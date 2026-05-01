// src/lib/over-05-buts-equipes/detect-opportunities.ts
//
// Module 4 v4 — Detection des opportunites de pari "+0.5 but equipe"
//
// LOGIQUE v4 alignee sur message Bertrand 30/04/2026 + 01/05/2026 :
//   "Critères de sélection du match à étudier par ordre d'importance:
//    1) Enjeu : place à perdre pour l'équipe qui doit marquer
//    2) Disparité de niveau = ECART DE CLASSEMENT ACTUEL >= 10 places
//       (pas la moyenne 5 saisons, mais le rang ACTUEL)
//    3) Analyse des 5 derniers matchs avec ta formule Excel"
//
// CHANGEMENT v4 vs v3 :
//   AJOUT du filtre disparite de rang actuel >= MIN_RANK_GAP (10 places).
//   Ex: Frankfurt 6e vs Hambourg 18e = ecart 12 places -> OK
//       Stuttgart 11e vs Hoffenheim 13e = ecart 2 places -> SKIP

import {
  isO05FixtureFinished,
  type O05Fixture,
} from "./apifootball-fixtures";
import type { StakeInfo } from "./detect-stakes";


// ─── Types ─────────────────────────────────────────────────────────


export type OpportunityCandidate = {
  fixture_id: number;
  league_id: number;
  season: number;
  match_date: string;
  home_team_id: number;
  home_team_name: string;
  away_team_id: number;
  away_team_name: string;
  home_intrinsic: number;
  away_intrinsic: number;
  // v4 : rang actuel de chaque equipe dans son championnat
  // (necessaire pour le filtre disparite)
  home_current_rank: number;
  away_current_rank: number;
};


export type LineDetail = {
  opponent_name: string;
  opponent_intrinsic: number | null;
  match_date: string;
  goals_team: number;
  goals_opponent: number;
  pts5_opponent: number | null;
  env_letter: "I/E" | "S" | null;
  ad_letter: "I/E" | "S" | "S/E" | "I" | null;
  score_line: number;
  anomaly_value: number;
};


export type OpportunityResult = {
  fixture_id: number;
  league_id: number;
  season: number;
  match_date: string;
  home_team_id: number;
  home_team_name: string;
  away_team_id: number;
  away_team_name: string;
  target_team_id: number;
  target_team_name: string;
  target_role: "home" | "away";
  target_current_rank: number;
  opponent_team_id: number;
  opponent_team_name: string;
  opponent_current_rank: number;
  rank_gap: number;
  target_intrinsic: number;
  opponent_intrinsic: number;
  level_gap: number;
  stake_score: number;
  stake_situations: StakeInfo["situations"];
  score_outsider: number;
  score_favori: number;
  anomalies_total: number;
  total_score: number;
  badge: "green" | "orange" | "red";
  outsider_details: LineDetail[];
  favori_details: LineDetail[];
};


// ─── Constantes ───────────────────────────────────────────────────


export const BADGE_THRESHOLDS = {
  green: 25,
  orange: 15,
} as const;

// v4 : ecart minimum de classement ACTUEL pour qu'on parle de disparite
// Bertrand : 12 places = vraie disparite, 2 places = pas de disparite
// Seuil retenu : 10 places (proche du cas Frankfurt-Hambourg)
const MIN_RANK_GAP = 10;

const OUTSIDER_ANOMALY_PENALTIES = [-5, -4, -3, -2, -1];
const FAVORI_ANOMALY_PENALTIES = [-5, -4, -3, -2, -1];


// ─── Helpers ───────────────────────────────────────────────────────


export const computePts5 = (fixtures: O05Fixture[], teamId: number): number => {
  let points = 0;
  for (const f of fixtures) {
    if (!isO05FixtureFinished(f)) continue;
    const home = f.teams.home;
    const away = f.teams.away;
    const goalsHome = f.goals.home ?? 0;
    const goalsAway = f.goals.away ?? 0;
    const isHome = home.id === teamId;
    const myGoals = isHome ? goalsHome : goalsAway;
    const oppGoals = isHome ? goalsAway : goalsHome;
    if (myGoals > oppGoals) points += 3;
    else if (myGoals === oppGoals) points += 1;
  }
  return points;
};


