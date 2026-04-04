import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  SPORT_API_MAP,
  extractTeams,
  teamsMatch,
  getCached,
  setCache,
  parseFootballFixtures,
  parseGenericFixtures,
  type LiveScoreResult,
  type ParsedGame,
} from "@/lib/live-scores";
import { NextResponse } from "next/server";

const API_KEY = process.env.API_SPORTS_KEY || "";

/**
 * GET /api/live-scores?active=true
 * Returns live/final scores for all pending picks with today's date.
 * 
 * Response: { scores: { [pickId]: LiveScoreResult | null } }
 */
export async function GET(request: Request) {
  if (!API_KEY) {
    return NextResponse.json({ scores: {}, error: "API key not configured" });
  }

  const { searchParams } = new URL(request.url);

  // Mode: all active picks
  if (searchParams.get("active") === "true") {
    return getActivePicksScores();
  }

  // Mode: single pick
  const pickId = searchParams.get("pick_id");
  if (pickId) {
    return getPickScore(pickId);
  }

  return NextResponse.json({ error: "Use ?active=true or ?pick_id=xxx" }, { status: 400 });
}

// ═══════════════════════════════════════════════
// ALL ACTIVE PICKS
// ═══════════════════════════════════════════════

async function getActivePicksScores() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  // Get pending picks within time window
  const { data: picks } = await supabaseAdmin
    .from("picks")
    .select("id, event_name, event_date, competition, pick_type, sport:sports(slug), legs:pick_legs(leg_number, event_name, event_date, sport:sports(slug))")
    .eq("status", "pending")
    .gte("event_date", yesterday.toISOString())
    .lte("event_date", tomorrow.toISOString());

  if (!picks || picks.length === 0) {
    return NextResponse.json({ scores: {} });
  }

  const scores: Record<string, LiveScoreResult | null> = {};

  // Build search jobs
  const searchJobs: { key: string; eventName: string; eventDate: string; sportSlug: string }[] = [];

  for (const pick of picks) {
    const pickAny = pick as Record<string, unknown>;
    const sportObj = pickAny.sport as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const sportSlug = (Array.isArray(sportObj) ? sportObj[0]?.slug : sportObj?.slug) as string || "football";
    const legs = (pickAny.legs || []) as Array<Record<string, unknown>>;

    if (pick.pick_type === "combine" && legs.length > 1) {
      // Combined: search each leg
      for (const leg of legs) {
        const legSportObj = leg.sport as Record<string, unknown> | Array<Record<string, unknown>> | null;
        const legSport = (Array.isArray(legSportObj) ? legSportObj[0]?.slug : legSportObj?.slug) as string || sportSlug;
        searchJobs.push({
          key: `${pick.id}_leg${leg.leg_number}`,
          eventName: String(leg.event_name),
          eventDate: String(leg.event_date || pick.event_date),
          sportSlug: legSport,
        });
      }
    } else {
      searchJobs.push({
        key: pick.id,
        eventName: pick.event_name,
        eventDate: pick.event_date,
        sportSlug,
      });
    }
  }

  // Execute searches
  await Promise.all(
    searchJobs.map(async (job) => {
      scores[job.key] = await findScore(job.eventName, job.eventDate, job.sportSlug);
    })
  );

  return NextResponse.json({ scores });
}

// ═══════════════════════════════════════════════
// SINGLE PICK
// ═══════════════════════════════════════════════

async function getPickScore(pickId: string) {
  const { data: pick } = await supabaseAdmin
    .from("picks")
    .select("id, event_name, event_date, competition, sport:sports(slug)")
    .eq("id", pickId)
    .single();

  if (!pick) {
    return NextResponse.json({ found: false });
  }

  const pickAny = pick as Record<string, unknown>;
  const sportObj = pickAny.sport as Record<string, unknown> | Array<Record<string, unknown>> | null;
  const sportSlug = (Array.isArray(sportObj) ? sportObj[0]?.slug : sportObj?.slug) as string || "football";
  const result = await findScore(pick.event_name, pick.event_date, sportSlug);

  if (!result) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json(result);
}

// ═══════════════════════════════════════════════
// CORE: Find score for an event
// ═══════════════════════════════════════════════

async function findScore(
  eventName: string,
  eventDate: string,
  sportSlug: string
): Promise<LiveScoreResult | null> {
  const apiBase = SPORT_API_MAP[sportSlug];
  if (!apiBase) return null;

  const teams = extractTeams(eventName);
  if (teams.length === 0) return null;

  const dateStr = new Date(eventDate).toISOString().split("T")[0];
  const games = await fetchGames(apiBase, sportSlug, dateStr);
  if (!games || games.length === 0) return null;

  // Find matching game
  for (const game of games) {
    if (teams.length >= 2) {
      const match1 = teamsMatch(game.homeTeam, teams[0]) && teamsMatch(game.awayTeam, teams[1]);
      const match2 = teamsMatch(game.homeTeam, teams[1]) && teamsMatch(game.awayTeam, teams[0]);
      if (!match1 && !match2) continue;
    } else {
      if (!teamsMatch(game.homeTeam, teams[0]) && !teamsMatch(game.awayTeam, teams[0])) continue;
    }

    return {
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      matchStatus: game.status,
      minute: game.minute,
      fixtureId: game.fixtureId,
    };
  }

  return null;
}

// ═══════════════════════════════════════════════
// FETCH: Get games from API-Sports (cached 60s)
// ═══════════════════════════════════════════════

async function fetchGames(apiBase: string, sportSlug: string, dateStr: string): Promise<ParsedGame[]> {
  const cacheKey = `${sportSlug}:${dateStr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as ParsedGame[];

  try {
    // Football uses /fixtures?date=YYYY-MM-DD
    // Other sports use /games?date=YYYY-MM-DD
    const endpoint = sportSlug === "football"
      ? `${apiBase}/fixtures?date=${dateStr}`
      : `${apiBase}/games?date=${dateStr}`;

    const res = await fetch(endpoint, {
      headers: {
        "x-apisports-key": API_KEY,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[live-scores] API-Sports error: ${res.status} for ${sportSlug}`);
      setCache(cacheKey, []);
      return [];
    }

    const data = await res.json();

    const games = sportSlug === "football"
      ? parseFootballFixtures(data)
      : parseGenericFixtures(data);

    setCache(cacheKey, games);
    return games;
  } catch (err) {
    console.error(`[live-scores] Fetch error for ${sportSlug}:`, err);
    setCache(cacheKey, []);
    return [];
  }
}