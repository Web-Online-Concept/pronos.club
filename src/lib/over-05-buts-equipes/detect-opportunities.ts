// src/lib/over-05-buts-equipes/detect-opportunities.ts
//
// Module 4 — Detection des opportunites de pari "+0.5 but equipe"
// Reproduction EXACTE de la formule Excel de Bertrand (sans interpretation).
//
// Pour chaque match candidat :
//   1. Determine FAVORI (intrinseque le plus bas) et OUTSIDER (le plus haut)
//   2. Filtre les cas inutiles (Cas 4 valide : enjeu sur l'outsider -> SKIP)
//   3. Fetch les 5 derniers matchs des deux equipes
//   4. Pour chaque adversaire, fetch ses 5 derniers matchs pour calculer Pts5
//   5. Calcule score_outsider + score_favori + anomalies (formule Excel)
//   6. Total = somme + badge couleur (vert/orange/rouge)
//
// Cout API estime : ~12 calls par match analyse (2 pour les equipes + 10 pour
//                   les adversaires). Cache intelligent reduit a ~6-8 en pratique.

import {
  getO05TeamLastFixtures,
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
};


export type LineDetail = {
  opponent_name: string;
  opponent_intrinsic: number | null;
  match_date: string;
  goals_team: number;        // buts de l'equipe analysee (favori ou outsider)
  goals_opponent: number;    // buts de l'adversaire
  pts5_opponent: number | null;
  // Lettres P et Q de l'Excel (env vs favori/outsider, ad vs autre)
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
  
  // Equipes
  home_team_id: number;
  home_team_name: string;
  away_team_id: number;
  away_team_name: string;
  
  // Cible (favori) et autre (outsider)
  target_team_id: number;
  target_team_name: string;
  target_role: "home" | "away";
  opponent_team_id: number;
  opponent_team_name: string;
  
  // Niveaux intrinseques
  target_intrinsic: number;
  opponent_intrinsic: number;
  level_gap: number;
  
  // Stake (depuis Module 1)
  stake_score: number;
  stake_situations: StakeInfo["situations"];
  
  // Module 4 — formule Excel
  score_outsider: number;        // somme des 5 lignes outsider (max 20)
  score_favori: number;          // somme des 5 lignes favori (max 20)
  anomalies_total: number;       // somme des anomalies (negatif)
  total_score: number;           // outsider + favori + anomalies
  badge: "green" | "orange" | "red";
  
  // Details pour affichage frontend
  outsider_details: LineDetail[];
  favori_details: LineDetail[];
};


// ─── Constantes ───────────────────────────────────────────────────


// Seuils pour le badge couleur (ajustables apres premiers tests)
export const BADGE_THRESHOLDS = {
  green: 25,
  orange: 15,
  // < orange => red
} as const;

// Penalites des anomalies par position dans la liste (le plus recent compte le plus)
const OUTSIDER_ANOMALY_PENALTIES = [-5, -4, -3, -2, -1]; // V7 -> V11
const FAVORI_ANOMALY_PENALTIES = [-5, -4, -3, -2, -1];   // V14 -> V18


// ─── Helpers ───────────────────────────────────────────────────────


/**
 * Calcule les points pris par une equipe dans 5 fixtures (3 par victoire, 1 par nul).
 */
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


/**
 * Pour un fixture donne, retourne :
 *   - l'adversaire (id, nom)
 *   - les buts marques par l'equipe analysee
 *   - les buts marques par l'adversaire
 */
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


