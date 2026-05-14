// src/lib/over-05-buts-equipes/understat-service.ts
//
// Service de scraping Understat (https://understat.com) pour récupérer
// les xG / xGA des équipes des 5 grands championnats européens.
//
// Pourquoi Understat ?
//  - Données xG fiables (modèle propre, stable depuis 2018)
//  - HTML très simple : les données sont injectées dans des variables JS
//    via JSON.parse(window.atob(...)) — facile à extraire avec regex
//  - Pas de Cloudflare ni captcha
//  - Couverture : EPL, La Liga, Bundesliga, Serie A, Ligue 1, RFPL
//
// Limitations :
//  - Top 5 uniquement (pas de Ligue 2, Championship, etc.)
//  - Pas de "Big Chances" Opta. On approxime par "tirs avec xG > 0.3".

// ─── Configuration ───────────────────────────────────────────────

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
  xg: number;             // 0..1
  result: string;          // "Goal", "MissedShots", "BlockedShot", "ShotOnPost", "SavedShot"
};

export type UnderstatTeamStats = {
  team_name: string;
  team_id: number;
  season: number;
  matches: UnderstatTeamMatch[];   // tous les matchs joués cette saison
};


export class UnderstatError extends Error {
  constructor(message: string, public readonly url: string) {
    super(message);
    this.name = "UnderstatError";
  }
}


// ─── Helpers réseau ──────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new UnderstatError(
        `Understat returned ${response.status}`,
        url
      );
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};


/**
 * Fetch une URL Understat avec retry.
 */
const fetchUnderstatHtml = async (url: string): Promise<string> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fetchWithTimeout(url);
    } catch (err) {
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


// ─── Parsing ─────────────────────────────────────────────────────

/**
 * Extrait une variable JS du HTML Understat.
 * Understat injecte ses données via :
 *   var matchesData = JSON.parse('\\x7B"...\\x7D');
 * On extrait la chaîne entre les quotes et on parse.
 */
const extractJsVariable = (html: string, varName: string): unknown => {
  // Pattern : varName = JSON.parse('...');
  const pattern = new RegExp(
    `${varName}\\s*=\\s*JSON\\.parse\\('([^']+)'\\)`,
    "s"
  );
  const match = html.match(pattern);
  if (!match) {
    return null;
  }
  // Décoder les \xHH
  const escaped = match[1];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decoded = (escaped as any).replace(
    /\\x([0-9A-Fa-f]{2})/g,
    (_: string, hex: string) => String.fromCharCode(parseInt(hex, 16))
  );
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};


// ─── Fonctions publiques ─────────────────────────────────────────

/**
 * Récupère tous les matchs d'une équipe sur une saison Understat.
 *
 * @param teamSlug Slug Understat (ex: "Marseille", "Manchester_City")
 * @param year Année de début de saison (ex: 2025 pour 2025-2026)
 *
 * Le slug doit correspondre exactement au format Understat. Une table
 * de mapping (DB ou code) sera nécessaire pour mapper les noms PRONOS.CLUB
 * vers les slugs Understat. Cette correspondance sera construite en Phase 3.
 */
export const getUnderstatTeamMatches = async (
  teamSlug: string,
  year: number
): Promise<UnderstatTeamMatch[]> => {
  const url = `${UNDERSTAT_BASE_URL}/team/${teamSlug}/${year}`;
  const html = await fetchUnderstatHtml(url);

  // Understat utilise la variable `datesData` pour la liste des matchs
  const data = extractJsVariable(html, "datesData");
  if (!Array.isArray(data)) {
    throw new UnderstatError(
      `Failed to parse datesData for ${teamSlug} ${year}`,
      url
    );
  }

  const matches: UnderstatTeamMatch[] = [];
  for (const m of data as Array<Record<string, unknown>>) {
    try {
      // Structure observée :
      // { id, isResult, side: "h"|"a", h:{id,title,short_title}, a:{...},
      //   goals:{h,a}, xG:{h,a}, datetime:"2026-05-10 17:00:00", forecast:{...} }
      const isResult = m.isResult === true || m.isResult === "true";
      if (!isResult) continue; // skip les matchs non joués

      const home = m.h as { title: string };
      const away = m.a as { title: string };
      const goals = m.goals as { h: string; a: string };
      const xg = m.xG as { h: string; a: string };

      matches.push({
        match_id: typeof m.id === "string" ? parseInt(m.id, 10) : (m.id as number),
        date: m.datetime as string,
        is_home: m.side === "h",
        home_team: home.title,
        away_team: away.title,
        home_goals: parseInt(goals.h, 10),
        away_goals: parseInt(goals.a, 10),
        home_xg: parseFloat(xg.h),
        away_xg: parseFloat(xg.a),
      });
    } catch {
      // On ignore les matchs malformés silencieusement
      continue;
    }
  }

  // Tri chronologique inverse (le plus récent en premier)
  matches.sort((a, b) => b.date.localeCompare(a.date));

  return matches;
};


/**
 * Récupère les tirs détaillés d'un match Understat.
 * Permet de calculer "Big Chances ~ tirs avec xG > 0.3" (approximation Opta).
 *
 * @param matchId ID Understat du match (récupéré via getUnderstatTeamMatches)
 */
export const getUnderstatMatchShots = async (
  matchId: number
): Promise<UnderstatShot[]> => {
  const url = `${UNDERSTAT_BASE_URL}/match/${matchId}`;
  const html = await fetchUnderstatHtml(url);

  // Understat utilise la variable `shotsData` pour les tirs du match
  // Structure : { h: [...shots], a: [...shots] }
  const data = extractJsVariable(html, "shotsData") as
    | { h: Array<Record<string, unknown>>; a: Array<Record<string, unknown>> }
    | null;

  if (!data) {
    throw new UnderstatError(
      `Failed to parse shotsData for match ${matchId}`,
      url
    );
  }

  const shots: UnderstatShot[] = [];

  const parseShots = (arr: Array<Record<string, unknown>>, isHome: boolean) => {
    for (const s of arr) {
      try {
        shots.push({
          match_id: matchId,
          player: (s.player as string) ?? "",
          is_home: isHome,
          xg: parseFloat((s.xG as string) ?? "0"),
          result: (s.result as string) ?? "",
        });
      } catch {
        continue;
      }
    }
  };

  parseShots(data.h, true);
  parseShots(data.a, false);

  return shots;
};


/**
 * Compte les "Big Chances approximées" pour une équipe sur un match.
 *
 * Définition Opta officielle (FotMob) : "situation où un joueur devrait
 * raisonnablement marquer, généralement en face-à-face ou très courte distance".
 * Seuil heuristique appliqué chez plusieurs analystes : xG par tir > 0.3.
 *
 * @param shots Tirs du match (depuis getUnderstatMatchShots)
 * @param wantHome true si on veut les Big Chances de l'équipe à domicile
 */
export const countBigChances = (
  shots: UnderstatShot[],
  wantHome: boolean
): number => {
  return shots.filter((s) => s.is_home === wantHome && s.xg > 0.3).length;
};


/**
 * Compte les tirs cadrés pour une équipe sur un match.
 * Tirs cadrés (TC) = ceux qui ont touché le cadre :
 *   - "Goal" : but
 *   - "SavedShot" : tir arrêté par le gardien
 *   - "ShotOnPost" : tir sur le poteau (Understat compte ça comme TC)
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