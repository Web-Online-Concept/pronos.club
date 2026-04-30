// src/lib/over-05-buts-equipes/apifootball-fixtures.ts
//
// Client API-Football MINIMAL et ISOLE pour O05 (Phase 3).
//
// CE FICHIER N'EST PAS PARTAGE avec les Pronos IA. Aucun changement ici ne
// peut affecter le systeme Pronos IA ou Pronos Tipster.
//
// Usage :
//   - getO05FixturesByDateRange(leagueId, season, from, to)
//     -> liste des matchs d'un championnat sur une plage de dates
//   - getO05TeamLastFixtures(teamId, last)
//     -> N derniers matchs d'une equipe (quel que soit le championnat)

import { z } from "zod";

const API_BASE_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;


// ─── Schema Fixture (specifique O05) ────────────────────────────


export const O05FixtureSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    timestamp: z.number(),
    timezone: z.string(),
    status: z.object({
      long: z.string(),
      short: z.string(),
      elapsed: z.number().nullable(),
    }),
  }),
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    season: z.number(),
    round: z.string().nullable(),
  }),
  teams: z.object({
    home: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().nullable(),
      winner: z.boolean().nullable(),
    }),
    away: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().nullable(),
      winner: z.boolean().nullable(),
    }),
  }),
  goals: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
  }),
}).passthrough();

export type O05Fixture = z.infer<typeof O05FixtureSchema>;


type O05ApiEnvelope = {
  get: string;
  errors?: unknown[] | Record<string, string>;
  results: number;
  response: unknown;
};


// ─── Helpers reseau ───────────────────────────────────────────────


export class O05FixturesApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "O05FixturesApiError";
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const hasErrors = (errors: unknown): boolean => {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return false;
};

const getApiKey = (): string => {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error("API_FOOTBALL_KEY is missing in environment variables");
  }
  return key;
};

const fetchWithTimeout = async (url: string, apiKey: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};


/**
 * Helper interne pour faire un appel /fixtures avec retry et schema validation.
 */
const fetchFixturesRaw = async (
  url: string,
  endpointLabel: string
): Promise<O05Fixture[]> => {
  const apiKey = getApiKey();
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, apiKey);

      if (response.status === 429) {
        const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[o05-fixtures] Rate limited on ${endpointLabel}, waiting ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      if (response.status >= 500) {
        const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[o05-fixtures] Server error ${response.status}, retrying`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new O05FixturesApiError(
          `API-Football returned ${response.status}`,
          endpointLabel,
          response.status
        );
      }

      const json = (await response.json()) as O05ApiEnvelope;

      if (hasErrors(json.errors)) {
        throw new O05FixturesApiError(
          `API-Football returned errors on ${endpointLabel}`,
          endpointLabel,
          response.status
        );
      }

      if (!Array.isArray(json.response)) {
        return [];
      }

      const arraySchema = z.array(O05FixtureSchema);
      const parsed = arraySchema.safeParse(json.response);
      if (!parsed.success) {
        console.warn(
          `[o05-fixtures] Schema partial failure on ${endpointLabel}, returning raw`
        );
        // En cas de validation partielle on retourne ce qui matche le schema
        const valid: O05Fixture[] = [];
        for (const item of json.response) {
          const itemParsed = O05FixtureSchema.safeParse(item);
          if (itemParsed.success) valid.push(itemParsed.data);
        }
        return valid;
      }
      return parsed.data;

    } catch (err) {
      lastError = err;
      if (
        err instanceof O05FixturesApiError &&
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
    : new O05FixturesApiError(`Max retries reached`, endpointLabel);
};


/**
 * Fetch les fixtures d'un championnat sur une plage de dates.
 *
 * @param leagueId  ID du championnat (ex: 61 pour Ligue 1)
 * @param season    Saison API-Football (ex: 2025)
 * @param fromDate  Date de debut au format YYYY-MM-DD (ex: "2026-04-30")
 * @param toDate    Date de fin au format YYYY-MM-DD (ex: "2026-05-02")
 * @returns         Liste des fixtures sur cette plage
 */
export const getO05FixturesByDateRange = async (
  leagueId: number,
  season: number,
  fromDate: string,
  toDate: string
): Promise<O05Fixture[]> => {
  const url = `${API_BASE_URL}/fixtures?league=${leagueId}&season=${season}&from=${fromDate}&to=${toDate}`;
  return fetchFixturesRaw(url, `/fixtures league=${leagueId} from=${fromDate} to=${toDate}`);
};


/**
 * Fetch les N derniers matchs d'une equipe (quel que soit le championnat).
 *
 * @param teamId  ID de l'equipe API-Football
 * @param last    Nombre de matchs a recuperer (defaut: 5)
 * @returns       Liste des derniers matchs joues par l'equipe
 */
export const getO05TeamLastFixtures = async (
  teamId: number,
  last: number = 5
): Promise<O05Fixture[]> => {
  const url = `${API_BASE_URL}/fixtures?team=${teamId}&last=${last}`;
  return fetchFixturesRaw(url, `/fixtures team=${teamId} last=${last}`);
};


/**
 * Verifie si un fixture est termine (FT, AET, PEN, etc.).
 */
export const isO05FixtureFinished = (fixture: O05Fixture): boolean => {
  const finishedShorts = ["FT", "AET", "PEN", "AWD", "WO"];
  return finishedShorts.includes(fixture.fixture.status.short);
};