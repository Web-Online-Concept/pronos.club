import {
  FixtureSchema,
  InjurySchema,
  LineupSchema,
  OddsSchema,
  PredictionSchema,
  TeamStatisticsSchema,
  type Fixture,
  type Injury,
  type Lineup,
  type Odds,
  type Prediction,
  type TeamStatistics,
} from "@/types/apifootball";
import { trackApiFootballCall } from "./cost-tracker";
import { z } from "zod";

const API_BASE_URL = "https://v3.football.api-sports.io";


/**
 * Determine la saison API-Football actuelle.
 * Format API-Football : annee de demarrage uniquement.
 * Ex: saison 2025/2026 (aout 2025 -> juin 2026) -> "2025"
 *
 * Pour les Big 5 europeens, la saison demarre en aout/septembre.
 * On bascule sur la nouvelle saison a partir de juillet (mois 7).
 */
const getCurrentApiFootballSeason = (): number => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month >= 7 ? year : year - 1;
};



const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

export class ApiFootballError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly statusCode?: number,
    public readonly apiErrors?: unknown
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

type FetchOptions = {
  endpoint: string;
  params?: Record<string, string | number>;
  pickId?: string | null;
};

type ApiFootballEnvelope = {
  get: string;
  parameters?: Record<string, string | number>;
  errors?: unknown[] | Record<string, string>;
  results: number;
  paging?: { current: number; total: number };
  response: unknown;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const buildUrl = (
  endpoint: string,
  params?: Record<string, string | number>
): string => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

const fetchWithTimeout = async (
  url: string,
  apiKey: string
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const hasErrors = (errors: unknown): boolean => {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return false;
};

export class ApiFootballClient {
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.API_FOOTBALL_KEY;
    if (!key) {
      throw new Error(
        "API_FOOTBALL_KEY is missing. Set it in environment variables."
      );
    }
    this.apiKey = key;
  }

  private async fetchRaw(
    options: FetchOptions
  ): Promise<ApiFootballEnvelope> {
    const { endpoint, params, pickId } = options;
    const url = buildUrl(endpoint, params);

    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetchWithTimeout(url, this.apiKey);

        if (response.status === 429) {
          const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[apifootball] Rate limited on ${endpoint}, waiting ${waitMs}ms`
          );
          await sleep(waitMs);
          continue;
        }

        if (response.status >= 500) {
          const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[apifootball] Server error ${response.status} on ${endpoint}, retrying in ${waitMs}ms`
          );
          await sleep(waitMs);
          continue;
        }

        if (!response.ok) {
          throw new ApiFootballError(
            `API-Football returned ${response.status}`,
            endpoint,
            response.status
          );
        }

        const json = (await response.json()) as ApiFootballEnvelope;

        if (hasErrors(json.errors)) {
          // V3.5 Lot 18 — Debug : log explicite des erreurs API-Football
          // pour identifier rapidement les causes (saison, ligue, équipe...).
          console.warn(
            `[apifootball] API returned errors on ${endpoint} (params=${JSON.stringify(
              params ?? {}
            )}, pickId=${pickId ?? "n/a"}): ${JSON.stringify(json.errors)}`
          );
          throw new ApiFootballError(
            `API-Football returned errors`,
            endpoint,
            response.status,
            json.errors
          );
        }

        await trackApiFootballCall(endpoint, pickId ?? null);

        return json;
      } catch (err) {
        lastError = err;
        if (
          err instanceof ApiFootballError &&
          err.statusCode &&
          err.statusCode < 500 &&
          err.statusCode !== 429
        ) {
          throw err;
        }
        if (attempt === MAX_RETRIES - 1) {
          throw err;
        }
        const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(waitMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ApiFootballError(`Max retries reached on ${endpoint}`, endpoint);
  }

  private async requestArray<T extends z.ZodTypeAny>(
    options: FetchOptions,
    itemSchema: T
  ): Promise<z.infer<T>[]> {
    const raw = await this.fetchRaw(options);

    if (!Array.isArray(raw.response)) {
      return [];
    }

    const arraySchema = z.array(itemSchema);
    const parsed = arraySchema.safeParse(raw.response);
    if (!parsed.success) {
      throw new ApiFootballError(
        `Schema validation failed on ${options.endpoint}: ${parsed.error.message}`,
        options.endpoint
      );
    }
    return parsed.data;
  }

  private async requestObject<T extends z.ZodTypeAny>(
    options: FetchOptions,
    itemSchema: T
  ): Promise<z.infer<T> | null> {
    const raw = await this.fetchRaw(options);

    if (raw.response === null || raw.response === undefined) return null;
    if (Array.isArray(raw.response) && raw.response.length === 0) return null;

    const parsed = itemSchema.safeParse(raw.response);
    if (!parsed.success) {
      throw new ApiFootballError(
        `Schema validation failed on ${options.endpoint}: ${parsed.error.message}`,
        options.endpoint
      );
    }
    return parsed.data;
  }

  async getFixtureById(
    fixtureId: number,
    pickId?: string | null
  ): Promise<Fixture | null> {
    const results = await this.requestArray(
      {
        endpoint: "/fixtures",
        params: { id: fixtureId },
        pickId,
      },
      FixtureSchema
    );
    return results[0] ?? null;
  }

  async getFixturesByDate(
    date: string,
    leagueIds?: number[],
    pickId?: string | null
  ): Promise<Fixture[]> {
    const params: Record<string, string | number> = { date };
    if (leagueIds && leagueIds.length === 1) {
      params.league = leagueIds[0];
      // API-Football exige le parametre season quand on filtre par league.
      // Saison europeenne : "2025" pour aout 2025 -> juin 2026.
      params.season = getCurrentApiFootballSeason();
    }
    const results = await this.requestArray(
      { endpoint: "/fixtures", params, pickId },
      FixtureSchema
    );
    if (leagueIds && leagueIds.length > 1) {
      return results.filter((f) => leagueIds.includes(f.league.id));
    }
    return results;
  }

  async getOdds(fixtureId: number, pickId?: string | null): Promise<Odds[]> {
    return this.requestArray(
      {
        endpoint: "/odds",
        params: { fixture: fixtureId },
        pickId,
      },
      OddsSchema
    );
  }

  async getTeamStatistics(
    teamId: number,
    leagueId: number,
    season: number,
    pickId?: string | null
  ): Promise<TeamStatistics | null> {
    return this.requestObject(
      {
        endpoint: "/teams/statistics",
        params: { team: teamId, league: leagueId, season },
        pickId,
      },
      TeamStatisticsSchema
    );
  }

  async getLineups(
    fixtureId: number,
    pickId?: string | null
  ): Promise<Lineup[]> {
    return this.requestArray(
      {
        endpoint: "/fixtures/lineups",
        params: { fixture: fixtureId },
        pickId,
      },
      LineupSchema
    );
  }

  async getInjuries(
    fixtureId: number,
    pickId?: string | null
  ): Promise<Injury[]> {
    return this.requestArray(
      {
        endpoint: "/injuries",
        params: { fixture: fixtureId },
        pickId,
      },
      InjurySchema
    );
  }

  async getH2H(
    homeTeamId: number,
    awayTeamId: number,
    last: number = 10,
    pickId?: string | null
  ): Promise<Fixture[]> {
    return this.requestArray(
      {
        endpoint: "/fixtures/headtohead",
        params: { h2h: `${homeTeamId}-${awayTeamId}`, last },
        pickId,
      },
      FixtureSchema
    );
  }

  async getPredictions(
    fixtureId: number,
    pickId?: string | null
  ): Promise<Prediction | null> {
    const results = await this.requestArray(
      {
        endpoint: "/predictions",
        params: { fixture: fixtureId },
        pickId,
      },
      PredictionSchema
    );
    return results[0] ?? null;
  }

  async getTeamRecentFixtures(
    teamId: number,
    last: number = 5,
    pickId?: string | null
  ): Promise<Fixture[]> {
    return this.requestArray(
      {
        endpoint: "/fixtures",
        params: { team: teamId, last },
        pickId,
      },
      FixtureSchema
    );
  }

  async healthCheck(): Promise<{
    ok: boolean;
    requestsRemaining: number | null;
  }> {
    const url = buildUrl("/status");
    try {
      const response = await fetchWithTimeout(url, this.apiKey);
      if (!response.ok) {
        return { ok: false, requestsRemaining: null };
      }
      const json = await response.json();
      const remaining =
        json?.response?.requests?.limit_day !== undefined &&
        json?.response?.requests?.current !== undefined
          ? Number(json.response.requests.limit_day) -
            Number(json.response.requests.current)
          : null;
      return { ok: true, requestsRemaining: remaining };
    } catch {
      return { ok: false, requestsRemaining: null };
    }
  }
}

export const apiFootball = new ApiFootballClient();