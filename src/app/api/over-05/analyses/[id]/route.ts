// src/app/api/over-05/analyses/[id]/route.ts
//
// GET /api/over-05/analyses/[id]
// → Retourne l'etat d'une analyse + ses resultats partiels au fur et à mesure
//   que le job background avance.
//
// Utilise en polling toutes les 3s par le frontend pendant qu'une analyse
// est "running".

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";

export const dynamic = "force-dynamic";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  // Next.js 16 : params est une Promise
  const { id } = await ctx.params;

  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Recuperer la session d'analyse
  const { data: analysis, error: analysisErr } = await supabaseAdmin
    .from("o05_analyses")
    .select(`
      id,
      league_id,
      matchday_label,
      date_from,
      date_to,
      total_matches,
      matches_analyzed,
      matches_failed,
      status,
      error_message,
      requested_by,
      created_at,
      completed_at
    `)
    .eq("id", id)
    .single();

  if (analysisErr || !analysis) {
    return NextResponse.json(
      { error: "Analysis not found" },
      { status: 404 }
    );
  }

  // Securite supplementaire : seul le user qui a cree l'analyse peut la voir
  if (analysis.requested_by !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Recuperer les match analyses deja calcules
  const { data: matchAnalyses } = await supabaseAdmin
    .from("o05_match_analyses")
    .select(`
      id,
      api_football_fixture_id,
      match_date,
      home_team_id,
      away_team_id,
      target_team_id,
      target_role,
      attack_xg_weighted,
      attack_tc_weighted,
      attack_go_weighted,
      attack_goals_weighted,
      attack_efficiency,
      attack_score,
      attack_bonus_projet,
      defense_xgc_weighted,
      defense_tc_subis_weighted,
      defense_go_conceded_weighted,
      defense_goals_conceded_weighted,
      defense_clean_sheets,
      defense_score,
      defense_bonus_projet,
      matchup_bonus,
      home_bonus,
      closed_match_malus,
      total_score,
      note_10,
      verdict,
      data_source,
      data_quality,
      error_message,
      created_at,
      home_team:o05_teams!o05_match_analyses_home_team_id_fkey(id, name),
      away_team:o05_teams!o05_match_analyses_away_team_id_fkey(id, name),
      target_team:o05_teams!o05_match_analyses_target_team_id_fkey(id, name)
    `)
    .eq("analysis_id", id)
    .order("note_10", { ascending: false, nullsFirst: false });

  return NextResponse.json({
    analysis,
    match_analyses: matchAnalyses ?? [],
  });
}