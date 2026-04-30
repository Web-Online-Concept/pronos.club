// src/app/api/cron/over-05-buts-equipes-detect/route.ts
//
// Cron quotidien O05 : detecte les opportunites de paris "+0.5 but equipe"
// pour les 48h a venir, dans les 14 championnats configures.
//
// Schedule Vercel : 0 5 * * * (5h UTC = 6h Paris en hiver, 7h Paris en ete)
//
// Auth : CRON_SECRET (Vercel) ou x-admin-email pour test manuel
//
// Pipeline :
//   1. Refresh score_s1 de toutes les equipes (14 calls)
//   2. Pour chaque championnat : fetch standings + detect stakes (deja fetch)
//   3. Pour chaque championnat : fetch fixtures 48h a venir (14 calls)
//   4. Pour chaque match candidat : analyse + scoring + badge
//   5. Persist dans o05_opportunities + log dans o05_cron_logs

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import {
  getO05Standings,
  type O05StandingTeam,
} from "@/lib/over-05-buts-equipes/apifootball-standings";
import {
  getO05FixturesByDateRange,
  getO05TeamLastFixtures,
  isO05FixtureFinished,
  type O05Fixture,
} from "@/lib/over-05-buts-equipes/apifootball-fixtures";
import { refreshCurrentSeasonScores } from "@/lib/over-05-buts-equipes/refresh-current-season";
import { getCurrentApiFootballSeason } from "@/lib/over-05-buts-equipes/compute-intrinsics";
import {
  detectStakesAllLeagues,
  type LeagueWithRules,
  type StakeInfo,
} from "@/lib/over-05-buts-equipes/detect-stakes";
import {
  analyzeOpportunity,
  type OpportunityCandidate,
  type OpportunityResult,
} from "@/lib/over-05-buts-equipes/detect-opportunities";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// ─── Auth ──────────────────────────────────────────────────────────


const isAuthorized = (req: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET;

  // Mode 1 : Bearer CRON_SECRET (Vercel cron)
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // Mode 2 : signature Vercel cron
  const vercelSignature = req.headers.get("x-vercel-cron-signature");
  if (vercelSignature) return true;

  // Mode 3 : header x-admin-email (test manuel PowerShell)
  const adminEmail = req.headers.get("x-admin-email");
  if (
    adminEmail &&
    adminEmail.toLowerCase() === "flotoulouse7@gmail.com"
  ) {
    return true;
  }

  return false;
};


// ─── Helpers de date ───────────────────────────────────────────────


const formatDate = (date: Date): string => {
  // YYYY-MM-DD
  return date.toISOString().split("T")[0];
};


// ─── Helper de fetch des derniers matchs avec cache ────────────────


const buildFetchOpponentLast5 = (cache: Map<number, O05Fixture[]>) => {
  return async (teamId: number): Promise<O05Fixture[]> => {
    if (cache.has(teamId)) return cache.get(teamId)!;
    try {
      const fixtures = await getO05TeamLastFixtures(teamId, 10);
      // On garde les 10 derniers car on filtrera par "termines" et on a besoin de 5 finis
      cache.set(teamId, fixtures);
      return fixtures;
    } catch (err) {
      console.warn(
        `[o05-cron] Failed to fetch last fixtures for team ${teamId}:`,
        err instanceof Error ? err.message : err
      );
      cache.set(teamId, []);
      return [];
    }
  };
};


// ─── Pipeline principal ───────────────────────────────────────────


