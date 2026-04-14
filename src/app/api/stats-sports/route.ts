import { NextRequest, NextResponse } from "next/server";

// ============================================================
// /api/stats-sports/route.ts — PRONOS.CLUB Stats Sports API
// Views: standings | leaders | schedule | injuries
// Cache: 30 min server-side
// ============================================================

const CACHE_DURATION = 1800; // 30 min
const cache = new Map<string, { data: unknown; ts: number }>();

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_DURATION * 1000) return entry.data;
  return null;
}
function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// --- ESPN Config ---

const FOOTBALL_LEAGUES = [
  { id: "fra.1", name: "Ligue 1", flag: "fr" },
  { id: "eng.1", name: "Premier League", flag: "gb-eng" },
  { id: "esp.1", name: "La Liga", flag: "es" },
  { id: "ita.1", name: "Serie A", flag: "it" },
  { id: "ger.1", name: "Bundesliga", flag: "de" },
  { id: "fra.2", name: "Ligue 2", flag: "fr" },
  { id: "por.1", name: "Liga Portugal", flag: "pt" },
  { id: "ned.1", name: "Eredivisie", flag: "nl" },
  { id: "bel.1", name: "Pro League", flag: "be" },
  { id: "tur.1", name: "Süper Lig", flag: "tr" },
  { id: "uefa.champions", name: "Champions League", flag: "eu" },
  { id: "uefa.europa", name: "Europa League", flag: "eu" },
];

const US_SPORTS: Record<string, { sport: string; league: string; season: number; leaderCategories: string[] }> = {
  nba: { sport: "basketball", league: "nba", season: 2026, leaderCategories: ["points", "rebounds", "assists", "steals"] },
  nhl: { sport: "hockey", league: "nhl", season: 2026, leaderCategories: ["points", "goals", "assists", "wins"] },
  nfl: { sport: "football", league: "nfl", season: 2025, leaderCategories: ["passingYards", "rushingYards", "receivingYards", "sacks"] },
  mlb: { sport: "baseball", league: "mlb", season: 2026, leaderCategories: ["battingAverage", "homeRuns", "RBIs", "wins"] },
};

const TENNIS_TOURS = [
  { id: "atp", name: "ATP" },
  { id: "wta", name: "WTA" },
];

// --- Fetch helpers ---

async function espnFetch(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function resolveRef(url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================================
// STANDINGS (existing)
// ============================================================

async function getFootballStandings(league: string) {
  const cacheKey = `standings-football-${league}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await espnFetch(
    `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`
  );
  if (!data) return null;

  const standings = data.children?.[0]?.standings?.entries?.map((e: any) => ({
    position: e.stats?.find((s: any) => s.name === "rank")?.value ?? 0,
    team: {
      id: e.team?.id,
      name: e.team?.displayName ?? e.team?.name,
      shortName: e.team?.abbreviation,
      logo: e.team?.logos?.[0]?.href,
    },
    gamesPlayed: e.stats?.find((s: any) => s.name === "gamesPlayed")?.value ?? 0,
    wins: e.stats?.find((s: any) => s.name === "wins")?.value ?? 0,
    draws: e.stats?.find((s: any) => s.name === "ties")?.value ?? 0,
    losses: e.stats?.find((s: any) => s.name === "losses")?.value ?? 0,
    goalsFor: e.stats?.find((s: any) => s.name === "pointsFor")?.value ?? 0,
    goalsAgainst: e.stats?.find((s: any) => s.name === "pointsAgainst")?.value ?? 0,
    goalDiff: e.stats?.find((s: any) => s.name === "pointDifferential")?.value ?? 0,
    points: e.stats?.find((s: any) => s.name === "points")?.value ?? 0,
  })) ?? [];

  standings.sort((a: any, b: any) => a.position - b.position);

  // Forme récente
  const now = new Date();
  const from = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const dateRange = `${fmt(from)}-${fmt(now)}`;
  const scores = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${dateRange}&limit=200`
  );

  if (scores?.events) {
    const formMap = new Map<string, string[]>();
    const sortedEvents = scores.events
      .filter((ev: any) => ev.status?.type?.completed)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const ev of sortedEvents) {
      const comps = ev.competitions?.[0];
      if (!comps?.competitors) continue;
      const home = comps.competitors.find((c: any) => c.homeAway === "home");
      const away = comps.competitors.find((c: any) => c.homeAway === "away");
      if (!home || !away) continue;
      const hScore = parseInt(home.score);
      const aScore = parseInt(away.score);

      const hResult = hScore > aScore ? "W" : hScore < aScore ? "L" : "D";
      const aResult = aScore > hScore ? "W" : aScore < hScore ? "L" : "D";

      if (!formMap.has(home.team.id)) formMap.set(home.team.id, []);
      if (!formMap.has(away.team.id)) formMap.set(away.team.id, []);
      formMap.get(home.team.id)!.push(hResult);
      formMap.get(away.team.id)!.push(aResult);
    }

    for (const team of standings) {
      const results = formMap.get(team.team.id) ?? [];
      team.form = results.slice(-5);
    }
  }

  setCache(cacheKey, standings);
  return standings;
}

