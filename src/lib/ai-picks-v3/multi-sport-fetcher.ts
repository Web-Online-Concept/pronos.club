/**
 * PRONOS.CLUB — Multi-sport fetcher V3.5
 *
 * Pipeline V3.5 (09/05/2026) :
 *   - Foot enrichi : sidelined, recent matches stats, splits dom/ext, top scorers, xG si dispo
 *   - Tennis enrichi : past matches with odds, tournament record, career stats, finals/titles
 *     (filtré Masters 1000+ et Grand Chelem uniquement pour économiser le quota PRO 10k/mois)
 *   - 3 nouveaux sports : Rugby, Handball, F1
 *   - NBA : endpoint dédié v2.nba.api-sports.io (stats plus riches que v1.basketball)
 *   - Coupe du Monde 2026 (league=1 API-Football) prête à activer au 11 juin
 *   - Drop window : morning (kickoff < 20h Paris) / evening (kickoff >= 20h Paris)
 *
 * Sources :
 *   - the-odds-api  : cotes 4 books (PS3838/Pinnacle, Winamax, Betclic, Unibet)
 *   - api-sports.io : ALL-SPORTS PRO (foot, basket, NBA dédié, hockey, baseball, MMA, NFL,
 *                     rugby, handball, F1) — 7500 calls/jour PAR SPORT
 *   - Matchstat Pro : enrichissement tennis (10$/mois RapidAPI, 10k calls/mois)
 *
 * Performance :
 *   - ~160 matchs / jour
 *   - ~5-15 minutes selon throttling
 *   - Quota foot : pic projeté ~3000 calls/jour (40% du quota 7500)
 */

import {
  LEAGUE_RESOLUTION,
  type LeagueMapping,
} from "./league-resolution";
import { TEAM_ALIASES } from "./team-aliases";
import { getCachedOrFetch, getCacheStats, resetCacheStats } from "./api-cache";
import type {
  CotesBooks,
  EnrichedFixture,
  FetchOutput,
  FetchStats,
  SupportedBookmaker,
  SupportedSport,
  FootballTeamStats,
  FootballPrediction,
  FootballSplitStats,
  FootballRecentMatchStats,
  FootballSidelinedItem,
  FootballTopScorer,
  TeamStanding,
  TeamH2H,
  PitcherStats,
  MMAFighterRecord,
  TennisPastMatchWithOdds,
  TennisTournamentRecord,
  TennisCareerStats,
  TennisFinalsTitles,
  RugbyTeamStats,
  HandballTeamStats,
  F1RaceData,
  F1DriverStats,
  DropWindow,
} from "./tipster-types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const ODDS_API_KEY = process.env.ODDS_API_KEY ?? "";
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY ?? "";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? "";

const ALLOWED_GROUPS = [
  "Soccer",
  "Tennis",
  "Basketball",
  "Ice Hockey",
  "Baseball",
  "American Football",
  "Mixed Martial Arts",
  "Rugby Union",
  "Rugby League",
  "Handball",
  "Motor Sports",
];

const EXCLUDED_GROUPS = [
  "Politics",
  "Aussie Rules",
  "Boxing",
  "Cricket",
  "Lacrosse",
  "Golf",
  "Snooker",
];

const BOOK_MAPPING: Record<string, SupportedBookmaker> = {
  pinnacle: "PS3838",
  winamax_fr: "Winamax",
  betclic_fr: "Betclic",
  unibet_fr: "Unibet",
};

// Throttle base (ms entre matchs)
const SLEEP_API_FOOTBALL_BASE = 250;
const SLEEP_API_SPORTS = 200;
const SLEEP_MATCHSTAT = 300;
const SLEEP_ODDS_API = 100;

// Tennis : rankId Matchstat à inclure (Grand Slam + Masters 1000 + 500 + 250)
const TENNIS_ALLOWED_RANK_IDS = [1, 2, 3, 4, 5, 6, 7];

// Tennis V3.5 : enrichissements lourds (past-matches with odds, tournament-record,
// career stats, finals/titles, h2h match stats) UNIQUEMENT sur tournois majeurs.
// Filtre rankId : 1=Grand Slam, 2=Masters 1000/WTA 1000, 3=ATP/WTA 500
const TENNIS_DEEP_ENRICHMENT_RANK_IDS = [1, 2, 3];

// Tournament types api-football
const TOURNAMENT_TYPES_LEAGUE = "League";

// V3.5 : ID API-Football de la Coupe du Monde FIFA (active à partir du 11 juin 2026)
const FIFA_WORLD_CUP_LEAGUE_ID = 1;

// V3.5 : Drop window — filtre par heure de kickoff Paris
const DROP_WINDOW_EVENING_THRESHOLD_HOUR = 20;

// V3.5 : Cache top scorers par league (TTL 24h)
const TOP_SCORERS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const topScorersCache = new Map<string, { data: FootballTopScorer[]; timestamp: number }>();

// V3.5 : Cache recent match stats par fixture_id (TTL 48h)
const RECENT_STATS_CACHE_TTL_MS = 48 * 60 * 60 * 1000;
const recentStatsCache = new Map<string, { data: FootballRecentMatchStats; timestamp: number }>();

// ============================================================================
// HELPERS
// ============================================================================

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Normalise : lowercase, sans accents, sans ponctuation */
const normalize = (s: string | null | undefined): string => {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const STOPWORDS = new Set([
  "fc", "cf", "sc", "ac", "sv", "sd", "cd", "rc", "sk", "fk", "club", "team", "cp",
]);

/** Tokens significatifs (>=3 chars, hors stopwords) */
const tokenize = (s: string): string[] => {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
};

/**
 * Match deux noms d'equipe via :
 *   1. Egalite normalisee
 *   2. Alias bidirectionnels (TEAM_ALIASES)
 *   3. Containment direct
 *   4. Tokens significatifs en commun (>=4 chars)
 *   5. Overlap >= 50% des tokens
 */
export const teamsMatch = (nameA: string, nameB: string): boolean => {
  const normA = normalize(nameA);
  const normB = normalize(nameB);
  if (normA === normB) return true;

  const aliasesA = TEAM_ALIASES[normA] ?? [];
  const aliasesB = TEAM_ALIASES[normB] ?? [];
  if (aliasesA.includes(normB) || aliasesB.includes(normA)) return true;

  for (const a of aliasesA) {
    if (aliasesB.includes(a)) return true;
    if (normalize(a) === normB) return true;
  }
  for (const a of aliasesB) {
    if (aliasesA.includes(a)) return true;
    if (normalize(a) === normA) return true;
  }

  if (normA.includes(normB) || normB.includes(normA)) return true;

  const tokensA = tokenize(nameA);
  const tokensB = tokenize(nameB);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const setA = new Set(tokensA);
  const intersection = tokensB.filter((t) => setA.has(t));
  const significantCommon = intersection.find((t) => t.length >= 4);
  if (significantCommon) return true;

  const overlap =
    intersection.length / Math.min(tokensA.length, tokensB.length);
  return overlap >= 0.5;
};

const isSameDay = (isoDate: string | null, targetDate: string): boolean => {
  if (!isoDate) return false;
  const matchDate = new Date(isoDate);
  return (
    matchDate.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }) ===
    targetDate
  );
};

const formatTimeParis = (isoDate: string): string => {
  return new Date(isoDate)
    .toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
};

/**
 * V3.5 : retourne l'heure (0-23) Paris du match.
 * Utilisé pour le filtre drop_window (matin < 20h, soir >= 20h).
 */
const getHourParis = (isoDate: string): number => {
  const d = new Date(isoDate);
  const hourStr = d.toLocaleString("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    hour12: false,
  });
  return parseInt(hourStr.split(":")[0] ?? "0", 10);
};

/**
 * V3.5 : retourne true si le match correspond au drop window demandé.
 * - morning : kickoff < 20h Paris
 * - evening : kickoff >= 20h Paris
 */
const matchesDropWindow = (isoDate: string, dropWindow: DropWindow): boolean => {
  const hour = getHourParis(isoDate);
  if (dropWindow === "morning") return hour < DROP_WINDOW_EVENING_THRESHOLD_HOUR;
  return hour >= DROP_WINDOW_EVENING_THRESHOLD_HOUR;
};

const detectSportFromGroup = (group: string): SupportedSport => {
  const map: Record<string, SupportedSport> = {
    Soccer: "football",
    Tennis: "tennis",
    Basketball: "basketball",
    "Ice Hockey": "hockey",
    Baseball: "baseball",
    "American Football": "american_football",
    "Mixed Martial Arts": "mma",
    "Rugby Union": "rugby",
    "Rugby League": "rugby",
    Handball: "handball",
    "Motor Sports": "formula_1",
  };
  return (map[group] ?? "football") as SupportedSport;
};

/**
 * V3.5 : détecte si une league basket est NBA (pour router vers v2.nba.api-sports.io).
 * Heuristique sur le titre OddsAPI ou le nom de la league.
 */
const isNBALeague = (leagueTitle: string): boolean => {
  const norm = normalize(leagueTitle);
  return (
    norm.includes("nba") &&
    !norm.includes("wnba") &&
    !norm.includes("g league") &&
    !norm.includes("euroleague")
  );
};

// ============================================================================
// API-FOOTBALL : ETAT GLOBAL DU RATE LIMIT
// ============================================================================

type ApiFootballState = {
  remainingMinute: number | null;
  limitMinute: number | null;
  remainingDay: number | null;
  limitDay: number | null;
};

class ApiFootballRateLimitTracker {
  state: ApiFootballState = {
    remainingMinute: null,
    limitMinute: null,
    remainingDay: null,
    limitDay: null,
  };

  /** Throttle adaptatif AVANT requête */
  async throttleIfNeeded(): Promise<void> {
    if (this.state.remainingMinute === null) return;
    if (this.state.remainingMinute < 5) {
      await sleep(60_000);
      this.state.remainingMinute = null;
    } else if (this.state.remainingMinute < 15) {
      await sleep(3_000);
    }
  }

  /** Met à jour l'état depuis les headers de réponse */
  updateFromResponse(response: Response): void {
    const remMin = response.headers.get("x-ratelimit-remaining");
    const limMin = response.headers.get("x-ratelimit-limit");
    const remDay = response.headers.get("x-ratelimit-requests-remaining");
    const limDay = response.headers.get("x-ratelimit-requests-limit");
    if (remMin) this.state.remainingMinute = parseInt(remMin, 10);
    if (limMin) this.state.limitMinute = parseInt(limMin, 10);
    if (remDay) this.state.remainingDay = parseInt(remDay, 10);
    if (limDay) this.state.limitDay = parseInt(limDay, 10);
  }
}

// ============================================================================
// FETCH HELPERS
// ============================================================================

const fetchJson = async <T = unknown>(
  url: string,
  headers: Record<string, string> = {},
  retries = 2
): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.status === 429) {
        if (attempt < retries) {
          await sleep(10_000);
          continue;
        }
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `HTTP ${response.status} : ${text.substring(0, 150)}`
        );
      }
      return (await response.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000);
    }
  }
  throw new Error("fetchJson exhausted retries");
};

// ─── Cache TTL automatique par endpoint API-Football ──────────────
// Détermine la durée de vie du cache selon le type de donnée fetchée.
// Les endpoints temps-réel (fixtures du jour, live scores) ne sont
// PAS cachés (TTL = 0). Les endpoints stables (standings, H2H, top
// scorers) sont cachés agressivement.
//
// V3.5 Lot 15 — réduction des appels API-Football répétés au sein
// d'un même drop ET entre drops successifs (matin + soir le même jour).
const getCacheTtlForApiFootballUrl = (url: string): number => {
  // Pas de cache pour les endpoints temps-réel ou avec date dynamique
  if (url.includes("/fixtures?") && !url.includes("headtohead")) return 0;
  if (url.includes("/odds")) return 0;
  if (url.includes("/players?")) return 0; // top buteurs live, on garde frais

  // Endpoints très stables : 24h
  if (url.includes("/headtohead")) return 24 * 3600;
  if (url.includes("/topscorers")) return 24 * 3600;
  if (url.includes("/leagues?")) return 24 * 3600;

  // Endpoints stables : 6-12h
  if (url.includes("/standings")) return 6 * 3600;
  if (url.includes("/teams/statistics")) return 12 * 3600;

  // Endpoints semi-stables : 1-6h
  if (url.includes("/injuries")) return 1 * 3600;
  if (url.includes("/sidelined")) return 6 * 3600;
  if (url.includes("/predictions")) return 1 * 3600;

  // Par défaut : pas de cache (sécurité)
  return 0;
};

const fetchJsonAFRaw = async <T = unknown>(
  url: string,
  tracker: ApiFootballRateLimitTracker,
  retries = 3
): Promise<T> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await tracker.throttleIfNeeded();

      const response = await fetch(url, {
        headers: { "x-apisports-key": API_FOOTBALL_KEY },
      });

      tracker.updateFromResponse(response);

      if (response.status === 429) {
        const wait = Math.min(60 + attempt * 30, 180);
        await sleep(wait * 1000);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `HTTP ${response.status} : ${text.substring(0, 150)}`
        );
      }
      return (await response.json()) as T;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(2000);
    }
  }
  throw new Error("fetchJsonAFRaw exhausted retries");
};

// Wrapper avec cache automatique (V3.5 Lot 15)
const fetchJsonAF = async <T = unknown>(
  url: string,
  tracker: ApiFootballRateLimitTracker,
  retries = 3
): Promise<T> => {
  const ttl = getCacheTtlForApiFootballUrl(url);

  // Si endpoint non cachable : appel direct
  if (ttl === 0) {
    return fetchJsonAFRaw<T>(url, tracker, retries);
  }

  // Sinon : passer par le cache
  // Clé = URL complète (sans la API key qui est dans le header)
  const cacheKey = `af:${url}`;
  return getCachedOrFetch<T>(cacheKey, ttl, () =>
    fetchJsonAFRaw<T>(url, tracker, retries)
  );
};

