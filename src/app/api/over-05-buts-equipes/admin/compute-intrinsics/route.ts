// src/app/api/over-05-buts-equipes/admin/compute-intrinsics/route.ts
//
// Route admin pour calculer les niveaux intrinseques de toutes les equipes
// des 14 championnats configures dans o05_leagues.
//
// Acces : Florent uniquement (whitelist O05 + flag admin recommande).
//
// Comportement :
//   1. Recupere la liste des championnats actifs depuis o05_leagues
//   2. Pour chaque championnat, fetch le standings de la saison en cours
//      pour identifier les equipes a calculer
//   3. Pour chaque equipe, calcule les 5 scores saisonniers + moyenne
//   4. Upsert dans o05_intrinsic_levels (sur cle (team_id, computed_for_season))
//
// Cache : un seul cache `standingsCache` partage entre toutes les equipes
//         pour eviter de re-fetch les memes (leagueId, season) plusieurs fois.
//
// Cout API estime : 14 championnats x 5 saisons = 70 calls API-Football
//                   (1 seul fetch par paire (leagueId, season) grace au cache)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";
import {
  getO05Standings,
  type O05StandingTeam,
} from "@/lib/over-05-buts-equipes/apifootball-standings";
import {
  computeTeamIntrinsic,
  getCurrentApiFootballSeason,
  type LeagueRef,
} from "@/lib/over-05-buts-equipes/compute-intrinsics";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (le calcul peut etre long)


const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


type ComputeReport = {
  ok: boolean;
  duration_ms: number;
  current_season: number;
  leagues_processed: Array<{
    league_id: number;
    league_name: string;
    teams_count: number;
    teams_processed: number;
    errors: number;
  }>;
  total_teams_processed: number;
  total_errors: number;
  api_calls_used: number;
  errors_detail?: Array<{ team_id: number; team_name: string; error: string }>;
};


