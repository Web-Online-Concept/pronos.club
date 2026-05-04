/**
 * PRONOS.CLUB — Multi-sport fetcher TS (v3)
 *
 * Adaptation production du script v7 validé en session.
 * Fetch + enrichissement multi-sports (foot, tennis, basket, hockey, baseball, MMA, NFL).
 *
 * Sources :
 *   - the-odds-api  : cotes 4 books (PS3838/Pinnacle, Winamax, Betclic, Unibet)
 *   - api-sports.io : enrichissement foot via api-football + 11 autres sports gratuits
 *   - Matchstat Pro : enrichissement tennis (10$/mois RapidAPI)
 *
 * Stratégie :
 *   - Cache leagues api-football (TTL 7 jours) → évite 1 call par run
 *   - Tennis : 2 calls /fixtures/{date} au démarrage → tous les matchs récupérés
 *   - Throttle adaptatif api-football basé sur les headers X-RateLimit-Remaining
 *
 * Performance :
 *   - ~160 matchs / jour
 *   - ~5-15 minutes selon throttling
 *   - ~5000 calls api-football / jour (sur quota 7500)
 */

import {
  LEAGUE_RESOLUTION,
  type LeagueMapping,
} from "./league-resolution";
import { TEAM_ALIASES } from "./team-aliases";
import type {
  CotesBooks,
  EnrichedFixture,
  FetchOutput,
  FetchStats,
  SupportedBookmaker,
  SupportedSport,
  FootballTeamStats,
  FootballPrediction,
  TeamStanding,
  TeamH2H,
  PitcherStats,
  MMAFighterRecord,
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
];