// Timeout wrapper pour les calls API secondaires
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timeout]);
};

// ============================================================================
// FOOTBALL — LIGUES
// ============================================================================

type CachedLeague = {
  id: number;
  name: string;
  type: string;
  country: string | null;
  season: number | null;
};

type ResolvedLeague = {
  leagueId: number;
  season: number;
  name: string;
};

class FootballLeagueResolver {
  private allLeagues: CachedLeague[] = [];
  private resolutionCache = new Map<string, ResolvedLeague | null>();
  private loaded = false;

  async load(tracker: ApiFootballRateLimitTracker): Promise<void> {
    if (this.loaded) return;
    type LeagueResponse = {
      response?: Array<{
        league: { id: number; name: string; type: string };
        country?: { name: string | null };
        seasons?: Array<{ year: number; current: boolean }>;
      }>;
    };
    const data = await fetchJsonAF<LeagueResponse>(
      `https://v3.football.api-sports.io/leagues?current=true`,
      tracker
    );
    this.allLeagues = (data.response ?? []).map((item) => {
      const seasons = item.seasons ?? [];
      const cs = seasons.find((s) => s.current === true) ?? seasons[seasons.length - 1];
      return {
        id: item.league.id,
        name: item.league.name,
        type: item.league.type,
        country: item.country?.name ?? null,
        season: cs?.year ?? null,
      };
    });
    this.loaded = true;
  }

  resolve(ligueOddsApi: string): ResolvedLeague | null {
    const cached = this.resolutionCache.get(ligueOddsApi);
    if (cached !== undefined) return cached;

    // V3.5 : détection explicite Coupe du Monde FIFA
    const norm = normalize(ligueOddsApi);
    if (
      norm.includes("fifa world cup") ||
      norm.includes("coupe du monde") ||
      norm.includes("world cup 2026")
    ) {
      const wc = this.allLeagues.find((l) => l.id === FIFA_WORLD_CUP_LEAGUE_ID);
      if (wc && wc.season !== null) {
        const result: ResolvedLeague = {
          leagueId: wc.id,
          season: wc.season,
          name: wc.name,
        };
        this.resolutionCache.set(ligueOddsApi, result);
        return result;
      }
    }

    const mapping: LeagueMapping | undefined = LEAGUE_RESOLUTION[ligueOddsApi];
    let result: ResolvedLeague | null = null;

    if (mapping) {
      const tNameNorm = normalize(mapping.name);
      const tCountryNorm = normalize(mapping.country);
      let m = this.allLeagues.find(
        (l) =>
          normalize(l.name) === tNameNorm &&
          normalize(l.country ?? "") === tCountryNorm &&
          l.type === TOURNAMENT_TYPES_LEAGUE
      );
      if (!m) {
        m = this.allLeagues.find(
          (l) =>
            normalize(l.name) === tNameNorm &&
            normalize(l.country ?? "") === tCountryNorm
        );
      }
      if (m && m.season !== null) {
        result = { leagueId: m.id, season: m.season, name: m.name };
      }
    }

    if (!result && ligueOddsApi.includes(" - ")) {
      const parts = ligueOddsApi.split(" - ");
      const m = this.allLeagues.find(
        (l) =>
          normalize(l.name) === normalize(parts[0] ?? "") &&
          normalize(l.country ?? "") === normalize(parts[1] ?? "")
      );
      if (m && m.season !== null) {
        result = { leagueId: m.id, season: m.season, name: m.name };
      }
    }

    if (!result) {
      const normSearch = normalize(ligueOddsApi);
      const m = this.allLeagues.find(
        (l) => l.type === TOURNAMENT_TYPES_LEAGUE && normalize(l.name) === normSearch
      );
      if (m && m.season !== null) {
        result = { leagueId: m.id, season: m.season, name: m.name };
      }
    }

    this.resolutionCache.set(ligueOddsApi, result);
    return result;
  }
}

// ============================================================================
// THE-ODDS-API : récupération sports actifs + cotes
// ============================================================================

type OddsApiSport = {
  key: string;
  active: boolean;
  group: string;
  title: string;
  has_outrights: boolean;
};

type OddsApiEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    markets?: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
};

type RawFixture = {
  id: string;
  sport: SupportedSport;
  ligue: string;
  match: string;
  date_heure: string;
  commence_time_iso: string;
  home_team: string;
  away_team: string;
  cotes_books: CotesBooks;
};

const fetchActiveSports = async (): Promise<OddsApiSport[]> => {
  const url = `https://api.the-odds-api.com/v4/sports?apiKey=${ODDS_API_KEY}`;
  const all = await fetchJson<OddsApiSport[]>(url);
  return all.filter(
    (s) =>
      s.active &&
      ALLOWED_GROUPS.includes(s.group) &&
      !EXCLUDED_GROUPS.includes(s.group) &&
      !s.has_outrights
  );
};

const fetchOddsForSport = async (
  sport: OddsApiSport,
  targetDate: string
): Promise<RawFixture[]> => {
  const isFootball = sport.key.startsWith("soccer_");
  const markets = isFootball ? "h2h,totals" : "h2h,totals,spreads";
  const url = `https://api.the-odds-api.com/v4/sports/${sport.key}/odds?apiKey=${ODDS_API_KEY}&regions=eu,fr&markets=${markets}&oddsFormat=decimal&dateFormat=iso`;

  let events: OddsApiEvent[];
  try {
    events = await fetchJson<OddsApiEvent[]>(url);
  } catch (err) {
    console.error(
      `[odds-api ${sport.title}] ${(err as Error).message.substring(0, 100)}`
    );
    return [];
  }

  const todayEvents = events.filter((e) =>
    isSameDay(e.commence_time, targetDate)
  );
  if (todayEvents.length === 0) return [];

  const sportLabel = detectSportFromGroup(sport.group);

  return todayEvents
    .map<RawFixture | null>((event) => {
      const cotes_books: CotesBooks = {};
      for (const bookmaker of event.bookmakers ?? []) {
        const ourName = BOOK_MAPPING[bookmaker.key];
        if (!ourName) continue;

        const odds: Record<string, number> = {};
        for (const market of bookmaker.markets ?? []) {
          if (market.key === "h2h") {
            for (const o of market.outcomes) {
              if (o.name === event.home_team) odds["1"] = o.price;
              else if (o.name === event.away_team) odds["2"] = o.price;
              else if (o.name === "Draw") odds["X"] = o.price;
            }
          } else if (market.key === "totals") {
            for (const o of market.outcomes) {
              if (o.name === "Over" && o.point !== undefined) {
                odds[`+${o.point}`] = o.price;
              } else if (o.name === "Under" && o.point !== undefined) {
                odds[`-${o.point}`] = o.price;
              }
            }
          } else if (market.key === "spreads") {
            for (const o of market.outcomes) {
              if (o.point === undefined) continue;
              const side = o.name === event.home_team ? "home" : "away";
              odds[`spread_${side}_${o.point}`] = o.price;
            }
          }
        }
        if (Object.keys(odds).length > 0) {
          cotes_books[ourName] = odds;
        }
      }

      if (Object.keys(cotes_books).length === 0) return null;

      return {
        id: `${sport.key}_${event.id}`,
        sport: sportLabel,
        ligue: sport.title,
        match: `${event.home_team} vs ${event.away_team}`,
        date_heure: formatTimeParis(event.commence_time),
        commence_time_iso: event.commence_time,
        home_team: event.home_team,
        away_team: event.away_team,
        cotes_books,
      };
    })
    .filter((f): f is RawFixture => f !== null);
};

// ============================================================================
// FOOTBALL — ENRICHISSEMENT (V3 existant maintenu)
// ============================================================================

type ApiFootballFixtureInfo = {
  fixture_id: number;
  home_id: number;
  away_id: number;
};

const findFootballFixtureId = async (
  homeTeam: string,
  awayTeam: string,
  dateIso: string,
  leagueId: number,
  season: number,
  tracker: ApiFootballRateLimitTracker
): Promise<ApiFootballFixtureInfo | null> => {
  const url = `https://v3.football.api-sports.io/fixtures?date=${dateIso.split("T")[0]}&league=${leagueId}&season=${season}`;
  type FixtureResponse = {
    response?: Array<{
      fixture: { id: number };
      teams: {
        home: { id: number; name: string };
        away: { id: number; name: string };
      };
    }>;
  };
  try {
    const data = await fetchJsonAF<FixtureResponse>(url, tracker);
    if (!data.response || data.response.length === 0) return null;
    const match = data.response.find(
      (f) =>
        teamsMatch(homeTeam, f.teams.home.name) &&
        teamsMatch(awayTeam, f.teams.away.name)
    );
    if (!match) return null;
    return {
      fixture_id: match.fixture.id,
      home_id: match.teams.home.id,
      away_id: match.teams.away.id,
    };
  } catch {
    return null;
  }
};

const fetchFootballTeamForm = async (
  teamId: number,
  leagueId: number,
  season: number,
  tracker: ApiFootballRateLimitTracker
): Promise<string | null> => {
  type FormResponse = {
    response?: Array<{
      teams: { home: { id: number }; away: { id: number } };
      goals: { home: number | null; away: number | null };
    }>;
  };
  try {
    const data = await fetchJsonAF<FormResponse>(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&league=${leagueId}&season=${season}&last=5`,
      tracker
    );
    return (data.response ?? [])
      .map((f) => {
        const isHome = f.teams.home.id === teamId;
        const my = isHome ? f.goals.home : f.goals.away;
        const opp = isHome ? f.goals.away : f.goals.home;
        if (my == null || opp == null) return "?";
        return my > opp ? "V" : my < opp ? "D" : "N";
      })
      .join("");
  } catch {
    return null;
  }
};

const fetchFootballH2H = async (
  homeId: number,
  awayId: number,
  tracker: ApiFootballRateLimitTracker
): Promise<string | null> => {
  type H2HResponse = {
    response?: Array<{
      teams: {
        home: { id: number; winner: boolean | null };
        away: { id: number; winner: boolean | null };
      };
    }>;
  };
  try {
    const data = await fetchJsonAF<H2HResponse>(
      `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`,
      tracker
    );
    let hw = 0;
    let aw = 0;
    let d = 0;
    for (const f of data.response ?? []) {
      const winner =
        f.teams.home.winner === true
          ? f.teams.home.id
          : f.teams.away.winner === true
          ? f.teams.away.id
          : null;
      if (winner === null) d++;
      else if (winner === homeId) hw++;
      else if (winner === awayId) aw++;
    }
    return `${hw}V domicile - ${aw}V extérieur - ${d} nul(s) sur les 5 derniers H2H`;
  } catch {
    return null;
  }
};

const fetchFootballInjuries = async (
  teamId: number,
  leagueId: number,
  season: number,
  tracker: ApiFootballRateLimitTracker
): Promise<string[] | null> => {
  type InjuryResponse = {
    response?: Array<{
      player: { name: string | null; reason: string | null };
    }>;
  };
  try {
    const data = await fetchJsonAF<InjuryResponse>(
      `https://v3.football.api-sports.io/injuries?team=${teamId}&league=${leagueId}&season=${season}`,
      tracker
    );
    const blessures = (data.response ?? [])
      .filter((i) => i.player?.name)
      .map((i) => `${i.player.name} (${i.player.reason ?? "absent"})`)
      .slice(0, 5);
    return blessures.length > 0
      ? blessures
      : ["Aucune blessure majeure signalée"];
  } catch {
    return null;
  }
};

// ── Stats équipe football (V3 maintenu, V3.5 enrichi avec splits) ─────────────

const fetchFootballTeamStats = async (
  teamId: number,
  leagueId: number,
  season: number,
  tracker: ApiFootballRateLimitTracker
): Promise<{ stats: FootballTeamStats; splitHome: FootballSplitStats; splitAway: FootballSplitStats }> => {
  type TeamStatsResponse = {
    response?: {
      form?: string;
      fixtures?: {
        played?: { home?: number; away?: number; total?: number };
        wins?: { home?: number; away?: number; total?: number };
        draws?: { home?: number; away?: number; total?: number };
        loses?: { home?: number; away?: number; total?: number };
      };
      goals?: {
        for?: {
          average?: { home?: string; away?: string; total?: string };
          total?: { home?: number; away?: number; total?: number };
        };
        against?: {
          average?: { home?: string; away?: string; total?: string };
          total?: { home?: number; away?: number; total?: number };
        };
      };
      clean_sheet?: { home?: number; away?: number; total?: number };
      failed_to_score?: { home?: number; away?: number; total?: number };
      biggest?: { streak?: { wins?: number; draws?: number; loses?: number } };
    };
  };
  try {
    const data = await fetchJsonAF<TeamStatsResponse>(
      `https://v3.football.api-sports.io/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`,
      tracker
    );
    const r = data.response;
    if (!r) return { stats: emptyFootballTeamStats(), splitHome: emptySplitStats(), splitAway: emptySplitStats() };

    const played = r.fixtures?.played?.total ?? 0;
    const wins   = r.fixtures?.wins?.total   ?? 0;
    const draws  = r.fixtures?.draws?.total  ?? 0;

    const avgFor     = parseFloat(r.goals?.for?.average?.total     ?? "0") || 0;
    const avgAgainst = parseFloat(r.goals?.against?.average?.total ?? "0") || 0;

    let serie: string | null = null;
    if (r.form && r.form.length > 0) {
      const form = r.form;
      const last = form[form.length - 1];
      let count = 0;
      for (let i = form.length - 1; i >= 0; i--) {
        if (form[i] === last) count++;
        else break;
      }
      const label = last === "W" ? "victoire" : last === "D" ? "nul" : "défaite";
      serie = count >= 2 ? `${count} ${label}s consécutif${count > 1 ? "s" : ""}` : null;
    }

    const btts_pct = avgFor > 0 && avgAgainst > 0
      ? Math.min(95, Math.round((avgFor * avgAgainst / (avgFor + avgAgainst)) * 100))
      : null;

    const avgTotal = avgFor + avgAgainst;
    const over_25_pct = avgTotal > 0
      ? Math.min(95, Math.round(Math.max(0, (avgTotal - 2.5) / avgTotal * 100 + 30)))
      : null;

    const stats: FootballTeamStats = {
      classement_position: null,
      classement_points: played > 0 ? wins * 3 + draws : null,
      buts_marques_par_match: avgFor > 0 ? avgFor.toFixed(2) : null,
      buts_encaisses_par_match: avgAgainst > 0 ? avgAgainst.toFixed(2) : null,
      clean_sheets_total: r.clean_sheet?.total ?? null,
      matchs_sans_marquer: r.failed_to_score?.total ?? null,
      btts_pct,
      over_25_pct,
      serie_en_cours: serie,
      matchs_joues: played > 0 ? played : null,
    };

    // V3.5 NOUVEAU : extraction splits dom/ext
    const splitHome: FootballSplitStats = {
      matchs_joues: r.fixtures?.played?.home ?? null,
      victoires: r.fixtures?.wins?.home ?? null,
      nuls: r.fixtures?.draws?.home ?? null,
      defaites: r.fixtures?.loses?.home ?? null,
      buts_marques: r.goals?.for?.total?.home ?? null,
      buts_encaisses: r.goals?.against?.total?.home ?? null,
      buts_marques_avg: r.goals?.for?.average?.home ?? null,
      buts_encaisses_avg: r.goals?.against?.average?.home ?? null,
    };

    const splitAway: FootballSplitStats = {
      matchs_joues: r.fixtures?.played?.away ?? null,
      victoires: r.fixtures?.wins?.away ?? null,
      nuls: r.fixtures?.draws?.away ?? null,
      defaites: r.fixtures?.loses?.away ?? null,
      buts_marques: r.goals?.for?.total?.away ?? null,
      buts_encaisses: r.goals?.against?.total?.away ?? null,
      buts_marques_avg: r.goals?.for?.average?.away ?? null,
      buts_encaisses_avg: r.goals?.against?.average?.away ?? null,
    };

    return { stats, splitHome, splitAway };
  } catch {
    return { stats: emptyFootballTeamStats(), splitHome: emptySplitStats(), splitAway: emptySplitStats() };
  }
};

