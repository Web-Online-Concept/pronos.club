// src/lib/over-05-buts-equipes/apifootball-team-stats-service.ts
//
// Service de recuperation des stats d'une equipe via API-Football.
// Utilise pour les 9 championnats hors Top 5 (Ligue 2, Championship,
// La Liga 2, 2.Bundesliga, Serie B, Eredivisie, Liga Portugal, Pro
// League, Süper Lig).
//
// API-Football ne fournit PAS d'xG mais fournit :
//   - Buts marques / encaisses par match
//   - Tirs totaux / cadres par match
//   - Possession, cartons, etc.
//
// On substitue donc :
//   - xG_weighted -> goals_weighted (= buts marques ponderes)
//   - xGC_weighted -> goals_conceded_weighted (= buts concedes ponderes)
//   - GO (grosses occasions) -> heuristique : tirs cadres * 0.3 (approximation)
//
// Endpoints utilises :
//   - GET /fixtures?team={id}&season={year}&last=10  (recuperer fixtures recentes)
//   - GET /fixtures/statistics?fixture={id}          (stats detaillees)

const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;


// ─── Types ───────────────────────────────────────────────────────

export type ApiFootballTeamMatch = {
  fixture_id: number;
  date: string;                      // ISO "2026-05-10T17:00:00+00:00"
  is_home: boolean;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  goals_for: number;
  goals_against: number;
  shots_total_for: number;
  shots_on_goal_for: number;
  shots_total_against: number;
  shots_on_goal_against: number;
  status_short: string;              // "FT" = fini
};


export class ApiFootballError extends Error {
  constructor(message: string, public readonly endpoint: string, public readonly status?: number) {
    super(message);
    this.name = "ApiFootballError";
  }
}


// ─── Helper fetch ─────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));


const fetchApiFootball = async <T = unknown>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<T> => {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("Missing API_FOOTBALL_KEY env variable");
  }

  const queryString = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();

  const url = `${API_FOOTBALL_BASE_URL}/${endpoint}?${queryString}`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": "v3.football.api-sports.io",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new ApiFootballError(
          `API-Football returned ${response.status}`,
          endpoint,
          response.status
        );
      }

      const data = (await response.json()) as { response: T; errors?: unknown };

      // Check API-Football specific errors
      if (data.errors && typeof data.errors === "object" && Object.keys(data.errors).length > 0) {
        throw new ApiFootballError(
          `API-Football error: ${JSON.stringify(data.errors)}`,
          endpoint
        );
      }

      return data.response;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new ApiFootballError("Max retries", endpoint);
};


// ─── API publique ────────────────────────────────────────────────

/**
 * Recupere les N derniers matchs (avec stats) d'une equipe via API-Football.
 *
 * @param apiFootballTeamId ID API-Football de l'equipe
 * @param season Annee de saison (ex: 2025 pour 2025-26)
 * @param beforeDate Date avant laquelle filtrer (string ISO "YYYY-MM-DD")
 *                   Sert a exclure le match en cours d'analyse.
 * @param limit Nombre de matchs a recuperer (3 pour la methode Bertrand)
 */
