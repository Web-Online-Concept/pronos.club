import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getEspnSlugs,
  extractTeams,
  teamsMatch,
  getCached,
  setCache,
  parseEspnScoreboard,
  type LiveScoreResult,
  type ParsedGame,
} from "@/lib/live-scores";
import { NextResponse } from "next/server";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

/**
 * GET /api/live-scores
 * 
 * ?active=true → scores for all pending picks (today)
 * ?pick_id=xxx → score for one pick
 * 
 * Uses ESPN hidden API — free, no key, all sports
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("active") === "true") {
    return getActivePicksScores();
  }

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

  const { data: picks } = await supabaseAdmin
    .from("picks")
    .select("id, event_name, event_date, competition, pick_type, sport:sports(slug), legs:pick_legs(leg_number, event_name, event_date, sport:sports(slug))")
    .in("status", ["pending", "won", "lost", "half_won", "half_lost", "void"])
    .gte("event_date", yesterday.toISOString())
    .lte("event_date", tomorrow.toISOString());

  if (!picks || picks.length === 0) {
    return NextResponse.json({ scores: {} });
  }

  const scores: Record<string, LiveScoreResult | null> = {};

  const searchJobs: { key: string; eventName: string; eventDate: string; sportSlug: string; competition: string | null }[] = [];

  for (const pick of picks) {
    const pickAny = pick as Record<string, unknown>;
    const sportObj = pickAny.sport as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const sportSlug = (Array.isArray(sportObj) ? sportObj[0]?.slug : sportObj?.slug) as string || "football";
    const legs = (pickAny.legs || []) as Array<Record<string, unknown>>;

    if (pick.pick_type === "combine" && legs.length > 1) {
      for (const leg of legs) {
        const legSportObj = leg.sport as Record<string, unknown> | Array<Record<string, unknown>> | null;
        const legSport = (Array.isArray(legSportObj) ? legSportObj[0]?.slug : legSportObj?.slug) as string || sportSlug;
        searchJobs.push({
          key: `${pick.id}_leg${leg.leg_number}`,
          eventName: String(leg.event_name),
          eventDate: String(leg.event_date || pick.event_date),
          sportSlug: legSport,
          competition: pick.competition as string | null,
        });
      }
    } else {
      searchJobs.push({
        key: pick.id,
        eventName: pick.event_name,
        eventDate: pick.event_date,
        sportSlug,
        competition: pick.competition as string | null,
      });
    }
  }

  await Promise.all(
    searchJobs.map(async (job) => {
      scores[job.key] = await findScore(job.eventName, job.eventDate, job.sportSlug, job.competition);
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
  const result = await findScore(pick.event_name, pick.event_date, sportSlug, pick.competition);

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
  sportSlug: string,
  competition: string | null
): Promise<LiveScoreResult | null> {
  const espnSlugs = getEspnSlugs(sportSlug, competition);
  if (espnSlugs.length === 0) return null;

  const teams = extractTeams(eventName);
  if (teams.length === 0) return null;

  const dateStr = new Date(eventDate).toISOString().split("T")[0].replace(/-/g, "");

  // Search each ESPN league until we find a match
  for (const slug of espnSlugs) {
    const games = await fetchEspnScoreboard(slug, dateStr);
    if (!games || games.length === 0) continue;

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
        isTennis: game.isTennis || false,
        sets: game.sets,
      };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════
// FETCH: ESPN scoreboard (cached 60s)
// ═══════════════════════════════════════════════

async function fetchEspnScoreboard(espnSlug: string, dateStr: string): Promise<ParsedGame[]> {
  const cacheKey = `espn:${espnSlug}:${dateStr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as ParsedGame[];

  try {
    const url = `${ESPN_BASE}/${espnSlug}/scoreboard?dates=${dateStr}`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      console.error(`[live-scores] ESPN error: ${res.status} for ${espnSlug}`);
      setCache(cacheKey, []);
      return [];
    }

    const data = await res.json();
    const games = parseEspnScoreboard(data);

    setCache(cacheKey, games);
    return games;
  } catch (err) {
    console.error(`[live-scores] ESPN fetch error for ${espnSlug}:`, err);
    setCache(cacheKey, []);
    return [];
  }
}