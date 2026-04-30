// src/app/api/over-05-buts-equipes/opportunities/route.ts
//
// API pour les opportunites O05 :
//   - GET  : liste les opportunites avec filtres (badge, league, date, decision)
//   - PATCH: met a jour la decision et les notes psycho d'une opportunite
//
// Auth : whitelist O05 (flotoulouse7@gmail.com + bertrandwebjob@yahoo.fr)

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


// ─── GET : liste filtree ──────────────────────────────────────────


export async function GET(req: NextRequest) {
  const user = await requireO05User();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const badge = searchParams.get("badge");
  const leagueId = searchParams.get("league_id");
  const date = searchParams.get("date");
  const decision = searchParams.get("decision");

  const today = new Date().toISOString().split("T")[0];
  const targetDate = date || today;

  let query = supabaseAdmin
    .from("o05_opportunities")
    .select(`
      id, fixture_id, league_id, season, match_date,
      home_team_id, home_team_name, away_team_id, away_team_name,
      target_team_id, target_team_name, target_role,
      opponent_team_id, opponent_team_name,
      stake_score, stake_situations,
      target_intrinsic, opponent_intrinsic, level_gap,
      target_form_score, opponent_fragility_score,
      total_score, badge,
      excel_details,
      psycho_notes, psycho_flags, bertrand_decision, bertrand_decided_at,
      detected_at, generation_batch,
      o05_leagues:league_id(name, country, division)
    `)
    .eq("generation_batch", targetDate);

  if (badge && badge !== "all") {
    query = query.eq("badge", badge);
  }

  if (leagueId) {
    query = query.eq("league_id", parseInt(leagueId, 10));
  }

  if (decision && decision !== "all") {
    if (decision === "pending") {
      query = query.or("bertrand_decision.is.null,bertrand_decision.eq.pending");
    } else {
      query = query.eq("bertrand_decision", decision);
    }
  }

  query = query.order("total_score", { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error("[o05 opportunities] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    date: targetDate,
    total: data?.length ?? 0,
    opportunities: data ?? [],
  });
}


// ─── PATCH : mise a jour decision/psycho ──────────────────────────


export async function PATCH(req: NextRequest) {
  const user = await requireO05User();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    opportunity_id?: string;
    psycho_notes?: string;
    psycho_flags?: Record<string, boolean>;
    bertrand_decision?: "play" | "skip" | "pending";
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.opportunity_id) {
    return NextResponse.json({ error: "Missing opportunity_id" }, { status: 400 });
  }

  if (body.bertrand_decision && !["play", "skip", "pending"].includes(body.bertrand_decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};
  if (body.psycho_notes !== undefined) updateData.psycho_notes = body.psycho_notes;
  if (body.psycho_flags !== undefined) updateData.psycho_flags = body.psycho_flags;
  if (body.bertrand_decision !== undefined) {
    updateData.bertrand_decision = body.bertrand_decision;
    updateData.bertrand_decided_at = new Date().toISOString();
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("o05_opportunities")
    .update(updateData)
    .eq("id", body.opportunity_id)
    .select()
    .single();

  if (error) {
    console.error("[o05 opportunities] PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ opportunity: data });
}