function fmt(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function getUSStandings(sportKey: string) {
  const cacheKey = `standings-us-${sportKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const cfg = US_SPORTS[sportKey];
  if (!cfg) return null;

  const data = await espnFetch(
    `https://site.api.espn.com/apis/v2/sports/${cfg.sport}/${cfg.league}/standings`
  );
  if (!data) return null;

  const conferences = data.children?.map((conf: any) => ({
    name: conf.name ?? conf.abbreviation,
    teams: conf.standings?.entries?.map((e: any) => ({
      team: {
        id: e.team?.id,
        name: e.team?.displayName ?? e.team?.name,
        shortName: e.team?.abbreviation,
        logo: e.team?.logos?.[0]?.href,
      },
      gamesPlayed: e.stats?.find((s: any) => s.name === "gamesPlayed")?.value ?? 0,
      wins: e.stats?.find((s: any) => s.name === "wins")?.value ?? 0,
      losses: e.stats?.find((s: any) => s.name === "losses")?.value ?? 0,
      winPct: e.stats?.find((s: any) => s.name === "winPercent" || s.name === "avgPointsFor")?.displayValue ?? "-",
      streak: e.stats?.find((s: any) => s.name === "streak")?.displayValue ?? "-",
    })) ?? [],
  })) ?? [];

  setCache(cacheKey, conferences);
  return conferences;
}

async function getTennisRankings(tour: string) {
  const cacheKey = `rankings-tennis-${tour}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`
  );
  if (!data) return null;

  const rankings = data.rankings?.[0]?.ranks?.slice(0, 100).map((r: any) => ({
    rank: r.current,
    previousRank: r.previous,
    movement: (r.previous ?? r.current) - r.current,
    athlete: {
      id: r.athlete?.id,
      name: r.athlete?.displayName ?? r.athlete?.name,
      country: r.athlete?.flag?.alt ?? "",
      countryCode: r.athlete?.flag?.href?.match(/\/(\w+)\.png/)?.[1] ?? "",
      headshot: r.athlete?.id
        ? `https://a.espncdn.com/i/headshots/tennis/players/full/${r.athlete.id}.png`
        : null,
    },
    points: r.points,
  })) ?? [];

  setCache(cacheKey, rankings);
  return rankings;
}

// ============================================================
// LEADERS (existing)
// ============================================================

async function getFootballLeaders(league: string) {
  const cacheKey = `leaders-football-${league}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/statistics`
  );
  if (!data) return null;

  const categories = data.categories ?? data.leaders ?? [];
  const result: Record<string, any[]> = {};

  for (const cat of categories) {
    const catName = cat.name ?? cat.displayName ?? "unknown";
    result[catName] = (cat.leaders ?? cat.entries ?? []).slice(0, 15).map((l: any) => ({
      athlete: {
        id: l.athlete?.id,
        name: l.athlete?.displayName ?? l.athlete?.name,
        headshot: l.athlete?.id
          ? `https://a.espncdn.com/i/headshots/soccer/players/full/${l.athlete.id}.png`
          : null,
        team: l.team?.displayName ?? l.team?.name ?? "",
        teamLogo: l.team?.logos?.[0]?.href ?? null,
        teamAbbr: l.team?.abbreviation ?? "",
      },
      value: l.value ?? l.stat ?? 0,
      displayValue: l.displayValue ?? String(l.value ?? 0),
      gamesPlayed: l.stats?.find((s: any) => s.name === "appearances")?.value ?? null,
    }));
  }

  setCache(cacheKey, result);
  return result;
}

