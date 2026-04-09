// src/app/api/livescore/match/[id]/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface MatchDetailTeam {
  name: string;
  abbreviation: string;
  logo: string;
  score: string;
  homeAway: string;
  form: string;
  record: string;
  linescores: string[];
  formation: string;
  color: string;
}

interface MatchDetailEvent {
  id: string;
  type: string; // goal, yellow-card, red-card, substitution, kickoff, halftime, etc.
  minute: string;
  text: string;
  shortText: string;
  team: string;
  teamId: string;
  scoringPlay: boolean;
  participants: { name: string; role: string }[];
  period: number;
}

interface MatchDetailStat {
  name: string;
  displayName: string;
  home: string;
  away: string;
  homeValue: number;
  awayValue: number;
}

interface MatchDetailPlayer {
  name: string;
  shortName: string;
  jersey: string;
  position: string;
  starter: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  formationPlace: number;
}

interface MatchDetailRoster {
  teamName: string;
  teamId: string;
  formation: string;
  starters: MatchDetailPlayer[];
  substitutes: MatchDetailPlayer[];
}

export interface MatchDetail {
  id: string;
  status: string;
  statusText: string;
  venue: string;
  venueCity: string;
  home: MatchDetailTeam;
  away: MatchDetailTeam;
  events: MatchDetailEvent[];
  stats: MatchDetailStat[];
  rosters: MatchDetailRoster[];
  h2h: { date: string; score: string; competition: string }[];
}

// Stats we want to display, in order
const STAT_KEYS = [
  "possessionPct",
  "totalShots",
  "shotsOnTarget",
  "wonCorners",
  "foulsCommitted",
  "yellowCards",
  "redCards",
  "offsides",
  "saves",
  "accuratePasses",
  "passPct",
  "totalTackles",
  "interceptions",
  "effectiveClearance",
];

