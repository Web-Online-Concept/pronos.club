// src/lib/over-05-buts-equipes/scoring-engine.ts
//
// Moteur de scoring selon la methode PROJETS Bertrand.
// Calcule attack /8 + defense /8 + bonus/malus -> total /18.5 -> note /10 -> verdict.
//
// Formules tirees de l'analyse de l'Excel "Selection_IA_0.5_but_equipe.xlsm".
// Voir les seuils detailles dans chaque fonction de scoring.

import type {
  MatchStats,
  MatchDefenseStats,
  O05Verdict,
} from "./types";


// ─── Section ATTAQUE : score /8 ──────────────────────────────────

export type AttackScoreBreakdown = {
  xg_points: number;             // 0, 1 ou 2
  tc_points: number;             // 0, 1 ou 2
  go_points: number;             // 0, 1 ou 2
  efficiency_points: number;     // -1, 0, 1 ou 2
  total: number;                 // somme /8
};

/**
 * Score attaque /8 selon les seuils :
 *  - xG pondéré  >= 1.50 : +2 / >= 1.20 : +1 / sinon 0
 *  - TC pondéré  >= 4   : +2 / >= 3   : +1 / sinon 0
 *  - GO pondéré  >= 2   : +2 / >= 1   : +1 / sinon 0
 *  - Efficacité buts/xG :
 *      < 0.80 : +2 (sous-perf finition, favorable a la prochaine fois)
 *      >= 0.80 et <= 1.30 : +1 (efficacite normale)
 *      > 1.30 : -1 (sur-perf, regression a venir)
 */
export const computeAttackScore = (stats: MatchStats): AttackScoreBreakdown => {
  // xG
  let xg_points = 0;
  if (stats.xg_weighted >= 1.5) xg_points = 2;
  else if (stats.xg_weighted >= 1.2) xg_points = 1;

  // TC
  let tc_points = 0;
  if (stats.tc_weighted >= 4) tc_points = 2;
  else if (stats.tc_weighted >= 3) tc_points = 1;

  // GO
  let go_points = 0;
  if (stats.go_weighted >= 2) go_points = 2;
  else if (stats.go_weighted >= 1) go_points = 1;

  // Efficacite buts/xG (uniquement si xG > 0 pour eviter div par 0)
  let efficiency_points = 0;
  if (stats.xg_weighted > 0) {
    const efficiency = stats.goals_weighted / stats.xg_weighted;
    if (efficiency < 0.8) efficiency_points = 2;
    else if (efficiency <= 1.3) efficiency_points = 1;
    else efficiency_points = -1;
  }

  return {
    xg_points,
    tc_points,
    go_points,
    efficiency_points,
    total: xg_points + tc_points + go_points + efficiency_points,
  };
};


// ─── Section DEFENSE adversaire : score /8 ───────────────────────

export type DefenseScoreBreakdown = {
  xgc_points: number;            // 0, 1 ou 2
  tc_subis_points: number;       // 0, 1 ou 2
  go_conceded_points: number;    // 0, 1 ou 2
  clean_sheets_points: number;   // 0, 1 ou 2
  total: number;                 // somme /8
};

/**
 * Score defense /8 selon les seuils (ici plus on a du score, plus l'adv est fragile) :
 *  - xGC pondéré >= 1.50 : +2 / >= 1.20 : +1 / sinon 0
 *  - TC subis    >= 4   : +2 / >= 3   : +1 / sinon 0
 *  - GO concédées >= 1   : +2 / >= 0.5 : +1 / sinon 0
 *  - Clean sheets = 0   : +2 (jamais reussi a garder son but)
 *                 = 1   : +1 (1 seule fois)
 *                 = 2,3 : 0  (defense solide)
 */
export const computeDefenseScore = (
  stats: MatchDefenseStats
): DefenseScoreBreakdown => {
  // xGC
  let xgc_points = 0;
  if (stats.xgc_weighted >= 1.5) xgc_points = 2;
  else if (stats.xgc_weighted >= 1.2) xgc_points = 1;

  // TC subis
  let tc_subis_points = 0;
  if (stats.tc_subis_weighted >= 4) tc_subis_points = 2;
  else if (stats.tc_subis_weighted >= 3) tc_subis_points = 1;

  // GO concedees
  let go_conceded_points = 0;
  if (stats.go_conceded_weighted >= 1) go_conceded_points = 2;
  else if (stats.go_conceded_weighted >= 0.5) go_conceded_points = 1;

  // Clean sheets
  let clean_sheets_points = 0;
  if (stats.clean_sheets === 0) clean_sheets_points = 2;
  else if (stats.clean_sheets === 1) clean_sheets_points = 1;

  return {
    xgc_points,
    tc_subis_points,
    go_conceded_points,
    clean_sheets_points,
    total: xgc_points + tc_subis_points + go_conceded_points + clean_sheets_points,
  };
};