export async function POST(req: NextRequest) {
  // Auth check : whitelist O05
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const currentSeason = getCurrentApiFootballSeason();

  // Cache partage : evite de re-fetch les memes standings 280 fois
  const standingsCache = new Map<string, O05StandingTeam[] | null>();
  let apiCallsCount = 0;

  // Helper : track les appels API via le cache
  const fetchWithCache = async (
    leagueId: number,
    season: number
  ): Promise<O05StandingTeam[] | null> => {
    const cacheKey = `${leagueId}_${season}`;
    if (standingsCache.has(cacheKey)) {
      return standingsCache.get(cacheKey) ?? null;
    }
    try {
      const standings = await getO05Standings(leagueId, season);
      standingsCache.set(cacheKey, standings);
      apiCallsCount++;
      return standings;
    } catch (err) {
      console.warn(
        `[compute-intrinsics] Fetch failed league=${leagueId} season=${season}:`,
        err instanceof Error ? err.message : err
      );
      standingsCache.set(cacheKey, null);
      apiCallsCount++;
      return null;
    }
  };

  // 1. Recuperer la liste des championnats actifs
  const { data: leagues, error: leaguesErr } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, name, country, division, current_season, total_teams")
    .eq("active", true)
    .order("id", { ascending: true });

  if (leaguesErr || !leagues) {
    return NextResponse.json(
      { error: "Impossible de charger les championnats", details: leaguesErr?.message },
      { status: 500 }
    );
  }

  const report: ComputeReport = {
    ok: true,
    duration_ms: 0,
    current_season: currentSeason,
    leagues_processed: [],
    total_teams_processed: 0,
    total_errors: 0,
    api_calls_used: 0,
    errors_detail: [],
  };

  // 2. Pour chaque championnat
  for (const league of leagues) {
    const leagueRef: LeagueRef = {
      id: league.id,
      name: league.name,
      country: league.country,
      division: league.division,
      total_teams: league.total_teams,
    };

    // 2a. Fetch le standings de la saison en cours pour identifier les equipes
    const currentStandings = await fetchWithCache(league.id, currentSeason);

    if (!currentStandings || currentStandings.length === 0) {
      console.warn(
        `[compute-intrinsics] No standings for league ${league.name} season ${currentSeason}, skipping`
      );
      report.leagues_processed.push({
        league_id: league.id,
        league_name: league.name,
        teams_count: 0,
        teams_processed: 0,
        errors: 0,
      });
      continue;
    }

    let teamsProcessed = 0;
    let errors = 0;

    // 2b. Pour chaque equipe du championnat
    for (const standingEntry of currentStandings) {
      try {
        // Calcul des 5 scores avec cache partage
        const intrinsicResult = await computeTeamIntrinsic(
          standingEntry.team.id,
          standingEntry.team.name,
          leagueRef,
          currentSeason,
          standingsCache
        );

        // Compter les appels API supplementaires faits par computeTeamIntrinsic
        // (le cache est partage donc tous les nouveaux fetch passent par fetchWithCache.
        //  Mais computeSeasonScore appelle directement getO05Standings via son
        //  helper interne. Je mets a jour apiCallsCount apres coup en comparant
        //  la taille du cache).
        // (deja gere par standingsCache.size implicitement)

        // 2c. Upsert dans o05_intrinsic_levels
        const insertData = {
          team_id: intrinsicResult.team_id,
          team_name: intrinsicResult.team_name,
          current_league_id: intrinsicResult.current_league_id,
          score_s1: intrinsicResult.scores.s1.score,
          score_s2: intrinsicResult.scores.s2.score,
          score_s3: intrinsicResult.scores.s3.score,
          score_s4: intrinsicResult.scores.s4.score,
          score_s5: intrinsicResult.scores.s5.score,
          intrinsic_average: intrinsicResult.intrinsic_average,
          computed_for_season: intrinsicResult.computed_for_season,
          s1_last_updated: new Date().toISOString(),
          last_computed_at: new Date().toISOString(),
        };

        const { error: upsertErr } = await supabaseAdmin
          .from("o05_intrinsic_levels")
          .upsert(insertData, {
            onConflict: "team_id,computed_for_season",
          });

        if (upsertErr) {
          errors++;
          report.errors_detail!.push({
            team_id: intrinsicResult.team_id,
            team_name: intrinsicResult.team_name,
            error: `DB: ${upsertErr.message}`,
          });
          console.error(
            `[compute-intrinsics] Upsert failed for ${intrinsicResult.team_name}:`,
            upsertErr.message
          );
          continue;
        }

        teamsProcessed++;
      } catch (err) {
        errors++;
        report.errors_detail!.push({
          team_id: standingEntry.team.id,
          team_name: standingEntry.team.name,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    report.leagues_processed.push({
      league_id: league.id,
      league_name: league.name,
      teams_count: currentStandings.length,
      teams_processed: teamsProcessed,
      errors,
    });

    report.total_teams_processed += teamsProcessed;
    report.total_errors += errors;
  }

  // Recompter les API calls reels (taille du cache - cache misses geres comme null)
  report.api_calls_used = standingsCache.size;
  report.duration_ms = Date.now() - startedAt;

  // Si pas d'erreurs critiques mais quelques erreurs equipes, on reste OK
  if (report.total_errors > 0 && report.total_teams_processed === 0) {
    report.ok = false;
  }

  return NextResponse.json(report);
}


// GET : pour preview/test rapide sans declencher le calcul
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Stats de la table
  const { count: totalRows } = await supabaseAdmin
    .from("o05_intrinsic_levels")
    .select("*", { count: "exact", head: true });

  const { data: leagues } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, name, current_season")
    .eq("active", true)
    .order("id");

  const currentSeason = getCurrentApiFootballSeason();

  return NextResponse.json({
    info: "Cette route POST recalcule les niveaux intrinseques de toutes les equipes (14 championnats x ~280 equipes)",
    current_season_calculated: currentSeason,
    leagues_active: leagues?.length ?? 0,
    teams_in_intrinsic_table: totalRows ?? 0,
    estimated_api_calls: 70,
    estimated_duration: "30 secondes a 2 minutes selon API-Football",
    usage: "POST avec session admin (flotoulouse7@gmail.com)",
  });
}