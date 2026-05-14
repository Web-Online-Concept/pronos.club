// src/lib/over-05-buts-equipes/stats-aggregator.ts
//
// VERSION 2 — supporte 2 sources de stats :
//  - Understat : Top 5 europeens (xG natif)
//  - API-Football : 9 championnats hors Top 5 (pas d'xG, on substitue par les buts)
//
// La fonction publique est fetchTeamStats() qui dispatche automatiquement
// selon le parametre xg_source du championnat. Les anciennes signatures
// (fetchTeamStatsUnderstat) sont conservees pour compatibilite avec les
// anciens appels.

import {
  getUnderstatTeamMatches,
  getUnderstatMatchShots,
  countBigChances,
  countShotsOnTarget,
  type UnderstatTeamMatch,
} from "./understat-service";
import {
  getApiFootballTeamLastMatches,
  type ApiFootballTeamMatch,
} from "./apifootball-team-stats-service";
import { getUnderstatSlug } from "./team-mapping";
import type { MatchStats, MatchDefenseStats, O05DataQuality } from "./types";


// ─── Pondérations (validées Q4) ──────────────────────────────────

const RECENCY_WEIGHTS = {
  M3: 1.5,  // match le plus récent
  M2: 1.2,
  M1: 1.0,  // match le moins récent (des 3)
};

const OPPONENT_LEVEL_COEFFS: Record<string, number> = {
  ELITE: 1.30,
  EUROPE: 1.15,
  AMBITIEUX: 1.00,
  MILIEU: 0.90,
  MAINTIEN: 0.80,
};

const getOpponentCoeff = (category: string | null | undefined): number => {
  if (!category) return 1.0;
  return OPPONENT_LEVEL_COEFFS[category] ?? 1.0;
};


// ─── Types intermediaires ────────────────────────────────────────

export type ProcessedMatch = {
  match_date: string;
  opponent_name: string;
  opponent_category: string | null;
  is_home: boolean;
  // Stats offensives
  xg_for: number;
  shots_on_target_for: number;
  big_chances_for: number;
  goals_for: number;
  // Stats defensives
  xg_against: number;
  shots_on_target_against: number;
  big_chances_against: number;
  goals_against: number;
  // Resultat
  clean_sheet: boolean;
};

export type TeamStatsResult = {
  attack: MatchStats;
  defense: MatchDefenseStats;
  raw_matches: ProcessedMatch[];
  data_quality: O05DataQuality;
  errors: string[];
};


// ─── Dispatcher public ───────────────────────────────────────────

/**
 * Recupere les stats agregees d'une equipe.
 * Dispatche automatiquement vers Understat ou API-Football selon xg_source.
 *
 * @param dbNormalizedName  name_normalized de l'equipe
 * @param apiFootballTeamId ID API-Football de l'equipe (requis pour apifootball)
 * @param year              annee de saison (ex: 2025)
 * @param beforeDate        date avant laquelle filtrer
 * @param opponentCategories Map (opponent_name -> category PROJET)
 * @param xgSource          'understat' ou 'apifootball'
 * @param N                 nombre de matchs voulus (defaut 3)
 */
export const fetchTeamStats = async (
  dbNormalizedName: string,
  apiFootballTeamId: number | null,
  year: number,
  beforeDate: Date,
  opponentCategories: Map<string, string | null>,
  xgSource: "understat" | "apifootball",
  N: number = 3
): Promise<TeamStatsResult> => {
  if (xgSource === "understat") {
    return fetchTeamStatsUnderstat(
      dbNormalizedName,
      year,
      beforeDate,
      opponentCategories,
      N
    );
  } else {
    if (apiFootballTeamId === null) {
      return emptyResult([
        `Pas d'api_football_id pour ${dbNormalizedName}, impossible d'utiliser API-Football`,
      ]);
    }
    return fetchTeamStatsApiFootball(
      apiFootballTeamId,
      dbNormalizedName,
      year,
      beforeDate,
      opponentCategories,
      N
    );
  }
};


// ─── Source Understat (existant Phase 3, inchange) ───────────────

