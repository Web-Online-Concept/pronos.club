// src/lib/over-05-buts-equipes/refresh-current-season.ts
//
// Refresh quotidien du score_s1 (saison en cours) pour toutes les equipes
// des 14 championnats actifs.
//
// Cette logique est appelee chaque matin par le cron de detection. Elle :
//   1. Pour chaque championnat actif, fetch le standings actuel (1 call)
//   2. Pour chaque equipe du standings, met a jour son score_s1 = rang/10
//   3. Recalcule la moyenne intrinsic_average a partir des 5 scores
//
// Cout API : 14 calls par jour (1 par championnat)
//
// IMPORTANT : si une equipe a ete promue/relegued en cours de saison
// (rare mais possible si refresh fait apres saison commencee), son
// current_league_id reste inchange ici. La table doit etre re-initialisee
// via /api/over-05-buts-equipes/admin/compute-intrinsics en debut de saison.

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getO05Standings, type O05StandingTeam } from "./apifootball-standings";
import { getCurrentApiFootballSeason } from "./compute-intrinsics";


const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export type RefreshReport = {
  ok: boolean;
  duration_ms: number;
  current_season: number;
  leagues_refreshed: Array<{
    league_id: number;
    league_name: string;
    teams_updated: number;
    errors: number;
  }>;
  total_teams_updated: number;
  total_errors: number;
  api_calls_used: number;
};


/**
 * Rafraichit score_s1 pour toutes les equipes des championnats actifs.
 *
 * @returns Rapport detaille du refresh
 */
export const refreshCurrentSeasonScores = async (): Promise<RefreshReport> => {
  const startedAt = Date.now();
  const currentSeason = getCurrentApiFootballSeason();
  let apiCalls = 0;

  const report: RefreshReport = {
    ok: true,
    duration_ms: 0,
    current_season: currentSeason,
    leagues_refreshed: [],
    total_teams_updated: 0,
    total_errors: 0,
    api_calls_used: 0,
  };

  // 1. Recuperer les championnats actifs
  const { data: leagues, error: leaguesErr } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, name")
    .eq("active", true)
    .order("id");

  if (leaguesErr || !leagues) {
    report.ok = false;
    report.duration_ms = Date.now() - startedAt;
    return report;
  }

  // 2. Pour chaque championnat, fetch le standings actuel
  for (const league of leagues) {
    let teamsUpdated = 0;
    let errors = 0;

    let standings: O05StandingTeam[] | null = null;
    try {
      standings = await getO05Standings(league.id, currentSeason);
      apiCalls++;
    } catch (err) {
      console.warn(
        `[refresh-current-season] Failed to fetch standings for league ${league.id}:`,
        err instanceof Error ? err.message : err
      );
      report.leagues_refreshed.push({
        league_id: league.id,
        league_name: league.name,
        teams_updated: 0,
        errors: 1,
      });
      report.total_errors++;
      continue;
    }

    if (!standings || standings.length === 0) {
      report.leagues_refreshed.push({
        league_id: league.id,
        league_name: league.name,
        teams_updated: 0,
        errors: 0,
      });
      continue;
    }

    // 3. Pour chaque equipe, update son score_s1 + recalcul moyenne
    for (const standing of standings) {
      try {
        // Charger les scores existants pour calculer la nouvelle moyenne
        const { data: existing, error: fetchErr } = await supabaseAdmin
          .from("o05_intrinsic_levels")
          .select("score_s2, score_s3, score_s4, score_s5")
          .eq("team_id", standing.team.id)
          .eq("computed_for_season", currentSeason)
          .single();

        if (fetchErr || !existing) {
          // L'equipe n'est pas dans la table : on saute (peut etre une nouvelle
          // equipe non geree). On ne cree pas d'entree "vide" ici, c'est le job
          // du compute-intrinsics initial.
          continue;
        }

        const newScoreS1 = standing.rank / 10;
        const sum =
          newScoreS1 +
          (existing.score_s2 ?? 40) +
          (existing.score_s3 ?? 40) +
          (existing.score_s4 ?? 40) +
          (existing.score_s5 ?? 40);
        const newAverage = Math.round((sum / 5) * 100) / 100;

        const { error: updateErr } = await supabaseAdmin
          .from("o05_intrinsic_levels")
          .update({
            score_s1: newScoreS1,
            intrinsic_average: newAverage,
            s1_last_updated: new Date().toISOString(),
          })
          .eq("team_id", standing.team.id)
          .eq("computed_for_season", currentSeason);

        if (updateErr) {
          errors++;
          console.error(
            `[refresh-current-season] Update failed for team ${standing.team.name}:`,
            updateErr.message
          );
          continue;
        }
        teamsUpdated++;
      } catch (err) {
        errors++;
      }
    }

    report.leagues_refreshed.push({
      league_id: league.id,
      league_name: league.name,
      teams_updated: teamsUpdated,
      errors,
    });
    report.total_teams_updated += teamsUpdated;
    report.total_errors += errors;
  }

  report.api_calls_used = apiCalls;
  report.duration_ms = Date.now() - startedAt;
  return report;
};