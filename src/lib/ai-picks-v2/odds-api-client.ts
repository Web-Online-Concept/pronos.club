import { trackApiCost } from "./cost-tracker";

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Liste blanche des bookmakers utilisés par le tipster Jérôme.
 * L'IA ne propose des picks que basés sur ces cotes, pour cohérence
 * avec ce que les abonnés peuvent réellement parier.
 *
 * Slugs au format The Odds API.
 * NB : OrbitX absent (pas d'API publique disponible).
 */
const ALLOWED_BOOKMAKERS = [
  "pinnacle",     // PS3838 (ordre prioritaire — le plus gros volume Jérôme)
  "onexbet",      // 1xBet
  "betclic_fr",   // Betclic
  "winamax_fr",   // Winamax
  "unibet_fr",    // Unibet
  "stake",        // Stake
] as const;

/**
 * Ordre de préférence pour la cote affichée si plusieurs bookmakers de la
 * whitelist couvrent le même match. PS3838 en premier (cote sharp/référence).
 */
const BOOKMAKER_PREFERENCE_ORDER: readonly string[] = ALLOWED_BOOKMAKERS;

export type OddsApiSport = {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
};

export type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

export type OddsApiMarket = {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
};

export type OddsApiBookmaker = {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
};

export type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
};

export class OddsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "OddsApiError";
  }
}

const ODDS_API_COST_PER_CALL_USD = 0;

const fetchWithTimeout = async (url: string): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const getApiKey = (): string => {
  const key = process.env.ODDS_API_KEY;
  if (!key) {
    throw new Error("ODDS_API_KEY is missing in environment variables");
  }
  return key;
};

const trackOddsApiCall = async (
  endpoint: string,
  pickId?: string | null
): Promise<void> => {
  await trackApiCost({
    eventType: "apifootball_call",
    provider: "apifootball",
    pickId: pickId ?? null,
    apiCalls: 1,
    costUsd: ODDS_API_COST_PER_CALL_USD,
    metadata: { endpoint, source: "oddsapi" },
  });
};

export const getActiveSports = async (
  pickId?: string | null
): Promise<OddsApiSport[]> => {
  const apiKey = getApiKey();
  const url = `${ODDS_API_BASE}/sports?apiKey=${apiKey}&all=false`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new OddsApiError(
      `Sports endpoint returned ${res.status}`,
      res.status
    );
  }
  const json = (await res.json()) as OddsApiSport[];
  await trackOddsApiCall("/sports", pickId ?? null);
  return json.filter((s) => s.active && !s.has_outrights);
};

export type GetOddsOptions = {
  sportKey: string;
  regions?: string;
  markets?: string;
  oddsFormat?: "decimal" | "american";
  daysFrom?: number;
  pickId?: string | null;
};