const extractMatchData = (
  fixture: O05Fixture,
  teamId: number
): {
  opponent_id: number;
  opponent_name: string;
  goals_team: number;
  goals_opponent: number;
} => {
  const isHome = fixture.teams.home.id === teamId;
  const opponent = isHome ? fixture.teams.away : fixture.teams.home;
  const goalsTeam = isHome ? (fixture.goals.home ?? 0) : (fixture.goals.away ?? 0);
  const goalsOpponent = isHome ? (fixture.goals.away ?? 0) : (fixture.goals.home ?? 0);
  return {
    opponent_id: opponent.id,
    opponent_name: opponent.name,
    goals_team: goalsTeam,
    goals_opponent: goalsOpponent,
  };
};


// ─── Calcul score OUTSIDER (formule U7-U11) ───────────────────────


const computeOutsiderLines = async (
  outsiderId: number,
  outsiderIntrinsic: number,
  favoriIntrinsic: number,
  outsiderLastFixtures: O05Fixture[],
  intrinsicMap: Map<number, number>,
  pts5Cache: Map<number, number>,
  fetchOpponentLast5: (oppId: number) => Promise<O05Fixture[]>
): Promise<{ details: LineDetail[]; total_score: number; total_anomalies: number }> => {
  const details: LineDetail[] = [];
  let totalScore = 0;
  let totalAnomalies = 0;

  const finished = outsiderLastFixtures.filter(isO05FixtureFinished).slice(0, 5);

  for (let i = 0; i < finished.length; i++) {
    const fixture = finished[i];
    const data = extractMatchData(fixture, outsiderId);
    const oppIntrinsic = intrinsicMap.get(data.opponent_id) ?? null;

    let pts5: number | null = null;
    if (pts5Cache.has(data.opponent_id)) {
      pts5 = pts5Cache.get(data.opponent_id)!;
    } else {
      try {
        const oppFixtures = await fetchOpponentLast5(data.opponent_id);
        pts5 = computePts5(oppFixtures, data.opponent_id);
        pts5Cache.set(data.opponent_id, pts5);
      } catch {
        pts5 = null;
      }
    }

    let envLetter: "I/E" | "S" | null = null;
    if (oppIntrinsic !== null) {
      envLetter = oppIntrinsic >= outsiderIntrinsic ? "I/E" : "S";
    }

    let adLetter: "I/E" | "S" | null = null;
    if (oppIntrinsic !== null) {
      adLetter = oppIntrinsic >= favoriIntrinsic ? "I/E" : "S";
    }

    let scoreLine = 0;
    const beo = data.goals_team;
    if (beo > 0 && adLetter !== null && pts5 !== null) {
      if (adLetter === "I/E" && pts5 < 7) scoreLine = 4;
      else if (adLetter === "I/E" && pts5 > 6) scoreLine = 3;
      else if (adLetter === "S" && pts5 < 7) scoreLine = 2;
      else if (adLetter === "S" && pts5 > 6) scoreLine = 1;
    }

    let anomalyValue = 0;
    if (beo === 0 && pts5 !== null && pts5 > 6) {
      if (envLetter === "S" || adLetter === "S") {
        anomalyValue = OUTSIDER_ANOMALY_PENALTIES[i] ?? 0;
      }
    }

    totalScore += scoreLine;
    totalAnomalies += anomalyValue;

    details.push({
      opponent_name: data.opponent_name,
      opponent_intrinsic: oppIntrinsic,
      match_date: fixture.fixture.date,
      goals_team: data.goals_team,
      goals_opponent: data.goals_opponent,
      pts5_opponent: pts5,
      env_letter: envLetter,
      ad_letter: adLetter,
      score_line: scoreLine,
      anomaly_value: anomalyValue,
    });
  }

  return { details, total_score: totalScore, total_anomalies: totalAnomalies };
};


// ─── Calcul score FAVORI (formule U14-U18) ────────────────────────


