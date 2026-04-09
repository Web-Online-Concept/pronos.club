// src/app/api/livescore/route.ts
import { NextResponse } from "next/server";
import { SPORTS_CONFIG, buildScoreboardUrl } from "@/lib/livescore-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ESPNCompetitor {
  team?: { displayName?: string; abbreviation?: string; logo?: string; shortDisplayName?: string };
  score?: string;
  winner?: boolean;
  homeAway?: string;
}

interface ESPNStatus {
  type?: { id?: string; name?: string; state?: string; completed?: boolean; description?: string; shortDetail?: string; detail?: string };
  clock?: number;
  displayClock?: string;
  period?: number;
}

interface ESPNCompetitor {
  team?: { displayName?: string; abbreviation?: string; logo?: string; shortDisplayName?: string };
  athlete?: { displayName?: string; shortName?: string; flag?: { href?: string } };
  score?: string;
  winner?: boolean;
  homeAway?: string;
  linescores?: { displayValue?: string; value?: number; winner?: boolean }[];
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
  status: "scheduled" | "live" | "finished" | "postponed" | "other";
  statusText: string;
  clock: string;
  startTime: string;
}

export interface LiveLeague {
  slug: string;
  name: string;
  flag?: string;
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
  const { status, statusText, clock } = parseStatus(comp.status);

  // Tennis/individual sports use athlete instead of team
  const homeName = home.team?.displayName ?? home.team?.shortDisplayName ?? home.athlete?.displayName ?? "?";
  const homeAbbr = home.team?.abbreviation ?? home.athlete?.shortName ?? "";
  const homeLogo = home.team?.logo ?? home.athlete?.flag?.href ?? "";
  const awayName = away.team?.displayName ?? away.team?.shortDisplayName ?? away.athlete?.displayName ?? "?";
  const awayAbbr = away.team?.abbreviation ?? away.athlete?.shortName ?? "";
  const awayLogo = away.team?.logo ?? away.athlete?.flag?.href ?? "";

  // Tennis linescores (sets) — ESPN uses value (number) for tennis, displayValue for football
  const homeLinescores = home.linescores?.map((l) => l.displayValue ?? (l.value !== undefined ? String(Math.round(l.value)) : "")).filter(Boolean) ?? [];
  const awayLinescores = away.linescores?.map((l) => l.displayValue ?? (l.value !== undefined ? String(Math.round(l.value)) : "")).filter(Boolean) ?? [];
  
  // For tennis: show set scores as "6-4 6-3" style
  const isIndividualSport = !home.team?.displayName && home.athlete?.displayName;
  let tennisScore = "";
  if (isIndividualSport && homeLinescores.length > 0) {
    tennisScore = homeLinescores.map((h, i) => `${h}-${awayLinescores[i] ?? "?"}`).join(" ");
  }

  // Score: for tennis use winner marker, for team sports use score field
  const homeScore = home.score ?? (isIndividualSport && home.winner ? "W" : "");
  const awayScore = away.score ?? (isIndividualSport && away.winner ? "W" : "");

  return {
    id: comp.id ?? fallbackId ?? "",
    homeTeam: homeName,
    homeAbbr,
    homeLogo,
    homeScore: homeScore || "-",
    awayTeam: awayName,
    awayAbbr,
    awayLogo,
    awayScore: awayScore || "-",
    status,
    statusText: tennisScore || statusText,
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
function parseTournamentEvent(event: ESPNEvent): LiveMatch[] {
  const matches: LiveMatch[] = [];
  const groupings = event.groupings ?? [];
  for (const g of groupings) {
    for (const comp of g.competitions ?? []) {
      const match = parseCompetition(comp, comp.id);
      if (match) matches.push(match);
    }
  }
  // Fallback: also check direct competitions
  if (event.competitions) {
    for (const comp of event.competitions) {
      const match = parseCompetition(comp, event.id);
      if (match && !matches.find((m) => m.id === match.id)) {
        matches.push(match);
      }
    }
  }
  return matches;
}

async function fetchLeagueDates(espnSport: string, league: { slug: string; name: string; flag?: string }, dates: string[]): Promise<LiveLeague | null> {
  try {
    // Fetch all dates in parallel
    const allEvents: ESPNEvent[] = [];
    const seenIds = new Set<string>();

    await Promise.all(
      dates.map(async (date) => {
        try {
          const url = buildScoreboardUrl(espnSport, league.slug, date);
          const res = await fetch(url, { next: { revalidate: 30 }, headers: { "User-Agent": "Mozilla/5.0" } });
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
      matches = allEvents.flatMap(parseTournamentEvent);
    } else {
      matches = allEvents.map(parseEvent).filter((m): m is LiveMatch => m !== null);
    }

    if (!matches.length) return null;

    // For tournament sports, use the tournament name as league name
    const leagueName = isTournamentSport && allEvents[0]?.name
      ? allEvents[0].name
      : league.name;

    return {
      slug: league.slug,
      name: leagueName,
      flag: league.flag,
      matches,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport"); // filter by sport key, or "all"
  const date = searchParams.get("date") ?? undefined; // YYYYMMDD — date locale du client
  const tz = searchParams.get("tz") ?? "Europe/Paris"; // timezone du client

  // Calculer les dates à fetcher
  // "all" sports = juste la date demandée (sinon trop de requêtes parallèles)
  // Sport spécifique = veille + jour + lendemain pour couvrir les décalages timezone
  const isAllSports = !sport || sport === "all";
  let datesToFetch: string[] = [];
  if (date && date.length === 8) {
    const y = parseInt(date.slice(0, 4));
    const m = parseInt(date.slice(4, 6)) - 1;
    const d = parseInt(date.slice(6, 8));
    const base = new Date(y, m, d);
    
    if (isAllSports) {
      // Just the requested date + next day to cover late night matches
      for (const offset of [0, 1]) {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + offset);
        const ds = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
        datesToFetch.push(ds);
      }
    } else {
      // Full range for specific sport
      for (const offset of [-1, 0, 1]) {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + offset);
        const ds = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
        datesToFetch.push(ds);
      }
    }
  }

  const targetSports = sport && sport !== "all"
    ? SPORTS_CONFIG.filter((s) => s.key === sport)
    : SPORTS_CONFIG;

  const results: LiveSport[] = [];

  // Fetch sports sequentially to avoid rate-limiting, leagues in parallel per sport
  for (const sportConfig of targetSports) {
    if (sportConfig.leagues.length === 0) continue;

    const leagueResults = await Promise.all(
      sportConfig.leagues.map((league) =>
        datesToFetch.length > 0
          ? fetchLeagueDates(sportConfig.espnSport, league, datesToFetch)
          : fetchLeagueDates(sportConfig.espnSport, league, [])
      )
    );

      const validLeagues = leagueResults
        .filter((l): l is LiveLeague => l !== null)
        .map((league) => {
          // Filter matches to only those that fall on the requested date in the client's timezone
          if (date && date.length === 8) {
            const requestedDate = date; // YYYYMMDD
            league.matches = league.matches.filter((match) => {
              if (!match.startTime) return true; // keep matches without startTime
              try {
                const matchDate = new Date(match.startTime);
                // Format match date in client timezone
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
                const matchLocalDate = `${yy}${mm}${dd}`;
                return matchLocalDate === requestedDate;
              } catch {
                return true;
              }
            });
          }
          return league;
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