export const getApiFootballTeamLastMatches = async (
  apiFootballTeamId: number,
  season: number,
  beforeDate: string,
  limit: number = 3
): Promise<ApiFootballTeamMatch[]> => {
  // 1. Recuperer les fixtures recentes (jusqu'a 10 pour filtrer)
  type RawFixture = {
    fixture: {
      id: number;
      date: string;
      status: { short: string };
    };
    teams: {
      home: { id: number; name: string };
      away: { id: number; name: string };
    };
    goals: { home: number | null; away: number | null };
  };

  const fixtures = await fetchApiFootball<RawFixture[]>("fixtures", {
    team: apiFootballTeamId,
    season,
    last: 10,
  });

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return [];
  }

  // 2. Filtrer : seulement fixtures FINIES, avant beforeDate
  const beforeTimestamp = new Date(beforeDate).getTime();
  const validFixtures = fixtures.filter((f) => {
    if (f.fixture.status.short !== "FT") return false;
    const fixtureTimestamp = new Date(f.fixture.date).getTime();
    return fixtureTimestamp < beforeTimestamp;
  });

  // 3. Garder les N plus recents
  const sortedFixtures = validFixtures
    .sort((a, b) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())
    .slice(0, limit);

  if (sortedFixtures.length === 0) {
    return [];
  }

  // 4. Pour chaque fixture, recuperer les stats detaillees
  const results: ApiFootballTeamMatch[] = [];

  for (const f of sortedFixtures) {
    try {
      const isHome = f.teams.home.id === apiFootballTeamId;
      const stats = await getFixtureStatistics(f.fixture.id);
      const teamStats = stats.find((s) => s.team_id === apiFootballTeamId);
      const oppStats = stats.find((s) => s.team_id !== apiFootballTeamId);

      results.push({
        fixture_id: f.fixture.id,
        date: f.fixture.date,
        is_home: isHome,
        home_team_id: f.teams.home.id,
        away_team_id: f.teams.away.id,
        home_team_name: f.teams.home.name,
        away_team_name: f.teams.away.name,
        goals_for: isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0),
        goals_against: isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0),
        shots_total_for: teamStats?.shots_total ?? 0,
        shots_on_goal_for: teamStats?.shots_on_goal ?? 0,
        shots_total_against: oppStats?.shots_total ?? 0,
        shots_on_goal_against: oppStats?.shots_on_goal ?? 0,
        status_short: f.fixture.status.short,
      });
    } catch (err) {
      console.warn(
        `[apifootball-team-stats] Failed to fetch stats for fixture ${f.fixture.id}:`,
        err instanceof Error ? err.message : err
      );
      // On garde quand meme la fixture mais avec stats partielles
      const isHome = f.teams.home.id === apiFootballTeamId;
      results.push({
        fixture_id: f.fixture.id,
        date: f.fixture.date,
        is_home: isHome,
        home_team_id: f.teams.home.id,
        away_team_id: f.teams.away.id,
        home_team_name: f.teams.home.name,
        away_team_name: f.teams.away.name,
        goals_for: isHome ? (f.goals.home ?? 0) : (f.goals.away ?? 0),
        goals_against: isHome ? (f.goals.away ?? 0) : (f.goals.home ?? 0),
        shots_total_for: 0,
        shots_on_goal_for: 0,
        shots_total_against: 0,
        shots_on_goal_against: 0,
        status_short: f.fixture.status.short,
      });
    }
  }

  return results;
};


/**
 * Recupere les stats detaillees d'une fixture (pour les 2 equipes).
 */
type FixtureStatsByTeam = {
  team_id: number;
  team_name: string;
  shots_total: number;
  shots_on_goal: number;
};

const getFixtureStatistics = async (
  fixtureId: number
): Promise<FixtureStatsByTeam[]> => {
  type RawStats = {
    team: { id: number; name: string };
    statistics: Array<{ type: string; value: number | string | null }>;
  };

  const stats = await fetchApiFootball<RawStats[]>("fixtures/statistics", {
    fixture: fixtureId,
  });

  if (!Array.isArray(stats)) {
    return [];
  }

  return stats.map((s) => {
    const findStat = (type: string): number => {
      const stat = s.statistics.find(
        (st) => st.type.toLowerCase() === type.toLowerCase()
      );
      if (!stat || stat.value === null) return 0;
      const num = typeof stat.value === "string"
        ? parseInt(stat.value.replace("%", ""), 10) || 0
        : Number(stat.value) || 0;
      return num;
    };

    return {
      team_id: s.team.id,
      team_name: s.team.name,
      shots_total: findStat("Total Shots"),
      shots_on_goal: findStat("Shots on Goal"),
    };
  });
};