const computeFavoriLines = async (
  favoriId: number,
  favoriIntrinsic: number,
  outsiderIntrinsic: number,
  favoriLastFixtures: O05Fixture[],
  intrinsicMap: Map<number, number>,
  pts5Cache: Map<number, number>,
  fetchOpponentLast5: (oppId: number) => Promise<O05Fixture[]>
): Promise<{ details: LineDetail[]; total_score: number; total_anomalies: number }> => {
  const details: LineDetail[] = [];
  let totalScore = 0;
  let totalAnomalies = 0;

  const finished = favoriLastFixtures.filter(isO05FixtureFinished).slice(0, 5);

  for (let i = 0; i < finished.length; i++) {
    const fixture = finished[i];
    const data = extractMatchData(fixture, favoriId);
    const oppIntrinsic = intrinsicMap.get(data.opponent_id) ?? null;

    let pts5: number | null = null;
    if (pts5Cache.has(data.opponent_id)) {
      pts5 = pts5Cache.get(data.opponent_id)!;
    } else {
      try {
        const oppFixtures = await fetchOpponentLast5(data.opponent_id);
        pts5 = computePts5(oppFixtures, data.opponent_id);
        pts5Cache.set(data.opponent_id, pts5);
      } catch {
        pts5 = null;
      }
    }

    let envLetter: "I/E" | "S" | null = null;
    if (oppIntrinsic !== null) {
      envLetter = oppIntrinsic < favoriIntrinsic ? "S" : "I/E";
    }

    let adLetter: "S/E" | "I" | null = null;
    if (oppIntrinsic !== null) {
      adLetter = oppIntrinsic < outsiderIntrinsic ? "S/E" : "I";
    }

    let scoreLine = 0;
    const bmf = data.goals_opponent;
    if (bmf > 0 && adLetter !== null && pts5 !== null) {
      if (adLetter === "S/E" && pts5 > 6) scoreLine = 4;
      else if (adLetter === "S/E" && pts5 < 7) scoreLine = 3;
      else if (adLetter === "I" && pts5 > 6) scoreLine = 2;
      else if (adLetter === "I" && pts5 < 7) scoreLine = 1;
    }

    let anomalyValue = 0;
    if (bmf === 0 && pts5 !== null && pts5 < 7) {
      if (envLetter === "I/E" || adLetter === "I") {
        anomalyValue = FAVORI_ANOMALY_PENALTIES[i] ?? 0;
      }
    }

    totalScore += scoreLine;
    totalAnomalies += anomalyValue;

    details.push({
      opponent_name: data.opponent_name,
      opponent_intrinsic: oppIntrinsic,
      match_date: fixture.fixture.date,
      goals_team: data.goals_team,
      goals_opponent: data.goals_opponent,
      pts5_opponent: pts5,
      env_letter: envLetter,
      ad_letter: adLetter,
      score_line: scoreLine,
      anomaly_value: anomalyValue,
    });
  }

  return { details, total_score: totalScore, total_anomalies: totalAnomalies };
};


// ─── Determination du badge ────────────────────────────────────────


export const computeBadge = (totalScore: number): "green" | "orange" | "red" => {
  if (totalScore >= BADGE_THRESHOLDS.green) return "green";
  if (totalScore >= BADGE_THRESHOLDS.orange) return "orange";
  return "red";
};


// ─── Fonction principale : analyse d'un match ─────────────────────