const emptyFootballTeamStats = (): FootballTeamStats => ({
  classement_position: null,
  classement_points: null,
  buts_marques_par_match: null,
  buts_encaisses_par_match: null,
  clean_sheets_total: null,
  matchs_sans_marquer: null,
  btts_pct: null,
  over_25_pct: null,
  serie_en_cours: null,
  matchs_joues: null,
});

const emptySplitStats = (): FootballSplitStats => ({
  matchs_joues: null,
  victoires: null,
  nuls: null,
  defaites: null,
  buts_marques: null,
  buts_encaisses: null,
  buts_marques_avg: null,
  buts_encaisses_avg: null,
});

const fetchFootballPredictions = async (
  fixtureId: number,
  tracker: ApiFootballRateLimitTracker
): Promise<FootballPrediction | null> => {
  type PredictionsResponse = {
    response?: Array<{
      predictions?: {
        winner?: { name?: string | null };
        percent?: { home?: string; draw?: string; away?: string };
        advice?: string | null;
        under_over?: string | null;
      };
    }>;
  };
  try {
    const data = await fetchJsonAF<PredictionsResponse>(
      `https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`,
      tracker
    );
    const pred = data.response?.[0]?.predictions;
    if (!pred) return null;
    return {
      winner: pred.winner?.name ?? null,
      percent_home: pred.percent?.home ?? null,
      percent_draw: pred.percent?.draw ?? null,
      percent_away: pred.percent?.away ?? null,
      advice: pred.advice ?? null,
      under_over: pred.under_over ?? null,
    };
  } catch {
    return null;
  }
};

// ============================================================================
// V3.5 — FOOTBALL ENRICHISSEMENTS NOUVEAUX
// ============================================================================

/**
 * V3.5 : Récupère la liste des absents/suspendus (sidelined complet).
 * Surclasse fetchFootballInjuries car inclut suspensions cartons + indisponibilités diverses.
 */
const fetchFootballSidelined = async (
  teamId: number,
  tracker: ApiFootballRateLimitTracker
): Promise<FootballSidelinedItem[] | null> => {
  type SidelinedResponse = {
    response?: Array<{
      player?: { name?: string | null };
      type?: string | null;
      start?: string | null;
      end?: string | null;
    }>;
  };
  try {
    const data = await fetchJsonAF<SidelinedResponse>(
      `https://v3.football.api-sports.io/sidelined?team=${teamId}`,
      tracker
    );
    const items: FootballSidelinedItem[] = (data.response ?? [])
      .filter((s) => s.player?.name)
      .slice(0, 10)
      .map((s) => ({
        player_name: s.player?.name ?? "?",
        type: s.type ?? null,
        start_date: s.start ?? null,
        end_date: s.end ?? null,
      }));
    return items.length > 0 ? items : [];
  } catch {
    return null;
  }
};

/**
 * V3.5 : Récupère les stats détaillées d'un match (possession, tirs, corners, xG).
 * Avec cache 48h sur fixture_id pour mutualiser entre matchs de la même équipe.
 */
const fetchFootballFixtureStats = async (
  fixtureId: number,
  teamId: number,
  tracker: ApiFootballRateLimitTracker
): Promise<FootballRecentMatchStats | null> => {
  const cacheKey = `${fixtureId}-${teamId}`;
  const cached = recentStatsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < RECENT_STATS_CACHE_TTL_MS) {
    return cached.data;
  }

  type FixtureStatsResponse = {
    response?: Array<{
      team?: { id?: number };
      statistics?: Array<{
        type?: string;
        value?: number | string | null;
      }>;
    }>;
  };

  type FixtureInfoResponse = {
    response?: Array<{
      fixture?: { id?: number; date?: string };
      teams?: {
        home?: { id?: number; name?: string };
        away?: { id?: number; name?: string };
      };
      goals?: { home?: number | null; away?: number | null };
    }>;
  };

  try {
    const [statsData, infoData] = await Promise.all([
      fetchJsonAF<FixtureStatsResponse>(
        `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
        tracker
      ),
      fetchJsonAF<FixtureInfoResponse>(
        `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
        tracker
      ),
    ]);

    const teamStats = (statsData.response ?? []).find((s) => s.team?.id === teamId);
    if (!teamStats) return null;

    const stat = (key: string): number | null => {
      const item = (teamStats.statistics ?? []).find((s) => s.type === key);
      if (!item || item.value == null) return null;
      const v = typeof item.value === "string" ? parseFloat(item.value.replace("%", "")) : item.value;
      return isNaN(v) ? null : v;
    };

    const fixtureInfo = infoData.response?.[0];
    const isHome = fixtureInfo?.teams?.home?.id === teamId;
    const myGoals = isHome ? fixtureInfo?.goals?.home : fixtureInfo?.goals?.away;
    const oppGoals = isHome ? fixtureInfo?.goals?.away : fixtureInfo?.goals?.home;
    const adversaire = isHome
      ? fixtureInfo?.teams?.away?.name ?? "?"
      : fixtureInfo?.teams?.home?.name ?? "?";

    const resultat: "V" | "N" | "D" | null =
      myGoals == null || oppGoals == null
        ? null
        : myGoals > oppGoals
          ? "V"
          : myGoals < oppGoals
            ? "D"
            : "N";

    const score = myGoals != null && oppGoals != null ? `${myGoals}-${oppGoals}` : null;

    const result: FootballRecentMatchStats = {
      fixture_id: fixtureId,
      date: fixtureInfo?.fixture?.date ?? "?",
      adversaire,
      resultat,
      score,
      possession: stat("Ball Possession"),
      tirs_total: stat("Total Shots"),
      tirs_cadres: stat("Shots on Goal"),
      big_chances: stat("Big Chances"),
      corners: stat("Corner Kicks"),
      cartons_jaunes: stat("Yellow Cards"),
      cartons_rouges: stat("Red Cards"),
      xg: stat("expected_goals") ?? stat("xG"),
      xga: null,
    };

    recentStatsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return null;
  }
};

/**
 * V3.5 : Récupère les stats des 5 derniers matchs d'une équipe.
 * Pour chaque match, fetch les stats détaillées (possession, tirs, xG si dispo).
 */
const fetchFootballRecentMatchesStats = async (
  teamId: number,
  leagueId: number,
  season: number,
  tracker: ApiFootballRateLimitTracker
): Promise<FootballRecentMatchStats[] | null> => {
  type FixturesResponse = {
    response?: Array<{
      fixture?: { id?: number };
    }>;
  };
  try {
    const data = await fetchJsonAF<FixturesResponse>(
      `https://v3.football.api-sports.io/fixtures?team=${teamId}&league=${leagueId}&season=${season}&last=5`,
      tracker
    );
    const fixtureIds = (data.response ?? [])
      .map((f) => f.fixture?.id)
      .filter((id): id is number => typeof id === "number");

    if (fixtureIds.length === 0) return [];

    const stats = await Promise.all(
      fixtureIds.map((fid) =>
        withTimeout(fetchFootballFixtureStats(fid, teamId, tracker), 20000, null)
      )
    );

    return stats.filter((s): s is FootballRecentMatchStats => s !== null);
  } catch {
    return null;
  }
};

/**
 * V3.5 : Récupère les top scorers d'une league (cache 24h).
 */
const fetchFootballTopScorers = async (
  leagueId: number,
  season: number,
  tracker: ApiFootballRateLimitTracker
): Promise<FootballTopScorer[] | null> => {
  const cacheKey = `${leagueId}-${season}`;
  const cached = topScorersCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TOP_SCORERS_CACHE_TTL_MS) {
    return cached.data;
  }

  type TopScorersResponse = {
    response?: Array<{
      player?: { name?: string };
      statistics?: Array<{
        team?: { name?: string };
        games?: { appearences?: number };
        goals?: { total?: number };
      }>;
    }>;
  };
  try {
    const data = await fetchJsonAF<TopScorersResponse>(
      `https://v3.football.api-sports.io/players/topscorers?league=${leagueId}&season=${season}`,
      tracker
    );
    const scorers: FootballTopScorer[] = (data.response ?? [])
      .slice(0, 10)
      .map((s) => ({
        player_name: s.player?.name ?? "?",
        team_name: s.statistics?.[0]?.team?.name ?? "?",
        buts_saison: s.statistics?.[0]?.goals?.total ?? 0,
        apparitions: s.statistics?.[0]?.games?.appearences ?? 0,
      }));

    topScorersCache.set(cacheKey, { data: scorers, timestamp: Date.now() });
    return scorers;
  } catch {
    return null;
  }
};

// ============================================================================
// FOOTBALL — ENRICHFOOTBALL (V3.5 enrichi)
// ============================================================================

