/**
 * Live Scores utility for PRONOS.CLUB
 * Uses API-Sports (api-sports.io) — covers 12+ sports, 1200+ football leagues
 * 
 * If no match is found, returns null — the PickCard displays normally.
 */

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export interface LiveScoreResult {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchStatus: "scheduled" | "live" | "halftime" | "final" | "postponed" | "extra_time" | "penalties";
  minute?: string;
  fixtureId?: number;
}

// ═══════════════════════════════════════════════
// API-SPORTS ENDPOINTS PER SPORT
// ═══════════════════════════════════════════════

export const SPORT_API_MAP: Record<string, string> = {
  "football": "https://v3.football.api-sports.io",
  "basketball": "https://v1.basketball.api-sports.io",
  "hockey": "https://v1.hockey.api-sports.io",
  "baseball": "https://v1.baseball.api-sports.io",
  "handball": "https://v1.handball.api-sports.io",
  "volleyball": "https://v1.volleyball.api-sports.io",
  "rugby": "https://v1.rugby.api-sports.io",
  "mma": "https://v1.mma.api-sports.io",
  "football-americain": "https://v1.american-football.api-sports.io",
  "formule-1": "https://v1.formula-1.api-sports.io",
};

// ═══════════════════════════════════════════════
// FUZZY TEAM MATCHING
// ═══════════════════════════════════════════════

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTeams(eventName: string): string[] {
  const separators = [" - ", " vs ", " v ", " – ", " — ", " contre "];
  for (const sep of separators) {
    if (eventName.toLowerCase().includes(sep.toLowerCase())) {
      return eventName.split(new RegExp(sep, "i")).map(normalize).filter(Boolean);
    }
  }
  return [normalize(eventName)];
}

export function teamsMatch(apiTeam: string, pickTeam: string): boolean {
  const a = normalize(apiTeam);
  const b = normalize(pickTeam);

  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const apiWords = a.split(" ").filter(w => w.length >= 3);
  const pickWords = b.split(" ").filter(w => w.length >= 3);

  if (pickWords.length === 0) return false;

  let matches = 0;
  for (const pw of pickWords) {
    if (apiWords.some(aw => {
      if (aw === pw) return true;
      if (aw.startsWith(pw) || pw.startsWith(aw)) return true;
      // Language variant: compare first 4+ chars (parme/parma, lyon/lyonnais, etc.)
      if (pw.length >= 4 && aw.length >= 4 && pw.slice(0, 4) === aw.slice(0, 4)) return true;
      return false;
    })) {
      matches++;
    }
  }

  return matches >= Math.max(1, Math.ceil(pickWords.length * 0.5));
}

// ═══════════════════════════════════════════════
// SERVER-SIDE CACHE (60s TTL)
// ═══════════════════════════════════════════════

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

const scoreCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000;

