// src/lib/over-05-buts-equipes/compute-intrinsics.ts
//
// Calcul des niveaux intrinseques 5 saisons par equipe selon la
// methode Bertrand. Pondere par la division actuelle de l'equipe.
//
// LOGIQUE (validee par Florent et Bertrand) :
//
// Pour une equipe qui joue actuellement dans le championnat C (avec N equipes) :
//
//   Pour chaque saison passee, on regarde dans quelle division elle a joue :
//
//   Cas 1 : Equipe dans le MEME championnat C ou un championnat SUPERIEUR
//           cette saison-la
//     -> Score = (rang final) / 10
//     Ex: 1er en Ligue 1 = 0.1, 17e en Ligue 1 = 1.7
//
//   Cas 2 : Equipe dans le championnat IMMEDIATEMENT INFERIEUR cette saison-la
//     -> Score = N + (rang final)
//     Ex: equipe Ligue 1 (N=18) qui etait 1er en Ligue 2 -> 18+1=19
//         equipe Ligue 1 (N=18) qui etait 5e en Ligue 2  -> 18+5=23
//         equipe Ligue 1 (N=18) qui etait 18e en Ligue 2 -> 18+18=36
//
//   Cas 3 : Equipe dans une division DEUX crans plus bas (ou plus)
//     -> Score = 40 (forfaitaire)
//
// Le score final intrinseque = moyenne arithmetique des 5 scores saisonniers.

import { getO05Standings, type O05StandingTeam } from "./apifootball-standings";


// ─── Types ─────────────────────────────────────────────────────────


export type LeagueRef = {
  id: number;            // League ID API-Football (ex: 61 pour Ligue 1)
  name: string;          // ex: "Ligue 1"
  country: string;       // ex: "France"
  division: number;      // 1 ou 2
  total_teams: number;   // ex: 18 pour Ligue 1
};


export type SeasonScore = {
  season: number;        // ex: 2024 pour saison 2024-25
  score: number;         // ex: 1.7
  source: "same_or_higher" | "one_below" | "two_or_more_below" | "missing";
  league_played: string | null;  // nom du championnat ou l'equipe a joue
  rank_final: number | null;     // rang final dans ce championnat
};


export type TeamIntrinsicResult = {
  team_id: number;
  team_name: string;
  current_league_id: number;
  scores: {
    s1: SeasonScore;  // saison N (en cours)
    s2: SeasonScore;  // N-1
    s3: SeasonScore;  // N-2
    s4: SeasonScore;  // N-3
    s5: SeasonScore;  // N-4
  };
  intrinsic_average: number;
  computed_for_season: number;
};


// ─── Helpers ───────────────────────────────────────────────────────


/**
 * Determine la saison API-Football actuelle.
 * Format API-Football : annee de demarrage (saison 2025-2026 = 2025).
 * Bascule en juillet (mois 7) sur la nouvelle saison.
 */
export const getCurrentApiFootballSeason = (): number => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 7 ? year : year - 1;
};


/**
 * Pour un championnat donne, retourne la liste des championnats
 * directement INFERIEURS (1 cran plus bas).
 *
 * Mapping base sur les pays (D1 -> D2 du meme pays).
 * Ex: Ligue 1 (61) -> Ligue 2 (62)
 *     Premier League (39) -> Championship (40)
 *
 * Pour les championnats sans D2 dans notre referentiel (Eredivisie,
 * Primeira, etc.), retourne un tableau vide -> toute saison passee
 * dans une autre division compte comme "two_or_more_below" (forfait 40).
 */
export const getOneBelowLeagueIds = (currentLeagueId: number): number[] => {
  const map: Record<number, number[]> = {
    // France
    61: [62],            // Ligue 1 -> Ligue 2
    62: [],              // Ligue 2 -> National (pas dans notre ref) -> []
    // Angleterre
    39: [40],            // Premier League -> Championship
    40: [],              // Championship -> League One (pas dans ref) -> []
    // Espagne
    140: [141],          // La Liga -> La Liga 2
    141: [],             // La Liga 2 -> Primera RFEF (pas dans ref) -> []
    // Italie
    135: [136],          // Serie A -> Serie B
    136: [],             // Serie B -> Serie C (pas dans ref) -> []
    // Allemagne
    78: [79],            // Bundesliga -> 2. Bundesliga
    79: [],              // 2. Bundesliga -> 3. Liga (pas dans ref) -> []
    // Pays-Bas, Portugal, Belgique, Turquie : pas de D2 dans notre ref
    88: [],              // Eredivisie
    94: [],              // Primeira Liga
    144: [],             // Pro League BE
    203: [],             // Süper Lig
  };
  return map[currentLeagueId] ?? [];
};