const STAT_LABELS: Record<string, string> = {
  possessionPct: "Possession",
  totalShots: "Tirs",
  shotsOnTarget: "Tirs cadrés",
  wonCorners: "Corners",
  foulsCommitted: "Fautes",
  yellowCards: "Cartons jaunes",
  redCards: "Cartons rouges",
  offsides: "Hors-jeu",
  saves: "Arrêts",
  accuratePasses: "Passes réussies",
  passPct: "% passes",
  totalTackles: "Tacles",
  interceptions: "Interceptions",
  effectiveClearance: "Dégagements",
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function parseSummary(data: any, eventId: string): MatchDetail {
  const header = data.header?.competitions?.[0];
  const homeComp = header?.competitors?.find((c: any) => c.homeAway === "home") ?? header?.competitors?.[0];
  const awayComp = header?.competitors?.find((c: any) => c.homeAway === "away") ?? header?.competitors?.[1];

  const status = header?.status?.type?.name ?? "";
  const statusText = header?.status?.type?.shortDetail ?? header?.status?.type?.detail ?? "";

  const venue = data.gameInfo?.venue?.fullName ?? "";
  const venueCity = data.gameInfo?.venue?.address?.city ?? "";

  // Teams
  const home: MatchDetailTeam = {
    name: homeComp?.team?.displayName ?? "?",
    abbreviation: homeComp?.team?.abbreviation ?? "",
    logo: homeComp?.team?.logos?.[0]?.href ?? "",
    score: homeComp?.score ?? "-",
    homeAway: "home",
    form: homeComp?.form ?? "",
    record: homeComp?.record?.[0]?.summary ?? "",
    linescores: (homeComp?.linescores ?? []).map((l: any) => l.displayValue ?? ""),
    formation: "",
    color: homeComp?.team?.color ? `#${homeComp.team.color}` : "#333",
  };

  const away: MatchDetailTeam = {
    name: awayComp?.team?.displayName ?? "?",
    abbreviation: awayComp?.team?.abbreviation ?? "",
    logo: awayComp?.team?.logos?.[0]?.href ?? "",
    score: awayComp?.score ?? "-",
    homeAway: "away",
    form: awayComp?.form ?? "",
    record: awayComp?.record?.[0]?.summary ?? "",
    linescores: (awayComp?.linescores ?? []).map((l: any) => l.displayValue ?? ""),
    formation: "",
    color: awayComp?.team?.color ? `#${awayComp.team.color}` : "#666",
  };

  // Events
  const events: MatchDetailEvent[] = (data.keyEvents ?? []).map((ke: any) => ({
    id: ke.id ?? "",
    type: ke.type?.type ?? ke.type?.text ?? "",
    minute: ke.clock?.displayValue ?? "",
    text: ke.text ?? "",
    shortText: ke.shortText ?? "",
    team: ke.team?.displayName ?? "",
    teamId: ke.team?.id ?? "",
    scoringPlay: ke.scoringPlay ?? false,
    participants: (ke.participants ?? []).map((p: any) => ({
      name: p.athlete?.displayName ?? "",
      role: p.type ?? "",
    })),
    period: ke.period?.number ?? 0,
  }));

  // Stats
  const stats: MatchDetailStat[] = [];
  const boxTeams = data.boxscore?.teams ?? [];
  const homeBox = boxTeams.find((t: any) => t.homeAway === "home") ?? boxTeams[0];
  const awayBox = boxTeams.find((t: any) => t.homeAway === "away") ?? boxTeams[1];

  if (homeBox && awayBox) {
    const homeStats: Record<string, any> = {};
    const awayStats: Record<string, any> = {};
    for (const s of homeBox.statistics ?? []) homeStats[s.name] = s;
    for (const s of awayBox.statistics ?? []) awayStats[s.name] = s;

    for (const key of STAT_KEYS) {
      const hs = homeStats[key];
      const as = awayStats[key];
      if (hs || as) {
        stats.push({
          name: key,
          displayName: STAT_LABELS[key] ?? key,
          home: hs?.displayValue ?? "0",
          away: as?.displayValue ?? "0",
          homeValue: hs?.value ?? 0,
          awayValue: as?.value ?? 0,
        });
      }
    }
  }

  // Rosters
  const rosters: MatchDetailRoster[] = (data.rosters ?? []).map((r: any) => {
    const players: MatchDetailPlayer[] = (r.roster ?? []).map((p: any) => ({
      name: p.athlete?.displayName ?? "?",
      shortName: p.athlete?.shortName ?? "?",
      jersey: p.jersey ?? "",
      position: p.position?.abbreviation ?? p.position?.name ?? "",
      starter: p.starter ?? false,
      subbedIn: p.subbedIn ?? false,
      subbedOut: p.subbedOut ?? false,
      formationPlace: p.formationPlace ?? 0,
    }));

    const teamName = r.team?.displayName ?? "?";
    const teamId = r.team?.id ?? "";
    const formation = r.formation ?? "";

    // Set formation on the matching team
    if (r.homeAway === "home") home.formation = formation;
    if (r.homeAway === "away") away.formation = formation;

    return {
      teamName,
      teamId,
      formation,
      starters: players.filter((p) => p.starter).sort((a, b) => a.formationPlace - b.formationPlace),
      substitutes: players.filter((p) => !p.starter),
    };
  });

  // H2H
  const h2h = (data.headToHeadGames ?? []).flatMap((group: any) =>
    (group.events ?? []).map((e: any) => ({
      date: e.gameDate ?? "",
      score: e.score ?? "",
      competition: e.competitionName ?? "",
    }))
  );

  return {
    id: eventId,
    status,
    statusText,
    venue,
    venueCity,
    home,
    away,
    events,
    stats,
    rosters,
    h2h,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") ?? "soccer";
  const league = searchParams.get("league") ?? "fra.1";

  const url = `https://site.web.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${id}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 30 },
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const data = await res.json();
    const detail = parseSummary(data, id);

    return NextResponse.json(detail, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch match" }, { status: 500 });
  }
}