export const fetchTeamStatsUnderstat = async (
  dbNormalizedName: string,
  year: number,
  beforeDate: Date,
  opponentCategories: Map<string, string | null>,
  N: number = 3
): Promise<TeamStatsResult> => {
  const errors: string[] = [];
  const slug = getUnderstatSlug(dbNormalizedName);

  if (!slug) {
    return emptyResult([`No Understat slug for team ${dbNormalizedName}`]);
  }

  // 1. Récupérer tous les matchs de la saison
  let allMatches: UnderstatTeamMatch[];
  try {
    allMatches = await getUnderstatTeamMatches(slug, year);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return emptyResult([`Understat fetch failed for ${slug}/${year}: ${msg}`]);
  }

  // 2. Filtrer ceux AVANT beforeDate
  const beforeIso = beforeDate.toISOString().replace("T", " ").substring(0, 19);
  const pastMatches = allMatches.filter((m) => m.date < beforeIso);

  if (pastMatches.length === 0) {
    return emptyResult([`No past matches for ${slug} before ${beforeIso}`]);
  }

  const lastN = pastMatches.slice(0, N);

  // 3. Pour chaque match, fetcher les tirs detailles
  const processed: ProcessedMatch[] = [];
  for (const match of lastN) {
    try {
      const shots = await getUnderstatMatchShots(match.match_id);
      const isHome = match.is_home;

      const xg_for = isHome ? match.home_xg : match.away_xg;
      const goals_for = isHome ? match.home_goals : match.away_goals;
      const sot_for = countShotsOnTarget(shots, isHome);
      const bc_for = countBigChances(shots, isHome);

      const xg_against = isHome ? match.away_xg : match.home_xg;
      const goals_against = isHome ? match.away_goals : match.home_goals;
      const sot_against = countShotsOnTarget(shots, !isHome);
      const bc_against = countBigChances(shots, !isHome);

      const opponentName = isHome ? match.away_team : match.home_team;
      const opponentCategory = opponentCategories.get(opponentName) ?? null;

      processed.push({
        match_date: match.date,
        opponent_name: opponentName,
        opponent_category: opponentCategory,
        is_home: isHome,
        xg_for,
        shots_on_target_for: sot_for,
        big_chances_for: bc_for,
        goals_for,
        xg_against,
        shots_on_target_against: sot_against,
        big_chances_against: bc_against,
        goals_against,
        clean_sheet: goals_against === 0,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Match ${match.match_id} shots fetch failed: ${msg}`);
      const isHome = match.is_home;
      const opponentName = isHome ? match.away_team : match.home_team;
      processed.push({
        match_date: match.date,
        opponent_name: opponentName,
        opponent_category: opponentCategories.get(opponentName) ?? null,
        is_home: isHome,
        xg_for: isHome ? match.home_xg : match.away_xg,
        shots_on_target_for: 0,
        big_chances_for: 0,
        goals_for: isHome ? match.home_goals : match.away_goals,
        xg_against: isHome ? match.away_xg : match.home_xg,
        shots_on_target_against: 0,
        big_chances_against: 0,
        goals_against: isHome ? match.away_goals : match.home_goals,
        clean_sheet: (isHome ? match.away_goals : match.home_goals) === 0,
      });
    }
  }

  return computeWeightedStats(processed, errors, "understat");
};


// ─── Source API-Football (nouveau Phase 5) ───────────────────────

/**
 * Recupere les stats via API-Football (pas d'xG, substitution par les buts).
 *
 * SUBSTITUTIONS :
 *  - xg_for       -> goals_for (buts marques)
 *  - xg_against   -> goals_against (buts encaisses)
 *  - big_chances  -> heuristique : tirs cadres / 3 (approximation)
 *                   Justification : sur les Top 5, ratio BC/TC est ~30-40%
 */
export const fetchTeamStatsApiFootball = async (
  apiFootballTeamId: number,
  dbNormalizedName: string,
  year: number,
  beforeDate: Date,
  opponentCategories: Map<string, string | null>,
  N: number = 3
): Promise<TeamStatsResult> => {
  const errors: string[] = [];

  // 1. Recuperer les N derniers matchs avec stats
  const beforeDateStr = beforeDate.toISOString().substring(0, 10);

  let matches: ApiFootballTeamMatch[];
  try {
    matches = await getApiFootballTeamLastMatches(
      apiFootballTeamId,
      year,
      beforeDateStr,
      N
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return emptyResult([
      `API-Football fetch failed for team ${dbNormalizedName} (id ${apiFootballTeamId}): ${msg}`,
    ]);
  }

  if (matches.length === 0) {
    return emptyResult([
      `No past matches via API-Football for ${dbNormalizedName} before ${beforeDateStr}`,
    ]);
  }

  // 2. Transformer en ProcessedMatch (avec substitutions)
  const processed: ProcessedMatch[] = matches.map((m) => {
    const opponentName = m.is_home ? m.away_team_name : m.home_team_name;
    const opponentCategory =
      opponentCategories.get(opponentName) ??
      opponentCategories.get(opponentName.toLowerCase()) ??
      null;

    // SUBSTITUTIONS clés :
    //  - xg_for = goals_for (on n'a pas d'xG)
    //  - big_chances_for = shots_on_goal_for / 3 (heuristique)
    const big_chances_for_estimate = m.shots_on_goal_for / 3;
    const big_chances_against_estimate = m.shots_on_goal_against / 3;

    return {
      match_date: m.date,
      opponent_name: opponentName,
      opponent_category: opponentCategory,
      is_home: m.is_home,
      // OFFENSE
      xg_for: m.goals_for,                            // substitution
      shots_on_target_for: m.shots_on_goal_for,
      big_chances_for: round2(big_chances_for_estimate),
      goals_for: m.goals_for,
      // DEFENSE
      xg_against: m.goals_against,                    // substitution
      shots_on_target_against: m.shots_on_goal_against,
      big_chances_against: round2(big_chances_against_estimate),
      goals_against: m.goals_against,
      clean_sheet: m.goals_against === 0,
    };
  });

  return computeWeightedStats(processed, errors, "apifootball");
};


// ─── Compute weighted stats (commun aux 2 sources) ────────────────

const computeWeightedStats = (
  processed: ProcessedMatch[],
  errors: string[],
  source: "understat" | "apifootball"
): TeamStatsResult => {
  if (processed.length === 0) {
    return emptyResult(errors.length > 0 ? errors : ["No matches to compute"]);
  }

  const weights = [RECENCY_WEIGHTS.M3, RECENCY_WEIGHTS.M2, RECENCY_WEIGHTS.M1];

  let denominator = 0;
  let xg_for_sum = 0;
  let tc_for_sum = 0;
  let go_for_sum = 0;
  let goals_for_sum = 0;
  let xg_against_sum = 0;
  let tc_against_sum = 0;
  let go_against_sum = 0;
  let goals_against_sum = 0;
  let clean_sheets = 0;

  for (let i = 0; i < processed.length; i++) {
    const m = processed[i];
    const recencyWeight = weights[i] ?? 1.0;
    const oppCoeff = getOpponentCoeff(m.opponent_category);
    const w = recencyWeight * oppCoeff;
    denominator += w;

    xg_for_sum += m.xg_for * w;
    tc_for_sum += m.shots_on_target_for * w;
    go_for_sum += m.big_chances_for * w;
    goals_for_sum += m.goals_for * w;
    xg_against_sum += m.xg_against * w;
    tc_against_sum += m.shots_on_target_against * w;
    go_against_sum += m.big_chances_against * w;
    goals_against_sum += m.goals_against * w;
    if (m.clean_sheet) clean_sheets++;
  }

  if (denominator === 0) {
    return emptyResult([...errors, "Denominator zero in weighted stats"]);
  }

  const attack: MatchStats = {
    xg_weighted: round2(xg_for_sum / denominator),
    tc_weighted: round2(tc_for_sum / denominator),
    go_weighted: round2(go_for_sum / denominator),
    goals_weighted: round2(goals_for_sum / denominator),
    matches_count: processed.length,
  };

  const defense: MatchDefenseStats = {
    xgc_weighted: round2(xg_against_sum / denominator),
    tc_subis_weighted: round2(tc_against_sum / denominator),
    go_conceded_weighted: round2(go_against_sum / denominator),
    goals_conceded_weighted: round2(goals_against_sum / denominator),
    clean_sheets,
    matches_count: processed.length,
  };

  let data_quality: O05DataQuality = "complete";
  if (processed.length < 3) data_quality = "partial";
  if (errors.length > 0 && processed.length < 2) data_quality = "missing";
  if (errors.length > 0 && data_quality === "complete") data_quality = "partial";

  return {
    attack,
    defense,
    raw_matches: processed,
    data_quality,
    errors,
  };
};


// ─── Helpers ─────────────────────────────────────────────────────

const round2 = (n: number): number => Math.round(n * 100) / 100;

const emptyResult = (errors: string[]): TeamStatsResult => ({
  attack: {
    xg_weighted: 0,
    tc_weighted: 0,
    go_weighted: 0,
    goals_weighted: 0,
    matches_count: 0,
  },
  defense: {
    xgc_weighted: 0,
    tc_subis_weighted: 0,
    go_conceded_weighted: 0,
    goals_conceded_weighted: 0,
    clean_sheets: 0,
    matches_count: 0,
  },
  raw_matches: [],
  data_quality: "missing",
  errors,
});