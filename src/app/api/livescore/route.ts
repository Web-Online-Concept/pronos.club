// src/app/api/livescore/route.ts
import { NextResponse } from "next/server";
import { SPORTS_CONFIG, buildScoreboardUrl } from "@/lib/livescore-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60; // Fluid Compute : jusqu'à 60s sur plan Hobby

interface ESPNCompetitor {
  team?: { displayName?: string; abbreviation?: string; logo?: string; shortDisplayName?: string };
  athlete?: { displayName?: string; shortName?: string; flag?: { href?: string } };
  score?: string;
  winner?: boolean;
  homeAway?: string;
  linescores?: { displayValue?: string; value?: number; winner?: boolean }[];
}

interface ESPNStatus {
  type?: { id?: string; name?: string; state?: string; completed?: boolean; description?: string; shortDetail?: string; detail?: string };
  clock?: number;
  displayClock?: string;
  period?: number;
}


interface ESPNCompetition {
  id?: string;
  competitors?: ESPNCompetitor[];
  status?: ESPNStatus;
  startDate?: string;
  date?: string;
  round?: { displayName?: string };
}

interface ESPNGrouping {
  grouping?: { name?: string };
  competitions?: ESPNCompetition[];
}

interface ESPNEvent {
  id?: string;
  name?: string;
  shortName?: string;
  competitions?: ESPNCompetition[];
  groupings?: ESPNGrouping[];
}

interface ESPNLeagueInfo {
  name?: string;
  abbreviation?: string;
  slug?: string;
}

interface ESPNResponse {
  leagues?: ESPNLeagueInfo[];
  events?: ESPNEvent[];
}

export interface LiveMatch {
  id: string;
  homeTeam: string;
  homeAbbr: string;
  homeLogo: string;
  homeScore: string;
  awayTeam: string;
  awayAbbr: string;
  awayLogo: string;
  awayScore: string;
  homeWinner?: boolean;
  awayWinner?: boolean;
  status: "scheduled" | "live" | "finished" | "postponed" | "other";
  statusText: string;
  clock: string;
  startTime: string;
}

export interface LiveLeague {
  slug: string;
  name: string;
  flag?: string;
  country?: string;
  matches: LiveMatch[];
}

export interface LiveSport {
  key: string;
  name: string;
  icon: string;
  leagues: LiveLeague[];
  totalMatches: number;
  liveMatches: number;
}

function parseStatus(status?: ESPNStatus): { status: LiveMatch["status"]; statusText: string; clock: string } {
  if (!status?.type) return { status: "other", statusText: "", clock: "" };
  
  const state = status.type.state ?? "";
  const detail = status.type.shortDetail ?? status.type.detail ?? status.type.description ?? "";
  
  if (state === "pre") {
    return { status: "scheduled", statusText: detail, clock: "" };
  }
  if (state === "in") {
    const clock = status.displayClock ?? "";
    return { status: "live", statusText: detail, clock };
  }
  if (state === "post") {
    return { status: "finished", statusText: detail, clock: "" };
  }
  if (status.type.name === "STATUS_POSTPONED" || status.type.name === "STATUS_CANCELED") {
    return { status: "postponed", statusText: detail, clock: "" };
  }
  return { status: "other", statusText: detail, clock: "" };
}

function parseCompetition(comp: ESPNCompetition, fallbackId?: string): LiveMatch | null {
  if (!comp?.competitors || comp.competitors.length < 2) return null;

  const home = comp.competitors.find((c) => c.homeAway === "home") ?? comp.competitors[0];
  const away = comp.competitors.find((c) => c.homeAway === "away") ?? comp.competitors[1];

  // Tennis/individual sports use athlete instead of team
  const homeName = home.team?.displayName ?? home.team?.shortDisplayName ?? home.athlete?.displayName ?? "?";
  const awayName = away.team?.displayName ?? away.team?.shortDisplayName ?? away.athlete?.displayName ?? "?";

  // Skip matches with no real team/player names (TBD, ?, empty)
  const invalidNames = ["?", "TBD", "TBA", ""];
  if (invalidNames.includes(homeName) || invalidNames.includes(awayName)) return null;

  const { status, statusText, clock } = parseStatus(comp.status);
  const homeAbbr = home.team?.abbreviation ?? home.athlete?.shortName ?? "";
  const homeLogo = home.team?.logo ?? home.athlete?.flag?.href ?? "";
  const awayAbbr = away.team?.abbreviation ?? away.athlete?.shortName ?? "";
  const awayLogo = away.team?.logo ?? away.athlete?.flag?.href ?? "";

  // Tennis linescores (sets) — ESPN uses value (number), displayValue is empty for tennis
  const homeLinescores = home.linescores?.map((l) => l.displayValue || (l.value !== undefined ? String(Math.round(l.value)) : "")).filter(Boolean) ?? [];
  const awayLinescores = away.linescores?.map((l) => l.displayValue || (l.value !== undefined ? String(Math.round(l.value)) : "")).filter(Boolean) ?? [];
  
  const isIndividualSport = !home.team?.displayName && !!home.athlete?.displayName;

  // Build scores
  let homeScore: string;
  let awayScore: string;
  let displayStatusText = statusText;

  if (isIndividualSport) {
    // Tennis: show set scores in the score columns, e.g. "6 4 6" and "4 6 3"
    if (homeLinescores.length > 0) {
      homeScore = homeLinescores.join(" ");
      awayScore = awayLinescores.join(" ");
      // Also build "6-4 6-3" format for statusText
      displayStatusText = homeLinescores.map((h, i) => `${h}-${awayLinescores[i] ?? "?"}`).join("  ");
    } else {
      homeScore = home.winner ? "W" : "-";
      awayScore = away.winner ? "W" : "-";
    }
  } else {
    // Team sports: use score field directly
    homeScore = (home.score !== undefined && home.score !== null && home.score !== "") ? home.score : "-";
    awayScore = (away.score !== undefined && away.score !== null && away.score !== "") ? away.score : "-";
  }

  return {
    id: comp.id ?? fallbackId ?? "",
    homeTeam: homeName,
    homeAbbr,
    homeLogo,
    homeScore,
    awayTeam: awayName,
    awayAbbr,
    awayLogo,
    awayScore,
    homeWinner: home.winner ?? undefined,
    awayWinner: away.winner ?? undefined,
    status,
    statusText: displayStatusText,
    clock,
    startTime: comp.startDate ?? comp.date ?? "",
  };
}

