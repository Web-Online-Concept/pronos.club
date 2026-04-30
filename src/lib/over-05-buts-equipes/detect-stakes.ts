// src/lib/over-05-buts-equipes/detect-stakes.ts
//
// Module 1 — Detection des enjeux sportifs par championnat.
//
// Pour chaque championnat actif, on identifie les equipes qui sont en
// situation d'enjeu reel selon la logique Bertrand :
//
//   Situation A : Lutte pour le titre
//     -> equipe dans le Top N (defini par title_race_top_n) AVEC ecart <= 2 pts
//        avec ses poursuivants/leaders directs
//
//   Situation B : Course a l'Europe (UCL / UEL / UECL)
//     -> equipe DANS une place qualificative ET ecart <= 2 pts avec position juste en-dessous
//     -> equipe JUSTE EN-DESSOUS d'une place qualificative ET ecart <= 2 pts avec position juste au-dessus
//
//   Situation C : Lutte pour la relegation
//     -> equipe DANS la zone rouge ET niveau intrinseque > position actuelle (= reveil attendu)
//     -> equipe JUSTE AU-DESSUS de la zone rouge ET ecart <= 2 pts vers cette zone
//
// Sortie : Map<team_id, StakeInfo> ou StakeInfo = { stake_score: 1-3, situations: [...] }
//
// Une equipe sans enjeu N'EST PAS dans la map.

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


// ─── Helpers ───────────────────────────────────────────────────────


const POINTS_GAP_THRESHOLD = 2; // strict <= 2 pts (validation Florent)


/**
 * Combine les positions des 3 coupes europeennes en un seul Set
 * pour faciliter les checks.
 */
const getEuropeanPositions = (rules: LeagueRulesJSON["european_rules"]): Set<number> => {
  return new Set([
    ...rules.ucl_positions,
    ...rules.uel_positions,
    ...rules.uecl_positions,
  ]);
};


/**
 * Combine les positions de relegation (auto + playoff) en un seul Set.
 */
const getRelegationPositions = (rules: LeagueRulesJSON["relegation_rules"]): Set<number> => {
  return new Set([
    ...rules.auto_relegated,
    ...rules.playoff_relegated,
  ]);
};


/**
 * Determine la "frontiere europeenne" la plus proche pour une position donnee.
 * Ex: si rank=4 et ucl_positions=[1,2,3], alors la frontiere est entre 3 et 4.
 *
 * Retourne :
 *   - la position de la frontiere superieure (derniere place qualificative)
 *   - la position de la frontiere inferieure (premiere place non-qualificative)
 *   - null si pas de frontiere proche pour ce rank
 */
const getEuropeanFrontier = (
  rank: number,
  europeanPositions: Set<number>
): { lastQualified: number; firstNonQualified: number } | null => {
  // Trouve toutes les positions europeennes triees
  const sortedPositions = Array.from(europeanPositions).sort((a, b) => a - b);
  if (sortedPositions.length === 0) return null;

  const lastQualified = Math.max(...sortedPositions);
  const firstNonQualified = lastQualified + 1;

  // Cas 1 : equipe DANS la zone qualificative
  // Son enjeu : ne pas tomber a firstNonQualified (= rank 6 ou 7 selon le cas)
  if (europeanPositions.has(rank)) {
    return { lastQualified, firstNonQualified };
  }

  // Cas 2 : equipe JUSTE en dessous (= a la position firstNonQualified)
  // Son enjeu : entrer dans le dernier rang qualificatif
  if (rank === firstNonQualified) {
    return { lastQualified, firstNonQualified };
  }

  return null;
};


// ─── Fonction principale ──────────────────────────────────────────


