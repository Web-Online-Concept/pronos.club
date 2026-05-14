// src/lib/over-05-buts-equipes/run-analysis-job.ts
//
// Logique du job d'analyse extraite en fonction reutilisable.
// Utilise par :
//  - /api/over-05/analyze (via after())
//  - /api/over-05/internal/run-analysis (via HTTP, pour debug et test direct)
//
// VERSION 3 — pipeline complet :
//   1. Charger la session d'analyse + le championnat
//   2. Verifier que tous les championnats ont PROJETS
//   3. Fetch les fixtures de la plage de dates via API-Football
//   4. Pour chaque fixture :
//      a) Resoudre les team_id home/away (creer si absents)
//      b) Charger les PROJETS des 2 equipes
//      c) Identifier le favori intrinseque (favori-resolver)
//      d) Recuperer les stats des 3 derniers matchs de la cible (Understat)
//      e) Recuperer les stats defensives des 3 derniers matchs de l'adv (Understat)
//      f) Calculer les scores (scoring-engine)
//      g) Inserer le resultat complet en DB
//   5. Marquer status='completed'

import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  getO05FixturesByDateRange,
  type O05Fixture,
} from "./apifootball-fixtures";
import { getCurrentApiFootballSeason } from "./season-helper";
import { apiFootballToDbName, normalizeTeamName } from "./team-mapping";
import { resolveFavoriIntrinseque, computeProjectBonus } from "./favori-resolver";
import { fetchTeamStatsUnderstat } from "./stats-aggregator";
import { computeScoring } from "./scoring-engine";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// ─── Types ────────────────────────────────────────────────────────

export type RunAnalysisResult = {
  ok: boolean;
  analysis_id: string;
  total_matches?: number;
  matches_analyzed?: number;
  matches_failed?: number;
  reason?: string;
};

type TeamWithProject = {
  team_id: number;
  team_name: string;
  name_normalized: string;
  current_rank: number | null;
  avg_rank_historical: number | null;
  category: string | null;
  project_bonus: number;
};


// ─── Helper resolution equipe ─────────────────────────────────────

async function resolveTeamWithProject(
  leagueId: number,
  apiFootballTeamId: number,
  apiFootballTeamName: string
): Promise<TeamWithProject | null> {
  const dbNormalizedName = apiFootballToDbName(apiFootballTeamName);

  let { data: team } = await supabaseAdmin
    .from("o05_teams")
    .select("id, name, name_normalized, api_football_id")
    .eq("league_id", leagueId)
    .eq("api_football_id", apiFootballTeamId)
    .maybeSingle();

  if (!team) {
    const { data: teamByName } = await supabaseAdmin
      .from("o05_teams")
      .select("id, name, name_normalized, api_football_id")
      .eq("league_id", leagueId)
      .eq("name_normalized", dbNormalizedName)
      .maybeSingle();
    team = teamByName;

    if (team && !team.api_football_id) {
      await supabaseAdmin
        .from("o05_teams")
        .update({ api_football_id: apiFootballTeamId })
        .eq("id", team.id);
    }
  }

  if (!team) {
    const { data: created, error } = await supabaseAdmin
      .from("o05_teams")
      .insert({
        league_id: leagueId,
        name: apiFootballTeamName,
        name_normalized: normalizeTeamName(apiFootballTeamName),
        api_football_id: apiFootballTeamId,
      })
      .select("id, name, name_normalized")
      .single();

    if (error || !created) {
      console.error(
        `[run-analysis-job] Failed to create team ${apiFootballTeamName}:`,
        error?.message
      );
      return null;
    }
    return {
      team_id: created.id,
      team_name: created.name,
      name_normalized: created.name_normalized,
      current_rank: null,
      avg_rank_historical: null,
      category: null,
      project_bonus: 0,
    };
  }

  const { data: project } = await supabaseAdmin
    .from("o05_projects")
    .select("current_rank, avg_rank_historical, category")
    .eq("team_id", team.id)
    .maybeSingle();

  const project_bonus = project
    ? computeProjectBonus(project.current_rank, project.avg_rank_historical)
    : 0;

  return {
    team_id: team.id,
    team_name: team.name,
    name_normalized: team.name_normalized,
    current_rank: project?.current_rank ?? null,
    avg_rank_historical: project?.avg_rank_historical ?? null,
    category: project?.category ?? null,
    project_bonus,
  };
}


// ─── Helpers DB ──────────────────────────────────────────────────

async function markFailed(analysisId: string, errorMessage: string) {
  await supabaseAdmin
    .from("o05_analyses")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);
}

async function updateProgress(
  analysisId: string,
  analyzed: number,
  failed: number
) {
  await supabaseAdmin
    .from("o05_analyses")
    .update({
      matches_analyzed: analyzed,
      matches_failed: failed,
    })
    .eq("id", analysisId);
}

