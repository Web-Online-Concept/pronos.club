// src/app/api/over-05/match/[match_id]/route.ts
//
// GET    /api/over-05/match/[match_id]
//   -> Detail complet d'un match analyse (page detail)
//
// PATCH  /api/over-05/match/[match_id]
//   -> Sauvegarde psycho_flags + psycho_notes pour ce match
//
// POST   /api/over-05/match/[match_id]
//   Body : { played: boolean, stake_amount?, odds? }
//   -> Enregistrer ou mettre a jour un pari pour ce match.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";

export const dynamic = "force-dynamic";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// ─── GET : detail d'un match ─────────────────────────────────────

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ match_id: string }> }
) {
  const { match_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Charger le match analysé avec toutes ses relations
  const { data: match, error } = await supabaseAdmin
    .from("o05_match_analyses")
    .select(`
      *,
      analysis:o05_analyses!o05_match_analyses_analysis_id_fkey(
        id, league_id, matchday_label, date_from, date_to, requested_by
      ),
      home_team:o05_teams!o05_match_analyses_home_team_id_fkey(id, name),
      away_team:o05_teams!o05_match_analyses_away_team_id_fkey(id, name),
      target_team:o05_teams!o05_match_analyses_target_team_id_fkey(id, name)
    `)
    .eq("id", match_id)
    .single();

  if (error || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Securite : seul le user qui a cree l'analyse peut voir le match
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisAny = match.analysis as any;
  if (analysisAny?.requested_by !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Charger les PROJETS des 2 equipes (pour affichage catégorie)
  const teamIds = [match.home_team_id, match.away_team_id];
  const { data: projects } = await supabaseAdmin
    .from("o05_projects")
    .select("team_id, category, avg_rank_historical, current_rank")
    .in("team_id", teamIds);

  const projectsByTeam: Record<number, unknown> = {};
  for (const p of projects ?? []) {
    projectsByTeam[p.team_id] = p;
  }

  // Charger le pari associe (si existe)
  const { data: bet } = await supabaseAdmin
    .from("o05_bets")
    .select("*")
    .eq("match_analysis_id", match_id)
    .eq("user_email", user.email)
    .maybeSingle();

  return NextResponse.json({
    match,
    projects: projectsByTeam,
    bet: bet ?? null,
  });
}


// ─── PATCH : sauvegarde psycho ───────────────────────────────────

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ match_id: string }> }
) {
  const { match_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { psycho_flags?: Record<string, boolean>; psycho_notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Verifier que le match existe et que l'analyse appartient au user
  const { data: match } = await supabaseAdmin
    .from("o05_match_analyses")
    .select("id, analysis:o05_analyses!o05_match_analyses_analysis_id_fkey(requested_by)")
    .eq("id", match_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisAny = match?.analysis as any;
  if (!match || analysisAny?.requested_by !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upsert dans o05_bets (qui contient les psycho_flags) — on cree le pari
  // si pas encore existant, avec played=false par defaut.
  const { data: existingBet } = await supabaseAdmin
    .from("o05_bets")
    .select("id")
    .eq("match_analysis_id", match_id)
    .eq("user_email", user.email)
    .maybeSingle();

  if (existingBet) {
    // UPDATE
    const { error: updateErr } = await supabaseAdmin
      .from("o05_bets")
      .update({
        psycho_flags: body.psycho_flags ?? {},
        psycho_notes: body.psycho_notes ?? null,
      })
      .eq("id", existingBet.id);

    if (updateErr) {
      return NextResponse.json(
        { error: "Update failed", details: updateErr.message },
        { status: 500 }
      );
    }
  } else {
    // INSERT placeholder bet (played=false)
    const { error: insertErr } = await supabaseAdmin
      .from("o05_bets")
      .insert({
        match_analysis_id: match_id,
        user_email: user.email,
        played: false,
        odds: 1.5,
        bet_status: "pending",
        psycho_flags: body.psycho_flags ?? {},
        psycho_notes: body.psycho_notes ?? null,
      });

    if (insertErr) {
      return NextResponse.json(
        { error: "Insert failed", details: insertErr.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}


// ─── POST : enregistrer un pari ──────────────────────────────────

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ match_id: string }> }
) {
  const { match_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    played: boolean;
    stake_amount?: number;
    odds?: number;
    bet_status?: "pending" | "won" | "lost";
    target_team_scored?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Verifier que le match existe
  const { data: match } = await supabaseAdmin
    .from("o05_match_analyses")
    .select("id, analysis:o05_analyses!o05_match_analyses_analysis_id_fkey(requested_by)")
    .eq("id", match_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analysisAny = match?.analysis as any;
  if (!match || analysisAny?.requested_by !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Calcul profit si le bet est resolu
  let profit: number | null = null;
  if (body.bet_status === "won" && body.stake_amount && body.odds) {
    profit = body.stake_amount * (body.odds - 1);
  } else if (body.bet_status === "lost" && body.stake_amount) {
    profit = -body.stake_amount;
  }

  const updates = {
    played: body.played,
    stake_amount: body.stake_amount ?? null,
    odds: body.odds ?? 1.5,
    bet_status: body.bet_status ?? "pending",
    target_team_scored: body.target_team_scored ?? null,
    profit,
    resolved_at:
      body.bet_status === "won" || body.bet_status === "lost"
        ? new Date().toISOString()
        : null,
  };

  // Upsert
  const { data: existingBet } = await supabaseAdmin
    .from("o05_bets")
    .select("id")
    .eq("match_analysis_id", match_id)
    .eq("user_email", user.email)
    .maybeSingle();

  if (existingBet) {
    const { error: updateErr } = await supabaseAdmin
      .from("o05_bets")
      .update(updates)
      .eq("id", existingBet.id);
    if (updateErr) {
      return NextResponse.json(
        { error: "Update failed", details: updateErr.message },
        { status: 500 }
      );
    }
  } else {
    const { error: insertErr } = await supabaseAdmin
      .from("o05_bets")
      .insert({
        match_analysis_id: match_id,
        user_email: user.email,
        ...updates,
      });
    if (insertErr) {
      return NextResponse.json(
        { error: "Insert failed", details: insertErr.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}