// ─── BONUS Match-up : /2 ─────────────────────────────────────────

/**
 * Bonus match-up : si l'attaque est forte ET la defense adverse est fragile
 * (croisement explosif), bonus.
 *  - attaque_score >= 6 ET defense_score >= 6 : +2
 *  - attaque_score >= 5 ET defense_score >= 5 : +1
 *  - sinon : 0
 */
export const computeMatchupBonus = (
  attackScore: number,
  defenseScore: number
): number => {
  if (attackScore >= 6 && defenseScore >= 6) return 2;
  if (attackScore >= 5 && defenseScore >= 5) return 1;
  return 0;
};


// ─── BONUS Domicile : /0.5 ───────────────────────────────────────

/**
 * Si la cible joue a domicile, +0.5.
 * Avantage du terrain pour marquer.
 */
export const computeHomeBonus = (targetRole: "home" | "away"): number => {
  return targetRole === "home" ? 0.5 : 0;
};


// ─── MALUS Match fermé : 0 ou -1 ─────────────────────────────────

/**
 * Si l'attaque est faible (<= 3) ET la defense de l'adversaire est solide (<= 3),
 * c'est un match qui risque d'etre ferme (peu de buts) : -1.
 */
export const computeClosedMatchMalus = (
  attackScore: number,
  defenseScore: number
): number => {
  if (attackScore <= 3 && defenseScore <= 3) return -1;
  return 0;
};


// ─── TOTAL et VERDICT ────────────────────────────────────────────

export type ScoringResult = {
  attack_breakdown: AttackScoreBreakdown;
  defense_breakdown: DefenseScoreBreakdown;
  attack_score: number;
  defense_score: number;
  attack_bonus_projet: number;
  defense_bonus_projet: number;
  matchup_bonus: number;
  home_bonus: number;
  closed_match_malus: number;
  total_score: number;     // /18.5
  note_10: number;         // /10 recalibre
  verdict: O05Verdict;
};

/**
 * Calcule le score final et le verdict d'un match.
 *
 * @param attack_stats    Stats offensives ponderees de la cible
 * @param defense_stats   Stats defensives ponderees de l'adversaire
 * @param target_role     "home" ou "away" pour la cible
 * @param attack_bonus_projet    Bonus projet cible (de -0.5 a +1)
 * @param defense_bonus_projet   Bonus projet defense adversaire (inverse, voir doc)
 */
export const computeScoring = (
  attack_stats: MatchStats,
  defense_stats: MatchDefenseStats,
  target_role: "home" | "away",
  attack_bonus_projet: number,
  defense_bonus_projet: number
): ScoringResult => {
  const attack_breakdown = computeAttackScore(attack_stats);
  const defense_breakdown = computeDefenseScore(defense_stats);

  const attack_score = attack_breakdown.total;
  const defense_score = defense_breakdown.total;

  const matchup_bonus = computeMatchupBonus(attack_score, defense_score);
  const home_bonus = computeHomeBonus(target_role);
  const closed_match_malus = computeClosedMatchMalus(attack_score, defense_score);

  const total_score =
    attack_score +
    defense_score +
    matchup_bonus +
    home_bonus +
    closed_match_malus +
    attack_bonus_projet +
    defense_bonus_projet;

  // Recalibrage /10 (le max theorique est 18.5)
  const note_10 = Math.round((total_score * 10 / 18.5) * 10) / 10;

  // Verdict (seuils valides en phase 3)
  let verdict: O05Verdict;
  if (note_10 >= 8.0) verdict = "TRÈS BON";
  else if (note_10 >= 6.5) verdict = "BON";
  else if (note_10 >= 4.5) verdict = "MOYEN";
  else verdict = "FAIBLE";

  return {
    attack_breakdown,
    defense_breakdown,
    attack_score,
    defense_score,
    attack_bonus_projet,
    defense_bonus_projet,
    matchup_bonus,
    home_bonus,
    closed_match_malus,
    total_score: Math.round(total_score * 100) / 100,
    note_10,
    verdict,
  };
};