/**
 * ═══════════════════════════════════════════════════════════════════
 * THE ODDS API CLIENT — Pronos IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Récupère les cotes des matchs via The Odds API (free tier).
 *
 * Bookmakers ciblés :
 *  - Pinnacle (référence marché, équivalent PS3838)
 *  - Winamax FR
 *  - Betclic FR
 *  - Unibet FR
 *  - 1xBet
 *
 * Stratégie de consommation (économie crédits) :
 *  - 1 appel groupé par sport (EU region)
 *  - Marchés : h2h (+ totals pour basket uniquement)
 *  - ~15-25 crédits/jour → ~450-750/mois (quota 500 = limite)
 *
 * Docs : https://the-odds-api.com/liveapi/guides/v4/
 * ═══════════════════════════════════════════════════════════════════
 */


// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

/** Clé sport dans The Odds API */
export type OddsSportKey =
  | "soccer_epl"
  | "soccer_france_ligue_one"
  | "soccer_spain_la_liga"
  | "soccer_germany_bundesliga"
  | "soccer_italy_serie_a"
  | "soccer_uefa_champs_league"
  | "tennis_atp_french_open"  // dynamique selon période
  | "tennis_wta_french_open"
  | "basketball_nba";

/** Bookmaker retourné par l'API */
export interface BookmakerOdds {
  key: string;            // "pinnacle", "winamax_fr", etc.
  title: string;          // nom lisible
  lastUpdate: string;     // ISO
  markets: {
    h2h?: OutcomePrice[];        // 1N2 / vainqueur
    totals?: TotalsOutcome[];    // Over/Under (basket principalement)
    btts?: OutcomePrice[];       // les 2 équipes marquent (pas dispo en free)
  };
}

export interface OutcomePrice {
  name: string;   // "Paris Saint-Germain" | "Draw" | "RC Lens"
  price: number;  // cote décimale
  point?: number; // pour spreads/totals
}

export interface TotalsOutcome extends OutcomePrice {
  point: number;  // ex: 2.5 pour "Over 2.5"
}

/** Match avec cotes agrégées */
export interface MatchWithOdds {
  id: string;             // ID The Odds API
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;  // ISO UTC
  bookmakers: BookmakerOdds[];
}


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const API_BASE = "https://api.the-odds-api.com/v4";
const API_KEY = process.env.ODDS_API_KEY ?? "";

/** Bookmakers qu'on garde dans les réponses (filtrage côté app) */
export const TARGET_BOOKMAKERS = [
  "pinnacle",     // Référence (= PS3838)
  "winamax_fr",
  "betclic_fr",
  "unibet_fr",
  "onexbet",      // 1xBet
] as const;

/** Mapping sport interne → clés possibles The Odds API */
export const ODDS_SPORT_KEYS: Record<string, string[]> = {
  soccer_epl: ["soccer_epl"],
  soccer_france_ligue_one: ["soccer_france_ligue_one"],
  soccer_spain_la_liga: ["soccer_spain_la_liga"],
  soccer_germany_bundesliga: ["soccer_germany_bundesliga"],
  soccer_italy_serie_a: ["soccer_italy_serie_a"],
  soccer_uefa_champs_league: ["soccer_uefa_champs_league"],
  basketball_nba: ["basketball_nba"],
  // Tennis : plusieurs clés possibles selon le tournoi actif
  // On les découvrira dynamiquement (cf. getTennisSportKeys)
  tennis_atp: [],
  tennis_wta: [],
};

const FETCH_TIMEOUT_MS = 10000;


// ═══════════════════════════════════════════════════════════════════
// HELPER FETCH
// ═══════════════════════════════════════════════════════════════════

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}


// ═══════════════════════════════════════════════════════════════════
// DÉCOUVERTE DES SPORTS ACTIFS (tennis)
// ═══════════════════════════════════════════════════════════════════

/**
 * Retourne la liste des sports "in season" actuellement.
 * Utile pour le tennis dont les clés changent selon la période
 * (Roland-Garros, US Open, etc.).
 * Coût : 0 crédit (cet endpoint est gratuit).
 */