const EXCLUDED_GROUPS = [
  "Politics",
  "Aussie Rules",
  "Boxing",
  "Cricket",
  "Lacrosse",
  "Rugby League",
  "Rugby Union",
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

// Tournament types api-football
const TOURNAMENT_TYPES_LEAGUE = "League";

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

/** Tokens significatifs (≥3 chars, hors stopwords) */
const tokenize = (s: string): string[] => {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
};

/**
 * Match deux noms d'équipe via :
 *   1. Égalité normalisée
 *   2. Alias bidirectionnels (TEAM_ALIASES)
 *   3. Containment direct
 *   4. Tokens significatifs en commun (≥4 chars)
 *   5. Overlap ≥ 50% des tokens
 */
export const teamsMatch = (nameA: string, nameB: string): boolean => {
  const normA = normalize(nameA);
  const normB = normalize(nameB);
  if (normA === normB) return true;

  // Alias bidirectionnels
  const aliasesA = TEAM_ALIASES[normA] ?? [];
  const aliasesB = TEAM_ALIASES[normB] ?? [];
  if (aliasesA.includes(normB) || aliasesB.includes(normA)) return true;

  // Cross-alias (A et B partagent un alias commun)
  for (const a of aliasesA) {
    if (aliasesB.includes(a)) return true;
    if (normalize(a) === normB) return true;
  }
  for (const a of aliasesB) {
    if (aliasesA.includes(a)) return true;
    if (normalize(a) === normA) return true;
  }

  // Containment
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Tokens
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

const detectSportFromGroup = (group: string): SupportedSport => {
  const map: Record<string, SupportedSport> = {
    Soccer: "football",
    Tennis: "tennis",
    Basketball: "basketball",
    "Ice Hockey": "hockey",
    Baseball: "baseball",
    "American Football": "american_football",
    "Mixed Martial Arts": "mma",
  };
  return (map[group] ?? "football") as SupportedSport;
};

// ============================================================================
// API-FOOTBALL : ÉTAT GLOBAL DU RATE LIMIT
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
      await sleep(60_000); // attente full reset
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

const fetchJsonAF = async <T = unknown>(
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
  throw new Error("fetchJsonAF exhausted retries");
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
      const norm = normalize(ligueOddsApi);
      const m = this.allLeagues.find(
        (l) => l.type === TOURNAMENT_TYPES_LEAGUE && normalize(l.name) === norm
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
// FOOTBALL — ENRICHISSEMENT
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



// ── Timeout wrapper pour les calls API secondaires ────────────────────────────
// Les nouvelles stats (standings, pitchers, etc.) sont optionnelles.
// Si l'API met plus de 5s → fallback, on continue sans bloquer le pipeline.
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms));
  return Promise.race([promise, timeout]);
};

// ── Stats équipe football ─────────────────────────────────────────────────────

const fetchFootballTeamStats = async (
  teamId: number,
  leagueId: number,
  season: number,
  tracker: ApiFootballRateLimitTracker
): Promise<FootballTeamStats> => {
  type TeamStatsResponse = {
    response?: {
      form?: string;
      fixtures?: {
        played?: { total?: number };
        wins?: { total?: number };
        draws?: { total?: number };
        loses?: { total?: number };
      };
      goals?: {
        for?: { average?: { total?: string }; total?: { total?: number } };
        against?: { average?: { total?: string }; total?: { total?: number } };
      };
      clean_sheet?: { total?: number };
      failed_to_score?: { total?: number };
      biggest?: { streak?: { wins?: number; draws?: number; loses?: number } };
    };
  };
  try {
    const data = await fetchJsonAF<TeamStatsResponse>(
      `https://v3.football.api-sports.io/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`,
      tracker
    );
    const r = data.response;
    if (!r) return emptyFootballTeamStats();

    const played = r.fixtures?.played?.total ?? 0;
    const wins   = r.fixtures?.wins?.total   ?? 0;
    const draws  = r.fixtures?.draws?.total  ?? 0;
    const loses  = r.fixtures?.loses?.total  ?? 0;

    // Calcul BTTS% et Over2.5% depuis le formulaire
    // (API-Football ne retourne pas ces % directement, on les calcule depuis la forme)
    // Approximation : on utilise les buts pour/contre pour estimer
    const avgFor     = parseFloat(r.goals?.for?.average?.total     ?? "0") || 0;
    const avgAgainst = parseFloat(r.goals?.against?.average?.total ?? "0") || 0;

    // Série en cours depuis le champ form (ex: "WWWDL")
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

    // Estimation BTTS% : si avg_for > 0.8 et avg_against > 0.8 → ~55-65%
    // Approximation simple car API ne donne pas le chiffre exact
    const btts_pct = avgFor > 0 && avgAgainst > 0
      ? Math.min(95, Math.round((avgFor * avgAgainst / (avgFor + avgAgainst)) * 100))
      : null;

    // Estimation Over2.5% depuis avg de buts total
    const avgTotal = avgFor + avgAgainst;
    const over_25_pct = avgTotal > 0
      ? Math.min(95, Math.round(Math.max(0, (avgTotal - 2.5) / avgTotal * 100 + 30)))
      : null;

    return {
      classement_position: null, // récupéré séparément si besoin
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
  } catch {
    return emptyFootballTeamStats();
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

  // Groupe 1 : 5 calls parallèles (forme + H2H + stats équipe)
  const [hf, af, h, hStats, aStats] = await Promise.all([
    fetchFootballTeamForm(fi.home_id, leagueId, season, tracker),
    fetchFootballTeamForm(fi.away_id, leagueId, season, tracker),
    fetchFootballH2H(fi.home_id, fi.away_id, tracker),
    withTimeout(fetchFootballTeamStats(fi.home_id, leagueId, season, tracker), 5000, emptyFootballTeamStats()),
    withTimeout(fetchFootballTeamStats(fi.away_id, leagueId, season, tracker), 5000, emptyFootballTeamStats()),
  ]);

  // Groupe 2 : blessures + prédictions
  const [hi, ai, pred] = await Promise.all([
    fetchFootballInjuries(fi.home_id, leagueId, season, tracker),
    fetchFootballInjuries(fi.away_id, leagueId, season, tracker),
    withTimeout(fetchFootballPredictions(fi.fixture_id, tracker), 5000, null),
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
      home: hStats,
      away: aStats,
    },
    predictions_api: pred,
  };
};

// ============================================================================
// AUTRES SPORTS — ENRICHISSEMENT (basket, hockey, baseball, MMA)
// ============================================================================

type ApiSportsGenericGame = {
  id: number;
  date?: string; // ISO 8601 — heure réelle du match (vs commence_time OddsAPI = heure de publication)
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  league?: { id: number; season: number };
  scores?: {
    home?: { total: number | null } | number | null;
    away?: { total: number | null } | number | null;
  };
};


// ── Standings et H2H basket/hockey ────────────────────────────────────────────

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

      // Extraire les scores (format variable selon sport)
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

const enrichBasketball = async (match: RawFixture): Promise<EnrichedFixture> => {
  type GamesResponse = { response?: ApiSportsGenericGame[] };
  try {
    const data = await fetchJson<GamesResponse>(
      `https://v1.basketball.api-sports.io/games?date=${match.commence_time_iso.split("T")[0]}`,
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
          `https://v1.basketball.api-sports.io/games?team=${teamId}&league=${game.league!.id}&season=${game.league!.season}&last=5`,
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

    // Standings + H2H en parallèle
    const [hStanding, aStanding, h2hData] = await Promise.all([
      withTimeout(fetchApiSportsStanding("https://v1.basketball.api-sports.io", game.league!.id, game.league!.season, game.teams.home.id), 5000, emptyTeamStanding()),
      withTimeout(fetchApiSportsStanding("https://v1.basketball.api-sports.io", game.league!.id, game.league!.season, game.teams.away.id), 5000, emptyTeamStanding()),
      withTimeout(fetchApiSportsH2H("https://v1.basketball.api-sports.io", game.teams.home.id, game.teams.away.id, match.home_team, match.away_team), 5000, null),
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
      blessures: "donnée non disponible (api-basketball ne couvre pas les blessures)",
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

    // Standings + H2H en parallèle
    const [hStanding, aStanding, h2hData] = await Promise.all([
      withTimeout(fetchApiSportsStanding("https://v1.hockey.api-sports.io", game.league!.id, game.league!.season, game.teams.home.id), 5000, emptyTeamStanding()),
      withTimeout(fetchApiSportsStanding("https://v1.hockey.api-sports.io", game.league!.id, game.league!.season, game.teams.away.id), 5000, emptyTeamStanding()),
      withTimeout(fetchApiSportsH2H("https://v1.hockey.api-sports.io", game.teams.home.id, game.teams.away.id, match.home_team, match.away_team), 5000, null),
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


// ── Stats baseball : standings + lanceurs partants ─────────────────────────────

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
    pct?: string; // ex: ".571"
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
    // Runs par match
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

/**
 * Récupère les stats du lanceur partant prévu.
 * En MLB, le lanceur partant est connu ~1 jour avant le match.
 * Source : /players/statistics filtrés par position P (pitcher).
 */
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

    // Filtrer les lanceurs (qui ont fait au moins 1 départ)
    const pitchers = players.filter((p) => {
      const s = p.statistics?.[0];
      return s && (s.games?.start ?? 0) > 0 && s.earned_run_average !== undefined;
    });

    if (pitchers.length === 0) return null;

    // Prendre le lanceur avec le plus de départs (probable starter)
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

    // Standings + pitchers en parallèle
    const [hStanding, aStanding, hPitcher, aPitcher] = await Promise.all([
      withTimeout(fetchBaseballStanding(game.league!.id, game.league!.season, game.teams.home.id), 5000, emptyTeamStanding()),
      withTimeout(fetchBaseballStanding(game.league!.id, game.league!.season, game.teams.away.id), 5000, emptyTeamStanding()),
      withTimeout(fetchBaseballPitcherStats(game.teams.home.id, game.league!.id, game.league!.season), 5000, null),
      withTimeout(fetchBaseballPitcherStats(game.teams.away.id, game.league!.id, game.league!.season), 5000, null),
    ]);

    // Utilise game.date (api-sports.io) si disponible — plus fiable que
    // commence_time OddsAPI qui représente l'heure de publication des cotes
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


// ── Stats MMA : record et méthodes de victoire ─────────────────────────────────

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
      withTimeout(fetchMMAFighterRecord(f1.id), 5000, null),
      withTimeout(fetchMMAFighterRecord(f2.id), 5000, null),
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
  // Pas de saison régulière en mai 2026 (saison NFL = sept-fév)
  return {
    ...match,
    forme_5_derniers: "donnée non disponible (NFL hors saison régulière)",
    h2h_5_derniers: "donnée non disponible",
    blessures: "donnée non disponible",
  };
};

// ============================================================================
// TENNIS — ENRICHISSEMENT VIA MATCHSTAT PRO RAPIDAPI
// ============================================================================

const MATCHSTAT_HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";
const MATCHSTAT_BASE = `https://${MATCHSTAT_HOST}`;
const MATCHSTAT_HEADERS = {
  "X-RapidAPI-Key": RAPIDAPI_KEY,
  "X-RapidAPI-Host": MATCHSTAT_HOST,
};

type MatchstatFixture = {
  player1?: { id: number; name: string };
  player2?: { id: number; name: string };
  tournament?: {
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
        // Format peut être array direct OU { data: [] }
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
  ch?: number | null; // career high
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
  const [pr1, pr2, sf1, sf2, hi, hs, hm] = await Promise.all([
    fetchTennisPlayerProfile(tour, player1.id),
    fetchTennisPlayerProfile(tour, player2.id),
    fetchTennisSurfaceSummary(tour, player1.id),
    fetchTennisSurfaceSummary(tour, player2.id),
    fetchTennisH2HInfo(tour, player1.id, player2.id),
    fetchTennisH2HStats(tour, player1.id, player2.id),
    fetchTennisH2HMatches(tour, player1.id, player2.id),
  ]);

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
  };
};

// ============================================================================
// MAIN — fetchMultiSportFixturesForDate
// ============================================================================

/**
 * Point d'entrée du multi-sport-fetcher.
 *
 * @param targetDate Format YYYY-MM-DD
 * @returns FetchOutput avec la liste des matchs enrichis + stats
 */
export const fetchMultiSportFixturesForDate = async (
  targetDate: string
): Promise<FetchOutput> => {
  // Validation des clés API
  if (!ODDS_API_KEY || !API_FOOTBALL_KEY || !RAPIDAPI_KEY) {
    throw new Error(
      "Missing API keys: check ODDS_API_KEY, API_FOOTBALL_KEY, RAPIDAPI_KEY env vars"
    );
  }

  // Initialisation
  const tracker = new ApiFootballRateLimitTracker();
  const leagueResolver = new FootballLeagueResolver();
  const tennisIndex = new TennisFixturesIndex();

  // STEP 0 : Chargement références (cache leagues + tennis fixtures)
  await Promise.all([
    leagueResolver.load(tracker),
    tennisIndex.load(targetDate),
  ]);

  // STEP 1 : Sports actifs + cotes
  const activeSports = await fetchActiveSports();
  const allMatches: RawFixture[] = [];
  for (const sport of activeSports) {
    const matches = await fetchOddsForSport(sport, targetDate);
    allMatches.push(...matches);
    await sleep(SLEEP_ODDS_API);
  }

  if (allMatches.length === 0) {
    return {
      date_du_jour: targetDate,
      contexte_du_jour: `Aucun match disponible le ${targetDate}.`,
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
    };
  }

  // STEP 2 : Vérification des ligues foot non résolues
  const unresolvedLeagues = new Set<string>();
  for (const m of allMatches) {
    if (m.sport === "football") {
      const r = leagueResolver.resolve(m.ligue);
      if (!r) unresolvedLeagues.add(m.ligue);
    }
  }

  // STEP 3 : Enrichissement
  const enriched: EnrichedFixture[] = [];
  for (const m of allMatches) {
    let e: EnrichedFixture;
    try {
      switch (m.sport) {
        case "football":
          e = await enrichFootball(m, leagueResolver, tracker);
          await sleep(SLEEP_API_FOOTBALL_BASE);
          break;
        case "basketball":
          e = await enrichBasketball(m);
          await sleep(SLEEP_API_SPORTS);
          break;
        case "hockey":
          e = await enrichHockey(m);
          await sleep(SLEEP_API_SPORTS);
          break;
        case "baseball":
          e = await enrichBaseball(m);
          await sleep(SLEEP_API_SPORTS);
          break;
        case "mma":
          e = await enrichMMA(m);
          await sleep(SLEEP_API_SPORTS);
          break;
        case "american_football":
          e = enrichAmericanFootball(m);
          break;
        case "tennis":
          e = await enrichTennis(m, tennisIndex);
          await sleep(SLEEP_MATCHSTAT);
          break;
        default:
          e = {
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
      e = {
        ...m,
        forme_5_derniers: "donnée non disponible",
        h2h_5_derniers: "donnée non disponible",
        blessures: "donnée non disponible",
      };
    }
    enriched.push(e);
  }

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
    contexte_du_jour: `Données réelles fetchées le ${new Date().toISOString()}.`,
    books_disponibles: ["PS3838", "Winamax", "Betclic", "Unibet"],
    note: "PS3838 = Pinnacle (rebrandé). Hors ARJEL. Winamax/Betclic/Unibet = ARJEL.",
    matchs: enriched,
    stats,
  };
};