/**
 * Pour le tableau OUTSIDER (lignes 7-11), pour chaque adversaire :
 *
 * Q (Ad O/F) = SI(intrinsic(adversaire) >= intrinsic(FAVORI), "I/E", "S")
 *               (= adversaire similaire ou pire au favori = I/E, sinon S)
 *
 * Score ligne :
 *   SI BEO > 0 ET Q="I/E" ET Pts5 < 7  → 4
 *   SI BEO > 0 ET Q="I/E" ET Pts5 > 6  → 3
 *   SI BEO > 0 ET Q="S"   ET Pts5 < 7  → 2
 *   SI BEO > 0 ET Q="S"   ET Pts5 > 6  → 1
 *   SINON → 0
 *
 * (BEO = buts encaisses par l'adversaire = buts marques par l'OUTSIDER dans
 *  son match precedent contre cet adversaire)
 *
 * Anomalie ligne :
 *   SI BEO=0 ET P="S" ET Pts5 > 6 → penalite (-5,-4,-3,-2,-1 selon position)
 *   SI BEO=0 ET Q="S" ET Pts5 > 6 → penalite
 *   SINON → 0
 *
 * P (Env. O) = SI(intrinsic(adversaire) >= intrinsic(OUTSIDER), "I/E", "S")
 */
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

  // Limiter aux 5 derniers fixtures termines
  const finished = outsiderLastFixtures.filter(isO05FixtureFinished).slice(0, 5);

  for (let i = 0; i < finished.length; i++) {
    const fixture = finished[i];
    const data = extractMatchData(fixture, outsiderId);
    const oppIntrinsic = intrinsicMap.get(data.opponent_id) ?? null;

    // Calcul Pts5 de l'adversaire (avec cache)
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

    // Letter P (Env. O) = comparaison adversaire vs OUTSIDER
    // Excel : "I/E" si MOY(K:O) > MOY(K6:O6), c-a-d niveau adversaire > niveau outsider
    //         (rang plus eleve = niveau plus bas, donc adversaire MOINS BON)
    // Convention numerique : intrinsic plus haut = pire equipe
    let envLetter: "I/E" | "S" | null = null;
    if (oppIntrinsic !== null) {
      envLetter = oppIntrinsic >= outsiderIntrinsic ? "I/E" : "S";
    }

    // Letter Q (Ad O/F) = comparaison adversaire vs FAVORI
    let adLetter: "I/E" | "S" | null = null;
    if (oppIntrinsic !== null) {
      adLetter = oppIntrinsic >= favoriIntrinsic ? "I/E" : "S";
    }

    // Score ligne (formule U7-U11)
    let scoreLine = 0;
    const beo = data.goals_team; // buts encaisses par l'adversaire = buts de l'outsider
    if (beo > 0 && adLetter !== null && pts5 !== null) {
      if (adLetter === "I/E" && pts5 < 7) scoreLine = 4;
      else if (adLetter === "I/E" && pts5 > 6) scoreLine = 3;
      else if (adLetter === "S" && pts5 < 7) scoreLine = 2;
      else if (adLetter === "S" && pts5 > 6) scoreLine = 1;
    }

    // Anomalie ligne (formule V7-V11)
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


/**
 * Pour le tableau FAVORI (lignes 14-18), pour chaque adversaire :
 *
 * P (Env. F) = SI(intrinsic(adversaire) < intrinsic(FAVORI), "S", "I/E")
 *               (= adversaire de meilleur niveau que favori = S)
 *
 * Q (Ad F/O) = SI(intrinsic(adversaire) < intrinsic(OUTSIDER), "S/E", "I")
 *               (= adversaire >= outsider en niveau = S/E, sinon I)
 *               (Excel utilise < : si rang adversaire plus bas = niveau plus haut
 *                => Q="S/E" = "Superieur/Egal")
 *
 * Score ligne :
 *   SI BMF > 0 ET Q="S/E" ET Pts5 > 6 → 4
 *   SI BMF > 0 ET Q="S/E" ET Pts5 < 7 → 3
 *   SI BMF > 0 ET Q="I"   ET Pts5 > 6 → 2
 *   SI BMF > 0 ET Q="I"   ET Pts5 < 7 → 1
 *   SINON → 0
 *
 * (BMF = buts marques par l'adversaire = buts encaisses par le FAVORI)
 *
 * Anomalie ligne :
 *   SI BMF=0 ET P="I/E" ET Pts5 < 7 → penalite
 *   SI BMF=0 ET Q="I" ET Pts5 < 7   → penalite
 *   SINON → 0
 */
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

    // Letter P (Env. F) = comparaison adversaire vs FAVORI
    // Excel : SI(MOY(K:O) < MOY(K13:O13), "S", "I/E")
    //         intrinsic plus bas = meilleure equipe
    //         si adversaire intrinsic < favori intrinsic => adversaire meilleur => "S"
    let envLetter: "I/E" | "S" | null = null;
    if (oppIntrinsic !== null) {
      envLetter = oppIntrinsic < favoriIntrinsic ? "S" : "I/E";
    }

    // Letter Q (Ad F/O) = comparaison adversaire vs OUTSIDER
    // Excel : SI(MOY(K:O) < MOY(K6:O6), "S/E", "I")
    //         si adversaire intrinsic < outsider intrinsic => adversaire meilleur que outsider => "S/E"
    let adLetter: "S/E" | "I" | null = null;
    if (oppIntrinsic !== null) {
      adLetter = oppIntrinsic < outsiderIntrinsic ? "S/E" : "I";
    }

    // Score ligne (formule U14-U18)
    let scoreLine = 0;
    const bmf = data.goals_opponent; // buts marques par l'adversaire
    if (bmf > 0 && adLetter !== null && pts5 !== null) {
      if (adLetter === "S/E" && pts5 > 6) scoreLine = 4;
      else if (adLetter === "S/E" && pts5 < 7) scoreLine = 3;
      else if (adLetter === "I" && pts5 > 6) scoreLine = 2;
      else if (adLetter === "I" && pts5 < 7) scoreLine = 1;
    }

    // Anomalie ligne (formule V14-V18)
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


/**
 * Analyse un match candidat et determine si c'est une opportunite.
 *
 * @returns OpportunityResult si le match est analysable, null si SKIP
 *          (cas 4 : enjeu sur l'outsider, ou aucun enjeu)
 */
export const analyzeOpportunity = async (
  candidate: OpportunityCandidate,
  stakesMap: Map<number, StakeInfo>,
  intrinsicMap: Map<number, number>,
  pts5Cache: Map<number, number>,
  fetchOpponentLast5: (oppId: number) => Promise<O05Fixture[]>
): Promise<OpportunityResult | null> => {
  // Determiner FAVORI (intrinsic le plus bas) et OUTSIDER (le plus haut)
  let favoriId: number;
  let favoriName: string;
  let favoriRole: "home" | "away";
  let favoriIntrinsic: number;
  let outsiderId: number;
  let outsiderName: string;
  let outsiderIntrinsic: number;

  if (candidate.home_intrinsic < candidate.away_intrinsic) {
    favoriId = candidate.home_team_id;
    favoriName = candidate.home_team_name;
    favoriRole = "home";
    favoriIntrinsic = candidate.home_intrinsic;
    outsiderId = candidate.away_team_id;
    outsiderName = candidate.away_team_name;
    outsiderIntrinsic = candidate.away_intrinsic;
  } else {
    favoriId = candidate.away_team_id;
    favoriName = candidate.away_team_name;
    favoriRole = "away";
    favoriIntrinsic = candidate.away_intrinsic;
    outsiderId = candidate.home_team_id;
    outsiderName = candidate.home_team_name;
    outsiderIntrinsic = candidate.home_intrinsic;
  }

  // Verifier qu'il y a un enjeu (Module 1)
  const favoriStake = stakesMap.get(favoriId);
  const outsiderStake = stakesMap.get(outsiderId);

  if (!favoriStake && !outsiderStake) {
    return null; // Aucune des 2 equipes n'a d'enjeu -> SKIP
  }

  // Cas 4 (validation Florent) : si l'enjeu est UNIQUEMENT sur l'outsider, SKIP
  if (!favoriStake && outsiderStake) {
    return null;
  }

  // A partir d'ici, le favori a un enjeu (avec ou sans enjeu sur l'outsider)
  const stakeInfo = favoriStake!;

  // Fetch les 5 derniers matchs des 2 equipes
  const [favoriLast5, outsiderLast5] = await Promise.all([
    fetchOpponentLast5(favoriId),
    fetchOpponentLast5(outsiderId),
  ]);

  // Calcul scores via formule Excel
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
    opponent_team_id: outsiderId,
    opponent_team_name: outsiderName,
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