export const analyzeOpportunity = async (
  candidate: OpportunityCandidate,
  stakesMap: Map<number, StakeInfo>,
  intrinsicMap: Map<number, number>,
  pts5Cache: Map<number, number>,
  fetchOpponentLast5: (oppId: number) => Promise<O05Fixture[]>
): Promise<OpportunityResult | null> => {
  // ─── CRITERE 2 (Bertrand) v4 : Disparite de classement ACTUEL ──
  // Bertrand 01/05 : "la disparite c'est sur le classement ACTUEL,
  //                   sinon ca n'a aucun interet"
  // On filtre les matchs ou les 2 equipes sont proches au classement.
  const rankGap = Math.abs(
    candidate.home_current_rank - candidate.away_current_rank
  );
  if (rankGap < MIN_RANK_GAP) {
    return null; // Pas de vraie disparite -> SKIP
  }

  // Determiner FAVORI (intrinsic le plus bas = meilleure equipe historique)
  // et OUTSIDER (intrinsic le plus haut = pire equipe historique).
  // Note : on garde l'intrinsic pour le scoring Excel (formules I/E vs S),
  // mais le filtre disparite ci-dessus utilise le rang actuel.
  let favoriId: number;
  let favoriName: string;
  let favoriRole: "home" | "away";
  let favoriIntrinsic: number;
  let favoriCurrentRank: number;
  let outsiderId: number;
  let outsiderName: string;
  let outsiderIntrinsic: number;
  let outsiderCurrentRank: number;

  if (candidate.home_intrinsic < candidate.away_intrinsic) {
    favoriId = candidate.home_team_id;
    favoriName = candidate.home_team_name;
    favoriRole = "home";
    favoriIntrinsic = candidate.home_intrinsic;
    favoriCurrentRank = candidate.home_current_rank;
    outsiderId = candidate.away_team_id;
    outsiderName = candidate.away_team_name;
    outsiderIntrinsic = candidate.away_intrinsic;
    outsiderCurrentRank = candidate.away_current_rank;
  } else {
    favoriId = candidate.away_team_id;
    favoriName = candidate.away_team_name;
    favoriRole = "away";
    favoriIntrinsic = candidate.away_intrinsic;
    favoriCurrentRank = candidate.away_current_rank;
    outsiderId = candidate.home_team_id;
    outsiderName = candidate.home_team_name;
    outsiderIntrinsic = candidate.home_intrinsic;
    outsiderCurrentRank = candidate.home_current_rank;
  }

  // ─── CRITERE 1 (Bertrand) : Enjeu obligatoire sur le FAVORI ──
  const favoriStake = stakesMap.get(favoriId);
  if (!favoriStake) {
    return null;
  }

  const stakeInfo = favoriStake;

  // Fetch les 5 derniers matchs des 2 equipes
  const [favoriLast5, outsiderLast5] = await Promise.all([
    fetchOpponentLast5(favoriId),
    fetchOpponentLast5(outsiderId),
  ]);

  const outsiderResult = await computeOutsiderLines(
    outsiderId,
    outsiderIntrinsic,
    favoriIntrinsic,
    outsiderLast5,
    intrinsicMap,
    pts5Cache,
    fetchOpponentLast5
  );

  const favoriResult = await computeFavoriLines(
    favoriId,
    favoriIntrinsic,
    outsiderIntrinsic,
    favoriLast5,
    intrinsicMap,
    pts5Cache,
    fetchOpponentLast5
  );

  const totalAnomalies = outsiderResult.total_anomalies + favoriResult.total_anomalies;
  const totalScore =
    outsiderResult.total_score + favoriResult.total_score + totalAnomalies;
  const badge = computeBadge(totalScore);

  return {
    fixture_id: candidate.fixture_id,
    league_id: candidate.league_id,
    season: candidate.season,
    match_date: candidate.match_date,
    home_team_id: candidate.home_team_id,
    home_team_name: candidate.home_team_name,
    away_team_id: candidate.away_team_id,
    away_team_name: candidate.away_team_name,
    target_team_id: favoriId,
    target_team_name: favoriName,
    target_role: favoriRole,
    target_current_rank: favoriCurrentRank,
    opponent_team_id: outsiderId,
    opponent_team_name: outsiderName,
    opponent_current_rank: outsiderCurrentRank,
    rank_gap: rankGap,
    target_intrinsic: favoriIntrinsic,
    opponent_intrinsic: outsiderIntrinsic,
    level_gap: outsiderIntrinsic - favoriIntrinsic,
    stake_score: stakeInfo.stake_score,
    stake_situations: stakeInfo.situations,
    score_outsider: outsiderResult.total_score,
    score_favori: favoriResult.total_score,
    anomalies_total: totalAnomalies,
    total_score: totalScore,
    badge,
    outsider_details: outsiderResult.details,
    favori_details: favoriResult.details,
  };
};