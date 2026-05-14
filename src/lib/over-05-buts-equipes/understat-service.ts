// src/lib/over-05-buts-equipes/understat-service.ts
//
// Service Understat — VERSION 2 (AJAX endpoints)
//
// ─────────────────────────────────────────────────────────────────
// HISTORIQUE DU CHANGEMENT (mai 2026) :
//
// Understat a migré son architecture en décembre 2025. Avant : les
// données étaient injectées en dur dans le HTML via :
//
//     var datesData = JSON.parse('\\x7B"..."}');
//
// Maintenant : Understat sert les données via des endpoints AJAX
// internes qui retournent du JSON directement. Pas de scraping HTML
// requis, pas de regex, pas de décodage \xHH.
//
// Endpoints découverts :
//   - GET https://understat.com/getTeamData/{slug}/{year}
//     → { dates: [...], players: [...], statistics: {...} }
//   - GET https://understat.com/getMatchData/{match_id}
//     → { shots: {...}, rosters: {...}, tmpl: {...} }
//
// Header OBLIGATOIRE pour que ça marche :
//   X-Requested-With: XMLHttpRequest
//
// Source confirmation : code Python officiel understatapi 0.7.1
// (https://collinb9.github.io/understatAPI/)
// ─────────────────────────────────────────────────────────────────

const UNDERSTAT_BASE_URL = "https://understat.com";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";


// ─── Types ───────────────────────────────────────────────────────

export type UnderstatTeamMatch = {
  match_id: number;
  date: string;              // "2026-05-10 17:00:00"
  is_home: boolean;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  home_xg: number;
  away_xg: number;
};

export type UnderstatShot = {
  match_id: number;
  player: string;
  is_home: boolean;
  xg: number;
  result: string;
};


// Raw types from Understat API
type RawDateEntry = {
  id?: string | number;
  isResult?: boolean | string;
  side?: "h" | "a";
  h?: { id?: string; title?: string; short_title?: string };
  a?: { id?: string; title?: string; short_title?: string };
  goals?: { h?: string | number; a?: string | number };
  xG?: { h?: string | number; a?: string | number };
  datetime?: string;
};

type RawShotEntry = {
  id?: string | number;
  match_id?: string | number;
  player?: string;
  xG?: string | number;
  result?: string;
  h_a?: "h" | "a";
};


export class UnderstatError extends Error {
  constructor(message: string, public readonly url: string, public readonly status?: number) {
    super(message);
    this.name = "UnderstatError";
  }
}


// ─── Helper : fetch AJAX ─────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));


/**
 * Fait un appel AJAX vers un endpoint Understat.
 * Retourne le JSON parsé directement.
 *
 * Headers critiques :
 *   - X-Requested-With: XMLHttpRequest (sans ça, Understat renvoie le HTML)
 *   - User-Agent navigateur (sinon parfois bloqué)
 */
const fetchUnderstatAjax = async <T = unknown>(
  endpoint: string
): Promise<T> => {
  const url = `${UNDERSTAT_BASE_URL}/${endpoint}`;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": USER_AGENT,
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new UnderstatError(
          `Understat returned ${response.status}`,
          url,
          response.status
        );
      }

      const data = (await response.json()) as T;
      return data;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new UnderstatError("Max retries", url);
};


// ─── API publique ────────────────────────────────────────────────

/**
 * Récupère tous les matchs joués par une équipe dans une saison.
 *
 * @param teamSlug Slug Understat (ex: "Marseille", "Manchester_City")
 * @param year Année de début de saison (ex: 2025 pour 2025-2026)
 */
export const getUnderstatTeamMatches = async (
  teamSlug: string,
  year: number
): Promise<UnderstatTeamMatch[]> => {
  const endpoint = `getTeamData/${teamSlug}/${year}`;
  const data = await fetchUnderstatAjax<{
    dates?: RawDateEntry[];
    players?: unknown[];
    statistics?: unknown;
  }>(endpoint);

  const rawDates = data.dates;
  if (!Array.isArray(rawDates)) {
    throw new UnderstatError(
      `No 'dates' array in response for ${teamSlug}/${year}`,
      `${UNDERSTAT_BASE_URL}/${endpoint}`
    );
  }

  const matches: UnderstatTeamMatch[] = [];
  for (const m of rawDates) {
    try {
      // Filtrer les matchs non joués
      const isResult = m.isResult === true || m.isResult === "true";
      if (!isResult) continue;

      const homeTitle = m.h?.title ?? "";
      const awayTitle = m.a?.title ?? "";
      const goalsH = parseInt(String(m.goals?.h ?? "0"), 10);
      const goalsA = parseInt(String(m.goals?.a ?? "0"), 10);
      const xgH = parseFloat(String(m.xG?.h ?? "0"));
      const xgA = parseFloat(String(m.xG?.a ?? "0"));
      const matchId = typeof m.id === "string" ? parseInt(m.id, 10) : (m.id as number);

      matches.push({
        match_id: matchId,
        date: m.datetime ?? "",
        is_home: m.side === "h",
        home_team: homeTitle,
        away_team: awayTitle,
        home_goals: goalsH,
        away_goals: goalsA,
        home_xg: xgH,
        away_xg: xgA,
      });
    } catch {
      // Skip les matchs malformés
      continue;
    }
  }

  // Tri chronologique inverse (plus récent en premier)
  matches.sort((a, b) => b.date.localeCompare(a.date));
  return matches;
};


/**
 * Récupère les tirs détaillés d'un match.
 * Permet de calculer Big Chances (xG > 0.3) et TC.
 */
export const getUnderstatMatchShots = async (
  matchId: number
): Promise<UnderstatShot[]> => {
  const endpoint = `getMatchData/${matchId}`;
  const data = await fetchUnderstatAjax<{
    shots?: { h?: RawShotEntry[]; a?: RawShotEntry[] };
    rosters?: unknown;
  }>(endpoint);

  const rawShots = data.shots;
  if (!rawShots || (typeof rawShots !== "object")) {
    throw new UnderstatError(
      `No 'shots' object in response for match ${matchId}`,
      `${UNDERSTAT_BASE_URL}/${endpoint}`
    );
  }

  const shots: UnderstatShot[] = [];

  const parseShots = (arr: RawShotEntry[] | undefined, isHome: boolean) => {
    if (!Array.isArray(arr)) return;
    for (const s of arr) {
      try {
        shots.push({
          match_id: matchId,
          player: s.player ?? "",
          is_home: isHome,
          xg: parseFloat(String(s.xG ?? "0")),
          result: s.result ?? "",
        });
      } catch {
        continue;
      }
    }
  };

  parseShots(rawShots.h, true);
  parseShots(rawShots.a, false);

  return shots;
};


/**
 * Compte les Big Chances approximées (tirs avec xG > 0.3).
 */
export const countBigChances = (
  shots: UnderstatShot[],
  wantHome: boolean
): number => {
  return shots.filter((s) => s.is_home === wantHome && s.xg > 0.3).length;
};


/**
 * Compte les tirs cadrés (Goal + SavedShot + ShotOnPost).
 */
export const countShotsOnTarget = (
  shots: UnderstatShot[],
  wantHome: boolean
): number => {
  const onTargetResults = new Set(["Goal", "SavedShot", "ShotOnPost"]);
  return shots.filter(
    (s) => s.is_home === wantHome && onTargetResults.has(s.result)
  ).length;
};