// src/lib/over-05-buts-equipes/detect-stakes.ts
//
// Module 1 — Detection des enjeux sportifs par championnat.
//
// LOGIQUE CORRIGEE (v2) :
// Pour chaque equipe, on verifie son ecart SPECIFIQUE avec son voisin direct,
// pas un ecart global au niveau du championnat.
//
//   Situation A : Lutte pour le titre
//     -> equipe dans le Top N (defini par title_race_top_n)
//     -> ET (si elle est leader) ecart <= 2 pts avec le 2e
//        OU (si elle poursuit) ecart <= 2 pts avec le leader
//
//   Situation B : Course a l'Europe
//     -> equipe DANS une place qualificative (UCL/UEL/UECL)
//        ET ecart <= 2 pts avec l'equipe juste en-dessous
//        (= peut perdre sa place europeenne ou descendre dans la hierarchie UCL→UEL→UECL)
//     OU
//     -> equipe JUSTE EN-DESSOUS d'une place qualificative
//        ET ecart <= 2 pts avec l'equipe juste au-dessus
//        (= peut gagner une place europeenne)
//
//   Situation C : Lutte pour la relegation
//     -> equipe DANS la zone rouge (relegation auto ou playoff)
//        ET niveau intrinseque significativement meilleur que sa position actuelle
//        (= reveil attendu, equipe normalement bien mieux placee)
//     OU
//     -> equipe JUSTE AU-DESSUS de la zone rouge
//        ET ecart <= 2 pts avec la premiere place de zone rouge
//
// Sortie : Map<team_id, StakeInfo> ne contenant QUE les equipes avec un enjeu.

import type { O05StandingTeam } from "./apifootball-standings";


// ─── Types ─────────────────────────────────────────────────────────


export type StakeSituation = {
  type: "title" | "europe" | "relegation";
  detail: string;
  gap_points: number;
};


export type StakeInfo = {
  team_id: number;
  team_name: string;
  rank: number;
  points: number;
  stake_score: number; // 0-3 (0 = pas d'enjeu, 3 = enjeu maximal)
  situations: StakeSituation[];
};


export type LeagueRulesJSON = {
  european_rules: {
    ucl_positions: number[];
    uel_positions: number[];
    uecl_positions: number[];
    epc_eligible: boolean;
  };
  relegation_rules: {
    auto_relegated: number[];
    playoff_relegated: number[];
  };
  title_rules: {
    champion_position: number;
    title_race_top_n: number;
  };
};


export type LeagueWithRules = {
  id: number;
  name: string;
  total_teams: number;
  european_rules: LeagueRulesJSON["european_rules"];
  relegation_rules: LeagueRulesJSON["relegation_rules"];
  title_rules: LeagueRulesJSON["title_rules"];
};


// ─── Constantes ────────────────────────────────────────────────────


const POINTS_GAP_THRESHOLD = 2; // strict <= 2 pts


// ─── Helpers ───────────────────────────────────────────────────────


/**
 * Combine les positions des 3 coupes europeennes en un seul Set.
 */
const getEuropeanPositions = (rules: LeagueRulesJSON["european_rules"]): Set<number> => {
  return new Set([
    ...rules.ucl_positions,
    ...rules.uel_positions,
    ...rules.uecl_positions,
  ]);
};


/**
 * Combine les positions de relegation (auto + playoff).
 */
const getRelegationPositions = (rules: LeagueRulesJSON["relegation_rules"]): Set<number> => {
  return new Set([
    ...rules.auto_relegated,
    ...rules.playoff_relegated,
  ]);
};


/**
 * Helper : nom court de la coupe europeenne pour une position.
 * Ex: 4e en La Liga (ucl_positions=[1,2,3,4,5]) → "UCL"
 */
const getCupNameForPosition = (
  rank: number,
  rules: LeagueRulesJSON["european_rules"]
): string => {
  if (rules.ucl_positions.includes(rank)) return "UCL";
  if (rules.uel_positions.includes(rank)) return "UEL";
  if (rules.uecl_positions.includes(rank)) return "UECL";
  return "Europe";
};


// ─── Fonction principale ──────────────────────────────────────────


/**
 * Detecte les equipes en enjeu sportif dans un championnat.
 *
 * @param standings Classement actuel
 * @param league Championnat avec ses regles
 * @param intrinsicMap Map<team_id, intrinsic_average> pour Cas C relegation
 */