/**
 * Cherche une equipe dans une liste de standings (peut renvoyer null si
 * l'equipe ne jouait pas dans ce championnat cette saison-la).
 */
const findTeamInStandings = (
  standings: O05StandingTeam[] | null,
  teamId: number
): O05StandingTeam | null => {
  if (!standings) return null;
  return standings.find((s) => s.team.id === teamId) ?? null;
};


/**
 * Calcule le score d'une equipe pour UNE saison donnee, en cherchant
 * dans le championnat actuel + les championnats inferieurs.
 *
 * @param teamId Id de l'equipe
 * @param currentLeague Championnat actuel de l'equipe
 * @param season Saison API-Football a verifier
 * @param standingsCache Cache (leagueId, season) -> standings, pour eviter
 *                       de re-fetch des donnees deja chargees.
 */
export const computeSeasonScore = async (
  teamId: number,
  currentLeague: LeagueRef,
  season: number,
  standingsCache: Map<string, O05StandingTeam[] | null>
): Promise<SeasonScore> => {
  // Helper interne avec cache
  const getStandingsCached = async (
    leagueId: number,
    s: number
  ): Promise<O05StandingTeam[] | null> => {
    const cacheKey = `${leagueId}_${s}`;
    if (standingsCache.has(cacheKey)) {
      return standingsCache.get(cacheKey) ?? null;
    }
    try {
      const standings = await getO05Standings(leagueId, s);
      standingsCache.set(cacheKey, standings);
      return standings;
    } catch (err) {
      console.warn(
        `[compute-intrinsics] Failed to fetch standings league=${leagueId} season=${s}:`,
        err instanceof Error ? err.message : err
      );
      standingsCache.set(cacheKey, null);
      return null;
    }
  };

  // 1. Cherche dans le championnat actuel (Cas 1 : meme championnat)
  const currentStandings = await getStandingsCached(currentLeague.id, season);
  const inCurrent = findTeamInStandings(currentStandings, teamId);
  if (inCurrent) {
    return {
      season,
      score: inCurrent.rank / 10,
      source: "same_or_higher",
      league_played: currentLeague.name,
      rank_final: inCurrent.rank,
    };
  }

  // 2. Cherche dans le championnat directement inferieur (Cas 2)
  const oneBelowIds = getOneBelowLeagueIds(currentLeague.id);
  for (const belowId of oneBelowIds) {
    const belowStandings = await getStandingsCached(belowId, season);
    const inBelow = findTeamInStandings(belowStandings, teamId);
    if (inBelow) {
      return {
        season,
        score: currentLeague.total_teams + inBelow.rank,
        source: "one_below",
        league_played: `Division ${currentLeague.division + 1}`,
        rank_final: inBelow.rank,
      };
    }
  }

  // 3. Sinon : equipe pas trouvee dans current ni one_below
  //    -> 2 ou plus crans plus bas (Cas 3) ou equipe absente (promotion recente)
  return {
    season,
    score: 40,
    source: "two_or_more_below",
    league_played: null,
    rank_final: null,
  };
};


/**
 * Calcule le niveau intrinseque complet d'une equipe sur 5 saisons.
 *
 * @param team Reference de l'equipe (issue du standings actuel)
 * @param currentLeague Championnat actuel de l'equipe
 * @param currentSeason Saison API-Football en cours (ex: 2025)
 * @param standingsCache Cache partage entre tous les calculs (cle: leagueId_season)
 */
export const computeTeamIntrinsic = async (
  teamId: number,
  teamName: string,
  currentLeague: LeagueRef,
  currentSeason: number,
  standingsCache: Map<string, O05StandingTeam[] | null>
): Promise<TeamIntrinsicResult> => {
  // 5 saisons : courante (s1) + 4 passees (s2 a s5)
  const seasons = [
    currentSeason,
    currentSeason - 1,
    currentSeason - 2,
    currentSeason - 3,
    currentSeason - 4,
  ];

  const results = await Promise.all(
    seasons.map((s) =>
      computeSeasonScore(teamId, currentLeague, s, standingsCache)
    )
  );

  const [s1, s2, s3, s4, s5] = results;

  // Moyenne arithmetique des 5 scores
  const sum = s1.score + s2.score + s3.score + s4.score + s5.score;
  const intrinsic_average = Math.round((sum / 5) * 100) / 100;

  return {
    team_id: teamId,
    team_name: teamName,
    current_league_id: currentLeague.id,
    scores: { s1, s2, s3, s4, s5 },
    intrinsic_average,
    computed_for_season: currentSeason,
  };
};