async function getUSLeaders(sportKey: string) {
  const cacheKey = `leaders-us-${sportKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const cfg = US_SPORTS[sportKey];
  if (!cfg) return null;

  const data = await espnFetch(
    `https://sports.core.api.espn.com/v2/sports/${cfg.sport}/leagues/${cfg.league}/seasons/${cfg.season}/types/2/leaders`
  );
  if (!data?.categories) return null;

  const result: Record<string, any[]> = {};

  for (const cat of data.categories) {
    const catName = cat.name ?? cat.displayName ?? "unknown";
    const leaders = (cat.leaders ?? []).slice(0, 5);

    const resolved = await Promise.all(
      leaders.map(async (l: any) => {
        let athlete: any = { id: null, name: "Unknown", headshot: null, team: "", teamLogo: null };

        if (l.athlete?.$ref) {
          const ath = await resolveRef(l.athlete.$ref);
          if (ath) {
            athlete = {
              id: ath.id,
              name: ath.displayName ?? ath.fullName ?? "Unknown",
              headshot: ath.id
                ? `https://a.espncdn.com/i/headshots/${cfg.sport === "basketball" ? "nba" : cfg.sport === "hockey" ? "nhl" : cfg.sport === "football" ? "nfl" : "mlb"}/players/full/${ath.id}.png`
                : null,
              team: "",
              teamLogo: null,
            };

            // Resolve team
            const teamRef = ath.team?.$ref;
            if (teamRef) {
              const tm = await resolveRef(teamRef);
              if (tm) {
                athlete.team = tm.displayName ?? tm.name ?? "";
                athlete.teamAbbr = tm.abbreviation ?? "";
                athlete.teamLogo = tm.id
                  ? `https://a.espncdn.com/i/teamlogos/${cfg.sport === "basketball" ? "nba" : cfg.sport === "hockey" ? "nhl" : cfg.sport === "football" ? "nfl" : "mlb"}/500/${tm.id}.png`
                  : null;
              }
            }
          }
        }

        return {
          athlete,
          value: l.value ?? 0,
          displayValue: l.displayValue ?? String(l.value ?? 0),
        };
      })
    );

    result[catName] = resolved;
  }

  setCache(cacheKey, result);
  return result;
}

// ============================================================
// SCHEDULE (NEW — Phase 2)
// ============================================================

function getDateRange14() {
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return { from: fmt(now), to: fmt(end) };
}

async function getFootballSchedule(league: string) {
  const cacheKey = `schedule-football-${league}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { from, to } = getDateRange14();
  const data = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${from}-${to}&limit=200`
  );
  if (!data?.events) return [];

  const matches = data.events
    .filter((ev: any) => !ev.status?.type?.completed)
    .map((ev: any) => {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
      const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
      return {
        id: ev.id,
        date: ev.date,
        name: ev.name ?? `${home?.team?.displayName} vs ${away?.team?.displayName}`,
        status: ev.status?.type?.name ?? "STATUS_SCHEDULED",
        venue: comp?.venue?.fullName ?? null,
        home: home
          ? {
              id: home.team?.id,
              name: home.team?.displayName ?? home.team?.name,
              shortName: home.team?.abbreviation,
              logo: home.team?.logos?.[0]?.href,
            }
          : null,
        away: away
          ? {
              id: away.team?.id,
              name: away.team?.displayName ?? away.team?.name,
              shortName: away.team?.abbreviation,
              logo: away.team?.logos?.[0]?.href,
            }
          : null,
      };
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  setCache(cacheKey, matches);
  return matches;
}

async function getUSSchedule(sportKey: string) {
  const cacheKey = `schedule-us-${sportKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const cfg = US_SPORTS[sportKey];
  if (!cfg) return [];

  const { from, to } = getDateRange14();
  const data = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard?dates=${from}-${to}&limit=200`
  );
  if (!data?.events) return [];

  const matches = data.events
    .filter((ev: any) => !ev.status?.type?.completed)
    .map((ev: any) => {
      const comp = ev.competitions?.[0];
      const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
      const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
      return {
        id: ev.id,
        date: ev.date,
        name: ev.name ?? ev.shortName ?? "",
        status: ev.status?.type?.name ?? "STATUS_SCHEDULED",
        venue: comp?.venue?.fullName ?? null,
        broadcast: comp?.broadcasts?.[0]?.names?.[0] ?? null,
        home: home
          ? {
              id: home.team?.id,
              name: home.team?.displayName ?? home.team?.name,
              shortName: home.team?.abbreviation,
              logo: home.team?.logos?.[0]?.href,
            }
          : null,
        away: away
          ? {
              id: away.team?.id,
              name: away.team?.displayName ?? away.team?.name,
              shortName: away.team?.abbreviation,
              logo: away.team?.logos?.[0]?.href,
            }
          : null,
      };
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  setCache(cacheKey, matches);
  return matches;
}

async function getTennisSchedule(tour: string) {
  const cacheKey = `schedule-tennis-${tour}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { from, to } = getDateRange14();
  const data = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard?dates=${from}-${to}&limit=100`
  );
  if (!data?.events) return [];

  const matches = data.events
    .filter((ev: any) => !ev.status?.type?.completed)
    .map((ev: any) => {
      const comp = ev.competitions?.[0];
      const competitors = comp?.competitors ?? [];
      return {
        id: ev.id,
        date: ev.date,
        name: ev.name ?? ev.shortName ?? "",
        status: ev.status?.type?.name ?? "STATUS_SCHEDULED",
        tournament: ev.season?.name ?? comp?.venue?.fullName ?? "",
        venue: comp?.venue?.fullName ?? null,
        players: competitors.map((c: any) => ({
          id: c.athlete?.id ?? c.id,
          name: c.athlete?.displayName ?? c.athlete?.name ?? c.team?.displayName ?? "",
          seed: c.seed ?? null,
          countryCode: c.athlete?.flag?.href?.match(/\/(\w+)\.png/)?.[1] ?? "",
          headshot: c.athlete?.id
            ? `https://a.espncdn.com/i/headshots/tennis/players/full/${c.athlete.id}.png`
            : null,
        })),
      };
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  setCache(cacheKey, matches);
  return matches;
}

// ============================================================
// INJURIES (NEW — Phase 2)
// ============================================================

async function getUSInjuries(sportKey: string) {
  const cacheKey = `injuries-us-${sportKey}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const cfg = US_SPORTS[sportKey];
  if (!cfg) return null;

  const data = await espnFetch(
    `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/injuries`
  );
  if (!data) return null;

  // ESPN returns injuries grouped by team
  const teams = (data.items ?? data.teams ?? []).map((teamEntry: any) => {
    const team = teamEntry.team ?? {};
    const injuries = (teamEntry.injuries ?? []).map((inj: any) => ({
      athlete: {
        id: inj.athlete?.id,
        name: inj.athlete?.displayName ?? inj.athlete?.name ?? "Unknown",
        position: inj.athlete?.position?.abbreviation ?? inj.athlete?.position?.name ?? "",
        headshot: inj.athlete?.id
          ? `https://a.espncdn.com/i/headshots/${cfg.sport === "basketball" ? "nba" : cfg.sport === "hockey" ? "nhl" : cfg.sport === "football" ? "nfl" : "mlb"}/players/full/${inj.athlete.id}.png`
          : null,
      },
      status: inj.status ?? inj.type?.name ?? "Unknown",
      date: inj.date ?? null,
      description: inj.longComment ?? inj.shortComment ?? inj.details?.detail ?? "",
    }));

    return {
      team: {
        id: team.id,
        name: team.displayName ?? team.name ?? "Unknown",
        shortName: team.abbreviation ?? "",
        logo: team.logos?.[0]?.href ?? (team.id
          ? `https://a.espncdn.com/i/teamlogos/${cfg.sport === "basketball" ? "nba" : cfg.sport === "hockey" ? "nhl" : cfg.sport === "football" ? "nfl" : "mlb"}/500/${team.id}.png`
          : null),
      },
      injuries,
    };
  });

  // Sort teams alphabetically, filter out teams with no injuries
  const filtered = teams
    .filter((t: any) => t.injuries.length > 0)
    .sort((a: any, b: any) => a.team.name.localeCompare(b.team.name));

  setCache(cacheKey, filtered);
  return filtered;
}

