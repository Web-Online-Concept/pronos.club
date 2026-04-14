// src/app/api/stats-sports/route.ts
// API route pour les statistiques sportives — données ESPN avec cache 30 min

import { NextResponse } from "next/server";

// ── Configuration des ligues ──
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

const NBA_CONFIG = { sport: "basketball", league: "nba", name: "NBA" };
const NHL_CONFIG = { sport: "hockey", league: "nhl", name: "NHL" };
const NFL_CONFIG = { sport: "football", league: "nfl", name: "NFL" };
const MLB_CONFIG = { sport: "baseball", league: "mlb", name: "MLB" };

// ── Cache en mémoire — 30 minutes ──
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL = 30 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

// ── Fetch ESPN ──
async function fetchESPN(url: string) {
  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Parser classement football ──
function parseFootballStandings(data: any) {
  const children = data?.children || [];
  // Some leagues have groups (e.g., Champions League), others have a single standings block
  const allEntries: any[] = [];

  for (const group of children) {
    const entries = group?.standings?.entries || [];
    for (const entry of entries) {
      const team = entry.team || {};
      const stats: Record<string, number> = {};
      for (const s of entry.stats || []) {
        stats[s.name] = s.value;
        if (s.displayValue) stats[s.name + "_display"] = s.displayValue;
      }

      allEntries.push({
        position: stats.rank || 0,
        team: {
          name: team.displayName || team.name || "?",
          shortName: team.abbreviation || "",
          logo: team.logos?.[0]?.href || null,
        },
        played: stats.gamesPlayed || 0,
        wins: stats.wins || 0,
        draws: stats.ties || 0,
        losses: stats.losses || 0,
        goalsFor: stats.pointsFor || 0,
        goalsAgainst: stats.pointsAgainst || 0,
        goalDiff: stats.pointDifferential || 0,
        points: stats.points || 0,
      });
    }
  }

  // If no children, try direct standings
  if (allEntries.length === 0) {
    const entries = data?.standings?.entries || [];
    for (const entry of entries) {
      const team = entry.team || {};
      const stats: Record<string, number> = {};
      for (const s of entry.stats || []) {
        stats[s.name] = s.value;
      }
      allEntries.push({
        position: stats.rank || 0,
        team: {
          name: team.displayName || team.name || "?",
          shortName: team.abbreviation || "",
          logo: team.logos?.[0]?.href || null,
        },
        played: stats.gamesPlayed || 0,
        wins: stats.wins || 0,
        draws: stats.ties || 0,
        losses: stats.losses || 0,
        goalsFor: stats.pointsFor || 0,
        goalsAgainst: stats.pointsAgainst || 0,
        goalDiff: stats.pointDifferential || 0,
        points: stats.points || 0,
      });
    }
  }

  return allEntries.sort((a, b) => a.position - b.position);
}

// ── Parser classement US sports (NBA, NHL, NFL, MLB) ──
function parseUSStandings(data: any) {
  const children = data?.children || [];
  const conferences: any[] = [];

  for (const conf of children) {
    const confName = conf.name || conf.abbreviation || "";
    const entries: any[] = [];

    // Some sports have divisions inside conferences
    if (conf.children) {
      for (const div of conf.children) {
        const divName = div.name || "";
        for (const entry of div.standings?.entries || []) {
          const team = entry.team || {};
          const stats: Record<string, number | string> = {};
          for (const s of entry.stats || []) {
            stats[s.name] = s.displayValue || s.value;
          }
          entries.push({
            division: divName,
            team: {
              name: team.displayName || team.name || "?",
              shortName: team.abbreviation || "",
              logo: team.logos?.[0]?.href || null,
            },
            played: Number(stats.gamesPlayed) || (Number(stats.wins) || 0) + (Number(stats.losses) || 0),
            wins: Number(stats.wins) || 0,
            losses: Number(stats.losses) || 0,
            pct: stats.winPercent || stats.winPct || "-",
            streak: stats.streak || "-",
          });
        }
      }
    } else {
      for (const entry of conf.standings?.entries || []) {
        const team = entry.team || {};
        const stats: Record<string, number | string> = {};
        for (const s of entry.stats || []) {
          stats[s.name] = s.displayValue || s.value;
        }
        entries.push({
          team: {
            name: team.displayName || team.name || "?",
            shortName: team.abbreviation || "",
            logo: team.logos?.[0]?.href || null,
          },
          played: Number(stats.gamesPlayed) || (Number(stats.wins) || 0) + (Number(stats.losses) || 0),
          wins: Number(stats.wins) || 0,
          losses: Number(stats.losses) || 0,
          pct: stats.winPercent || stats.winPct || "-",
          streak: stats.streak || "-",
        });
      }
    }

    conferences.push({ name: confName, entries });
  }

  return conferences;
}

// ── Parser rankings tennis ──
function parseTennisRankings(data: any) {
  const rankings = data?.rankings || [];
  if (rankings.length === 0) return [];

  const entries: any[] = [];
  for (const r of rankings[0]?.ranks || []) {
    entries.push({
      rank: r.current || 0,
      previousRank: r.previous || 0,
      name: r.athlete?.displayName || "?",
      country: r.athlete?.flag?.alt || "",
      countryFlag: r.athlete?.flag?.href || null,
      points: r.points || 0,
    });
  }

  return entries.slice(0, 100); // Top 100
}

// ── GET handler ──
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") || "football";
  const league = searchParams.get("league") || "fra.1";

  const cacheKey = `${sport}:${league}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    let result: any = null;

    if (sport === "football") {
      const leagueConfig = FOOTBALL_LEAGUES.find((l) => l.id === league);
      if (!leagueConfig) {
        return NextResponse.json({ error: "Unknown league" }, { status: 400 });
      }

      const data = await fetchESPN(
        `https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings`
      );
      if (!data) {
        return NextResponse.json({ error: "ESPN unavailable" }, { status: 502 });
      }

      result = {
        sport: "football",
        league: leagueConfig,
        standings: parseFootballStandings(data),
      };
    } else if (sport === "nba" || sport === "nhl" || sport === "nfl" || sport === "mlb") {
      const config = { nba: NBA_CONFIG, nhl: NHL_CONFIG, nfl: NFL_CONFIG, mlb: MLB_CONFIG }[sport]!;
      const data = await fetchESPN(
        `https://site.api.espn.com/apis/v2/sports/${config.sport}/${config.league}/standings`
      );
      if (!data) {
        return NextResponse.json({ error: "ESPN unavailable" }, { status: 502 });
      }

      result = {
        sport,
        name: config.name,
        conferences: parseUSStandings(data),
      };
    } else if (sport === "tennis") {
      const tour = league === "wta" ? "wta" : "atp";
      const data = await fetchESPN(
        `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/rankings`
      );
      if (!data) {
        return NextResponse.json({ error: "ESPN unavailable" }, { status: 502 });
      }

      result = {
        sport: "tennis",
        tour: tour.toUpperCase(),
        rankings: parseTennisRankings(data),
      };
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