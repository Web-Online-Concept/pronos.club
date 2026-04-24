import {
  ApiFootballResponseSchema,
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

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const buildUrl = (endpoint: string, params?: Record<string, string | number>): string => {
  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

const fetchWithTimeout = async (url: string, apiKey: string): Promise<Response> => {
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

  private async rawRequest<T extends z.ZodTypeAny>(
    options: FetchOptions,
    itemSchema: T
  ): Promise<z.infer<T>[]> {
    const { endpoint, params, pickId } = options;
    const url = buildUrl(endpoint, params);
    const schema = ApiFootballResponseSchema(itemSchema);

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

        const json = await response.json();
        const parsed = schema.safeParse(json);

        if (!parsed.success) {
          throw new ApiFootballError(
            `Schema validation failed on ${endpoint}: ${parsed.error.message}`,
            endpoint
          );
        }

        const data = parsed.data;

        if (data.errors) {
          const hasErrors = Array.isArray(data.errors)
            ? data.errors.length > 0
            : Object.keys(data.errors).length > 0;

          if (hasErrors) {
            throw new ApiFootballError(
              `API-Football returned errors`,
              endpoint,
              response.status,
              data.errors
            );
          }
        }

        await trackApiFootballCall(endpoint, pickId ?? null);

        return data.response;
      } catch (err) {
        lastError = err;
        if (err instanceof ApiFootballError && err.statusCode && err.statusCode < 500 && err.statusCode !== 429) {
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

  async getFixtureById(fixtureId: number, pickId?: string | null): Promise<Fixture | null> {
    const results = await this.rawRequest(
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
    }
    const results = await this.rawRequest(
      { endpoint: "/fixtures", params, pickId },
      FixtureSchema
    );
    if (leagueIds && leagueIds.length > 1) {
      return results.filter((f) => leagueIds.includes(f.league.id));
    }
    return results;
  }

  async getOdds(fixtureId: number, pickId?: string | null): Promise<Odds[]> {
    return this.rawRequest(
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
    const results = await this.rawRequest(
      {
        endpoint: "/teams/statistics",
        params: { team: teamId, league: leagueId, season },
        pickId,
      },
      TeamStatisticsSchema
    );
    return results[0] ?? null;
  }

  async getLineups(fixtureId: number, pickId?: string | null): Promise<Lineup[]> {
    return this.rawRequest(
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
    return this.rawRequest(
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
    return this.rawRequest(
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
    const results = await this.rawRequest(
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
    return this.rawRequest(
      {
        endpoint: "/fixtures",
        params: { team: teamId, last },
        pickId,
      },
      FixtureSchema
    );
  }

  async healthCheck(): Promise<{ ok: boolean; requestsRemaining: number | null }> {
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