// ============================================================
// ROUTE HANDLER
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") ?? "football";
  const league = searchParams.get("league") ?? "";
  const view = searchParams.get("view") ?? "standings";

  try {
    // --- STANDINGS ---
    if (view === "standings") {
      if (sport === "football" && league) {
        const data = await getFootballStandings(league);
        return NextResponse.json({ sport, league, view, data });
      }
      if (sport === "tennis" && league) {
        const data = await getTennisRankings(league);
        return NextResponse.json({ sport, league, view, data });
      }
      if (US_SPORTS[sport]) {
        const data = await getUSStandings(sport);
        return NextResponse.json({ sport, league: sport, view, data });
      }
    }

    // --- LEADERS ---
    if (view === "leaders") {
      if (sport === "football" && league) {
        const data = await getFootballLeaders(league);
        return NextResponse.json({ sport, league, view, data });
      }
      if (US_SPORTS[sport]) {
        const data = await getUSLeaders(sport);
        return NextResponse.json({ sport, league: sport, view, data });
      }
    }

    // --- SCHEDULE ---
    if (view === "schedule") {
      if (sport === "football" && league) {
        const data = await getFootballSchedule(league);
        return NextResponse.json({ sport, league, view, data });
      }
      if (sport === "tennis" && league) {
        const data = await getTennisSchedule(league);
        return NextResponse.json({ sport, league, view, data });
      }
      if (US_SPORTS[sport]) {
        const data = await getUSSchedule(sport);
        return NextResponse.json({ sport, league: sport, view, data });
      }
    }

    // --- INJURIES ---
    if (view === "injuries") {
      if (US_SPORTS[sport]) {
        const data = await getUSInjuries(sport);
        return NextResponse.json({ sport, league: sport, view, data });
      }
      // Football & Tennis: no ESPN injuries endpoint
      return NextResponse.json({ sport, league, view, data: null, message: "Injuries not available for this sport" });
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (err: any) {
    console.error("[stats-sports] Error:", err?.message ?? err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}