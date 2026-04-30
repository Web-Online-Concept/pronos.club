// src/app/api/over-05-buts-equipes/results/route.ts
//
// API pour le suivi des paris joues par Bertrand/Florent :
//   - POST : enregistre un nouveau pari joue (lie a une opportunite)
//   - GET  : liste les paris du user connecte avec stats agregees
//   - PATCH: met a jour le resultat (won/lost) apres le match
//
// Auth : whitelist O05

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";

export const dynamic = "force-dynamic";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const requireO05User = async (): Promise<{ email: string } | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isO05Authorized(user.email)) return null;
  return { email: user.email };
};


// ─── POST : enregistre un pari joue ────────────────────────────────


export async function POST(req: NextRequest) {
  const user = await requireO05User();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    opportunity_id?: string;
    stake_amount?: number;
    odds?: number;
    user_notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.opportunity_id) {
    return NextResponse.json({ error: "Missing opportunity_id" }, { status: 400 });
  }

  if (!body.stake_amount || body.stake_amount <= 0) {
    return NextResponse.json({ error: "Invalid stake_amount" }, { status: 400 });
  }

  if (!body.odds || body.odds < 1.01) {
    return NextResponse.json({ error: "Invalid odds (must be >= 1.01)" }, { status: 400 });
  }

  // Insert le resultat (en pending par defaut)
  const { data, error } = await supabaseAdmin
    .from("o05_results")
    .insert({
      opportunity_id: body.opportunity_id,
      user_email: user.email,
      played: true,
      stake_amount: body.stake_amount,
      odds: body.odds,
      result: "pending",
      profit: null,
      target_team_scored: null,
      user_notes: body.user_notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("[o05 results] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update aussi la decision sur l'opportunite
  await supabaseAdmin
    .from("o05_opportunities")
    .update({
      bertrand_decision: "play",
      bertrand_decided_at: new Date().toISOString(),
    })
    .eq("id", body.opportunity_id);

  return NextResponse.json({ result: data });
}


// ─── GET : liste des paris du user + stats ────────────────────────


export async function GET(req: NextRequest) {
  const user = await requireO05User();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "all"; // all | pending | won | lost

  let query = supabaseAdmin
    .from("o05_results")
    .select(`
      *,
      o05_opportunities:opportunity_id(
        id, target_team_name, opponent_team_name, match_date, badge, total_score,
        league_id, o05_leagues:league_id(name, country)
      )
    `)
    .eq("user_email", user.email);

  if (filter !== "all") {
    query = query.eq("result", filter);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("[o05 results] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calcul des stats agregees
  const allResults = data ?? [];
  const won = allResults.filter((r) => r.result === "won").length;
  const lost = allResults.filter((r) => r.result === "lost").length;
  const pending = allResults.filter((r) => r.result === "pending").length;
  const totalStaked = allResults
    .filter((r) => r.result !== "pending")
    .reduce((sum, r) => sum + Number(r.stake_amount ?? 0), 0);
  const totalProfit = allResults
    .filter((r) => r.result !== "pending")
    .reduce((sum, r) => sum + Number(r.profit ?? 0), 0);
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const roi = totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 10000) / 100 : 0;

  return NextResponse.json({
    results: allResults,
    stats: {
      total_bets: allResults.length,
      won,
      lost,
      pending,
      win_rate_pct: winRate,
      total_staked: Math.round(totalStaked * 100) / 100,
      total_profit: Math.round(totalProfit * 100) / 100,
      roi_pct: roi,
    },
  });
}


// ─── PATCH : update result apres match ────────────────────────────


export async function PATCH(req: NextRequest) {
  const user = await requireO05User();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    result_id?: string;
    target_team_scored?: boolean;
    user_notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.result_id) {
    return NextResponse.json({ error: "Missing result_id" }, { status: 400 });
  }

  if (body.target_team_scored === undefined) {
    return NextResponse.json({ error: "Missing target_team_scored" }, { status: 400 });
  }

  // Recuperer le pari pour calculer le profit
  const { data: existingResult, error: fetchErr } = await supabaseAdmin
    .from("o05_results")
    .select("stake_amount, odds, user_email")
    .eq("id", body.result_id)
    .single();

  if (fetchErr || !existingResult) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }

  if (existingResult.user_email !== user.email) {
    return NextResponse.json({ error: "Not your bet" }, { status: 403 });
  }

  // Calcul profit : si target a marque -> won (gain = stake * (odds - 1))
  //                 sinon -> lost (perte = stake)
  const stake = Number(existingResult.stake_amount ?? 0);
  const odds = Number(existingResult.odds ?? 0);
  const result = body.target_team_scored ? "won" : "lost";
  const profit = body.target_team_scored
    ? Math.round(stake * (odds - 1) * 100) / 100
    : -stake;

  const { data, error } = await supabaseAdmin
    .from("o05_results")
    .update({
      target_team_scored: body.target_team_scored,
      result,
      profit,
      user_notes: body.user_notes ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.result_id)
    .select()
    .single();

  if (error) {
    console.error("[o05 results] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ result: data });
}