export async function getActiveSports(): Promise<string[]> {
  if (!API_KEY) {
    console.error("[OddsAPI] ODDS_API_KEY manquante");
    return [];
  }

  const url = `${API_BASE}/sports?apiKey=${API_KEY}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      console.warn(`[OddsAPI] /sports HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as Array<{ key: string; active: boolean }>;
    return data.filter((s) => s.active).map((s) => s.key);
  } catch (err) {
    console.error("[OddsAPI] getActiveSports error:", err);
    return [];
  }
}


// ═══════════════════════════════════════════════════════════════════
// FETCH ODDS POUR UNE CLÉ SPORT
// ═══════════════════════════════════════════════════════════════════

/**
 * Récupère les cotes pour un sport donné.
 * Coût : 1 crédit × nombre_markets × nombre_regions
 * Ici : 1 × 1 marché × 1 région = 1 crédit par sport
 */
export async function fetchOddsForSport(
  sportKey: string,
  markets: string[] = ["h2h"],
): Promise<MatchWithOdds[]> {
  if (!API_KEY) {
    console.error("[OddsAPI] ODDS_API_KEY manquante");
    return [];
  }

  const params = new URLSearchParams({
    apiKey: API_KEY,
    regions: "eu",  // Pinnacle + Winamax + Betclic + Unibet + 1xBet sont en "eu"
    markets: markets.join(","),
    oddsFormat: "decimal",
    dateFormat: "iso",
  });

  const url = `${API_BASE}/sports/${sportKey}/odds?${params}`;

  try {
    const res = await fetchWithTimeout(url);

    // Check quota headers (très utile pour monitoring)
    const remaining = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");
    console.log(
      `[OddsAPI] ${sportKey}: status=${res.status} quota=${used}/${used && remaining ? Number(used) + Number(remaining) : "?"} remaining=${remaining}`,
    );

    if (!res.ok) {
      console.warn(`[OddsAPI] ${sportKey} HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as MatchWithOddsRaw[];

    return data
      .map((match) => normalizeMatchOdds(match))
      .filter((m): m is MatchWithOdds => m !== null);
  } catch (err) {
    console.error(`[OddsAPI] fetchOddsForSport ${sportKey} error:`, err);
    return [];
  }
}


// ═══════════════════════════════════════════════════════════════════
// NORMALISATION
// ═══════════════════════════════════════════════════════════════════

interface MatchWithOddsRaw {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    last_update: string;
    markets?: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

function normalizeMatchOdds(raw: MatchWithOddsRaw): MatchWithOdds | null {
  if (!raw?.id || !raw?.commence_time) return null;

  // On ne garde QUE les bookmakers qui nous intéressent
  const filteredBookmakers: BookmakerOdds[] = (raw.bookmakers ?? [])
    .filter((b) => TARGET_BOOKMAKERS.includes(b.key as (typeof TARGET_BOOKMAKERS)[number]))
    .map((b) => {
      const markets: BookmakerOdds["markets"] = {};

      for (const m of b.markets ?? []) {
        if (m.key === "h2h") {
          markets.h2h = m.outcomes.map((o) => ({
            name: o.name,
            price: o.price,
          }));
        } else if (m.key === "totals") {
          markets.totals = m.outcomes
            .filter((o) => typeof o.point === "number")
            .map((o) => ({
              name: o.name,
              price: o.price,
              point: o.point as number,
            }));
        } else if (m.key === "btts") {
          markets.btts = m.outcomes.map((o) => ({
            name: o.name,
            price: o.price,
          }));
        }
      }

      return {
        key: b.key,
        title: b.title,
        lastUpdate: b.last_update,
        markets,
      };
    })
    // Ne garde que ceux qui ont AU MOINS un marché
    .filter((b) => Object.keys(b.markets).length > 0);

  return {
    id: raw.id,
    sport_key: raw.sport_key,
    home_team: raw.home_team,
    away_team: raw.away_team,
    commence_time: raw.commence_time,
    bookmakers: filteredBookmakers,
  };
}


// ═══════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE : fetch toutes les cotes utiles
// ═══════════════════════════════════════════════════════════════════

export interface AllOddsResult {
  matches: MatchWithOdds[];
  stats: {
    totalCreditsUsed: number;
    sportsQueried: string[];
    matchesPerSport: Record<string, number>;
  };
}

/**
 * Récupère les cotes pour tous les sports actifs en 1 batch.
 * Budget : ~8-10 crédits (foot 6 + basket 2 = 8, tennis 0-2 selon période).
 */
export async function getAllOdds(): Promise<AllOddsResult> {
  const allMatches: MatchWithOdds[] = [];
  const matchesPerSport: Record<string, number> = {};
  const sportsQueried: string[] = [];
  let totalCreditsUsed = 0;

  // 1) Sports "fixes" : foot + basket (clés stables)
  const fixedSports: Array<{ key: string; markets: string[] }> = [
    { key: "soccer_epl", markets: ["h2h", "totals"] },
    { key: "soccer_france_ligue_one", markets: ["h2h", "totals"] },
    { key: "soccer_spain_la_liga", markets: ["h2h", "totals"] },
    { key: "soccer_germany_bundesliga", markets: ["h2h", "totals"] },
    { key: "soccer_italy_serie_a", markets: ["h2h", "totals"] },
    { key: "soccer_uefa_champs_league", markets: ["h2h", "totals"] },
    { key: "basketball_nba", markets: ["h2h", "totals"] },
  ];

  // 2) Tennis : on découvre dynamiquement les clés actives
  const activeSports = await getActiveSports();
  const tennisKeys = activeSports.filter((k) => k.startsWith("tennis_"));

  const allSportsToQuery = [
    ...fixedSports,
    ...tennisKeys.map((key) => ({ key, markets: ["h2h"] })),
  ];

  // 3) Fetch en parallèle (max 5 en même temps pour pas surcharger)
  const BATCH_SIZE = 5;
  for (let i = 0; i < allSportsToQuery.length; i += BATCH_SIZE) {
    const batch = allSportsToQuery.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(({ key, markets }) => fetchOddsForSport(key, markets)),
    );

    results.forEach((matches, idx) => {
      const sportKey = batch[idx].key;
      const marketsCount = batch[idx].markets.length;

      sportsQueried.push(sportKey);
      matchesPerSport[sportKey] = matches.length;
      totalCreditsUsed += marketsCount; // 1 crédit par marché × 1 région
      allMatches.push(...matches);
    });
  }

  console.log(
    `[OddsAPI] getAllOdds terminé : ${allMatches.length} matchs, ${totalCreditsUsed} crédits utilisés`,
  );

  return {
    matches: allMatches,
    stats: {
      totalCreditsUsed,
      sportsQueried,
      matchesPerSport,
    },
  };
}


// ═══════════════════════════════════════════════════════════════════
// MATCHING AVEC ESPN
// ═══════════════════════════════════════════════════════════════════

/**
 * Matching fuzzy simple entre un match ESPN et un match The Odds API.
 * Comparaison sur les noms d'équipes.
 *
 * Note : un fuzzy matching plus sophistiqué (Levenshtein) pourra être
 * utilisé plus tard, on commence simple.
 */
export function matchesEspnAndOdds(
  espnHome: string,
  espnAway: string,
  oddsHome: string,
  oddsAway: string,
): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/fc|cf|ac|sc|afc|rc|sv|us|as|ssc|cd|ud|ss|rcd/gi, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const h1 = norm(espnHome);
  const h2 = norm(oddsHome);
  const a1 = norm(espnAway);
  const a2 = norm(oddsAway);

  // Matching si les 2 sens (home1 contient home2 ou l'inverse) ET idem pour away
  const homeMatch = h1.includes(h2) || h2.includes(h1);
  const awayMatch = a1.includes(a2) || a2.includes(a1);

  return homeMatch && awayMatch;
}