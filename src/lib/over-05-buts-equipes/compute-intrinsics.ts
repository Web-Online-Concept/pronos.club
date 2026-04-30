// src/lib/over-05-buts-equipes/compute-intrinsics.ts
//
// Calcul des niveaux intrinseques 5 saisons par equipe selon la
// methode Bertrand. Pondere par la division actuelle de l'equipe.
//
// LOGIQUE (precisee par Bertrand) :
//
// Pour une equipe qui joue actuellement dans le championnat C (avec N equipes) :
//
//   Pour chaque saison passee, on cherche ou elle a joue :
//
//   Cas A : Equipe dans le MEME championnat C ou dans un championnat
//           SUPERIEUR cette saison-la
//     -> Score = (rang final) / 10
//     Ex: equipe actuellement en Ligue 1 qui etait 5e en L1 -> 0.5
//         equipe actuellement en Ligue 2 qui etait 17e en L1 -> 1.7
//         equipe actuellement en Ligue 2 qui etait 18e en L1 -> 1.8
//
//   Cas B : Equipe dans le championnat IMMEDIATEMENT INFERIEUR cette saison-la
//     -> Score = N + (rang final)
//     Ex: equipe actuellement en L1 (N=18) qui etait 1er en L2 -> 19
//         equipe actuellement en L1 (N=18) qui etait 5e en L2  -> 23
//         equipe actuellement en L1 (N=18) qui etait 18e en L2 -> 36
//
//   Cas C : Equipe dans une division DEUX crans plus bas (ou plus)
//     -> Score = 40 (forfaitaire)
//     Ex: equipe actuellement en L1 qui jouait en National -> 40
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
  source: "current" | "above" | "one_below" | "two_or_more_below" | "missing";
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
 * Pour un championnat donne, retourne la liste des championnats SUPERIEURS
 * (au-dessus dans la hierarchie du meme pays).
 *
 * Necessaire pour le cas A : une equipe qui est actuellement en D2 mais
 * qui jouait en D1 la saison d'avant.
 *
 * Mapping base sur les pays (D2 -> D1 du meme pays).
 * Ex: Ligue 2 (62) -> Ligue 1 (61)
 *     Championship (40) -> Premier League (39)
 *
 * Pour les D1 (Ligue 1, Premier League, etc.), retourne tableau vide
 * (rien au-dessus dans nos referentiels nationaux).
 */
export const getAboveLeagueIds = (currentLeagueId: number): number[] => {
  const map: Record<number, number[]> = {
    // France : D2 -> D1
    62: [61],            // Ligue 2 -> Ligue 1
    // Angleterre : D2 -> D1
    40: [39],            // Championship -> Premier League
    // Espagne : D2 -> D1
    141: [140],          // La Liga 2 -> La Liga
    // Italie : D2 -> D1
    136: [135],          // Serie B -> Serie A
    // Allemagne : D2 -> D1
    79: [78],            // 2. Bundesliga -> Bundesliga
    // Tous les D1 : rien au-dessus dans notre referentiel
    61: [], 39: [], 140: [], 135: [], 78: [],
    88: [], 94: [], 144: [], 203: [],
  };
  return map[currentLeagueId] ?? [];
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
 *
 * Pour les D2, l'inferieur immediat est la D3, mais on ne l'a pas dans
 * notre referentiel. Donc retourne [] -> forfait 40 si l'equipe etait
 * en D3 ou plus bas.
 */
export const getOneBelowLeagueIds = (currentLeagueId: number): number[] => {
  const map: Record<number, number[]> = {
    // France
    61: [62],            // Ligue 1 -> Ligue 2
    62: [],              // Ligue 2 -> National (pas dans ref)
    // Angleterre
    39: [40],            // Premier League -> Championship
    40: [],              // Championship -> League One (pas dans ref)
    // Espagne
    140: [141],          // La Liga -> La Liga 2
    141: [],             // La Liga 2 -> Primera RFEF (pas dans ref)
    // Italie
    135: [136],          // Serie A -> Serie B
    136: [],             // Serie B -> Serie C (pas dans ref)
    // Allemagne
    78: [79],            // Bundesliga -> 2. Bundesliga
    79: [],              // 2. Bundesliga -> 3. Liga (pas dans ref)
    // Pays-Bas, Portugal, Belgique, Turquie : pas de D2 dans notre ref
    88: [], 94: [], 144: [], 203: [],
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
 * dans le championnat actuel + les championnats superieurs + les inferieurs.
 *
 * Ordre de recherche (logique Bertrand) :
 *   1. Championnat actuel (Cas A : score = rang/10)
 *   2. Championnats superieurs (Cas A : score = rang/10)
 *   3. Championnat directement inferieur (Cas B : score = N + rang)
 *   4. Si non trouve -> Cas C : score = 40 (forfait)
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
  // Helper interne avec cache PARTAGE (pas re-cree, on utilise celui passe)
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

  // 1. Cherche dans le championnat actuel (Cas A : meme championnat)
  const currentStandings = await getStandingsCached(currentLeague.id, season);
  const inCurrent = findTeamInStandings(currentStandings, teamId);
  if (inCurrent) {
    return {
      season,
      score: inCurrent.rank / 10,
      source: "current",
      league_played: currentLeague.name,
      rank_final: inCurrent.rank,
    };
  }

  // 2. Cherche dans les championnats SUPERIEURS (Cas A : score = rang/10)
  //    Important : equipe actuellement en D2 mais qui etait en D1 la saison d'avant
  const aboveIds = getAboveLeagueIds(currentLeague.id);
  for (const aboveId of aboveIds) {
    const aboveStandings = await getStandingsCached(aboveId, season);
    const inAbove = findTeamInStandings(aboveStandings, teamId);
    if (inAbove) {
      return {
        season,
        score: inAbove.rank / 10,
        source: "above",
        league_played: `Division ${currentLeague.division - 1}`,
        rank_final: inAbove.rank,
      };
    }
  }

  // 3. Cherche dans le championnat directement inferieur (Cas B)
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

  // 4. Sinon : equipe pas trouvee dans current/above/one_below
  //    -> 2 ou plus crans plus bas (Cas C) ou equipe absente
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
 * @param teamId Id de l'equipe
 * @param teamName Nom de l'equipe
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

  // Calcul sequentiel (pas Promise.all) pour mieux exploiter le cache
  // au fur et a mesure : si la s2 fetch un standings, la s3 peut le reutiliser
  const results: SeasonScore[] = [];
  for (const s of seasons) {
    const score = await computeSeasonScore(teamId, currentLeague, s, standingsCache);
    results.push(score);
  }

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