const enrichFootball = async (
  match: RawFixture,
  resolver: FootballLeagueResolver,
  tracker: ApiFootballRateLimitTracker
): Promise<EnrichedFixture> => {
  const resolved = resolver.resolve(match.ligue);
  if (!resolved) {
    return {
      ...match,
      apifootball_fixture_id: null,
      forme_5_derniers: "donnée non disponible (ligue non résolue)",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }

  const { leagueId, season } = resolved;
  let fi = await findFootballFixtureId(
    match.home_team, match.away_team, match.commence_time_iso,
    leagueId, season, tracker
  );
  if (!fi) {
    fi = await findFootballFixtureId(
      match.home_team, match.away_team, match.commence_time_iso,
      leagueId, season + 1, tracker
    );
  }
  if (!fi) {
    fi = await findFootballFixtureId(
      match.home_team, match.away_team, match.commence_time_iso,
      leagueId, season - 1, tracker
    );
  }
  if (!fi) {
    return {
      ...match,
      apifootball_fixture_id: null,
      forme_5_derniers: `donnée non disponible (fixture introuvable league=${leagueId})`,
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }

  // Groupe 1 : forme + H2H + stats équipe (avec splits dom/ext)
  const [hf, af, h, hStatsBundle, aStatsBundle] = await Promise.all([
    fetchFootballTeamForm(fi.home_id, leagueId, season, tracker),
    fetchFootballTeamForm(fi.away_id, leagueId, season, tracker),
    fetchFootballH2H(fi.home_id, fi.away_id, tracker),
    withTimeout(
      fetchFootballTeamStats(fi.home_id, leagueId, season, tracker),
      20000,
      { stats: emptyFootballTeamStats(), splitHome: emptySplitStats(), splitAway: emptySplitStats() }
    ),
    withTimeout(
      fetchFootballTeamStats(fi.away_id, leagueId, season, tracker),
      20000,
      { stats: emptyFootballTeamStats(), splitHome: emptySplitStats(), splitAway: emptySplitStats() }
    ),
  ]);

  // Groupe 2 : blessures + prédictions + sidelined V3.5
  const [hi, ai, pred, hSidelined, aSidelined] = await Promise.all([
    fetchFootballInjuries(fi.home_id, leagueId, season, tracker),
    fetchFootballInjuries(fi.away_id, leagueId, season, tracker),
    withTimeout(fetchFootballPredictions(fi.fixture_id, tracker), 20000, null),
    withTimeout(fetchFootballSidelined(fi.home_id, tracker), 20000, null),
    withTimeout(fetchFootballSidelined(fi.away_id, tracker), 20000, null),
  ]);

  // Groupe 3 : stats récentes 5 derniers matchs + top scorers V3.5
  const [hRecent, aRecent, topScorers] = await Promise.all([
    withTimeout(fetchFootballRecentMatchesStats(fi.home_id, leagueId, season, tracker), 20000, null),
    withTimeout(fetchFootballRecentMatchesStats(fi.away_id, leagueId, season, tracker), 20000, null),
    withTimeout(fetchFootballTopScorers(leagueId, season, tracker), 20000, null),
  ]);

  return {
    ...match,
    apifootball_fixture_id: fi.fixture_id,
    forme_5_derniers: {
      [match.home_team]: hf ?? "donnée non disponible",
      [match.away_team]: af ?? "donnée non disponible",
    },
    h2h_5_derniers: h ?? "donnée non disponible",
    blessures: {
      [match.home_team]: hi ?? ["donnée non disponible"],
      [match.away_team]: ai ?? ["donnée non disponible"],
    },
    stats_equipe: {
      home: hStatsBundle.stats,
      away: aStatsBundle.stats,
    },
    predictions_api: pred,
    // V3.5 NOUVEAUX champs
    splits_dom_ext: {
      home_team_at_home: hStatsBundle.splitHome,
      away_team_at_away: aStatsBundle.splitAway,
    },
    recent_matches_stats: {
      home: hRecent ?? [],
      away: aRecent ?? [],
    },
    sidelined: {
      home: hSidelined ?? [],
      away: aSidelined ?? [],
    },
    top_scorers_league: topScorers,
  };
};

// ============================================================================
// BASKETBALL — ENRICHISSEMENT (V3.5 : routing NBA vers v2.nba dédié)
// ============================================================================

type ApiSportsGenericGame = {
  id: number;
  date?: string;
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  league?: { id: number; season: number };
  scores?: {
    home?: { total: number | null } | number | null;
    away?: { total: number | null } | number | null;
  };
};

// ── Standings et H2H basket/hockey (existant maintenu) ─────────────────────────

const fetchApiSportsStanding = async (
  apiBase: string,
  leagueId: number,
  season: number,
  teamId: number
): Promise<TeamStanding> => {
  type StandingEntry = {
    position?: number;
    team?: { id?: number };
    games?: {
      win?: { total?: number };
      lose?: { total?: number };
      played?: { total?: number };
    };
    points?: { for?: { average?: { all?: number } }; against?: { average?: { all?: number } } };
  };
  type StandingResponse = { response?: StandingEntry[][] };
  try {
    const data = await fetchJson<StandingResponse>(
      `${apiBase}/standings?league=${leagueId}&season=${season}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const allEntries = (data.response ?? []).flat();
    const entry = allEntries.find((e) => e.team?.id === teamId);
    if (!entry) return emptyTeamStanding();

    const wins = entry.games?.win?.total ?? 0;
    const losses = entry.games?.lose?.total ?? 0;
    const played = entry.games?.played?.total ?? (wins + losses);
    const win_pct = played > 0 ? Math.round((wins / played) * 100) : null;

    return {
      position: entry.position ?? null,
      victoires: wins,
      defaites: losses,
      marques_par_match: entry.points?.for?.average?.all ?? null,
      encaisses_par_match: entry.points?.against?.average?.all ?? null,
      win_pct,
    };
  } catch {
    return emptyTeamStanding();
  }
};

const emptyTeamStanding = (): TeamStanding => ({
  position: null,
  victoires: null,
  defaites: null,
  marques_par_match: null,
  encaisses_par_match: null,
  win_pct: null,
});

const fetchApiSportsH2H = async (
  apiBase: string,
  homeId: number,
  awayId: number,
  homeTeam: string,
  awayTeam: string
): Promise<TeamH2H | null> => {
  type GameEntry = {
    date?: string;
    teams?: {
      home?: { id?: number; name?: string };
      away?: { id?: number; name?: string };
    };
    scores?: {
      home?: { total?: number | null } | number | null;
      away?: { total?: number | null } | number | null;
    };
  };
  type H2HResponse = { response?: GameEntry[] };
  try {
    const data = await fetchJson<H2HResponse>(
      `${apiBase}/games?h2h=${homeId}-${awayId}&last=5`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const games = data.response ?? [];
    if (games.length === 0) return null;

    let homeWins = 0;
    let awayWins = 0;
    const derniers: string[] = [];

    for (const g of games.slice(0, 5)) {
      const date = g.date ? g.date.split("T")[0] : "?";
      const gHomeId = g.teams?.home?.id;
      const gHomeName = g.teams?.home?.name ?? "?";
      const gAwayName = g.teams?.away?.name ?? "?";

      const rawHome = g.scores?.home;
      const rawAway = g.scores?.away;
      const sHome = typeof rawHome === "object" && rawHome !== null
        ? (rawHome as { total?: number | null }).total ?? null
        : typeof rawHome === "number" ? rawHome : null;
      const sAway = typeof rawAway === "object" && rawAway !== null
        ? (rawAway as { total?: number | null }).total ?? null
        : typeof rawAway === "number" ? rawAway : null;

      if (sHome !== null && sAway !== null) {
        const isOrigHome = gHomeId === homeId;
        const myScore = isOrigHome ? sHome : sAway;
        const oppScore = isOrigHome ? sAway : sHome;
        if (myScore > oppScore) homeWins++;
        else awayWins++;
        derniers.push(`${date}: ${gHomeName} ${sHome}-${sAway} ${gAwayName}`);
      }
    }

    const draws = games.length - homeWins - awayWins;
    const resume = `${homeWins}V ${homeTeam}, ${awayWins}V ${awayTeam}${draws > 0 ? `, ${draws}N` : ""} sur les ${games.length} derniers H2H`;

    return { resume, derniers_matchs: derniers };
  } catch {
    return null;
  }
};

/**
 * V3.5 : enrichissement basket avec routing intelligent NBA vs autres leagues.
 * - NBA → endpoint dédié v2.nba.api-sports.io (stats plus riches)
 * - Autres (Euroleague, ACB, ProA, etc.) → v1.basketball.api-sports.io
 */
const enrichBasketball = async (match: RawFixture): Promise<EnrichedFixture> => {
  const useNBAEndpoint = isNBALeague(match.ligue);
  const apiBase = useNBAEndpoint
    ? "https://v2.nba.api-sports.io"
    : "https://v1.basketball.api-sports.io";

  type GamesResponse = { response?: ApiSportsGenericGame[] };
  try {
    const data = await fetchJson<GamesResponse>(
      `${apiBase}/games?date=${match.commence_time_iso.split("T")[0]}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const game = (data.response ?? []).find(
      (g) =>
        teamsMatch(match.home_team, g.teams.home.name) &&
        teamsMatch(match.away_team, g.teams.away.name)
    );
    if (!game || !game.league) {
      return {
        ...match,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }

    const computeForm = async (teamId: number): Promise<string | null> => {
      try {
        const fd = await fetchJson<GamesResponse>(
          `${apiBase}/games?team=${teamId}&league=${game.league!.id}&season=${game.league!.season}&last=5`,
          { "x-apisports-key": API_FOOTBALL_KEY }
        );
        return (fd.response ?? [])
          .filter((g) => {
            const homeTotal = (g.scores?.home as { total: number | null })?.total;
            return homeTotal != null;
          })
          .slice(0, 5)
          .map((g) => {
            const isHome = g.teams.home.id === teamId;
            const my = isHome
              ? (g.scores?.home as { total: number | null })?.total
              : (g.scores?.away as { total: number | null })?.total;
            const opp = isHome
              ? (g.scores?.away as { total: number | null })?.total
              : (g.scores?.home as { total: number | null })?.total;
            if (my == null || opp == null) return "?";
            return my > opp ? "V" : "D";
          })
          .join("");
      } catch {
        return null;
      }
    };

    const [hf, af] = await Promise.all([
      computeForm(game.teams.home.id),
      computeForm(game.teams.away.id),
    ]);

    const [hStanding, aStanding, h2hData] = await Promise.all([
      withTimeout(fetchApiSportsStanding(apiBase, game.league!.id, game.league!.season, game.teams.home.id), 20000, emptyTeamStanding()),
      withTimeout(fetchApiSportsStanding(apiBase, game.league!.id, game.league!.season, game.teams.away.id), 20000, emptyTeamStanding()),
      withTimeout(fetchApiSportsH2H(apiBase, game.teams.home.id, game.teams.away.id, match.home_team, match.away_team), 20000, null),
    ]);

    const realCommenceTimeBk = game.date ?? match.commence_time_iso;
    return {
      ...match,
      commence_time_iso: realCommenceTimeBk,
      date_heure: formatTimeParis(realCommenceTimeBk),
      forme_5_derniers: {
        [match.home_team]: hf ?? "donnée non disponible",
        [match.away_team]: af ?? "donnée non disponible",
      },
      h2h_5_derniers: h2hData?.resume ?? "donnée non disponible",
      h2h_reel: h2hData,
      blessures: useNBAEndpoint
        ? "donnée non disponible (api-nba ne couvre pas les blessures détaillées)"
        : "donnée non disponible (api-basketball ne couvre pas les blessures)",
      classement: {
        home: hStanding,
        away: aStanding,
      },
    };
  } catch {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }
};

const enrichHockey = async (match: RawFixture): Promise<EnrichedFixture> => {
  type HockeyGame = {
    id: number;
    teams: { home: { id: number; name: string }; away: { id: number; name: string } };
    league?: { id: number; season: number };
    scores?: { home: number | null; away: number | null };
  };
  type GamesResponse = { response?: HockeyGame[] };

  try {
    const data = await fetchJson<GamesResponse>(
      `https://v1.hockey.api-sports.io/games?date=${match.commence_time_iso.split("T")[0]}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const game = (data.response ?? []).find(
      (g) =>
        teamsMatch(match.home_team, g.teams.home.name) &&
        teamsMatch(match.away_team, g.teams.away.name)
    );
    if (!game || !game.league) {
      return {
        ...match,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }

    const computeForm = async (teamId: number): Promise<string | null> => {
      try {
        const fd = await fetchJson<GamesResponse>(
          `https://v1.hockey.api-sports.io/games?team=${teamId}&league=${game.league!.id}&season=${game.league!.season}&last=5`,
          { "x-apisports-key": API_FOOTBALL_KEY }
        );
        return (fd.response ?? [])
          .filter((g) => g.scores?.home != null)
          .slice(0, 5)
          .map((g) => {
            const isHome = g.teams.home.id === teamId;
            const my = isHome ? g.scores!.home : g.scores!.away;
            const opp = isHome ? g.scores!.away : g.scores!.home;
            if (my == null || opp == null) return "?";
            return my > opp ? "V" : "D";
          })
          .join("");
      } catch {
        return null;
      }
    };

    const [hf, af] = await Promise.all([
      computeForm(game.teams.home.id),
      computeForm(game.teams.away.id),
    ]);

    const [hStanding, aStanding, h2hData] = await Promise.all([
      withTimeout(fetchApiSportsStanding("https://v1.hockey.api-sports.io", game.league!.id, game.league!.season, game.teams.home.id), 20000, emptyTeamStanding()),
      withTimeout(fetchApiSportsStanding("https://v1.hockey.api-sports.io", game.league!.id, game.league!.season, game.teams.away.id), 20000, emptyTeamStanding()),
      withTimeout(fetchApiSportsH2H("https://v1.hockey.api-sports.io", game.teams.home.id, game.teams.away.id, match.home_team, match.away_team), 20000, null),
    ]);

    return {
      ...match,
      forme_5_derniers: {
        [match.home_team]: hf ?? "donnée non disponible",
        [match.away_team]: af ?? "donnée non disponible",
      },
      h2h_5_derniers: h2hData?.resume ?? "donnée non disponible",
      h2h_reel: h2hData,
      blessures: "donnée non disponible",
      classement: {
        home: hStanding,
        away: aStanding,
      },
    };
  } catch {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }
};

// ── Stats baseball : standings + lanceurs partants (existant maintenu) ─────────

const fetchBaseballStanding = async (
  leagueId: number,
  season: number,
  teamId: number
): Promise<TeamStanding> => {
  type StandingEntry = {
    position?: number;
    team?: { id?: number };
    won?: number;
    lost?: number;
    pct?: string;
    runs?: { for?: number; against?: number; diff?: number };
  };
  type StandingResponse = { response?: StandingEntry[][] };
  try {
    const data = await fetchJson<StandingResponse>(
      `https://v1.baseball.api-sports.io/standings?league=${leagueId}&season=${season}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const allEntries = (data.response ?? []).flat();
    const entry = allEntries.find((e) => e.team?.id === teamId);
    if (!entry) return emptyTeamStanding();

    const won = entry.won ?? 0;
    const lost = entry.lost ?? 0;
    const played = won + lost;
    const win_pct = played > 0 ? Math.round((won / played) * 100) : null;
    const runsFor = entry.runs?.for;
    const marques_par_match = runsFor && played > 0 ? Math.round((runsFor / played) * 100) / 100 : null;
    const runsAgainst = entry.runs?.against;
    const encaisses_par_match = runsAgainst && played > 0 ? Math.round((runsAgainst / played) * 100) / 100 : null;

    return {
      position: entry.position ?? null,
      victoires: won,
      defaites: lost,
      marques_par_match,
      encaisses_par_match,
      win_pct,
    };
  } catch {
    return emptyTeamStanding();
  }
};

const fetchBaseballPitcherStats = async (
  teamId: number,
  leagueId: number,
  season: number
): Promise<PitcherStats | null> => {
  type PlayerStats = {
    player?: { id?: number; name?: string };
    statistics?: Array<{
      games?: { start?: number };
      earned_run_average?: number | null;
      walks_plus_hits_per_inning_pitched?: number | null;
      strikeouts_per_nine_innings?: number | null;
      wins?: number | null;
      losses?: number | null;
      innings_pitched?: string | null;
    }>;
  };
  type PlayersResponse = { response?: PlayerStats[] };
  try {
    const data = await fetchJson<PlayersResponse>(
      `https://v1.baseball.api-sports.io/players/statistics?team=${teamId}&season=${season}&league=${leagueId}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const players = data.response ?? [];

    const pitchers = players.filter((p) => {
      const s = p.statistics?.[0];
      return s && (s.games?.start ?? 0) > 0 && s.earned_run_average !== undefined;
    });

    if (pitchers.length === 0) return null;

    pitchers.sort((a, b) => {
      const sa = a.statistics?.[0]?.games?.start ?? 0;
      const sb = b.statistics?.[0]?.games?.start ?? 0;
      return sb - sa;
    });

    const best = pitchers[0];
    const s = best?.statistics?.[0];
    if (!s) return null;

    return {
      nom: best?.player?.name ?? null,
      era: s.earned_run_average ?? null,
      whip: s.walks_plus_hits_per_inning_pitched ?? null,
      k_per_9: s.strikeouts_per_nine_innings ?? null,
      victoires: s.wins ?? null,
      defaites: s.losses ?? null,
      innings_lances: s.innings_pitched ? parseFloat(s.innings_pitched) : null,
    };
  } catch {
    return null;
  }
};

const enrichBaseball = async (match: RawFixture): Promise<EnrichedFixture> => {
  type GamesResponse = { response?: ApiSportsGenericGame[] };
  try {
    const data = await fetchJson<GamesResponse>(
      `https://v1.baseball.api-sports.io/games?date=${match.commence_time_iso.split("T")[0]}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const game = (data.response ?? []).find(
      (g) =>
        teamsMatch(match.home_team, g.teams.home.name) &&
        teamsMatch(match.away_team, g.teams.away.name)
    );
    if (!game || !game.league) {
      return {
        ...match,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }

    const computeForm = async (teamId: number): Promise<string | null> => {
      try {
        const fd = await fetchJson<GamesResponse>(
          `https://v1.baseball.api-sports.io/games?team=${teamId}&league=${game.league!.id}&season=${game.league!.season}&last=5`,
          { "x-apisports-key": API_FOOTBALL_KEY }
        );
        return (fd.response ?? [])
          .filter((g) => {
            const t = (g.scores?.home as { total: number | null })?.total;
            return t != null;
          })
          .slice(0, 5)
          .map((g) => {
            const isHome = g.teams.home.id === teamId;
            const my = isHome
              ? (g.scores?.home as { total: number | null })?.total
              : (g.scores?.away as { total: number | null })?.total;
            const opp = isHome
              ? (g.scores?.away as { total: number | null })?.total
              : (g.scores?.home as { total: number | null })?.total;
            if (my == null || opp == null) return "?";
            return my > opp ? "V" : "D";
          })
          .join("");
      } catch {
        return null;
      }
    };

    const [hf, af] = await Promise.all([
      computeForm(game.teams.home.id),
      computeForm(game.teams.away.id),
    ]);

    const [hStanding, aStanding, hPitcher, aPitcher] = await Promise.all([
      withTimeout(fetchBaseballStanding(game.league!.id, game.league!.season, game.teams.home.id), 20000, emptyTeamStanding()),
      withTimeout(fetchBaseballStanding(game.league!.id, game.league!.season, game.teams.away.id), 20000, emptyTeamStanding()),
      withTimeout(fetchBaseballPitcherStats(game.teams.home.id, game.league!.id, game.league!.season), 20000, null),
      withTimeout(fetchBaseballPitcherStats(game.teams.away.id, game.league!.id, game.league!.season), 20000, null),
    ]);

    const realCommenceTime = game.date ?? match.commence_time_iso;

    return {
      ...match,
      commence_time_iso: realCommenceTime,
      date_heure: formatTimeParis(realCommenceTime),
      forme_5_derniers: {
        [match.home_team]: hf ?? "donnée non disponible",
        [match.away_team]: af ?? "donnée non disponible",
      },
      h2h_5_derniers: "donnée non disponible (peu pertinent en MLB vu le volume de matchs)",
      blessures: "donnée non disponible",
      classement: {
        home: hStanding,
        away: aStanding,
      },
      pitchers: {
        home: hPitcher,
        away: aPitcher,
      },
    };
  } catch {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }
};

// ── Stats MMA : record et méthodes de victoire (existant maintenu) ─────────────

const fetchMMAFighterRecord = async (
  fighterId: number
): Promise<MMAFighterRecord | null> => {
  type FighterStats = {
    response?: Array<{
      wins?: { total?: number; by_ko?: number; by_submission?: number; by_decision?: number };
      loses?: { total?: number };
      draws?: { total?: number };
    }>;
  };
  try {
    const data = await fetchJson<FighterStats>(
      `https://v1.mma.api-sports.io/fighters/statistics?id=${fighterId}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const stats = data.response?.[0];
    if (!stats) return null;

    const wins = stats.wins?.total ?? 0;
    const by_ko = stats.wins?.by_ko ?? 0;
    const by_sub = stats.wins?.by_submission ?? 0;
    const by_dec = stats.wins?.by_decision ?? 0;

    const ko_pct = wins > 0 ? Math.round((by_ko / wins) * 100) : null;
    const sub_pct = wins > 0 ? Math.round((by_sub / wins) * 100) : null;
    const dec_pct = wins > 0 ? Math.round((by_dec / wins) * 100) : null;

    return {
      victoires: wins,
      defaites: stats.loses?.total ?? null,
      nuls: stats.draws?.total ?? null,
      ko_tko: by_ko,
      submissions: by_sub,
      decisions: by_dec,
      ko_pct,
      submission_pct: sub_pct,
      decision_pct: dec_pct,
    };
  } catch {
    return null;
  }
};

const enrichMMA = async (match: RawFixture): Promise<EnrichedFixture> => {
  type MMAFighter = {
    id: number;
    name: string;
    height: string | null;
    weight: string | null;
    reach: string | null;
    stance: string | null;
    category: string | null;
    team?: { name: string | null };
  };
  type MMAFight = {
    fighters?: { first?: MMAFighter; second?: MMAFighter } | MMAFighter[];
  };
  type FightsResponse = { response?: MMAFight[] };
  type FighterResponse = { response?: MMAFighter[] };

  try {
    const data = await fetchJson<FightsResponse>(
      `https://v1.mma.api-sports.io/fights?date=${match.commence_time_iso.split("T")[0]}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const fight = (data.response ?? []).find((f) => {
      const fighters = f.fighters;
      if (!fighters) return false;
      const first = Array.isArray(fighters) ? fighters[0] : fighters.first;
      const second = Array.isArray(fighters) ? fighters[1] : fighters.second;
      if (!first || !second) return false;
      return (
        teamsMatch(match.home_team, first.name ?? "") &&
        teamsMatch(match.away_team, second.name ?? "")
      );
    });
    if (!fight) {
      return {
        ...match,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }

    const fighters = fight.fighters!;
    const f1 = (Array.isArray(fighters) ? fighters[0] : fighters.first)!;
    const f2 = (Array.isArray(fighters) ? fighters[1] : fighters.second)!;

    const fetchFighterInfo = async (
      fid: number
    ): Promise<string | null> => {
      try {
        const fd = await fetchJson<FighterResponse>(
          `https://v1.mma.api-sports.io/fighters?id=${fid}`,
          { "x-apisports-key": API_FOOTBALL_KEY }
        );
        const f = fd.response?.[0];
        if (!f) return null;
        const info: string[] = [];
        if (f.category) info.push(`Catégorie: ${f.category}`);
        if (f.height) info.push(`Taille: ${f.height}`);
        if (f.weight) info.push(`Poids: ${f.weight}`);
        if (f.reach) info.push(`Allonge: ${f.reach}`);
        if (f.stance) info.push(`Garde: ${f.stance}`);
        if (f.team?.name) info.push(`Équipe: ${f.team.name}`);
        return info.length > 0 ? info.join(", ") : null;
      } catch {
        return null;
      }
    };

    const [r1, r2, rec1, rec2] = await Promise.all([
      fetchFighterInfo(f1.id),
      fetchFighterInfo(f2.id),
      withTimeout(fetchMMAFighterRecord(f1.id), 20000, null),
      withTimeout(fetchMMAFighterRecord(f2.id), 20000, null),
    ]);

    const records: Record<string, MMAFighterRecord> = {};
    if (rec1) records[match.home_team] = rec1;
    if (rec2) records[match.away_team] = rec2;

    return {
      ...match,
      forme_5_derniers: {
        [match.home_team]: r1 ?? "donnée non disponible",
        [match.away_team]: r2 ?? "donnée non disponible",
      },
      h2h_5_derniers: "donnée non disponible (rare en MMA)",
      blessures: "donnée non disponible",
      records_fighters: Object.keys(records).length > 0 ? records : null,
    };
  } catch {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }
};

const enrichAmericanFootball = (match: RawFixture): EnrichedFixture => {
  return {
    ...match,
    forme_5_derniers: "donnée non disponible (NFL hors saison régulière)",
    h2h_5_derniers: "donnée non disponible",
    blessures: "donnée non disponible",
  };
};

// ============================================================================
// TENNIS — ENRICHISSEMENT VIA MATCHSTAT PRO RAPIDAPI (V3.5 enrichi)
// ============================================================================

const MATCHSTAT_HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";
const MATCHSTAT_BASE = `https://${MATCHSTAT_HOST}`;
const MATCHSTAT_HEADERS = {
  "X-RapidAPI-Key": RAPIDAPI_KEY,
  "X-RapidAPI-Host": MATCHSTAT_HOST,
};

type MatchstatFixture = {
  id?: number;
  player1?: { id: number; name: string };
  player2?: { id: number; name: string };
  tournament?: {
    id?: number;
    rankId?: number;
    rank?: { id?: number; name?: string };
    court?: { name?: string };
  };
  round?: { name?: string };
  h2h?: {
    player1AllWins?: number;
    player2AllWins?: number;
  };
};

class TennisFixturesIndex {
  atp: MatchstatFixture[] = [];
  wta: MatchstatFixture[] = [];

  async load(date: string): Promise<void> {
    const fetchTour = async (
      tour: "atp" | "wta"
    ): Promise<MatchstatFixture[]> => {
      try {
        const url = `${MATCHSTAT_BASE}/tennis/v2/${tour}/fixtures/${date}?include=round,tournament.court,tournament.rank,h2h&filter=PlayerGroup:singles&pageSize=200`;
        const data = await fetchJson<unknown>(url, MATCHSTAT_HEADERS);
        if (Array.isArray(data)) return data as MatchstatFixture[];
        const obj = data as { data?: MatchstatFixture[] };
        return obj.data ?? [];
      } catch (err) {
        console.warn(
          `[matchstat ${tour}] ${(err as Error).message.substring(0, 80)}`
        );
        return [];
      }
    };
    const [atp, wta] = await Promise.all([fetchTour("atp"), fetchTour("wta")]);
    this.atp = atp;
    this.wta = wta;
  }

  find(homeTeam: string, awayTeam: string):
    | {
        tour: "atp" | "wta";
        player1: { id: number; name: string };
        player2: { id: number; name: string };
        rankId: number | null;
        rankName: string | null;
        courtName: string | null;
        roundName: string | null;
        tournamentId: number | null;
        h2hPrecomputed: { player1AllWins?: number; player2AllWins?: number } | null;
      }
    | null {
    for (const tour of ["atp", "wta"] as const) {
      const fixtures = tour === "atp" ? this.atp : this.wta;
      const found = fixtures.find((f) => {
        const p1 = f.player1?.name ?? "";
        const p2 = f.player2?.name ?? "";
        return (
          (teamsMatch(homeTeam, p1) && teamsMatch(awayTeam, p2)) ||
          (teamsMatch(homeTeam, p2) && teamsMatch(awayTeam, p1))
        );
      });
      if (found && found.player1 && found.player2) {
        const p1MatchesHome = teamsMatch(homeTeam, found.player1.name ?? "");
        return {
          tour,
          player1: p1MatchesHome ? found.player1 : found.player2,
          player2: p1MatchesHome ? found.player2 : found.player1,
          rankId: found.tournament?.rankId ?? found.tournament?.rank?.id ?? null,
          rankName: found.tournament?.rank?.name ?? null,
          courtName: found.tournament?.court?.name ?? null,
          roundName: found.round?.name ?? null,
          tournamentId: found.tournament?.id ?? null,
          h2hPrecomputed: found.h2h ?? null,
        };
      }
    }
    return null;
  }
}

type MatchstatPlayerProfile = {
  currentRank?: number | null;
  points?: number | null;
  ch?: number | null;
  form?: string[] | null;
};

const fetchTennisPlayerProfile = async (
  tour: "atp" | "wta",
  playerId: number
): Promise<MatchstatPlayerProfile | null> => {
  try {
    return await fetchJson<MatchstatPlayerProfile>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/player/profile/${playerId}?include=form,country`,
      MATCHSTAT_HEADERS
    );
  } catch {
    return null;
  }
};

type MatchstatSurfaceItem = { court: string; courtWins: number; courtLosses: number };

const fetchTennisSurfaceSummary = async (
  tour: "atp" | "wta",
  playerId: number
): Promise<MatchstatSurfaceItem[] | null> => {
  type SurfaceResponse = {
    data?: Array<{ surfaces?: MatchstatSurfaceItem[] }>;
  };
  try {
    const data = await fetchJson<SurfaceResponse>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/player/surface-summary/${playerId}`,
      MATCHSTAT_HEADERS
    );
    return data?.data?.[0]?.surfaces ?? null;
  } catch {
    return null;
  }
};

