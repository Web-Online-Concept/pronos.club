// src/lib/over-05-buts-equipes/apifootball-standings.ts
//
// Client API-Football MINIMAL et ISOLE pour l'outil "Over 0.5 buts Equipes".
//
// CE FICHIER N'EST PAS PARTAGE avec les Pronos IA. Aucun changement ici ne
// peut affecter le systeme Pronos IA ou Pronos Tipster. Il dispose de sa
// propre instance et de ses propres types.
//
// Usage : recuperer les classements (standings) d'un championnat pour une
// saison donnee, afin de calculer les niveaux intrinseques 5 saisons.

import { z } from "zod";

const API_BASE_URL = "https://v3.football.api-sports.io";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;


// ─── Types Standing (specifique O05) ────────────────────────────


export const O05StandingTeamSchema = z.object({
  rank: z.number(),
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().nullable(),
  }),
  points: z.number(),
  goalsDiff: z.number(),
  group: z.string().nullable().optional(),
  form: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  all: z.object({
    played: z.number(),
    win: z.number(),
    draw: z.number(),
    lose: z.number(),
    goals: z.object({
      for: z.number(),
      against: z.number(),
    }),
  }).passthrough(),
}).passthrough();

export type O05StandingTeam = z.infer<typeof O05StandingTeamSchema>;


// La reponse API-Football pour /standings retourne :
// response: [ { league: { id, name, season, standings: [[team1, team2, ...]] } } ]
// Le double tableau gere les championnats avec poules (UCL groupe phase, etc).
// Pour les championnats classiques (Ligue 1, etc.), c'est un tableau de 1 element.
const O05StandingsResponseSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    logo: z.string().nullable(),
    flag: z.string().nullable(),
    season: z.number(),
    standings: z.array(z.array(O05StandingTeamSchema)),
  }),
});

type O05ApiEnvelope = {
  get: string;
  errors?: unknown[] | Record<string, string>;
  results: number;
  response: unknown;
};


// ─── Helpers reseau ───────────────────────────────────────────────


export class O05ApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly statusCode?: number,
    public readonly apiErrors?: unknown
  ) {
    super(message);
    this.name = "O05ApiError";
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


// ─── Client minimal ───────────────────────────────────────────────


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
 * Fetch standings d'une ligue pour une saison donnee.
 *
 * @param leagueId  ID API-Football du championnat (ex: 61 pour Ligue 1)
 * @param season    Saison API-Football (ex: 2024 pour saison 2024-2025)
 * @returns         Tableau plat des equipes avec leur position finale,
 *                  ou null si la saison n'est pas disponible.
 *
 * Pour les championnats avec poules (rare en championnat national), on
 * concatene toutes les poules. Pour les championnats classiques (toutes
 * les Top 5 + 2e divisions europeennes), c'est un seul groupe.
 */
export const getO05Standings = async (
  leagueId: number,
  season: number
): Promise<O05StandingTeam[] | null> => {
  const apiKey = getApiKey();
  const url = `${API_BASE_URL}/standings?league=${leagueId}&season=${season}`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, apiKey);

      if (response.status === 429) {
        const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[o05-standings] Rate limited on league=${leagueId} season=${season}, waiting ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      if (response.status >= 500) {
        const waitMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[o05-standings] Server error ${response.status}, retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      if (!response.ok) {
        throw new O05ApiError(
          `API-Football returned ${response.status}`,
          "/standings",
          response.status
        );
      }

      const json = (await response.json()) as O05ApiEnvelope;

      if (hasErrors(json.errors)) {
        throw new O05ApiError(
          `API-Football returned errors`,
          "/standings",
          response.status,
          json.errors
        );
      }

      // La reponse est un tableau (en general 1 element pour /standings)
      if (!Array.isArray(json.response) || json.response.length === 0) {
        return null;
      }

      const parsed = O05StandingsResponseSchema.safeParse(json.response[0]);
      if (!parsed.success) {
        throw new O05ApiError(
          `Schema validation failed: ${parsed.error.message}`,
          "/standings"
        );
      }

      // Aplatir : si poules multiples, on concatene
      const flat: O05StandingTeam[] = [];
      for (const group of parsed.data.league.standings) {
        flat.push(...group);
      }
      return flat;

    } catch (err) {
      lastError = err;
      if (
        err instanceof O05ApiError &&
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
    : new O05ApiError(`Max retries reached on /standings`, "/standings");
};