async function insertFailedMatch(
  analysisId: string,
  fixture: O05Fixture,
  homeTeamId: number,
  awayTeamId: number,
  errorMessage: string,
  targetTeamId?: number,
  targetRole?: "home" | "away"
) {
  await supabaseAdmin.from("o05_match_analyses").insert({
    analysis_id: analysisId,
    api_football_fixture_id: fixture.fixture.id,
    match_date: fixture.fixture.date,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    target_team_id: targetTeamId ?? homeTeamId,
    target_role: targetRole ?? "home",
    data_quality: "missing",
    error_message: errorMessage,
  });
}


// ─── Fonction principale exportee ─────────────────────────────────

/**
 * Execute le job d'analyse pour une session donnée.
 * Cette fonction peut etre appelee directement (pas via fetch HTTP).
 *
 * @param analysisId UUID de l'analyse a executer
 */
export async function runAnalysisJob(
  analysisId: string
): Promise<RunAnalysisResult> {
  // Charger l'analyse
  const { data: analysis, error: analysisErr } = await supabaseAdmin
    .from("o05_analyses")
    .select("id, league_id, date_from, date_to, status")
    .eq("id", analysisId)
    .single();

  if (analysisErr || !analysis) {
    throw new Error(`Analysis ${analysisId} not found`);
  }

  if (analysis.status !== "pending") {
    return {
      ok: false,
      analysis_id: analysisId,
      reason: `Analysis already in status '${analysis.status}'`,
    };
  }

  // Charger le championnat
  const { data: league } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, api_football_id, name, xg_source, is_top5, understat_slug")
    .eq("id", analysis.league_id)
    .single();

  if (!league) {
    await markFailed(analysisId, "League not found");
    throw new Error("League not found");
  }

  // ─── Validation : PROJETS seedes ? ───
  const { data: teamsInLeague } = await supabaseAdmin
    .from("o05_teams")
    .select("id")
    .eq("league_id", league.id);

  const teamIdsInLeague = teamsInLeague?.map((t) => t.id) ?? [];

  let projectCount = 0;
  if (teamIdsInLeague.length > 0) {
    const { count } = await supabaseAdmin
      .from("o05_projects")
      .select("id", { count: "exact", head: true })
      .in("team_id", teamIdsInLeague);
    projectCount = count ?? 0;
  }

  if (projectCount === 0) {
    await markFailed(
      analysisId,
      `Le championnat "${league.name}" n'a pas de PROJETS seedes en DB.`
    );
    throw new Error("PROJETS missing");
  }

  // ─── Validation : Understat couvre ce championnat ? ───
  if (league.xg_source !== "understat") {
    await markFailed(
      analysisId,
      `Le championnat "${league.name}" utilise ${league.xg_source} comme source xG. ` +
      `Seul Understat est supporte (5 grands championnats). Phase 5 ajoutera API-Football.`
    );
    throw new Error("Source xG non supportee");
  }

  // Passer en running
  await supabaseAdmin
    .from("o05_analyses")
    .update({ status: "running" })
    .eq("id", analysisId);

  // Recuperer les fixtures
  const currentSeason = getCurrentApiFootballSeason();
  let fixtures: O05Fixture[];
  try {
    fixtures = await getO05FixturesByDateRange(
      league.api_football_id,
      currentSeason,
      analysis.date_from,
      analysis.date_to
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    await markFailed(analysisId, `API-Football error: ${msg}`);
    throw err;
  }

  await supabaseAdmin
    .from("o05_analyses")
    .update({ total_matches: fixtures.length })
    .eq("id", analysisId);

  // ─── Pre-charger les categories ───
  const { data: allLeagueTeams } = await supabaseAdmin
    .from("o05_teams")
    .select("name, o05_projects(category)")
    .eq("league_id", league.id);

  const opponentCategories = new Map<string, string | null>();
  if (allLeagueTeams) {
    for (const t of allLeagueTeams) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cat = ((t.o05_projects as any[])?.[0]?.category) ?? null;
      opponentCategories.set(t.name, cat);
      opponentCategories.set(normalizeTeamName(t.name), cat);
    }
  }

  // ─── Pour chaque fixture ───
  let analyzedCount = 0;
  let failedCount = 0;

  for (const fixture of fixtures) {
    try {
      const homeTeam = await resolveTeamWithProject(
        league.id,
        fixture.teams.home.id,
        fixture.teams.home.name
      );
      const awayTeam = await resolveTeamWithProject(
        league.id,
        fixture.teams.away.id,
        fixture.teams.away.name
      );

      if (!homeTeam || !awayTeam) {
        await insertFailedMatch(
          analysisId,
          fixture,
          homeTeam?.team_id ?? 0,
          awayTeam?.team_id ?? 0,
          "Failed to resolve teams"
        );
        failedCount++;
        await updateProgress(analysisId, analyzedCount, failedCount);
        continue;
      }

      const favori = resolveFavoriIntrinseque({
        home_team_id: homeTeam.team_id,
        away_team_id: awayTeam.team_id,
        home_project: homeTeam.category
          ? {
              category: homeTeam.category as
                | "ELITE" | "EUROPE" | "AMBITIEUX" | "MILIEU" | "MAINTIEN",
              avg_rank_historical: homeTeam.avg_rank_historical,
            }
          : null,
        away_project: awayTeam.category
          ? {
              category: awayTeam.category as
                | "ELITE" | "EUROPE" | "AMBITIEUX" | "MILIEU" | "MAINTIEN",
              avg_rank_historical: awayTeam.avg_rank_historical,
            }
          : null,
      });

      const target = favori.target_role === "home" ? homeTeam : awayTeam;
      const opponent = favori.target_role === "home" ? awayTeam : homeTeam;
      const matchDate = new Date(fixture.fixture.date);

      const targetStats = await fetchTeamStatsUnderstat(
        target.name_normalized,
        currentSeason,
        matchDate,
        opponentCategories,
        3
      );

      const opponentStats = await fetchTeamStatsUnderstat(
        opponent.name_normalized,
        currentSeason,
        matchDate,
        opponentCategories,
        3
      );

      if (
        targetStats.data_quality === "missing" &&
        opponentStats.data_quality === "missing"
      ) {
        await insertFailedMatch(
          analysisId,
          fixture,
          homeTeam.team_id,
          awayTeam.team_id,
          `Stats Understat indisponibles : ${[
            ...targetStats.errors,
            ...opponentStats.errors,
          ].join(" | ")}`,
          target.team_id,
          favori.target_role
        );
        failedCount++;
        await updateProgress(analysisId, analyzedCount, failedCount);
        continue;
      }

      const attack_bonus_projet = target.project_bonus;
      const defense_bonus_projet = opponent.project_bonus;

      const scoring = computeScoring(
        targetStats.attack,
        opponentStats.defense,
        favori.target_role,
        attack_bonus_projet,
        defense_bonus_projet
      );

      let data_quality: "complete" | "partial" | "missing" = "complete";
      if (
        targetStats.data_quality === "missing" ||
        opponentStats.data_quality === "missing"
      )
        data_quality = "missing";
      else if (
        targetStats.data_quality === "partial" ||
        opponentStats.data_quality === "partial"
      )
        data_quality = "partial";

      const { error: insertErr } = await supabaseAdmin
        .from("o05_match_analyses")
        .insert({
          analysis_id: analysisId,
          api_football_fixture_id: fixture.fixture.id,
          match_date: fixture.fixture.date,
          home_team_id: homeTeam.team_id,
          away_team_id: awayTeam.team_id,
          target_team_id: target.team_id,
          target_role: favori.target_role,
          attack_xg_weighted: targetStats.attack.xg_weighted,
          attack_tc_weighted: targetStats.attack.tc_weighted,
          attack_go_weighted: targetStats.attack.go_weighted,
          attack_goals_weighted: targetStats.attack.goals_weighted,
          attack_efficiency:
            targetStats.attack.xg_weighted > 0
              ? Math.round(
                  (targetStats.attack.goals_weighted /
                    targetStats.attack.xg_weighted) *
                    100
                ) / 100
              : null,
          attack_score: scoring.attack_score,
          attack_bonus_projet,
          defense_xgc_weighted: opponentStats.defense.xgc_weighted,
          defense_tc_subis_weighted: opponentStats.defense.tc_subis_weighted,
          defense_go_conceded_weighted:
            opponentStats.defense.go_conceded_weighted,
          defense_goals_conceded_weighted:
            opponentStats.defense.goals_conceded_weighted,
          defense_clean_sheets: opponentStats.defense.clean_sheets,
          defense_score: scoring.defense_score,
          defense_bonus_projet,
          matchup_bonus: scoring.matchup_bonus,
          home_bonus: scoring.home_bonus,
          closed_match_malus: scoring.closed_match_malus,
          total_score: scoring.total_score,
          note_10: scoring.note_10,
          verdict: scoring.verdict,
          data_source: "understat",
          data_quality,
          raw_data: {
            favori_reason: favori.reason,
            target_matches: targetStats.raw_matches,
            opponent_matches: opponentStats.raw_matches,
            attack_breakdown: scoring.attack_breakdown,
            defense_breakdown: scoring.defense_breakdown,
            errors: [...targetStats.errors, ...opponentStats.errors],
          },
        });

      if (insertErr) {
        console.error(`[run-analysis-job] Insert match error:`, insertErr.message);
        failedCount++;
      } else {
        analyzedCount++;
      }

      await updateProgress(analysisId, analyzedCount, failedCount);
    } catch (err) {
      console.error(
        `[run-analysis-job] Fatal error on fixture ${fixture.fixture.id}:`,
        err instanceof Error ? err.message : err
      );
      failedCount++;
      await updateProgress(analysisId, analyzedCount, failedCount);
    }
  }

  // Finaliser
  await supabaseAdmin
    .from("o05_analyses")
    .update({
      status: "completed",
      matches_analyzed: analyzedCount,
      matches_failed: failedCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  return {
    ok: true,
    analysis_id: analysisId,
    total_matches: fixtures.length,
    matches_analyzed: analyzedCount,
    matches_failed: failedCount,
  };
}