// src/app/api/stats-sports/route.ts
// API route pour les statistiques sportives — données ESPN avec cache 30 min
// Football leaders via /statistics (noms inline)
// US sports leaders via /leaders + résolution $ref athlètes

import { NextResponse } from "next/server";

// ── Configuration ──
const FOOTBALL_LEAGUES = [
  { id: "fra.1", name: "Ligue 1", flag: "🇫🇷" },
  { id: "eng.1", name: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { id: "esp.1", name: "La Liga", flag: "🇪🇸" },
  { id: "ita.1", name: "Serie A", flag: "🇮🇹" },
  { id: "ger.1", name: "Bundesliga", flag: "🇩🇪" },
  { id: "fra.2", name: "Ligue 2", flag: "🇫🇷" },
  { id: "por.1", name: "Liga Portugal", flag: "🇵🇹" },
  { id: "ned.1", name: "Eredivisie", flag: "🇳🇱" },
  { id: "bel.1", name: "Pro League", flag: "🇧🇪" },
  { id: "tur.1", name: "Süper Lig", flag: "🇹🇷" },
  { id: "uefa.champions", name: "Champions League", flag: "🏆" },
  { id: "uefa.europa", name: "Europa League", flag: "🏆" },
];

const US_SPORTS: Record<string, { sport: string; league: string; name: string }> = {
  nba: { sport: "basketball", league: "nba", name: "NBA" },
  nhl: { sport: "hockey", league: "nhl", name: "NHL" },
  nfl: { sport: "football", league: "nfl", name: "NFL" },
  mlb: { sport: "baseball", league: "mlb", name: "MLB" },
};

// ── Cache 30 min ──
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// ── Fetch ESPN ──
async function fetchESPN(url: string) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

// ── Parsers standings (inchangés) ──
function parseFootballStandings(data: any) {
  const children = data?.children || [];
  const allEntries: any[] = [];
  const parseEntries = (entries: any[]) => {
    for (const entry of entries) {
      const team = entry.team || {};
      const stats: Record<string, number> = {};
      for (const s of entry.stats || []) { stats[s.name] = s.value; }
      allEntries.push({
        position: stats.rank || 0,
        team: { name: team.displayName || team.name || "?", shortName: team.abbreviation || "", logo: team.logos?.[0]?.href || null },
        played: stats.gamesPlayed || 0, wins: stats.wins || 0, draws: stats.ties || 0, losses: stats.losses || 0,
        goalsFor: stats.pointsFor || 0, goalsAgainst: stats.pointsAgainst || 0, goalDiff: stats.pointDifferential || 0, points: stats.points || 0,
      });
    }
  };
  for (const group of children) { parseEntries(group?.standings?.entries || []); }
  if (allEntries.length === 0) { parseEntries(data?.standings?.entries || []); }
  return allEntries.sort((a, b) => a.position - b.position);
}

function parseUSStandings(data: any) {
  const children = data?.children || [];
  const conferences: any[] = [];
  for (const conf of children) {
    const confName = conf.name || conf.abbreviation || "";
    const entries: any[] = [];
    const parseEntry = (entry: any, divName?: string) => {
      const team = entry.team || {};
      const stats: Record<string, number | string> = {};
      for (const s of entry.stats || []) { stats[s.name] = s.displayValue || s.value; }
      entries.push({
        ...(divName ? { division: divName } : {}),
        team: { name: team.displayName || team.name || "?", shortName: team.abbreviation || "", logo: team.logos?.[0]?.href || null },
        played: Number(stats.gamesPlayed) || (Number(stats.wins) || 0) + (Number(stats.losses) || 0),
        wins: Number(stats.wins) || 0, losses: Number(stats.losses) || 0,
        pct: stats.winPercent || stats.winPct || "-", streak: stats.streak || "-",
      });
    };
    if (conf.children) {
      for (const div of conf.children) { for (const entry of div.standings?.entries || []) { parseEntry(entry, div.name || ""); } }
    } else {
      for (const entry of conf.standings?.entries || []) { parseEntry(entry); }
    }
    conferences.push({ name: confName, entries });
  }
  return conferences;
}

function parseTennisRankings(data: any) {
  const rankings = data?.rankings || [];
  if (rankings.length === 0) return [];
  const entries: any[] = [];
  for (const r of rankings[0]?.ranks || []) {
    entries.push({
      rank: r.current || 0, previousRank: r.previous || 0,
      name: r.athlete?.displayName || "?", country: r.athlete?.flag?.alt || "",
      countryFlag: r.athlete?.flag?.href || null, points: r.points || 0,
    });
  }
  return entries.slice(0, 100);
}

// ── Parser football leaders (via /statistics — noms inline) ──
function parseFootballLeaders(data: any) {
  const categories: any[] = [];
  const statsList = data?.stats || [];
  for (const cat of statsList) {
    const catName = cat.displayName || cat.name || "?";
    const leaders: any[] = [];
    for (const entry of (cat.leaders || []).slice(0, 15)) {
      const athlete = entry.athlete || {};
      leaders.push({
        rank: leaders.length + 1,
        name: athlete.displayName || "?",
        headshot: athlete.headshot?.href || null,
        value: entry.displayValue || entry.value || "-",
      });
    }
    if (leaders.length > 0) {
      categories.push({ name: catName, leaders });
    }
  }
  return categories;
}

// ── Parser US sports leaders (via sports.core — résolution $ref) ──
async function parseUSLeaders(data: any, sport: string, league: string) {
  const categories: any[] = [];
  const catList = data?.categories || [];

  // Limiter à 4 premières catégories
  for (const cat of catList.slice(0, 4)) {
    const catName = cat.displayName || cat.name || "?";
    const abbr = cat.abbreviation || "";
    const leaders: any[] = [];

    // Limiter à 5 premiers joueurs par catégorie
    const topEntries = (cat.leaders || []).slice(0, 5);

    // Résoudre les $ref des athlètes en parallèle
    const athletePromises = topEntries.map(async (entry: any) => {
      const athleteRef = entry.athlete?.$ref;
      if (!athleteRef) return null;

      const athleteData = await fetchESPN(athleteRef);
      if (!athleteData) return null;

      const athleteId = athleteData.id;
      // Construire l'URL du headshot
      const headshotUrl = `https://a.espncdn.com/i/headshots/${sport}/players/full/${athleteId}.png`;

      return {
        rank: leaders.length + 1,
        name: athleteData.displayName || athleteData.fullName || "?",
        headshot: headshotUrl,
        team: { shortName: athleteData.team?.abbreviation || "" },
        value: entry.displayValue || String(entry.value) || "-",
      };
    });

    const resolved = await Promise.all(athletePromises);
    let rank = 1;
    for (const r of resolved) {
      if (r) {
        r.rank = rank++;
        leaders.push(r);
      }
    }

    if (leaders.length > 0) {
      categories.push({ name: catName, abbreviation: abbr, leaders });
    }
  }

  return categories;
}

// ── GET handler ──
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") || "football";
  const league = searchParams.get("league") || "fra.1";
  const view = searchParams.get("view") || "standings";

  const cacheKey = `${sport}:${league}:${view}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  try {
    let result: any = null;

    if (sport === "football") {
      const leagueConfig = FOOTBALL_LEAGUES.find((l) => l.id === league);
      if (!leagueConfig) return NextResponse.json({ error: "Unknown league" }, { status: 400 });

      if (view === "leaders") {
        // Football: /statistics retourne noms + stats inline
        const data = await fetchESPN(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/statistics`
        );
        result = {
          sport: "football", view: "leaders", league: leagueConfig,
          categories: data ? parseFootballLeaders(data) : [],
        };
      } else {
        const data = await fetchESPN(
          `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`
        );
        if (!data) return NextResponse.json({ error: "ESPN unavailable" }, { status: 502 });
        result = { sport: "football", view: "standings", league: leagueConfig, standings: parseFootballStandings(data) };
      }

    } else if (sport in US_SPORTS) {
      const config = US_SPORTS[sport];

      if (view === "leaders") {
        // US sports: sports.core + résolution $ref athlètes
        const data = await fetchESPN(
          `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/leaders`
        );
        if (!data) return NextResponse.json({ error: "ESPN unavailable" }, { status: 502 });

        const categories = await parseUSLeaders(data, config.sport === "football" ? "nfl" : config.league, config.league);
        result = { sport, view: "leaders", name: config.name, categories };
      } else {
        const data = await fetchESPN(
          `https://site.api.espn.com/apis/v2/sports/${config.sport}/${config.league}/standings`
        );
        if (!data) return NextResponse.json({ error: "ESPN unavailable" }, { status: 502 });
        result = { sport, view: "standings", name: config.name, conferences: parseUSStandings(data) };
      }

    } else if (sport === "tennis") {
      const tour = league === "wta" ? "wta" : "atp";
      const data = await fetchESPN(
        `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`
      );
      if (!data) return NextResponse.json({ error: "ESPN unavailable" }, { status: 502 });
      result = { sport: "tennis", view: "standings", tour: tour.toUpperCase(), rankings: parseTennisRankings(data) };

    } else {
      return NextResponse.json({ error: "Unknown sport" }, { status: 400 });
    }

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[stats-sports] Error:", err.message);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}