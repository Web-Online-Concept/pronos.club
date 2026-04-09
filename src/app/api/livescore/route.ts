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

interface ESPNCompetition {
  competitors?: ESPNCompetitor[];
  status?: ESPNStatus;
  startDate?: string;
}

interface ESPNEvent {
  id?: string;
  name?: string;
  shortName?: string;
  competitions?: ESPNCompetition[];
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

function parseEvent(event: ESPNEvent): LiveMatch | null {
  const comp = event.competitions?.[0];
  if (!comp?.competitors || comp.competitors.length < 2) return null;

  const home = comp.competitors.find((c) => c.homeAway === "home") ?? comp.competitors[0];
  const away = comp.competitors.find((c) => c.homeAway === "away") ?? comp.competitors[1];
  const { status, statusText, clock } = parseStatus(comp.status);

  return {
    id: event.id ?? "",
    homeTeam: home.team?.displayName ?? home.team?.shortDisplayName ?? "?",
    homeAbbr: home.team?.abbreviation ?? "",
    homeLogo: home.team?.logo ?? "",
    homeScore: home.score ?? "-",
    awayTeam: away.team?.displayName ?? away.team?.shortDisplayName ?? "?",
    awayAbbr: away.team?.abbreviation ?? "",
    awayLogo: away.team?.logo ?? "",
    awayScore: away.score ?? "-",
    status,
    statusText,
    clock,
    startTime: comp.startDate ?? "",
  };
}

async function fetchLeague(espnSport: string, league: { slug: string; name: string; flag?: string }, date?: string): Promise<LiveLeague | null> {
  try {
    const url = buildScoreboardUrl(espnSport, league.slug, date);
    const res = await fetch(url, { next: { revalidate: 30 }, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    
    const data: ESPNResponse = await res.json();
    if (!data.events?.length) return null;

    const matches = data.events.map(parseEvent).filter((m): m is LiveMatch => m !== null);
    if (!matches.length) return null;

    // Use ESPN league name if available
    const leagueName = data.leagues?.[0]?.name ?? league.name;

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
  const date = searchParams.get("date") ?? undefined; // YYYYMMDD

  const targetSports = sport && sport !== "all"
    ? SPORTS_CONFIG.filter((s) => s.key === sport)
    : SPORTS_CONFIG;

  const results: LiveSport[] = [];

  // Fetch all leagues for all targeted sports in parallel
  await Promise.all(
    targetSports.map(async (sportConfig) => {
      const leagueResults = await Promise.all(
        sportConfig.leagues.map((league) => fetchLeague(sportConfig.espnSport, league, date))
      );

      const validLeagues = leagueResults
        .filter((l): l is LiveLeague => l !== null)
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
    })
  );

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