function parseEvent(event: ESPNEvent): LiveMatch | null {
  const comp = event.competitions?.[0];
  if (!comp) return null;
  return parseCompetition(comp, event.id);
}

// Tennis/Golf: events contain groupings > competitions instead of direct competitions
// ESPN returns ALL tournament matches regardless of date parameter
// Strategy: filter by actual startTime date (which IS reliable, unlike startDate on the competition)
function parseTournamentEvent(event: ESPNEvent, clientDate?: string): LiveMatch[] {
  const matches: LiveMatch[] = [];
  const groupings = event.groupings ?? [];
  for (const g of groupings) {
    for (const comp of g.competitions ?? []) {
      const match = parseCompetition(comp, comp.id);
      if (match) matches.push(match);
    }
  }
  if (event.competitions) {
    for (const comp of event.competitions) {
      const match = parseCompetition(comp, event.id);
      if (match && !matches.find((m) => m.id === match.id)) {
        matches.push(match);
      }
    }
  }

  // Filter by startTime date (UTC) — startTime on individual matches IS correct
  // even though competition.startDate points to tournament start
  if (clientDate && clientDate.length === 8) {
    return matches.filter((m) => {
      if (m.status === "live") return true; // always show live
      if (!m.startTime) return false;
      try {
        const d = new Date(m.startTime);
        const matchDate = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
        return matchDate === clientDate;
      } catch {
        return false;
      }
    });
  }

  // No date filter — return live + scheduled only
  const live = matches.filter((m) => m.status === "live");
  const scheduled = matches.filter((m) => m.status === "scheduled");
  return [...live, ...scheduled];
}