export const getOddsForSport = async (
  options: GetOddsOptions
): Promise<OddsApiEvent[]> => {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apiKey,
    bookmakers: ALLOWED_BOOKMAKERS.join(","),
    markets: options.markets ?? "h2h,totals",
    oddsFormat: options.oddsFormat ?? "decimal",
    dateFormat: "iso",
  });
  if (options.daysFrom !== undefined) {
    params.set("daysFrom", String(options.daysFrom));
  }
  const url = `${ODDS_API_BASE}/sports/${options.sportKey}/odds?${params.toString()}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new OddsApiError(
      `Odds endpoint returned ${res.status} for sport ${options.sportKey}`,
      res.status
    );
  }
  const json = (await res.json()) as OddsApiEvent[];
  await trackOddsApiCall(`/sports/${options.sportKey}/odds`, options.pickId ?? null);
  return json;
};

export const isFootballSportKey = (sportKey: string): boolean => {
  return sportKey.startsWith("soccer_");
};

export const isMajorEuropeanLeague = (sportKey: string): boolean => {
  const majorKeys = [
    "soccer_epl",
    "soccer_spain_la_liga",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_one",
    "soccer_uefa_champs_league",
    "soccer_uefa_europa_league",
    "soccer_uefa_europa_conference_league",
  ];
  return majorKeys.includes(sportKey);
};

export type SimplifiedFixture = {
  source: "oddsapi";
  externalId: string;
  sportKey: string;
  sportTitle: string;
  league: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  isFootball: boolean;
  isMajorEuropean: boolean;
  oddsSummary: {
    bookmaker: string;
    h2hHome?: number;
    h2hDraw?: number;
    h2hAway?: number;
    over25?: number;
    under25?: number;
  } | null;
  /**
   * Donnees completes des 6 bookmakers Tipster (h2h + totals + alternate_totals
   * + h2h_3_way + double_chance + btts selon disponibilite).
   * Sert au value-bet-engine pour calculer les fair odds Pinnacle (devig)
   * et chercher la meilleure cote soft, ainsi qu'a l'odds-resolver pour
   * resoudre les picks LLM (DOUBLE_CHANCE, BTTS, etc.).
   */
  rawBookmakers: OddsApiBookmaker[];
};

/**
 * Sélectionne le bookmaker préféré parmi ceux couvrant ce match,
 * selon l'ordre BOOKMAKER_PREFERENCE_ORDER (PS3838 prioritaire).
 */
const pickPreferredBookmaker = (
  bookmakers: OddsApiBookmaker[]
): OddsApiBookmaker | null => {
  if (bookmakers.length === 0) return null;
  for (const slug of BOOKMAKER_PREFERENCE_ORDER) {
    const found = bookmakers.find((b) => b.key === slug);
    if (found) return found;
  }
  // Fallback : si aucun bookmaker de la whitelist (ne devrait pas arriver
  // grâce au filtre côté API, mais sécurité).
  return bookmakers[0];
};

const extractBestOddsSnapshot = (
  event: OddsApiEvent
): SimplifiedFixture["oddsSummary"] => {
  const preferredBookmaker = pickPreferredBookmaker(event.bookmakers);
  if (!preferredBookmaker) return null;

  const h2h = preferredBookmaker.markets.find((m) => m.key === "h2h");
  const totals = preferredBookmaker.markets.find((m) => m.key === "totals");

  const homeOutcome = h2h?.outcomes.find((o) => o.name === event.home_team);
  const awayOutcome = h2h?.outcomes.find((o) => o.name === event.away_team);
  const drawOutcome = h2h?.outcomes.find((o) => o.name === "Draw");

  const over25 = totals?.outcomes.find(
    (o) => o.name === "Over" && o.point === 2.5
  );
  const under25 = totals?.outcomes.find(
    (o) => o.name === "Under" && o.point === 2.5
  );

  return {
    bookmaker: preferredBookmaker.title,
    h2hHome: homeOutcome?.price,
    h2hDraw: drawOutcome?.price,
    h2hAway: awayOutcome?.price,
    over25: over25?.price,
    under25: under25?.price,
  };
};

/**
 * Helper : merger les markets d'un event additionnel (ex: btts, double_chance)
 * dans la liste de bookmakers d'un event principal.
 * Les markets supplementaires sont ajoutes aux bookmakers existants
 * (ou les bookmakers sont ajoutes s'ils n'existaient pas).
 */
const mergeAdditionalMarkets = (
  mainEvent: OddsApiEvent,
  additionalEvent: OddsApiEvent | undefined
): void => {
  if (!additionalEvent) return;
  for (const addBk of additionalEvent.bookmakers) {
    const existingBk = mainEvent.bookmakers.find((b) => b.key === addBk.key);
    if (existingBk) {
      for (const addMarket of addBk.markets) {
        existingBk.markets.push(addMarket);
      }
    } else {
      mainEvent.bookmakers.push(addBk);
    }
  }
};

export const fetchAllSportsForToday = async (
  pickId?: string | null
): Promise<SimplifiedFixture[]> => {
  const sports = await getActiveSports(pickId);
  const results: SimplifiedFixture[] = [];

  for (const sport of sports) {
    try {
      // 4 appels paralleles :
      // - "h2h,totals" : main lines (1 appel /sports/X/odds)
      // - "alternate_totals" : toutes les autres lignes Over/Under
      // - "btts" : both teams to score (foot uniquement, sera ignore par les autres sports)
      // - "h2h_3_way,double_chance" : double chance (foot uniquement)
      //
      // OddsAPI exige des appels separes car ces markets sont
      // "non-featured" (cf doc).
      //
      // Note sur le cout : 4 appels * ~30 sports actifs = ~120 appels OddsAPI
      // par run. Surveiller le quota.
      const [mainResult, altResult, bttsResult, dcResult] = await Promise.allSettled([
        getOddsForSport({
          sportKey: sport.key,
          markets: "h2h,totals",
          oddsFormat: "decimal",
          daysFrom: 1,
          pickId,
        }),
        getOddsForSport({
          sportKey: sport.key,
          markets: "alternate_totals",
          oddsFormat: "decimal",
          daysFrom: 1,
          pickId,
        }),
        getOddsForSport({
          sportKey: sport.key,
          markets: "btts",
          oddsFormat: "decimal",
          daysFrom: 1,
          pickId,
        }),
        getOddsForSport({
          sportKey: sport.key,
          markets: "double_chance",
          oddsFormat: "decimal",
          daysFrom: 1,
          pickId,
        }),
      ]);

      const mainEvents =
        mainResult.status === "fulfilled" ? mainResult.value : [];
      const altEvents =
        altResult.status === "fulfilled" ? altResult.value : [];
      const bttsEvents =
        bttsResult.status === "fulfilled" ? bttsResult.value : [];
      const dcEvents =
        dcResult.status === "fulfilled" ? dcResult.value : [];

      // Indexer alt/btts/dc par event_id pour merger
      const altByEventId = new Map<string, OddsApiEvent>();
      for (const evt of altEvents) altByEventId.set(evt.id, evt);
      const bttsByEventId = new Map<string, OddsApiEvent>();
      for (const evt of bttsEvents) bttsByEventId.set(evt.id, evt);
      const dcByEventId = new Map<string, OddsApiEvent>();
      for (const evt of dcEvents) dcByEventId.set(evt.id, evt);

      for (const event of mainEvents) {
        if (event.bookmakers.length === 0) continue;

        // Merger les markets additionnels dans les bookmakers existants
        mergeAdditionalMarkets(event, altByEventId.get(event.id));
        mergeAdditionalMarkets(event, bttsByEventId.get(event.id));
        mergeAdditionalMarkets(event, dcByEventId.get(event.id));

        const isFoot = isFootballSportKey(sport.key);
        const isMajor = isMajorEuropeanLeague(sport.key);
        results.push({
          source: "oddsapi",
          externalId: event.id,
          sportKey: sport.key,
          sportTitle: sport.title,
          league: event.sport_title,
          commenceTime: event.commence_time,
          homeTeam: event.home_team,
          awayTeam: event.away_team,
          isFootball: isFoot,
          isMajorEuropean: isMajor,
          oddsSummary: extractBestOddsSnapshot(event),
          rawBookmakers: event.bookmakers,
        });
      }
    } catch (err) {
      console.warn(
        `[odds-api-client] Failed to fetch ${sport.key}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return results;
};