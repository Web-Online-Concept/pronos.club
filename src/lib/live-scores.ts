/**
 * Live Scores utility for PRONOS.CLUB
 * Uses ESPN hidden API — FREE, no key, no rate limit, all sports
 * 
 * URL: https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
 * If no match is found, returns null — PickCard displays normally.
 */

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export interface SetScore {
  home: number;
  away: number;
  homeTiebreak?: number;
  awayTiebreak?: number;
}

export interface LiveScoreResult {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  matchStatus: "scheduled" | "live" | "halftime" | "final" | "postponed";
  minute?: string;
  fixtureId?: string;
  isTennis?: boolean;
  sets?: SetScore[];
}

// ═══════════════════════════════════════════════
// ESPN LEAGUE SLUGS
// ═══════════════════════════════════════════════

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// Competition name (from Jérôme) → ESPN sport/league slug
const COMPETITION_TO_ESPN: Record<string, string[]> = {
  // Football — by country/competition name
  "premier league": ["soccer/eng.1"],
  "epl": ["soccer/eng.1"],
  "angleterre": ["soccer/eng.1"],
  "england": ["soccer/eng.1"],
  "la liga": ["soccer/esp.1"],
  "liga": ["soccer/esp.1"],
  "espagne": ["soccer/esp.1"],
  "serie a": ["soccer/ita.1"],
  "italie": ["soccer/ita.1"],
  "bundesliga": ["soccer/ger.1"],
  "allemagne": ["soccer/ger.1"],
  "ligue 1": ["soccer/fra.1"],
  "france": ["soccer/fra.1"],
  "ligue 2": ["soccer/fra.2"],
  "champions league": ["soccer/uefa.champions"],
  "ldc": ["soccer/uefa.champions"],
  "europa league": ["soccer/uefa.europa"],
  "conference league": ["soccer/uefa.europa.conf"],
  "mls": ["soccer/usa.1"],
  "belgique": ["soccer/bel.1"],
  "belgium": ["soccer/bel.1"],
  "pays-bas": ["soccer/ned.1"],
  "eredivisie": ["soccer/ned.1"],
  "portugal": ["soccer/por.1"],
  "liga portugal": ["soccer/por.1"],
  "turquie": ["soccer/tur.1"],
  "ecosse": ["soccer/sco.1"],
  "coree": ["soccer/kor.1"],
  "k league": ["soccer/kor.1"],
  "suede": ["soccer/swe.1"],
  "norvege": ["soccer/nor.1"],
  "danemark": ["soccer/den.1"],
  "autriche": ["soccer/aut.1"],
  "suisse": ["soccer/sui.1"],
  "grece": ["soccer/gre.1"],
  "pologne": ["soccer/pol.1"],
  "croatie": ["soccer/cro.1"],
  "serbie": ["soccer/srb.1"],
  "roumanie": ["soccer/rou.1"],
  "tcheque": ["soccer/cze.1"],
  "bresil": ["soccer/bra.1"],
  "argentine": ["soccer/arg.1"],
  "mexique": ["soccer/mex.1"],
  "japon": ["soccer/jpn.1"],
  "j league": ["soccer/jpn.1"],
  "australie": ["soccer/aus.1"],
  "chine": ["soccer/chn.1"],
  "arabie saoudite": ["soccer/ksa.1"],
  "copa libertadores": ["soccer/conmebol.libertadores"],
  // Tennis
  "atp": ["tennis/atp"],
  "atp marrakech": ["tennis/atp"],
  "atp bucarest": ["tennis/atp"],
  "atp monte carlo": ["tennis/atp"],
  "atp houston": ["tennis/atp"],
  "wta": ["tennis/wta"],
  // US sports
  "nba": ["basketball/nba"],
  "nhl": ["hockey/nhl"],
  "mlb": ["baseball/mlb"],
  "nfl": ["football/nfl"],
  // MMA
  "ufc": ["mma/ufc"],
};

// Sport slug (from Supabase) → default ESPN slugs to try
const SPORT_TO_ESPN: Record<string, string[]> = {
  "football": [
    "soccer/eng.1", "soccer/esp.1", "soccer/ita.1", "soccer/ger.1",
    "soccer/fra.1", "soccer/uefa.champions", "soccer/bel.1", "soccer/ned.1",
    "soccer/por.1", "soccer/tur.1", "soccer/usa.1",
  ],
  "tennis": ["tennis/atp", "tennis/wta"],
  "basketball": ["basketball/nba"],
  "hockey": ["hockey/nhl"],
  "baseball": ["baseball/mlb"],
  "football-americain": ["football/nfl"],
  "mma": ["mma/ufc"],
  "rugby": ["rugby/super-rugby"],
  "handball": [],
  "volleyball": [],
};

/**
 * Get ESPN league slugs to search based on competition + sport.
 */
export function getEspnSlugs(sportSlug: string, competition: string | null): string[] {
  if (competition) {
    const normalized = competition.toLowerCase().trim();
    if (COMPETITION_TO_ESPN[normalized]) return COMPETITION_TO_ESPN[normalized];
    for (const [key, slugs] of Object.entries(COMPETITION_TO_ESPN)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return slugs;
      }
    }
  }
  return SPORT_TO_ESPN[sportSlug] || [];
}

