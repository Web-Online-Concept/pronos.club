// src/lib/over-05-buts-equipes/detect-stakes.ts
//
// Module 1 — Detection des enjeux sportifs par championnat.
//
// LOGIQUE v4 (alignee sur message Bertrand 30/04) :
//
// "S'il n'y a pas d'enjeu (place a perdre pour l'equipe qui doit marquer),
//  on n'etudie pas le match"
//
// → L'ENJEU EST STRICTEMENT DEFENSIF : l'equipe a une PLACE A PERDRE.
//   Les equipes qui peuvent GAGNER une place (grimper) ne sont PAS en enjeu
//   au sens Bertrand. C'est la peur de tomber qui motive, pas l'envie de monter.
//
//   Situation A : Lutte pour le titre (PROTECTION du leader)
//     -> equipe LEADER (rang 1) ET ecart <= 2 pts avec le 2e
//     (Les poursuivants ne sont PAS en enjeu : ils n'ont pas de place a perdre)
//
//   Situation B : Course a l'Europe (PROTECTION de la place)
//     -> equipe DANS une place qualificative (UCL/UEL/UECL)
//        ET ecart <= 2 pts avec l'equipe juste en-dessous
//     (Les equipes qui peuvent grimper ne sont PAS en enjeu)
//
//   Situation C : Lutte pour la relegation (PROTECTION pour ne pas tomber)
//     -> equipe JUSTE AU-DESSUS de la zone rouge
//        ET ecart <= 2 pts avec la 1ere place de zone rouge
//     (Les equipes DEJA en zone rouge ne sont PAS un enjeu de "protection",
//      elles luttent pour s'extirper - cas different)
//
//   Situation D : Equipe en zone rouge avec niveau intrinseque sup
//     -> equipe DANS la zone rouge ET niveau intrinseque < rang/10
//     (Cas particulier : equipe qui devrait remonter mecaniquement,
//      a une "place" historique a recuperer)

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
  stake_score: number;
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


const POINTS_GAP_MAX = 2;  // strict <= 2 pts
const POINTS_GAP_MIN = 0;  // gap doit etre >= 0 (pas negatif, anomalie API)


// ─── Helpers ───────────────────────────────────────────────────────


const getEuropeanPositions = (rules: LeagueRulesJSON["european_rules"]): Set<number> => {
  return new Set([
    ...rules.ucl_positions,
    ...rules.uel_positions,
    ...rules.uecl_positions,
  ]);
};


const getRelegationPositions = (rules: LeagueRulesJSON["relegation_rules"]): Set<number> => {
  return new Set([
    ...rules.auto_relegated,
    ...rules.playoff_relegated,
  ]);
};


const getCupNameForPosition = (
  rank: number,
  rules: LeagueRulesJSON["european_rules"]
): string => {
  if (rules.ucl_positions.includes(rank)) return "UCL";
  if (rules.uel_positions.includes(rank)) return "UEL";
  if (rules.uecl_positions.includes(rank)) return "UECL";
  return "Europe";
};


const isValidGap = (gap: number): boolean => {
  return gap >= POINTS_GAP_MIN && gap <= POINTS_GAP_MAX;
};


// ─── Fonction principale ──────────────────────────────────────────


export const detectStakesForLeague = (
  standings: O05StandingTeam[],
  league: LeagueWithRules,
  intrinsicMap: Map<number, number>
): Map<number, StakeInfo> => {
  const result = new Map<number, StakeInfo>();
  if (standings.length === 0) return result;

  const europeanPositions = getEuropeanPositions(league.european_rules);
  const relegationPositions = getRelegationPositions(league.relegation_rules);

  const sorted = [...standings].sort((a, b) => a.rank - b.rank);
  const byRank = new Map<number, O05StandingTeam>();
  for (const t of sorted) byRank.set(t.rank, t);

  for (const team of sorted) {
    const situations: StakeSituation[] = [];

    // ─── SITUATION A : Lutte titre (PROTECTION du leader) ───────
    // Le leader (rang 1) a une place à perdre si le 2e est proche
    if (team.rank === 1 && sorted.length >= 2) {
      const second = sorted[1];
      const gap = team.points - second.points;
      if (isValidGap(gap)) {
        situations.push({
          type: "title",
          detail: `Leader avec ${gap} pt(s) d'avance sur ${second.team.name}`,
          gap_points: gap,
        });
      }
    }
    // Note : on n'ajoute PAS les poursuivants ; ils n'ont pas de place
    // a perdre, ils en ont une a gagner (et selon Bertrand ce n'est pas
    // un enjeu).

    // ─── SITUATION B : Europe (PROTECTION de la place) ──────────
    // Equipe DANS une place europeenne ET menacee par celle juste en-dessous
    if (europeanPositions.has(team.rank)) {
      const teamBelow = byRank.get(team.rank + 1);
      if (teamBelow) {
        const gap = team.points - teamBelow.points;
        if (isValidGap(gap)) {
          const myCup = getCupNameForPosition(team.rank, league.european_rules);
          const isBelowEuropean = europeanPositions.has(team.rank + 1);
          if (isBelowEuropean) {
            const belowCup = getCupNameForPosition(team.rank + 1, league.european_rules);
            situations.push({
              type: "europe",
              detail: `Place ${myCup} (${team.rank}e) menacee : ${gap} pt(s) d'avance sur ${teamBelow.team.name} (${belowCup})`,
              gap_points: gap,
            });
          } else {
            situations.push({
              type: "europe",
              detail: `Place ${myCup} (${team.rank}e) menacee : ${gap} pt(s) d'avance sur ${teamBelow.team.name} (hors Europe)`,
              gap_points: gap,
            });
          }
        }
      }
    }
    // Note : on n'ajoute PAS les equipes juste sous l'Europe qui peuvent
    // grimper ; elles n'ont pas de place europeenne A PERDRE.

    // ─── SITUATION C : Relegation (PROTECTION pour ne pas tomber) ──
    // Equipe HORS zone rouge mais juste au-dessus, menacee par 1ere de zone
    if (!relegationPositions.has(team.rank)) {
      const sortedRelegation = Array.from(relegationPositions).sort((a, b) => a - b);
      if (sortedRelegation.length > 0) {
        const firstRelegation = sortedRelegation[0];
        const justAboveZone = firstRelegation - 1;
        if (team.rank === justAboveZone) {
          const firstRelegationTeam = byRank.get(firstRelegation);
          if (firstRelegationTeam) {
            const gap = team.points - firstRelegationTeam.points;
            if (isValidGap(gap)) {
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

    // ─── SITUATION D : Equipe en zone rouge avec niveau intrinseque sup ──
    // Cas particulier : equipe DANS zone rouge mais "trop forte" pour y rester.
    // Bertrand : "place a perdre" peut s'interpreter comme la place
    // historique du club (= projet en debut de saison). Si une equipe est
    // historiquement au-dessus de sa position actuelle, elle a une "place
    // historique a perdre" si elle est releguee.
    if (relegationPositions.has(team.rank)) {
      const intrinsic = intrinsicMap.get(team.team.id);
      if (intrinsic !== undefined && intrinsic < team.rank / 10) {
        situations.push({
          type: "relegation",
          detail: `Zone rouge (${team.rank}e) mais niveau intrinseque ${intrinsic.toFixed(2)} bien meilleur (place historique a defendre)`,
          gap_points: 0,
        });
      }
    }

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


const computeStakeScore = (situations: StakeSituation[]): number => {
  if (situations.length === 0) return 0;
  if (situations.length >= 2) return 3;
  const single = situations[0];
  if (single.gap_points === 0) return 3;
  return 2;
};


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