type MatchstatH2HInfoItem = {
  court: string;
  player1wins: number;
  player2wins: number;
};

const fetchTennisH2HInfo = async (
  tour: "atp" | "wta",
  p1Id: number,
  p2Id: number
): Promise<MatchstatH2HInfoItem[] | null> => {
  type H2HInfoResponse = { data?: MatchstatH2HInfoItem[] };
  try {
    const d = await fetchJson<H2HInfoResponse>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/h2h/info/${p1Id}/${p2Id}`,
      MATCHSTAT_HEADERS
    );
    return d?.data ?? null;
  } catch {
    return null;
  }
};

type MatchstatH2HStats = {
  matchesCount?: number;
  player1Stats?: {
    matchesWon: number;
    firstServePercentage: number;
    winningOnFirstServePercentage: number;
    winningOnSecondServePercentage: number;
    breakpointsWonPercentage: number;
    tiebreakWon: number;
    tiebreakCount: number;
  };
  player2Stats?: MatchstatH2HStats["player1Stats"];
};

const fetchTennisH2HStats = async (
  tour: "atp" | "wta",
  p1Id: number,
  p2Id: number
): Promise<MatchstatH2HStats | null> => {
  type H2HStatsResponse = { data?: MatchstatH2HStats };
  try {
    const d = await fetchJson<H2HStatsResponse>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/h2h/stats/${p1Id}/${p2Id}`,
      MATCHSTAT_HEADERS
    );
    return d?.data ?? null;
  } catch {
    return null;
  }
};