export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const runDate = formatDate(new Date());
  const currentSeason = getCurrentApiFootballSeason();

  // Initialiser le log cron
  const { data: logRow } = await supabaseAdmin
    .from("o05_cron_logs")
    .upsert(
      { run_date: runDate, started_at: new Date().toISOString(), status: "running" },
      { onConflict: "run_date" }
    )
    .select()
    .single();

  const stats = {
    fixtures_scanned: 0,
    opportunities_detected: 0,
    opportunities_green: 0,
    opportunities_orange: 0,
    opportunities_red: 0,
    api_calls_used: 0,
    errors: [] as string[],
  };

  try {
    // ─── 1. Refresh score_s1 ────────────────────────────────────
    console.log("[o05-cron] Step 1: refresh current season scores");
    const refreshReport = await refreshCurrentSeasonScores();
    stats.api_calls_used += refreshReport.api_calls_used;
    if (refreshReport.total_errors > 0) {
      stats.errors.push(`Refresh: ${refreshReport.total_errors} errors`);
    }

    // ─── 2. Charger championnats + intrinseques + standings ─────
    console.log("[o05-cron] Step 2: load leagues + intrinsics + standings");
    const { data: leagues, error: leaguesErr } = await supabaseAdmin
      .from("o05_leagues")
      .select("*")
      .eq("active", true)
      .order("id");

    if (leaguesErr || !leagues) {
      throw new Error(`Cannot load leagues: ${leaguesErr?.message}`);
    }

    const { data: intrinsics } = await supabaseAdmin
      .from("o05_intrinsic_levels")
      .select("team_id, intrinsic_average, current_league_id")
      .eq("computed_for_season", currentSeason);

    const intrinsicMap = new Map<number, number>();
    for (const row of intrinsics ?? []) {
      intrinsicMap.set(row.team_id, Number(row.intrinsic_average));
    }

    // Fetch standings actuels (deja fetch par refresh, on les re-fetch ici car
    // refreshCurrentSeasonScores ne les retourne pas. Cout : 14 calls supplementaires)
    // Optimisation possible plus tard : faire en sorte que refresh retourne les standings.
    const standingsByLeague = new Map<number, O05StandingTeam[]>();
    for (const league of leagues) {
      try {
        const standings = await getO05Standings(league.id, currentSeason);
        if (standings) {
          standingsByLeague.set(league.id, standings);
          stats.api_calls_used++;
        }
      } catch (err) {
        stats.errors.push(`Standings ${league.name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    // ─── 3. Detection des enjeux (Module 1) ─────────────────────
    console.log("[o05-cron] Step 3: detect stakes");
    const stakesMap = detectStakesAllLeagues(
      standingsByLeague,
      leagues as LeagueWithRules[],
      intrinsicMap
    );
    console.log(`[o05-cron] ${stakesMap.size} teams with stakes detected`);

    // ─── 4. Fetch fixtures des 48h a venir ──────────────────────
    console.log("[o05-cron] Step 4: fetch upcoming fixtures");
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const fromDate = formatDate(now);
    const toDate = formatDate(in48h);

    const allFixtures: { fixture: O05Fixture; league_id: number }[] = [];
    for (const league of leagues) {
      try {
        const fixtures = await getO05FixturesByDateRange(
          league.id,
          currentSeason,
          fromDate,
          toDate
        );
        stats.api_calls_used++;
        for (const f of fixtures) {
          // Garder uniquement les fixtures NON commences (NS = Not Started)
          if (f.fixture.status.short === "NS" || f.fixture.status.short === "TBD") {
            allFixtures.push({ fixture: f, league_id: league.id });
          }
        }
      } catch (err) {
        stats.errors.push(`Fixtures ${league.name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }
    stats.fixtures_scanned = allFixtures.length;
    console.log(`[o05-cron] ${allFixtures.length} fixtures to scan in 48h`);

    // ─── 5. Analyse de chaque match candidat ────────────────────
    console.log("[o05-cron] Step 5: analyze candidates");

    const lastFixturesCache = new Map<number, O05Fixture[]>();
    const pts5Cache = new Map<number, number>();
    const fetchOpponentLast5 = buildFetchOpponentLast5(lastFixturesCache);

    const opportunities: OpportunityResult[] = [];

    for (const { fixture, league_id } of allFixtures) {
      const homeId = fixture.teams.home.id;
      const awayId = fixture.teams.away.id;

      const homeIntrinsic = intrinsicMap.get(homeId);
      const awayIntrinsic = intrinsicMap.get(awayId);

      if (homeIntrinsic === undefined || awayIntrinsic === undefined) {
        // Equipe sans niveau intrinseque calcule -> SKIP
        continue;
      }

      const candidate: OpportunityCandidate = {
        fixture_id: fixture.fixture.id,
        league_id,
        season: fixture.league.season,
        match_date: fixture.fixture.date,
        home_team_id: homeId,
        home_team_name: fixture.teams.home.name,
        away_team_id: awayId,
        away_team_name: fixture.teams.away.name,
        home_intrinsic: homeIntrinsic,
        away_intrinsic: awayIntrinsic,
      };

      try {
        const result = await analyzeOpportunity(
          candidate,
          stakesMap,
          intrinsicMap,
          pts5Cache,
          fetchOpponentLast5
        );

        if (result) {
          opportunities.push(result);
          stats.opportunities_detected++;
          if (result.badge === "green") stats.opportunities_green++;
          else if (result.badge === "orange") stats.opportunities_orange++;
          else stats.opportunities_red++;
        }
      } catch (err) {
        stats.errors.push(
          `Analyze ${candidate.home_team_name} vs ${candidate.away_team_name}: ${err instanceof Error ? err.message : "error"}`
        );
      }
    }

    // Compter les API calls reels via le cache
    stats.api_calls_used += lastFixturesCache.size;

    // ─── 6. Persist les opportunites ────────────────────────────
    console.log(`[o05-cron] Step 6: persist ${opportunities.length} opportunities`);
    for (const opp of opportunities) {
      const { error: insertErr } = await supabaseAdmin
        .from("o05_opportunities")
        .upsert(
          {
            fixture_id: opp.fixture_id,
            league_id: opp.league_id,
            season: opp.season,
            match_date: opp.match_date,
            home_team_id: opp.home_team_id,
            home_team_name: opp.home_team_name,
            away_team_id: opp.away_team_id,
            away_team_name: opp.away_team_name,
            target_team_id: opp.target_team_id,
            target_team_name: opp.target_team_name,
            target_role: opp.target_role,
            opponent_team_id: opp.opponent_team_id,
            opponent_team_name: opp.opponent_team_name,
            stake_score: opp.stake_score,
            stake_situations: opp.stake_situations,
            target_intrinsic: opp.target_intrinsic,
            opponent_intrinsic: opp.opponent_intrinsic,
            level_gap: opp.level_gap,
            level_gap_score: 0, // module 3 simplifie : 0 pour l'instant
            target_form_score: opp.score_favori,
            opponent_fragility_score: opp.score_outsider,
            target_anomalies: 0,
            opponent_anomalies: 0,
            excel_details: {
              outsider_details: opp.outsider_details,
              favori_details: opp.favori_details,
              anomalies_total: opp.anomalies_total,
            },
            advanced_stats: null,
            total_score: opp.total_score,
            badge: opp.badge,
            generation_batch: runDate,
            bertrand_decision: "pending",
          },
          { onConflict: "fixture_id,target_team_id,generation_batch" }
        );

      if (insertErr) {
        stats.errors.push(`Insert ${opp.target_team_name}: ${insertErr.message}`);
      }
    }

    // ─── 7. Update log cron ─────────────────────────────────────
    const durationMs = Date.now() - startedAt;
    await supabaseAdmin
      .from("o05_cron_logs")
      .update({
        finished_at: new Date().toISOString(),
        fixtures_scanned: stats.fixtures_scanned,
        opportunities_detected: stats.opportunities_detected,
        opportunities_green: stats.opportunities_green,
        opportunities_orange: stats.opportunities_orange,
        opportunities_red: stats.opportunities_red,
        api_calls_used: stats.api_calls_used,
        duration_ms: durationMs,
        errors: stats.errors.length > 0 ? stats.errors : null,
        status: "success",
      })
      .eq("run_date", runDate);

    return NextResponse.json({
      ok: true,
      run_date: runDate,
      duration_ms: durationMs,
      ...stats,
      stakes_detected: stakesMap.size,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[o05-cron] Fatal error:", err);

    await supabaseAdmin
      .from("o05_cron_logs")
      .update({
        finished_at: new Date().toISOString(),
        status: "failed",
        errors: [errMsg, ...stats.errors],
        duration_ms: Date.now() - startedAt,
      })
      .eq("run_date", runDate);

    return NextResponse.json(
      { error: errMsg, partial_stats: stats },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}