async function fetchLeagueDates(espnSport: string, league: { slug: string; name: string; flag?: string; country?: string }, dates: string[], clientDate?: string): Promise<LiveLeague | null> {
  try {
    // Fetch all dates in parallel
    const allEvents: ESPNEvent[] = [];
    const seenIds = new Set<string>();

    await Promise.all(
      dates.map(async (date) => {
        try {
          const url = buildScoreboardUrl(espnSport, league.slug, date);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(url, { signal: controller.signal, next: { revalidate: 30 }, headers: { "User-Agent": "Mozilla/5.0" } });
          clearTimeout(timeout);
          if (!res.ok) return;
          const data: ESPNResponse = await res.json();
          if (data.events) {
            for (const event of data.events) {
              if (event.id && !seenIds.has(event.id)) {
                seenIds.add(event.id);
                allEvents.push(event);
              }
            }
          }
        } catch {
          // skip failed date
        }
      })
    );

    if (!allEvents.length) return null;

    // Tennis & Golf use tournament > groupings > competitions structure
    const isTournamentSport = espnSport === "tennis" || espnSport === "golf";
    let matches: LiveMatch[];

    if (isTournamentSport) {
      matches = allEvents.flatMap((e) => parseTournamentEvent(e, clientDate));
    } else {
      matches = allEvents.map(parseEvent).filter((m): m is LiveMatch => m !== null);
    }

    if (!matches.length) return null;

    // Sort: live first, then scheduled by start time, then finished
    matches.sort((a, b) => {
      const order = { live: 0, scheduled: 1, finished: 2, postponed: 3, other: 4 };
      const diff = (order[a.status] ?? 4) - (order[b.status] ?? 4);
      if (diff !== 0) return diff;
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    // For tournament sports, use the tournament name as league name
    const leagueName = isTournamentSport && allEvents[0]?.name
      ? allEvents[0].name
      : league.name;

    return {
      slug: league.slug,
      name: leagueName,
      flag: league.flag,
      country: league.country,
      matches,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport"); // filter by sport key, or "all"
  const league = searchParams.get("league"); // optional: filter by specific league slug
  const date = searchParams.get("date") ?? undefined; // YYYYMMDD — date locale du client
  const tz = searchParams.get("tz") ?? "Europe/Paris"; // timezone du client

  // Fetch ESPN dates: veille + date + lendemain pour couvrir les décalages timezone US/Europe
  // Ex: matchs NBA du 10 avril 1h Paris = 9 avril 19h US → ESPN les met au 9 avril
  let datesToFetch: string[] = [];
  if (date && date.length === 8) {
    const y = parseInt(date.slice(0, 4));
    const m = parseInt(date.slice(4, 6)) - 1;
    const d = parseInt(date.slice(6, 8));
    const base = new Date(y, m, d);
    for (const offset of [-1, 0, 1]) {
      const dt = new Date(base);
      dt.setDate(dt.getDate() + offset);
      datesToFetch.push(`${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`);
    }
  }

  const targetSports = sport && sport !== "all"
    ? SPORTS_CONFIG.filter((s) => s.key === sport)
    : SPORTS_CONFIG;

  const results: LiveSport[] = [];

  for (const sportConfig of targetSports) {
    if (sportConfig.leagues.length === 0) continue;

    // If a specific league is requested, only fetch that one
    const leaguesToFetch = league
      ? sportConfig.leagues.filter((l) => l.slug === league)
      : sportConfig.leagues;

    if (leaguesToFetch.length === 0) continue;

    const isTournament = sportConfig.espnSport === "tennis" || sportConfig.espnSport === "golf";
    // Tennis/golf: single date (ESPN returns whole tournament anyway)
    // Other sports: veille+date+lendemain to cover timezone differences
    const sportDates = isTournament && date ? [date] : datesToFetch;

    const leagueResults = await Promise.all(
      leaguesToFetch.map((lg) =>
        sportDates.length > 0
          ? fetchLeagueDates(sportConfig.espnSport, lg, sportDates, date)
          : fetchLeagueDates(sportConfig.espnSport, lg, [], date)
      )
    );

      const isTournamentSport = sportConfig.espnSport === "tennis" || sportConfig.espnSport === "golf";

      const validLeagues = leagueResults
        .filter((l): l is LiveLeague => l !== null)
        .map((leagueData) => {
          // Filter matches to only those on the requested date in the client's timezone
          // Skip for tournament sports (tennis/golf) — they already filter by date in parseTournamentEvent
          if (date && date.length === 8 && !isTournamentSport) {
            leagueData.matches = leagueData.matches.filter((match) => {
              if (!match.startTime) return true;
              try {
                const matchDate = new Date(match.startTime);
                const formatter = new Intl.DateTimeFormat("en-CA", {
                  timeZone: tz,
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                });
                const parts = formatter.formatToParts(matchDate);
                const yy = parts.find((p) => p.type === "year")?.value ?? "";
                const mm = parts.find((p) => p.type === "month")?.value ?? "";
                const dd = parts.find((p) => p.type === "day")?.value ?? "";
                return `${yy}${mm}${dd}` === date;
              } catch {
                return true;
              }
            });
          }
          return leagueData;
        })
        .filter((l) => l.matches.length > 0)
        .sort((a, b) => {
          const aPriority = sportConfig.leagues.find((l) => l.slug === a.slug)?.priority ?? 99;
          const bPriority = sportConfig.leagues.find((l) => l.slug === b.slug)?.priority ?? 99;
          return aPriority - bPriority;
        });

      const totalMatches = validLeagues.reduce((sum, l) => sum + l.matches.length, 0);
      const liveMatches = validLeagues.reduce((sum, l) => sum + l.matches.filter((m) => m.status === "live").length, 0);

      if (validLeagues.length > 0) {
        results.push({
          key: sportConfig.key,
          name: sportConfig.name,
          icon: sportConfig.icon,
          leagues: validLeagues,
          totalMatches,
          liveMatches,
        });
      }
  }

  // Sort: sports with live matches first, then by config order
  results.sort((a, b) => {
    if (a.liveMatches > 0 && b.liveMatches === 0) return -1;
    if (a.liveMatches === 0 && b.liveMatches > 0) return 1;
    const aIdx = SPORTS_CONFIG.findIndex((s) => s.key === a.key);
    const bIdx = SPORTS_CONFIG.findIndex((s) => s.key === b.key);
    return aIdx - bIdx;
  });

  return NextResponse.json({ sports: results, fetchedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}