export function getCached(key: string): unknown | null {
  const entry = scoreCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    scoreCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key: string, data: unknown): void {
  scoreCache.set(key, { data, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════
// PARSE API-SPORTS RESPONSES
// ═══════════════════════════════════════════════

export interface ParsedGame {
  fixtureId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: LiveScoreResult["matchStatus"];
  minute: string | undefined;
  startTime: string;
}

export function parseFootballFixtures(data: Record<string, unknown>): ParsedGame[] {
  const response = (data.response || []) as Array<Record<string, unknown>>;
  const games: ParsedGame[] = [];

  for (const item of response) {
    const fixture = (item.fixture || {}) as Record<string, unknown>;
    const teams = (item.teams || {}) as Record<string, unknown>;
    const goals = (item.goals || {}) as Record<string, unknown>;

    const home = (teams.home || {}) as Record<string, unknown>;
    const away = (teams.away || {}) as Record<string, unknown>;
    const statusObj = (fixture.status || {}) as Record<string, unknown>;

    const statusShort = String(statusObj.short || "NS");
    let gameStatus: LiveScoreResult["matchStatus"] = "scheduled";

    if (["1H", "2H", "ET"].includes(statusShort)) gameStatus = "live";
    else if (statusShort === "HT") gameStatus = "halftime";
    else if (statusShort === "P") gameStatus = "penalties";
    else if (statusShort === "AET") gameStatus = "extra_time";
    else if (["FT", "AET", "PEN"].includes(statusShort)) gameStatus = "final";
    else if (["PST", "CANC", "ABD", "AWD", "WO"].includes(statusShort)) gameStatus = "postponed";

    const elapsed = statusObj.elapsed;
    const minute = elapsed != null ? `${elapsed}'` : undefined;

    games.push({
      fixtureId: Number(fixture.id || 0),
      homeTeam: String(home.name || ""),
      awayTeam: String(away.name || ""),
      homeScore: Number(goals.home ?? 0),
      awayScore: Number(goals.away ?? 0),
      status: gameStatus,
      minute,
      startTime: String(fixture.date || ""),
    });
  }

  return games;
}

export function parseGenericFixtures(data: Record<string, unknown>): ParsedGame[] {
  const response = (data.response || []) as Array<Record<string, unknown>>;
  const games: ParsedGame[] = [];

  for (const item of response) {
    const teams = (item.teams || {}) as Record<string, unknown>;
    const scores = (item.scores || {}) as Record<string, unknown>;

    const home = (teams.home || {}) as Record<string, unknown>;
    const away = (teams.away || {}) as Record<string, unknown>;
    const homeScores = (scores.home || {}) as Record<string, unknown>;
    const awayScores = (scores.away || {}) as Record<string, unknown>;

    const statusObj = (item.status || item.game || {}) as Record<string, unknown>;
    const statusShort = String(statusObj.short || statusObj.status || "NS");

    let gameStatus: LiveScoreResult["matchStatus"] = "scheduled";
    if (["Q1", "Q2", "Q3", "Q4", "OT", "BT", "P1", "P2", "P3", "1H", "2H", "ET"].includes(statusShort)) gameStatus = "live";
    else if (statusShort === "HT") gameStatus = "halftime";
    else if (["FT", "AOT", "AP", "POST"].includes(statusShort)) gameStatus = "final";
    else if (["PST", "CANC"].includes(statusShort)) gameStatus = "postponed";

    const homeTotal = Number(homeScores.total ?? home.score ?? home.goals ?? 0);
    const awayTotal = Number(awayScores.total ?? away.score ?? away.goals ?? 0);

    const timer = statusObj.timer || statusObj.elapsed || statusObj.clock;
    const minute = timer != null ? `${timer}'` : undefined;

    const gameObj = (item.game || item.fixture || {}) as Record<string, unknown>;
    const gameId = Number(gameObj.id || item.id || 0);

    games.push({
      fixtureId: gameId,
      homeTeam: String(home.name || ""),
      awayTeam: String(away.name || ""),
      homeScore: homeTotal,
      awayScore: awayTotal,
      status: gameStatus,
      minute,
      startTime: String(item.date || gameObj.date || ""),
    });
  }

  return games;
}

/**
 * Parse tennis games from API-Sports Tennis
 * Tennis uses "players" instead of "teams" and "sets" for scoring
 */
export function parseTennisFixtures(data: Record<string, unknown>): ParsedGame[] {
  const response = (data.response || []) as Array<Record<string, unknown>>;
  const games: ParsedGame[] = [];

  for (const item of response) {
    const game = (item.game || {}) as Record<string, unknown>;
    const players = (item.players || {}) as Record<string, unknown>;
    const scores = (item.scores || {}) as Record<string, unknown>;

    const home = (players.home || {}) as Record<string, unknown>;
    const away = (players.away || {}) as Record<string, unknown>;

    const statusObj = (game.status || {}) as Record<string, unknown>;
    const statusShort = String(statusObj.short || "NS");

    let gameStatus: LiveScoreResult["matchStatus"] = "scheduled";
    if (["S1", "S2", "S3", "S4", "S5"].includes(statusShort)) gameStatus = "live";
    else if (statusShort === "LIVE" || statusShort === "IP") gameStatus = "live";
    else if (statusShort === "FT" || statusShort === "AO") gameStatus = "final";
    else if (["PST", "CANC", "ABD", "WO"].includes(statusShort)) gameStatus = "postponed";

    // Tennis: count sets won
    const homeScoreObj = (scores.home || {}) as Record<string, unknown>;
    const awayScoreObj = (scores.away || {}) as Record<string, unknown>;
    
    // Count total sets won by each player
    let homeSets = 0;
    let awaySets = 0;
    for (const key of ["set1", "set2", "set3", "set4", "set5"]) {
      const hVal = Number((homeScoreObj as Record<string, unknown>)[key] ?? 0);
      const aVal = Number((awayScoreObj as Record<string, unknown>)[key] ?? 0);
      if (hVal > 0 || aVal > 0) {
        if (hVal > aVal) homeSets++;
        else if (aVal > hVal) awaySets++;
      }
    }

    // Build minute/status string for tennis
    let minute: string | undefined;
    if (gameStatus === "live") {
      const currentSet = statusShort.startsWith("S") ? `Set ${statusShort[1]}` : "En cours";
      minute = currentSet;
    }

    const gameId = Number(game.id || 0);

    games.push({
      fixtureId: gameId,
      homeTeam: String(home.name || ""),
      awayTeam: String(away.name || ""),
      homeScore: homeSets,
      awayScore: awaySets,
      status: gameStatus,
      minute,
      startTime: String(game.date || item.date || ""),
    });
  }

  return games;
}