/**
 * Detecte les equipes en enjeu sportif dans un championnat.
 *
 * @param standings Classement actuel du championnat (deja fetche)
 * @param league Championnat avec ses regles (european, relegation, title)
 * @param intrinsicMap Map<team_id, intrinsic_average> pour le check du Cas C relegation
 *                     (equipe en zone rouge avec niveau intrinseque > position actuelle)
 * @returns Map<team_id, StakeInfo> ne contenant QUE les equipes avec un enjeu
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

  // Tri par rang (au cas ou le standings ne soit pas deja trie)
  const sorted = [...standings].sort((a, b) => a.rank - b.rank);

  // Pour chaque equipe, on verifie les 3 situations
  for (const team of sorted) {
    const situations: StakeSituation[] = [];

    // ─── SITUATION A : Lutte pour le titre ─────────────────
    // Top N (defini dans title_rules) avec ecart <= 2 pts
    if (team.rank <= titleTopN) {
      // Equipe dans le top -> verifier ecart avec leader (1er) ou poursuivant
      const leader = sorted[0];
      const gapToLeader = leader.points - team.points;

      // Si elle est leader, verifier ecart avec le 2eme
      if (team.rank === 1 && sorted.length >= 2) {
        const second = sorted[1];
        const gapToSecond = team.points - second.points;
        if (gapToSecond <= POINTS_GAP_THRESHOLD) {
          situations.push({
            type: "title",
            detail: `Leader avec ${gapToSecond} pt(s) d'avance sur ${second.team.name}`,
            gap_points: gapToSecond,
          });
        }
      } else if (team.rank > 1 && gapToLeader <= POINTS_GAP_THRESHOLD) {
        // Equipe poursuivante avec ecart faible
        situations.push({
          type: "title",
          detail: `${team.rank}e a ${gapToLeader} pt(s) du leader ${leader.team.name}`,
          gap_points: gapToLeader,
        });
      }
    }

    // ─── SITUATION B : Course a l'Europe ───────────────────
    // Frontiere des places UCL/UEL/UECL
    const frontier = getEuropeanFrontier(team.rank, europeanPositions);
    if (frontier) {
      const { lastQualified, firstNonQualified } = frontier;
      const lastQualTeam = sorted.find((t) => t.rank === lastQualified);
      const firstNonQualTeam = sorted.find((t) => t.rank === firstNonQualified);

      if (lastQualTeam && firstNonQualTeam) {
        const gap = lastQualTeam.points - firstNonQualTeam.points;
        if (gap <= POINTS_GAP_THRESHOLD) {
          if (europeanPositions.has(team.rank)) {
            // Equipe DANS la zone qualificative
            situations.push({
              type: "europe",
              detail: `Place europeenne (${team.rank}e) menacee : ${gap} pt(s) d'avance sur le ${firstNonQualified}e`,
              gap_points: gap,
            });
          } else {
            // Equipe juste en-dessous
            situations.push({
              type: "europe",
              detail: `A ${gap} pt(s) d'une place europeenne (${team.rank}e vs ${lastQualified}e)`,
              gap_points: gap,
            });
          }
        }
      }
    }

    // ─── SITUATION C : Lutte pour la relegation ────────────
    if (relegationPositions.has(team.rank)) {
      // Equipe DANS la zone rouge
      // Cas C1 : niveau intrinseque > position actuelle (reveil attendu)
      const intrinsic = intrinsicMap.get(team.team.id);
      if (intrinsic !== undefined && intrinsic < team.rank / 10) {
        // intrinsic moyen < rang/10 actuel = equipe normalement bien mieux placee
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
        const firstRelegation = sortedRelegation[0]; // ex: 16 (premiere place de barrage)
        const justAboveZone = firstRelegation - 1; // ex: 15 (juste au-dessus)
        if (team.rank === justAboveZone) {
          // Verifier ecart avec la premiere place de zone rouge
          const firstRelegationTeam = sorted.find((t) => t.rank === firstRelegation);
          if (firstRelegationTeam) {
            const gap = team.points - firstRelegationTeam.points;
            if (gap <= POINTS_GAP_THRESHOLD) {
              situations.push({
                type: "relegation",
                detail: `Juste au-dessus de la zone rouge (${gap} pt(s) d'avance sur le ${firstRelegation}e)`,
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
 *   - Aucune situation : stake_score = 0 (pas dans le resultat)
 */
const computeStakeScore = (situations: StakeSituation[]): number => {
  if (situations.length === 0) return 0;
  if (situations.length >= 2) return 3; // cumul = enjeu fort

  const single = situations[0];
  if (single.gap_points === 0) return 3; // course tres serree
  if (single.gap_points <= 1) return 2; // enjeu fort
  return 2; // gap = 2 = enjeu fort aussi (on est deja dans le filtre <= 2)
};


/**
 * Helper : detecte les enjeux pour TOUS les championnats.
 *
 * @param standingsByLeague Map<league_id, standings> deja fetches
 * @param leagues Liste des championnats avec leurs regles
 * @param intrinsicMap Map<team_id, intrinsic_average>
 * @returns Map<team_id, StakeInfo> globale (toutes ligues confondues)
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