type MatchstatH2HMatch = {
  date: string;
  tournament?: { name: string };
  player1?: { name: string };
  player2?: { name: string };
  result: string;
};

const fetchTennisH2HMatches = async (
  tour: "atp" | "wta",
  p1Id: number,
  p2Id: number
): Promise<MatchstatH2HMatch[] | null> => {
  type H2HMatchesResponse = { data?: MatchstatH2HMatch[] };
  try {
    const d = await fetchJson<H2HMatchesResponse>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/h2h/matches/${p1Id}/${p2Id}?include=round,tournament&pageSize=5`,
      MATCHSTAT_HEADERS
    );
    return d?.data ?? null;
  } catch {
    return null;
  }
};

// ============================================================================
// TENNIS V3.5 — NOUVEAUX ENDPOINTS (filtrés Masters 1000+ et Grand Chelem)
// ============================================================================

/**
 * V3.5 : past matches d'un joueur avec cotes historiques pré-match.
 * Endpoint : /player/past-matches/{id}
 *
 * Permet à l'IA de raisonner sur les patterns favori/outsider :
 * "Sinner gagne 73% en favori sous 1.50, mais 48% au-dessus de 1.80"
 */
const fetchTennisPastMatchesWithOdds = async (
  tour: "atp" | "wta",
  playerId: number
): Promise<TennisPastMatchWithOdds[] | null> => {
  type PastMatchesResponse = {
    data?: Array<{
      date?: string;
      tournament?: { name?: string; court?: { name?: string } };
      opponent?: { name?: string };
      result?: string;
      score?: string;
      odd1?: number | string | null;
      odd2?: number | string | null;
    }>;
  };
  try {
    const d = await fetchJson<PastMatchesResponse>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/player/past-matches/${playerId}?include=tournament,opponent&pageSize=20`,
      MATCHSTAT_HEADERS
    );
    return (d?.data ?? []).slice(0, 20).map((m) => ({
      date: m.date ?? "?",
      tournament: m.tournament?.name ?? "?",
      surface: m.tournament?.court?.name ?? null,
      opponent: m.opponent?.name ?? "?",
      result: m.result === "W" || m.result === "L" ? m.result : null,
      score: m.score ?? null,
      odd_player: typeof m.odd1 === "number"
        ? m.odd1
        : typeof m.odd1 === "string" ? parseFloat(m.odd1) || null : null,
      odd_opponent: typeof m.odd2 === "number"
        ? m.odd2
        : typeof m.odd2 === "string" ? parseFloat(m.odd2) || null : null,
    }));
  } catch {
    return null;
  }
};

/**
 * V3.5 : record du joueur sur ce tournoi spécifique.
 * Endpoint : /player/tournament-record/{playerId}/{tournamentId}
 */
const fetchTennisTournamentRecord = async (
  tour: "atp" | "wta",
  playerId: number,
  tournamentId: number
): Promise<TennisTournamentRecord | null> => {
  type TournamentRecordResponse = {
    data?: {
      tournament?: { name?: string };
      totalWins?: number;
      totalLosses?: number;
      bestRound?: string;
      lastYear?: number;
      yearly?: Array<{
        year: number;
        wins: number;
        losses: number;
        round?: string;
      }>;
    };
  };
  try {
    const d = await fetchJson<TournamentRecordResponse>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/player/tournament-record/${playerId}/${tournamentId}`,
      MATCHSTAT_HEADERS
    );
    if (!d?.data) return null;
    return {
      tournament_name: d.data.tournament?.name ?? "?",
      total_wins: d.data.totalWins ?? 0,
      total_losses: d.data.totalLosses ?? 0,
      best_round_reached: d.data.bestRound ?? null,
      last_year_played: d.data.lastYear ?? null,
      yearly_breakdown: (d.data.yearly ?? []).slice(0, 5).map((y) => ({
        year: y.year,
        wins: y.wins,
        losses: y.losses,
        round: y.round ?? null,
      })),
    };
  } catch {
    return null;
  }
};

/**
 * V3.5 : stats serve/return de carrière du joueur.
 * Endpoint : /player/match-stats/{id}
 */
const fetchTennisCareerStats = async (
  tour: "atp" | "wta",
  playerId: number
): Promise<TennisCareerStats | null> => {
  type CareerStatsResponse = {
    data?: {
      acesGm?: number;
      doubleFaultsGm?: number;
      firstServePercentage?: number;
      winningOnFirstServePercentage?: number;
      winningOnSecondServePercentage?: number;
      breakpointsSavedPercentage?: number;
      breakpointsConvertedPercentage?: number;
    };
  };
  try {
    const d = await fetchJson<CareerStatsResponse>(
      `${MATCHSTAT_BASE}/tennis/v2/${tour}/player/match-stats/${playerId}`,
      MATCHSTAT_HEADERS
    );
    if (!d?.data) return null;
    return {
      aces_per_match: d.data.acesGm ?? null,
      double_faults_per_match: d.data.doubleFaultsGm ?? null,
      first_serve_in_pct: d.data.firstServePercentage ?? null,
      first_serve_won_pct: d.data.winningOnFirstServePercentage ?? null,
      second_serve_won_pct: d.data.winningOnSecondServePercentage ?? null,
      break_points_saved_pct: d.data.breakpointsSavedPercentage ?? null,
      break_points_converted_pct: d.data.breakpointsConvertedPercentage ?? null,
    };
  } catch {
    return null;
  }
};

/**
 * V3.5 : finales et titres du joueur.
 * Endpoints : /player/finals/{id} + /player/titles/{id}
 *
 * Activé uniquement si le match est en demi (SF) ou finale (Final).
 */
const fetchTennisFinalsTitles = async (
  tour: "atp" | "wta",
  playerId: number
): Promise<TennisFinalsTitles | null> => {
  type FinalsResponse = {
    data?: {
      total?: number;
      won?: number;
      lost?: number;
    };
  };
  type TitlesResponse = {
    data?: {
      total?: number;
      grandSlam?: number;
    };
  };
  try {
    const [finalsD, titlesD] = await Promise.all([
      fetchJson<FinalsResponse>(
        `${MATCHSTAT_BASE}/tennis/v2/${tour}/player/finals/${playerId}`,
        MATCHSTAT_HEADERS
      ).catch(() => null),
      fetchJson<TitlesResponse>(
        `${MATCHSTAT_BASE}/tennis/v2/${tour}/player/titles/${playerId}`,
        MATCHSTAT_HEADERS
      ).catch(() => null),
    ]);
    const total_finals = finalsD?.data?.total ?? 0;
    const finals_won = finalsD?.data?.won ?? 0;
    const finals_win_pct = total_finals > 0
      ? Math.round((finals_won / total_finals) * 100)
      : null;
    return {
      total_finals,
      finals_won,
      finals_lost: finalsD?.data?.lost ?? 0,
      finals_win_pct,
      total_titles: titlesD?.data?.total ?? 0,
      grand_slam_titles: titlesD?.data?.grandSlam ?? 0,
    };
  } catch {
    return null;
  }
};

/**
 * V3.5 : détecte si le match est en demi-finale ou finale (utile pour activer
 * fetchTennisFinalsTitles uniquement quand pertinent).
 */
const isLateRoundTennis = (roundName: string | null): boolean => {
  if (!roundName) return false;
  const norm = roundName.toLowerCase();
  return (
    norm.includes("final") ||
    norm.includes("semi") ||
    norm.includes("sf") ||
    norm === "f"
  );
};

const enrichTennis = async (
  match: RawFixture,
  tennisIndex: TennisFixturesIndex
): Promise<EnrichedFixture> => {
  const fixture = tennisIndex.find(match.home_team, match.away_team);
  if (!fixture) {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible (match non trouvé sur Matchstat)",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }

  // Filtrage rankId 1-7 (Grand Slam, Masters 1000, ATP/WTA 500, ATP/WTA 250)
  if (fixture.rankId && !TENNIS_ALLOWED_RANK_IDS.includes(fixture.rankId)) {
    return {
      ...match,
      forme_5_derniers: `donnée non disponible (tournoi ${fixture.rankName ?? "?"} hors scope)`,
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }

  const { tour, player1, player2 } = fixture;

  // Groupe 1 : enrichissement basique (existant V3) — toujours actif
  const [pr1, pr2, sf1, sf2, hi, hs, hm] = await Promise.all([
    fetchTennisPlayerProfile(tour, player1.id),
    fetchTennisPlayerProfile(tour, player2.id),
    fetchTennisSurfaceSummary(tour, player1.id),
    fetchTennisSurfaceSummary(tour, player2.id),
    fetchTennisH2HInfo(tour, player1.id, player2.id),
    fetchTennisH2HStats(tour, player1.id, player2.id),
    fetchTennisH2HMatches(tour, player1.id, player2.id),
  ]);

  // V3.5 : enrichissements lourds (past matches, tournament record, career, finals)
  // UNIQUEMENT sur Grand Slam / Masters 1000 / 500 (rankId 1-3)
  const isDeepEnrichmentTournament =
    fixture.rankId !== null && TENNIS_DEEP_ENRICHMENT_RANK_IDS.includes(fixture.rankId);

  const isLateRound = isLateRoundTennis(fixture.roundName);

  let pastMatchesP1: TennisPastMatchWithOdds[] | null = null;
  let pastMatchesP2: TennisPastMatchWithOdds[] | null = null;
  let tournamentRecordP1: TennisTournamentRecord | null = null;
  let tournamentRecordP2: TennisTournamentRecord | null = null;
  let careerStatsP1: TennisCareerStats | null = null;
  let careerStatsP2: TennisCareerStats | null = null;
  let finalsTitlesP1: TennisFinalsTitles | null = null;
  let finalsTitlesP2: TennisFinalsTitles | null = null;

  if (isDeepEnrichmentTournament) {
    const [pm1, pm2, cs1, cs2] = await Promise.all([
      withTimeout(fetchTennisPastMatchesWithOdds(tour, player1.id), 20000, null),
      withTimeout(fetchTennisPastMatchesWithOdds(tour, player2.id), 20000, null),
      withTimeout(fetchTennisCareerStats(tour, player1.id), 20000, null),
      withTimeout(fetchTennisCareerStats(tour, player2.id), 20000, null),
    ]);
    pastMatchesP1 = pm1;
    pastMatchesP2 = pm2;
    careerStatsP1 = cs1;
    careerStatsP2 = cs2;

    if (fixture.tournamentId !== null) {
      const [tr1, tr2] = await Promise.all([
        withTimeout(fetchTennisTournamentRecord(tour, player1.id, fixture.tournamentId), 20000, null),
        withTimeout(fetchTennisTournamentRecord(tour, player2.id, fixture.tournamentId), 20000, null),
      ]);
      tournamentRecordP1 = tr1;
      tournamentRecordP2 = tr2;
    }

    if (isLateRound) {
      const [ft1, ft2] = await Promise.all([
        withTimeout(fetchTennisFinalsTitles(tour, player1.id), 20000, null),
        withTimeout(fetchTennisFinalsTitles(tour, player2.id), 20000, null),
      ]);
      finalsTitlesP1 = ft1;
      finalsTitlesP2 = ft2;
    }
  }

  const formatForm = (p: MatchstatPlayerProfile | null): string => {
    if (!p?.form) return "donnée non disponible";
    if (!Array.isArray(p.form)) return "donnée non disponible";
    return p.form
      .map((r) => (r === "w" ? "V" : r === "l" ? "D" : "?"))
      .join("");
  };

  const formatRank = (p: MatchstatPlayerProfile | null): string => {
    if (!p) return "donnée non disponible";
    return `#${p.currentRank ?? "?"} (${p.points ?? 0} pts, career high #${p.ch ?? "?"})`;
  };

  const formatSurface = (s: MatchstatSurfaceItem[] | null): string => {
    if (!s || s.length === 0) return "donnée non disponible";
    return s.map((x) => `${x.court} ${x.courtWins}V-${x.courtLosses}D`).join(" | ");
  };

  let h2hStr = "donnée non disponible";
  if (hi && Array.isArray(hi) && hi.length > 0) {
    h2hStr = hi
      .map((h) => `Sur ${h.court}: ${h.player1wins}-${h.player2wins}`)
      .join(" | ");
  } else if (fixture.h2hPrecomputed) {
    const p1w = fixture.h2hPrecomputed.player1AllWins ?? 0;
    const p2w = fixture.h2hPrecomputed.player2AllWins ?? 0;
    h2hStr = `Total: ${p1w}-${p2w}`;
  }

  let h2hStatsFmt: EnrichedFixture["h2h_stats_detaillees"] = "donnée non disponible";
  if (hs?.player1Stats && hs?.player2Stats && hs.matchesCount !== undefined) {
    h2hStatsFmt = {
      matches_count: hs.matchesCount,
      [match.home_team]: {
        matches_won: hs.player1Stats.matchesWon,
        first_serve_pct: `${hs.player1Stats.firstServePercentage}%`,
        win_first_serve_pct: `${hs.player1Stats.winningOnFirstServePercentage}%`,
        win_second_serve_pct: `${hs.player1Stats.winningOnSecondServePercentage}%`,
        break_points_won_pct: `${hs.player1Stats.breakpointsWonPercentage}%`,
        tiebreaks_won: `${hs.player1Stats.tiebreakWon}/${hs.player1Stats.tiebreakCount}`,
      },
      [match.away_team]: {
        matches_won: hs.player2Stats.matchesWon,
        first_serve_pct: `${hs.player2Stats.firstServePercentage}%`,
        win_first_serve_pct: `${hs.player2Stats.winningOnFirstServePercentage}%`,
        win_second_serve_pct: `${hs.player2Stats.winningOnSecondServePercentage}%`,
        break_points_won_pct: `${hs.player2Stats.breakpointsWonPercentage}%`,
        tiebreaks_won: `${hs.player2Stats.tiebreakWon}/${hs.player2Stats.tiebreakCount}`,
      },
    };
  }

  const h2hRecentFmt: string | string[] =
    hm && hm.length > 0
      ? hm.slice(0, 5).map((m) => {
          const date = m.date ? m.date.split("T")[0] : "?";
          const t = m.tournament?.name ?? "Tournoi";
          return `${date} - ${t}: ${m.player1?.name} bat ${m.player2?.name} (${m.result})`;
        })
      : "donnée non disponible";

  return {
    ...match,
    tournoi_info: `${fixture.rankName ?? "?"} sur ${fixture.courtName ?? "?"} (${fixture.roundName ?? "?"})`,
    ranking: {
      [match.home_team]: formatRank(pr1),
      [match.away_team]: formatRank(pr2),
    },
    forme_5_derniers: {
      [match.home_team]: formatForm(pr1),
      [match.away_team]: formatForm(pr2),
    },
    surface_year_to_date: {
      [match.home_team]: formatSurface(sf1),
      [match.away_team]: formatSurface(sf2),
    },
    h2h_5_derniers: h2hStr,
    h2h_stats_detaillees: h2hStatsFmt,
    h2h_derniers_matchs: h2hRecentFmt,
    blessures: "donnée non disponible (pas de tracking blessures en tennis)",
    // V3.5 NOUVEAUX champs (null si tournoi mineur)
    tennis_past_matches: isDeepEnrichmentTournament
      ? { player1: pastMatchesP1 ?? [], player2: pastMatchesP2 ?? [] }
      : null,
    tennis_tournament_record: isDeepEnrichmentTournament
      ? { player1: tournamentRecordP1, player2: tournamentRecordP2 }
      : null,
    tennis_career_stats: isDeepEnrichmentTournament
      ? { player1: careerStatsP1, player2: careerStatsP2 }
      : null,
    tennis_finals_titles: isDeepEnrichmentTournament && isLateRound
      ? { player1: finalsTitlesP1, player2: finalsTitlesP2 }
      : null,
  };
};

