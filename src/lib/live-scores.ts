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
  "coree 2": ["soccer/kor.2"],
  "coree": ["soccer/kor.1"],
  "k league": ["soccer/kor.1"],
  "finlande": ["soccer/fin.1"],
  "suede": ["soccer/swe.1"],
  "norvege": ["soccer/nor.1"],
  "danemark": ["soccer/den.1"],
  "autriche": ["soccer/aut.1"],
  "suisse": ["soccer/sui.1"],
  "grece": ["soccer/gre.1"],
  "pologne": ["soccer/pol.1"],
  "russie": ["soccer/rus.1"],
  "ukraine": ["soccer/ukr.1"],
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
  // Try competition first (most precise)
  if (competition) {
    const normalized = competition.toLowerCase().trim();

    // Exact match
    if (COMPETITION_TO_ESPN[normalized]) return COMPETITION_TO_ESPN[normalized];

    // Partial match
    for (const [key, slugs] of Object.entries(COMPETITION_TO_ESPN)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return slugs;
      }
    }
  }

  // Fall back to sport slug
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
      // Language variants: compare first 4+ chars (parme/parma, etc.)
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
    // Collect all competitions from the event
    // Football: event.competitions[] (flat)
    // Tennis: event.groupings[].competitions[] (nested under groupings)
    const allCompetitions: Array<Record<string, unknown>> = [];

    // Direct competitions (football, basketball, etc.)
    const directComps = (event.competitions || []) as Array<Record<string, unknown>>;
    allCompetitions.push(...directComps);

    // Grouped competitions (tennis: groupings → competitions)
    const groupings = (event.groupings || []) as Array<Record<string, unknown>>;
    for (const grouping of groupings) {
      // Only take Men's Singles (skip doubles)
      const grpInfo = (grouping.grouping || {}) as Record<string, unknown>;
      const slug = String(grpInfo.slug || "");
      if (slug && slug.includes("doubles")) continue;

      const grpComps = (grouping.competitions || []) as Array<Record<string, unknown>>;
      allCompetitions.push(...grpComps);
    }

    // Parse each competition
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

      // Check for postponed / retired / walkover
      const statusName = String(statusType.name || "").toLowerCase();
      if (statusName.includes("postponed") || statusName.includes("canceled")) {
        gameStatus = "postponed";
      }
      // Tennis: retired and walkover count as final
      if (statusName.includes("retired") || statusName.includes("walkover")) {
        gameStatus = "final";
      }

      // Find home and away
      const home = competitors.find(c => c.homeAway === "home") || competitors[0];
      const away = competitors.find(c => c.homeAway === "away") || competitors[1];

      // Football: competitor.team.displayName
      // Tennis singles: competitor.athlete.displayName
      // Tennis doubles: competitor.roster.displayName (skip these via grouping filter above)
      const homeTeamObj = (home.team || home.athlete || {}) as Record<string, unknown>;
      const awayTeamObj = (away.team || away.athlete || {}) as Record<string, unknown>;

      const homeName = String(homeTeamObj.displayName || homeTeamObj.shortDisplayName || homeTeamObj.name || "");
      const awayName = String(awayTeamObj.displayName || awayTeamObj.shortDisplayName || awayTeamObj.name || "");

      // Skip TBD matches
      if (homeName === "TBD" || awayName === "TBD") continue;

      // Detect tennis by presence of linescores (set-by-set) and athlete (not team)
      const homeLinescores = (home.linescores || []) as Array<Record<string, unknown>>;
      const awayLinescores = (away.linescores || []) as Array<Record<string, unknown>>;
      const isTennis = homeLinescores.length > 0 && !!home.athlete;

      let homeScore: number;
      let awayScore: number;
      let sets: SetScore[] | undefined;

      if (isTennis) {
        // Tennis: count sets won
        homeScore = homeLinescores.filter(s => s.winner === true).length;
        awayScore = awayLinescores.filter(s => s.winner === true).length;

        // Build detailed set scores
        sets = homeLinescores.map((hs, i) => {
          const as = awayLinescores[i];
          const setScore: SetScore = {
            home: Number(hs.value || 0),
            away: Number(as?.value || 0),
          };
          // Tiebreak scores
          if (hs.tiebreak !== undefined) setScore.homeTiebreak = Number(hs.tiebreak);
          if (as?.tiebreak !== undefined) setScore.awayTiebreak = Number(as.tiebreak);
          return setScore;
        });
      } else {
        // Football/basketball: simple score
        homeScore = Number(home.score || 0);
        awayScore = Number(away.score || 0);
      }

      // Minute / clock
      let minute: string | undefined;
      if (state === "in" && !isTennis) {
        const displayClock = statusObj.displayClock as string | undefined;
        if (displayClock && displayClock !== "0:00") {
          minute = displayClock;
        } else if (description) {
          minute = description;
        }
      } else if (state === "in" && isTennis) {
        minute = description; // "1st Set", "2nd Set", etc.
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