// ═══════════════════════════════════════════════
// FUZZY TEAM / PLAYER MATCHING
// ═══════════════════════════════════════════════

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTeams(eventName: string): string[] {
  const sepRegex = /\s*[-–—]\s*|\s+vs\.?\s+|\s+v\s+|\s+contre\s+/i;
  const parts = eventName.split(sepRegex).map(normalize).filter(Boolean);
  if (parts.length >= 2) return parts;
  return [normalize(eventName)];
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function wordsMatch(apiWord: string, pickWord: string): boolean {
  if (apiWord === pickWord) return true;
  if (apiWord.startsWith(pickWord) || pickWord.startsWith(apiWord)) return true;
  const maxDist = pickWord.length >= 8 ? 2 : pickWord.length >= 5 ? 1 : 0;
  if (maxDist > 0 && levenshtein(apiWord, pickWord) <= maxDist) return true;
  if (pickWord.length >= 4 && apiWord.length >= 4 && pickWord.slice(0, 4) === apiWord.slice(0, 4)) {
    if (Math.abs(apiWord.length - pickWord.length) <= 3) return true;
  }
  return false;
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
    if (apiWords.some(aw => wordsMatch(aw, pw))) {
      matches++;
    }
  }

  return matches >= 1;
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
// PARSE ESPN RESPONSE
// ═══════════════════════════════════════════════

export interface ParsedGame {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: LiveScoreResult["matchStatus"];
  minute: string | undefined;
  startTime: string;
  isTennis: boolean;
  sets?: SetScore[];
}

export function parseEspnScoreboard(data: Record<string, unknown>): ParsedGame[] {
  const events = (data.events || []) as Array<Record<string, unknown>>;
  const games: ParsedGame[] = [];

  for (const event of events) {
    const allCompetitions: Array<Record<string, unknown>> = [];

    const directComps = (event.competitions || []) as Array<Record<string, unknown>>;
    allCompetitions.push(...directComps);

    const groupings = (event.groupings || []) as Array<Record<string, unknown>>;
    for (const grouping of groupings) {
      const grpInfo = (grouping.grouping || {}) as Record<string, unknown>;
      const slug = String(grpInfo.slug || "");
      if (slug && slug.includes("doubles")) continue;
      const grpComps = (grouping.competitions || []) as Array<Record<string, unknown>>;
      allCompetitions.push(...grpComps);
    }

    for (const comp of allCompetitions) {
      const competitors = (comp.competitors || []) as Array<Record<string, unknown>>;
      if (competitors.length < 2) continue;

      const statusObj = (comp.status || event.status || {}) as Record<string, unknown>;
      const statusType = (statusObj.type || {}) as Record<string, unknown>;
      const state = String(statusType.state || "pre");
      const description = String(statusType.description || statusType.detail || "");

      let gameStatus: LiveScoreResult["matchStatus"] = "scheduled";
      if (state === "in") {
        gameStatus = description.toLowerCase().includes("halftime") ? "halftime" : "live";
      } else if (state === "post") {
        gameStatus = "final";
      } else if (state === "pre") {
        gameStatus = "scheduled";
      }

      const statusName = String(statusType.name || "").toLowerCase();
      if (statusName.includes("postponed") || statusName.includes("canceled")) {
        gameStatus = "postponed";
      }
      if (statusName.includes("retired") || statusName.includes("walkover")) {
        gameStatus = "final";
      }

      const home = competitors.find(c => c.homeAway === "home") || competitors[0];
      const away = competitors.find(c => c.homeAway === "away") || competitors[1];

      const homeTeamObj = (home.team || home.athlete || {}) as Record<string, unknown>;
      const awayTeamObj = (away.team || away.athlete || {}) as Record<string, unknown>;

      const homeName = String(homeTeamObj.displayName || homeTeamObj.shortDisplayName || homeTeamObj.name || "");
      const awayName = String(awayTeamObj.displayName || awayTeamObj.shortDisplayName || awayTeamObj.name || "");

      if (homeName === "TBD" || awayName === "TBD") continue;

      const homeLinescores = (home.linescores || []) as Array<Record<string, unknown>>;
      const awayLinescores = (away.linescores || []) as Array<Record<string, unknown>>;
      const isTennis = homeLinescores.length > 0 && !!home.athlete;

      let homeScore: number;
      let awayScore: number;
      let sets: SetScore[] | undefined;

      if (isTennis) {
        homeScore = homeLinescores.filter(s => s.winner === true).length;
        awayScore = awayLinescores.filter(s => s.winner === true).length;

        sets = homeLinescores.map((hs, i) => {
          const as = awayLinescores[i];
          const setScore: SetScore = {
            home: Number(hs.value || 0),
            away: Number(as?.value || 0),
          };
          if (hs.tiebreak !== undefined) setScore.homeTiebreak = Number(hs.tiebreak);
          if (as?.tiebreak !== undefined) setScore.awayTiebreak = Number(as.tiebreak);
          return setScore;
        });
      } else {
        homeScore = Number(home.score || 0);
        awayScore = Number(away.score || 0);
      }

      let minute: string | undefined;
      if (state === "in" && !isTennis) {
        const displayClock = statusObj.displayClock as string | undefined;
        if (displayClock && displayClock !== "0:00") {
          minute = displayClock;
        } else if (description) {
          minute = description;
        }
      } else if (state === "in" && isTennis) {
        minute = description;
      }

      games.push({
        fixtureId: String(comp.id || event.id || ""),
        homeTeam: homeName,
        awayTeam: awayName,
        homeScore,
        awayScore,
        status: gameStatus,
        minute,
        startTime: String(comp.date || event.date || ""),
        isTennis,
        sets,
      });
    }
  }

  return games;
}