// ============================================================================
// V3.5 — RUGBY (NOUVEAU sport)
// ============================================================================

type ApiRugbyGame = {
  id: number;
  date?: string;
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  league?: { id: number; season: number };
  scores?: { home: number | null; away: number | null };
};

const fetchRugbyStanding = async (
  leagueId: number,
  season: number,
  teamId: number
): Promise<RugbyTeamStats> => {
  type StandingEntry = {
    position?: number;
    team?: { id?: number };
    games?: {
      win?: { total?: number; home?: number; away?: number };
      lose?: { total?: number; home?: number; away?: number };
      draw?: { total?: number; home?: number; away?: number };
      played?: { total?: number };
    };
    points?: { for?: number; against?: number };
  };
  type StandingResponse = { response?: StandingEntry[][] };
  try {
    const data = await fetchJson<StandingResponse>(
      `https://v1.rugby.api-sports.io/standings?league=${leagueId}&season=${season}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const allEntries = (data.response ?? []).flat();
    const entry = allEntries.find((e) => e.team?.id === teamId);
    if (!entry) return emptyRugbyStats();

    const wins = entry.games?.win?.total ?? 0;
    const losses = entry.games?.lose?.total ?? 0;
    const draws = entry.games?.draw?.total ?? 0;
    const played = entry.games?.played?.total ?? (wins + losses + draws);
    const ptsFor = entry.points?.for ?? 0;
    const ptsAgainst = entry.points?.against ?? 0;

    return {
      classement_position: entry.position ?? null,
      victoires: wins,
      defaites: losses,
      nuls: draws,
      points_marques: ptsFor,
      points_encaisses: ptsAgainst,
      points_marques_avg: played > 0 ? Math.round((ptsFor / played) * 10) / 10 : null,
      points_encaisses_avg: played > 0 ? Math.round((ptsAgainst / played) * 10) / 10 : null,
      essais_marques_avg: null, // pas dans l'endpoint standings
      forme_5_derniers: null,
      domicile_record:
        entry.games?.win?.home !== undefined
          ? `${entry.games.win.home}V-${entry.games?.draw?.home ?? 0}N-${entry.games?.lose?.home ?? 0}D`
          : null,
      exterieur_record:
        entry.games?.win?.away !== undefined
          ? `${entry.games.win.away}V-${entry.games?.draw?.away ?? 0}N-${entry.games?.lose?.away ?? 0}D`
          : null,
    };
  } catch {
    return emptyRugbyStats();
  }
};

const emptyRugbyStats = (): RugbyTeamStats => ({
  classement_position: null,
  victoires: null,
  defaites: null,
  nuls: null,
  points_marques: null,
  points_encaisses: null,
  points_marques_avg: null,
  points_encaisses_avg: null,
  essais_marques_avg: null,
  forme_5_derniers: null,
  domicile_record: null,
  exterieur_record: null,
});

const enrichRugby = async (match: RawFixture): Promise<EnrichedFixture> => {
  type GamesResponse = { response?: ApiRugbyGame[] };
  try {
    const data = await fetchJson<GamesResponse>(
      `https://v1.rugby.api-sports.io/games?date=${match.commence_time_iso.split("T")[0]}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const game = (data.response ?? []).find(
      (g) =>
        teamsMatch(match.home_team, g.teams.home.name) &&
        teamsMatch(match.away_team, g.teams.away.name)
    );
    if (!game || !game.league) {
      return {
        ...match,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }

    const computeForm = async (teamId: number): Promise<string | null> => {
      try {
        const fd = await fetchJson<GamesResponse>(
          `https://v1.rugby.api-sports.io/games?team=${teamId}&league=${game.league!.id}&season=${game.league!.season}&last=5`,
          { "x-apisports-key": API_FOOTBALL_KEY }
        );
        return (fd.response ?? [])
          .filter((g) => g.scores?.home != null)
          .slice(0, 5)
          .map((g) => {
            const isHome = g.teams.home.id === teamId;
            const my = isHome ? g.scores!.home : g.scores!.away;
            const opp = isHome ? g.scores!.away : g.scores!.home;
            if (my == null || opp == null) return "?";
            return my > opp ? "V" : my < opp ? "D" : "N";
          })
          .join("");
      } catch {
        return null;
      }
    };

    const [hf, af, hStats, aStats] = await Promise.all([
      computeForm(game.teams.home.id),
      computeForm(game.teams.away.id),
      withTimeout(fetchRugbyStanding(game.league.id, game.league.season, game.teams.home.id), 20000, emptyRugbyStats()),
      withTimeout(fetchRugbyStanding(game.league.id, game.league.season, game.teams.away.id), 20000, emptyRugbyStats()),
    ]);

    const realCommenceTime = game.date ?? match.commence_time_iso;

    return {
      ...match,
      commence_time_iso: realCommenceTime,
      date_heure: formatTimeParis(realCommenceTime),
      forme_5_derniers: {
        [match.home_team]: hf ?? "donnée non disponible",
        [match.away_team]: af ?? "donnée non disponible",
      },
      h2h_5_derniers: "donnée non disponible (pas d'endpoint H2H rugby)",
      blessures: "donnée non disponible (pas d'endpoint blessures rugby)",
      rugby_stats: {
        home: { ...hStats, forme_5_derniers: hf ?? null },
        away: { ...aStats, forme_5_derniers: af ?? null },
      },
    };
  } catch {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }
};

// ============================================================================
// V3.5 — HANDBALL (NOUVEAU sport)
// ============================================================================

type ApiHandballGame = {
  id: number;
  date?: string;
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  league?: { id: number; season: number };
  scores?: { home: number | null; away: number | null };
};

const fetchHandballStanding = async (
  leagueId: number,
  season: number,
  teamId: number
): Promise<HandballTeamStats> => {
  type StandingEntry = {
    position?: number;
    team?: { id?: number };
    games?: {
      win?: { total?: number };
      lose?: { total?: number };
      draw?: { total?: number };
      played?: { total?: number };
    };
    goals?: { for?: number; against?: number };
  };
  type StandingResponse = { response?: StandingEntry[][] };
  try {
    const data = await fetchJson<StandingResponse>(
      `https://v1.handball.api-sports.io/standings?league=${leagueId}&season=${season}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const allEntries = (data.response ?? []).flat();
    const entry = allEntries.find((e) => e.team?.id === teamId);
    if (!entry) return emptyHandballStats();

    const wins = entry.games?.win?.total ?? 0;
    const losses = entry.games?.lose?.total ?? 0;
    const draws = entry.games?.draw?.total ?? 0;
    const played = entry.games?.played?.total ?? (wins + losses + draws);
    const goalsFor = entry.goals?.for ?? 0;
    const goalsAgainst = entry.goals?.against ?? 0;

    return {
      classement_position: entry.position ?? null,
      victoires: wins,
      defaites: losses,
      nuls: draws,
      buts_marques: goalsFor,
      buts_encaisses: goalsAgainst,
      buts_marques_avg: played > 0 ? Math.round((goalsFor / played) * 10) / 10 : null,
      buts_encaisses_avg: played > 0 ? Math.round((goalsAgainst / played) * 10) / 10 : null,
      diff_buts_avg: played > 0 ? Math.round(((goalsFor - goalsAgainst) / played) * 10) / 10 : null,
      forme_5_derniers: null,
      top_scorer: null,
    };
  } catch {
    return emptyHandballStats();
  }
};

const emptyHandballStats = (): HandballTeamStats => ({
  classement_position: null,
  victoires: null,
  defaites: null,
  nuls: null,
  buts_marques: null,
  buts_encaisses: null,
  buts_marques_avg: null,
  buts_encaisses_avg: null,
  diff_buts_avg: null,
  forme_5_derniers: null,
  top_scorer: null,
});

const enrichHandball = async (match: RawFixture): Promise<EnrichedFixture> => {
  type GamesResponse = { response?: ApiHandballGame[] };
  try {
    const data = await fetchJson<GamesResponse>(
      `https://v1.handball.api-sports.io/games?date=${match.commence_time_iso.split("T")[0]}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const game = (data.response ?? []).find(
      (g) =>
        teamsMatch(match.home_team, g.teams.home.name) &&
        teamsMatch(match.away_team, g.teams.away.name)
    );
    if (!game || !game.league) {
      return {
        ...match,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }

    const computeForm = async (teamId: number): Promise<string | null> => {
      try {
        const fd = await fetchJson<GamesResponse>(
          `https://v1.handball.api-sports.io/games?team=${teamId}&league=${game.league!.id}&season=${game.league!.season}&last=5`,
          { "x-apisports-key": API_FOOTBALL_KEY }
        );
        return (fd.response ?? [])
          .filter((g) => g.scores?.home != null)
          .slice(0, 5)
          .map((g) => {
            const isHome = g.teams.home.id === teamId;
            const my = isHome ? g.scores!.home : g.scores!.away;
            const opp = isHome ? g.scores!.away : g.scores!.home;
            if (my == null || opp == null) return "?";
            return my > opp ? "V" : my < opp ? "D" : "N";
          })
          .join("");
      } catch {
        return null;
      }
    };

    const [hf, af, hStats, aStats] = await Promise.all([
      computeForm(game.teams.home.id),
      computeForm(game.teams.away.id),
      withTimeout(fetchHandballStanding(game.league.id, game.league.season, game.teams.home.id), 20000, emptyHandballStats()),
      withTimeout(fetchHandballStanding(game.league.id, game.league.season, game.teams.away.id), 20000, emptyHandballStats()),
    ]);

    const realCommenceTime = game.date ?? match.commence_time_iso;

    return {
      ...match,
      commence_time_iso: realCommenceTime,
      date_heure: formatTimeParis(realCommenceTime),
      forme_5_derniers: {
        [match.home_team]: hf ?? "donnée non disponible",
        [match.away_team]: af ?? "donnée non disponible",
      },
      h2h_5_derniers: "donnée non disponible (pas d'endpoint H2H handball)",
      blessures: "donnée non disponible (pas d'endpoint blessures handball)",
      handball_stats: {
        home: { ...hStats, forme_5_derniers: hf ?? null },
        away: { ...aStats, forme_5_derniers: af ?? null },
      },
    };
  } catch {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }
};

// ============================================================================
// V3.5 — F1 (NOUVEAU sport, structure différente : course pas match)
// ============================================================================

type F1Race = {
  id: number;
  competition?: { id: number; name: string };
  circuit?: { id: number; name: string; image?: string };
  season?: number;
  type?: string;
  laps?: { total?: number; current?: number };
  date?: string;
  status?: { long?: string; short?: string };
  weather?: string;
};

type F1Driver = {
  driver?: { id: number; name: string };
  team?: { id: number; name: string };
  position?: number;
  points?: number;
  wins?: number;
  podiums?: number;
  poles?: number;
};

const fetchF1RaceData = async (
  competitionId: number,
  season: number,
  raceDate: string
): Promise<F1RaceData | null> => {
  type RacesResponse = { response?: F1Race[] };
  try {
    const data = await fetchJson<RacesResponse>(
      `https://v1.formula-1.api-sports.io/races?competition=${competitionId}&season=${season}&type=Race`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const race = (data.response ?? []).find(
      (r) => r.date && r.date.split("T")[0] === raceDate.split("T")[0]
    );
    if (!race) return null;

    return {
      race_name: race.competition?.name ?? "?",
      circuit: race.circuit?.name ?? "?",
      race_date: race.date ?? raceDate,
      qualifying_date: null, // peut être enrichi avec un autre call si besoin
      round: 0, // pas dans la réponse de base
      laps_total: race.laps?.total ?? null,
      weather: race.weather ?? null,
      recent_winners: [], // nécessiterait un call séparé /races?circuit=X&season=...
    };
  } catch {
    return null;
  }
};

const fetchF1DriversStandings = async (
  competitionId: number,
  season: number
): Promise<F1DriverStats[] | null> => {
  type RankingsResponse = { response?: F1Driver[] };
  try {
    const data = await fetchJson<RankingsResponse>(
      `https://v1.formula-1.api-sports.io/rankings/drivers?competition=${competitionId}&season=${season}`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    return (data.response ?? []).slice(0, 20).map((d) => ({
      driver_name: d.driver?.name ?? "?",
      constructor: d.team?.name ?? "?",
      championship_position: d.position ?? null,
      championship_points: d.points ?? null,
      wins_season: d.wins ?? null,
      podiums_season: d.podiums ?? null,
      poles_season: d.poles ?? null,
      last_3_races_positions: [],
      qualifying_position: null,
      best_result_at_circuit: null,
    }));
  } catch {
    return null;
  }
};

const enrichF1 = async (match: RawFixture): Promise<EnrichedFixture> => {
  // Pour F1, le "match" OddsAPI représente souvent un GP entier (pour markets vainqueur)
  // ou un matchup entre 2 pilotes (markets driver matchup)
  // On essaie de trouver la course du jour
  type RacesResponse = { response?: F1Race[] };
  try {
    const data = await fetchJson<RacesResponse>(
      `https://v1.formula-1.api-sports.io/races?date=${match.commence_time_iso.split("T")[0]}&type=Race`,
      { "x-apisports-key": API_FOOTBALL_KEY }
    );
    const race = (data.response ?? [])[0];
    if (!race || !race.competition) {
      return {
        ...match,
        forme_5_derniers: "donnée non disponible (course F1 introuvable)",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }

    const season = race.season ?? new Date().getFullYear();
    const competitionId = race.competition.id;

    const [raceData, drivers] = await Promise.all([
      withTimeout(fetchF1RaceData(competitionId, season, match.commence_time_iso), 20000, null),
      withTimeout(fetchF1DriversStandings(competitionId, season), 20000, null),
    ]);

    const realCommenceTime = race.date ?? match.commence_time_iso;

    return {
      ...match,
      commence_time_iso: realCommenceTime,
      date_heure: formatTimeParis(realCommenceTime),
      forme_5_derniers: "voir données pilotes ci-dessous",
      h2h_5_derniers: "voir historique circuit ci-dessous",
      blessures: "donnée non disponible (rare en F1)",
      f1_race: raceData,
      f1_drivers: drivers,
    };
  } catch {
    return {
      ...match,
      forme_5_derniers: "donnée non disponible",
      h2h_5_derniers: "donnée non disponible",
      blessures: "donnée non disponible",
    };
  }
};

// ============================================================================
// MAIN — fetchMultiSportFixturesForDate (V3.5 avec dropWindow)
// ============================================================================

/**
 * Point d'entrée du multi-sport-fetcher V3.5.
 *
 * @param targetDate Format YYYY-MM-DD
 * @param dropWindow "morning" (matchs < 20h Paris) | "evening" (matchs >= 20h Paris)
 * @returns FetchOutput avec la liste des matchs enrichis filtrés par drop window
 */
export const fetchMultiSportFixturesForDate = async (
  targetDate: string,
  dropWindow: DropWindow = "morning"
): Promise<FetchOutput> => {
  if (!ODDS_API_KEY || !API_FOOTBALL_KEY || !RAPIDAPI_KEY) {
    throw new Error(
      "Missing API keys: check ODDS_API_KEY, API_FOOTBALL_KEY, RAPIDAPI_KEY env vars"
    );
  }

  const tracker = new ApiFootballRateLimitTracker();
  const leagueResolver = new FootballLeagueResolver();
  const tennisIndex = new TennisFixturesIndex();

  // STEP 0 : Chargement références
  await Promise.all([
    leagueResolver.load(tracker),
    tennisIndex.load(targetDate),
  ]);

  // V3.5 Lot 15 — Reset stats cache pour ce drop
  resetCacheStats();

  // STEP 1 : Sports actifs + cotes (V3.5 Lot 15 : parallélisé)
  console.time("[fetcher] STEP 1 (sports + cotes)");
  const activeSports = await fetchActiveSports();
  const matchesPerSport = await Promise.all(
    activeSports.map((sport) => fetchOddsForSport(sport, targetDate))
  );
  const allMatches: RawFixture[] = matchesPerSport.flat();
  console.timeEnd("[fetcher] STEP 1 (sports + cotes)");
  console.log(`[fetcher] STEP 1 → ${allMatches.length} matchs bruts (tous sports)`);

  // V3.5 : Filtre par drop window AVANT enrichissement (économie de calls API)
  const matchesInWindow = allMatches.filter((m) =>
    matchesDropWindow(m.commence_time_iso, dropWindow)
  );

  if (matchesInWindow.length === 0) {
    return {
      date_du_jour: targetDate,
      contexte_du_jour: `Aucun match dans la fenêtre ${dropWindow} le ${targetDate}.`,
      books_disponibles: ["PS3838", "Winamax", "Betclic", "Unibet"],
      note: "PS3838 = Pinnacle (rebrandé). Hors ARJEL. Winamax/Betclic/Unibet = ARJEL.",
      matchs: [],
      stats: {
        total_matchs: 0,
        matchs_par_sport: {},
        api_football_quota_remaining: tracker.state.remainingDay,
        api_football_quota_limit: tracker.state.limitDay,
        unresolved_leagues: [],
      },
      drop_window: dropWindow,
    };
  }

  // STEP 2 : Vérification des ligues foot non résolues
  const unresolvedLeagues = new Set<string>();
  for (const m of matchesInWindow) {
    if (m.sport === "football") {
      const r = leagueResolver.resolve(m.ligue);
      if (!r) unresolvedLeagues.add(m.ligue);
    }
  }

  // STEP 3 : Enrichissement (V3.5 Lot 15 — parallélisé avec concurrence limitée)
  //
  // AVANT : 200 matchs × ~3s en série = ~600s (et timeout à 800s)
  // APRÈS : 200 matchs / concurrence 8 × ~3s = ~75s
  //
  // Concurrence 8 = compromis entre vitesse et respect des rate limits
  // API-Football (le tracker gère les 429 via sleep dans fetchJsonAF).
  // Plus de sleeps artificiels : inutiles avec une concurrence limitée.
  console.time("[fetcher] STEP 3 (enrichissement)");
  const ENRICH_CONCURRENCY = 8;

  const enrichOne = async (m: RawFixture): Promise<EnrichedFixture> => {
    try {
      switch (m.sport) {
        case "football":
          return await enrichFootball(m, leagueResolver, tracker);
        case "basketball":
          return await enrichBasketball(m);
        case "hockey":
          return await enrichHockey(m);
        case "baseball":
          return await enrichBaseball(m);
        case "mma":
          return await enrichMMA(m);
        case "american_football":
          return enrichAmericanFootball(m);
        case "tennis":
          return await enrichTennis(m, tennisIndex);
        case "rugby":
          return await enrichRugby(m);
        case "handball":
          return await enrichHandball(m);
        case "formula_1":
          return await enrichF1(m);
        default:
          return {
            ...m,
            forme_5_derniers: "donnée non disponible",
            h2h_5_derniers: "donnée non disponible",
            blessures: "donnée non disponible",
          };
      }
    } catch (err) {
      console.error(
        `[multi-sport-fetcher] enrich error for ${m.match}:`,
        (err as Error).message
      );
      return {
        ...m,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }
  };

  // Helper p-limit interne (évite la dépendance à la lib p-limit)
  const runWithConcurrency = async <T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const idx = cursor++;
        if (idx >= items.length) return;
        results[idx] = await worker(items[idx]!);
      }
    });
    await Promise.all(runners);
    return results;
  };

  const enriched: EnrichedFixture[] = await runWithConcurrency(
    matchesInWindow,
    ENRICH_CONCURRENCY,
    enrichOne,
  );

  console.timeEnd("[fetcher] STEP 3 (enrichissement)");
  console.log(`[fetcher] STEP 3 → ${enriched.length} matchs enrichis (concurrence ${ENRICH_CONCURRENCY})`);

  // V3.5 Lot 15 — Stats cache (debug perf)
  const cacheStats = getCacheStats();
  const cacheTotal = cacheStats.hits + cacheStats.misses;
  const hitRate = cacheTotal > 0 ? Math.round((cacheStats.hits / cacheTotal) * 100) : 0;
  console.log(
    `[fetcher] CACHE → ${cacheStats.hits} hits / ${cacheStats.misses} misses (${hitRate}%) · ${cacheStats.writes} writes · ${cacheStats.errors} errors`
  );

  // STEP 4 : Stats
  const matchsParSport: Record<string, { ok: number; ko: number }> = {};
  for (const m of enriched) {
    const isOk =
      typeof m.forme_5_derniers === "object" && m.forme_5_derniers !== null;
    matchsParSport[m.sport] = matchsParSport[m.sport] ?? { ok: 0, ko: 0 };
    if (isOk) matchsParSport[m.sport]!.ok++;
    else matchsParSport[m.sport]!.ko++;
  }

  const stats: FetchStats = {
    total_matchs: enriched.length,
    matchs_par_sport: matchsParSport,
    api_football_quota_remaining: tracker.state.remainingDay,
    api_football_quota_limit: tracker.state.limitDay,
    unresolved_leagues: Array.from(unresolvedLeagues),
  };

  return {
    date_du_jour: targetDate,
    contexte_du_jour: `Données réelles fetchées le ${new Date().toISOString()} (drop ${dropWindow}).`,
    books_disponibles: ["PS3838", "Winamax", "Betclic", "Unibet"],
    note: "PS3838 = Pinnacle (rebrandé). Hors ARJEL. Winamax/Betclic/Unibet = ARJEL.",
    matchs: enriched,
    stats,
    drop_window: dropWindow,
  };
};

// ════════════════════════════════════════════════════════════════════════════
// V3.5 LOT 19 — Re-enrichment d'un pick existant (endpoint admin)
// ════════════════════════════════════════════════════════════════════════════
//
// Permet de réenrichir un pick déjà inséré en BDD dont les stats sont vides
// (timeout du fetcher au moment du drop). Réutilisé par /api/admin/picks/[id]/re-enrich.
//
// Contrairement au pipeline complet `fetchMultiSportFixturesForDate`, on ne
// refait PAS les cotes (déjà persistées dans odds_comparison du pick). On
// fait UNIQUEMENT l'enrichissement stats équipe/joueur via API-Football, ESPN,
// Matchstat, etc.
//
// Avec les timeouts 20s du Lot 17 et le retry rate limit du Lot 18, cette
// fonction doit retourner des données complètes même sur les pages détail
// avec rate limit serré.
//

export type ReEnrichPickInput = {
  sport: string; // "football", "tennis", "basketball", etc.
  league: string;
  home_team: string;
  away_team: string;
  commence_time_iso: string; // ISO datetime du match
  apifootball_fixture_id?: number | null;
};

/**
 * Réenrichit un pick avec ses stats équipes/joueurs.
 * Retourne le EnrichedFixture (à mapper ensuite vers odds_comparison via buildOddsComparison).
 *
 * Pour les sports non couverts (NFL, F1, etc.), retourne un EnrichedFixture
 * minimal avec champs "donnée non disponible".
 */
export const reEnrichPick = async (
  input: ReEnrichPickInput
): Promise<EnrichedFixture> => {
  // ─── Init dépendances (selon sport)
  const tracker = new ApiFootballRateLimitTracker();
  const sportLower = input.sport.toLowerCase();
  const isFootball = sportLower === "football" || sportLower === "soccer";
  const isTennis = sportLower === "tennis";

  // Construire un RawFixture minimal (cotes vides — on ne refait pas l'odds layer)
  const match: RawFixture = {
    id: `re-enrich-${Date.now()}`,
    sport: sportLower as SupportedSport,
    ligue: input.league,
    match: `${input.home_team} vs ${input.away_team}`,
    date_heure: new Date(input.commence_time_iso).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    }),
    commence_time_iso: input.commence_time_iso,
    home_team: input.home_team,
    away_team: input.away_team,
    cotes_books: {}, // pas utilisé par les enrichXxx (utilisé seulement pour build cotes)
  };

  // ─── Foot : besoin de resolver
  if (isFootball) {
    const resolver = new FootballLeagueResolver();
    await resolver.load(tracker);
    return await enrichFootball(match, resolver, tracker);
  }

  // ─── Tennis : besoin de tennisIndex pour la date du match
  if (isTennis) {
    const tennisIndex = new TennisFixturesIndex();
    const targetDate = input.commence_time_iso.split("T")[0]; // YYYY-MM-DD
    await tennisIndex.load(targetDate);
    return await enrichTennis(match, tennisIndex);
  }

  // ─── Autres sports : appel direct
  switch (sportLower) {
    case "basketball":
      return await enrichBasketball(match);
    case "hockey":
      return await enrichHockey(match);
    case "baseball":
      return await enrichBaseball(match);
    case "mma":
      return await enrichMMA(match);
    case "rugby":
      return await enrichRugby(match);
    case "handball":
      return await enrichHandball(match);
    case "formula-1":
    case "formula_1":
      return await enrichF1(match);
    case "americanfootball":
    case "american_football":
    case "nfl":
      return enrichAmericanFootball(match);
    default:
      // Sport non couvert : retour minimal
      return {
        ...match,
        forme_5_derniers: `donnée non disponible (sport=${sportLower})`,
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
  }
};