export const detectStakesForLeague = (
  standings: O05StandingTeam[],
  league: LeagueWithRules,
  intrinsicMap: Map<number, number>
): Map<number, StakeInfo> => {
  const result = new Map<number, StakeInfo>();
  if (standings.length === 0) return result;

  const europeanPositions = getEuropeanPositions(league.european_rules);
  const relegationPositions = getRelegationPositions(league.relegation_rules);
  const titleTopN = league.title_rules.title_race_top_n;

  // Tri par rang
  const sorted = [...standings].sort((a, b) => a.rank - b.rank);

  // Index pour acces rapide par rang
  const byRank = new Map<number, O05StandingTeam>();
  for (const t of sorted) byRank.set(t.rank, t);

  for (const team of sorted) {
    const situations: StakeSituation[] = [];

    // ─── SITUATION A : Lutte pour le titre ─────────────────
    if (team.rank <= titleTopN) {
      const leader = sorted[0];
      const second = sorted[1];

      if (team.rank === 1 && second) {
        const gapToSecond = team.points - second.points;
        if (gapToSecond <= POINTS_GAP_THRESHOLD) {
          situations.push({
            type: "title",
            detail: `Leader avec ${gapToSecond} pt(s) d'avance sur ${second.team.name}`,
            gap_points: gapToSecond,
          });
        }
      } else if (team.rank > 1 && leader) {
        const gapToLeader = leader.points - team.points;
        if (gapToLeader <= POINTS_GAP_THRESHOLD) {
          situations.push({
            type: "title",
            detail: `${team.rank}e a ${gapToLeader} pt(s) du leader ${leader.team.name}`,
            gap_points: gapToLeader,
          });
        }
      }
    }

    // ─── SITUATION B : Course a l'Europe ───────────────────
    // CAS B1 : equipe DANS une place europeenne -> menace de descendre
    if (europeanPositions.has(team.rank)) {
      const teamBelow = byRank.get(team.rank + 1);
      if (teamBelow) {
        const gap = team.points - teamBelow.points;
        if (gap <= POINTS_GAP_THRESHOLD) {
          const myCup = getCupNameForPosition(team.rank, league.european_rules);
          const isBelowEuropean = europeanPositions.has(team.rank + 1);
          if (isBelowEuropean) {
            // Descente vers une coupe inferieure (UCL→UEL ou UEL→UECL)
            const belowCup = getCupNameForPosition(team.rank + 1, league.european_rules);
            situations.push({
              type: "europe",
              detail: `Place ${myCup} (${team.rank}e) menacee : ${gap} pt(s) d'avance sur ${teamBelow.team.name} (${belowCup})`,
              gap_points: gap,
            });
          } else {
            // Risque de tomber HORS Europe
            situations.push({
              type: "europe",
              detail: `Place ${myCup} (${team.rank}e) menacee : ${gap} pt(s) d'avance sur ${teamBelow.team.name} (hors Europe)`,
              gap_points: gap,
            });
          }
        }
      }
    } else {
      // CAS B2 : equipe HORS Europe mais juste en-dessous -> peut grimper
      const teamAbove = byRank.get(team.rank - 1);
      if (teamAbove && europeanPositions.has(team.rank - 1)) {
        const gap = teamAbove.points - team.points;
        if (gap <= POINTS_GAP_THRESHOLD) {
          const aboveCup = getCupNameForPosition(team.rank - 1, league.european_rules);
          situations.push({
            type: "europe",
            detail: `A ${gap} pt(s) d'une place ${aboveCup} (${team.rank}e vs ${team.rank - 1}e ${teamAbove.team.name})`,
            gap_points: gap,
          });
        }
      }
    }

    // ─── SITUATION C : Lutte pour la relegation ────────────
    if (relegationPositions.has(team.rank)) {
      // Equipe DANS la zone rouge
      // Cas C1 : niveau intrinseque > position actuelle (reveil attendu)
      const intrinsic = intrinsicMap.get(team.team.id);
      if (intrinsic !== undefined && intrinsic < team.rank / 10) {
        situations.push({
          type: "relegation",
          detail: `Zone rouge (${team.rank}e) mais niveau intrinseque ${intrinsic.toFixed(2)} bien meilleur`,
          gap_points: 0,
        });
      }
    } else {
      // Equipe HORS zone rouge -> verifier si juste au-dessus
      const sortedRelegation = Array.from(relegationPositions).sort((a, b) => a - b);
      if (sortedRelegation.length > 0) {
        const firstRelegation = sortedRelegation[0];
        const justAboveZone = firstRelegation - 1;
        if (team.rank === justAboveZone) {
          const firstRelegationTeam = byRank.get(firstRelegation);
          if (firstRelegationTeam) {
            const gap = team.points - firstRelegationTeam.points;
            if (gap <= POINTS_GAP_THRESHOLD) {
              situations.push({
                type: "relegation",
                detail: `Juste au-dessus de la zone rouge (${gap} pt(s) d'avance sur ${firstRelegationTeam.team.name})`,
                gap_points: gap,
              });
            }
          }
        }
      }
    }

    // Si au moins 1 situation -> ajouter au resultat
    if (situations.length > 0) {
      const stakeScore = computeStakeScore(situations);
      result.set(team.team.id, {
        team_id: team.team.id,
        team_name: team.team.name,
        rank: team.rank,
        points: team.points,
        stake_score: stakeScore,
        situations,
      });
    }
  }

  return result;
};


/**
 * Calcule le stake_score (0-3) en fonction des situations detectees.
 *
 * Logique :
 *   - 1 situation seule : stake_score = 2 (enjeu fort)
 *   - 1 situation avec gap = 0 (course tres serree) : stake_score = 3
 *   - Plusieurs situations cumulees : stake_score = 3 (enjeu maximal)
 */
const computeStakeScore = (situations: StakeSituation[]): number => {
  if (situations.length === 0) return 0;
  if (situations.length >= 2) return 3;
  const single = situations[0];
  if (single.gap_points === 0) return 3;
  return 2;
};


/**
 * Helper : detecte les enjeux pour TOUS les championnats.
 */
export const detectStakesAllLeagues = (
  standingsByLeague: Map<number, O05StandingTeam[]>,
  leagues: LeagueWithRules[],
  intrinsicMap: Map<number, number>
): Map<number, StakeInfo> => {
  const globalResult = new Map<number, StakeInfo>();
  for (const league of leagues) {
    const standings = standingsByLeague.get(league.id);
    if (!standings) continue;
    const leagueStakes = detectStakesForLeague(standings, league, intrinsicMap);
    for (const [teamId, stakeInfo] of leagueStakes) {
      globalResult.set(teamId, stakeInfo);
    }
  }
  return globalResult;
};