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
 * ?active=true        → scores for all pending picks (today)
 * ?pick_id=xxx        → score for one pick (auto-saves if resolved)
 *                       Cherche d'abord dans `picks` (Tipster), puis dans `ai_picks` (IA).
 * ?event=xxx&date=xxx → direct search (combined legs)
 *    &sport=xxx&competition=xxx
 *    &save_pick_id=xxx&save_leg=N  → optional: save result to DB
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

  // Direct event search (used by combined legs)
  const eventName = searchParams.get("event");
  const eventDate = searchParams.get("date");
  const sportSlug = searchParams.get("sport") || "football";
  const competition = searchParams.get("competition") || null;
  if (eventName && eventDate) {
    const result = await findScore(eventName, eventDate, sportSlug, competition);
    if (!result) return NextResponse.json({ found: false });

    // Auto-save for resolved leg if save params provided
    const saveLegPickId = searchParams.get("save_pick_id");
    const saveLegNum = searchParams.get("save_leg");
    if (saveLegPickId && saveLegNum && result.matchStatus === "final") {
      await saveLegScore(saveLegPickId, Number(saveLegNum), result);
    }

    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Use ?active=true or ?pick_id=xxx or ?event=xxx&date=xxx&sport=xxx" }, { status: 400 });
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
// Cherche d'abord dans `picks` (Tipster), puis dans `ai_picks` (IA).
// ═══════════════════════════════════════════════

async function getPickScore(pickId: string) {
  // ── Tentative 1 : table `picks` (Tipster) ────────────────
  const { data: tipsterPick } = await supabaseAdmin
    .from("picks")
    .select("id, event_name, event_date, competition, status, live_score_data, sport:sports(slug)")
    .eq("id", pickId)
    .maybeSingle();

  if (tipsterPick) {
    // If already saved, return it directly
    if (tipsterPick.live_score_data) {
      return NextResponse.json(tipsterPick.live_score_data);
    }

    const pickAny = tipsterPick as Record<string, unknown>;
    const sportObj = pickAny.sport as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const sportSlug = (Array.isArray(sportObj) ? sportObj[0]?.slug : sportObj?.slug) as string || "football";
    const result = await findScore(
      tipsterPick.event_name,
      tipsterPick.event_date,
      sportSlug,
      tipsterPick.competition
    );

    if (!result) {
      return NextResponse.json({ found: false });
    }

    // Auto-save if pick is resolved and match is final
    const isResolved = ["won", "lost", "half_won", "half_lost", "void"].includes(tipsterPick.status);
    if (isResolved && result.matchStatus === "final") {
      await supabaseAdmin
        .from("picks")
        .update({ live_score_data: result })
        .eq("id", pickId);
    }

    return NextResponse.json(result);
  }

  // ── Tentative 2 : table `ai_picks` (IA) ──────────────────
  const { data: aiPick } = await supabaseAdmin
    .from("ai_picks")
    .select("id, event_name, event_date, league, status, live_score_data, sport")
    .eq("id", pickId)
    .maybeSingle();

  if (!aiPick) {
    return NextResponse.json({ found: false });
  }

  // If already saved, return it directly
  if (aiPick.live_score_data) {
    return NextResponse.json(aiPick.live_score_data);
  }

  // Pour ai_picks, le sport est stocke directement comme string (ex: "football")
  // et la "competition" est dans `league` (ex: "France - Ligue 1")
  const aiSportSlug = (aiPick.sport as string) || "football";
  const aiCompetition = (aiPick.league as string) || null;

  const result = await findScore(
    aiPick.event_name,
    aiPick.event_date,
    aiSportSlug,
    aiCompetition
  );

  if (!result) {
    return NextResponse.json({ found: false });
  }

  // Auto-save if pick is resolved and match is final
  const isResolved = ["won", "lost", "void"].includes(aiPick.status);
  if (isResolved && result.matchStatus === "final") {
    await supabaseAdmin
      .from("ai_picks")
      .update({ live_score_data: result })
      .eq("id", pickId);
  }

  return NextResponse.json(result);
}

// ═══════════════════════════════════════════════
// SAVE LEG SCORE
// ═══════════════════════════════════════════════

async function saveLegScore(pickId: string, legNumber: number, scoreData: LiveScoreResult) {
  try {
    await supabaseAdmin
      .from("pick_legs")
      .update({ live_score_data: scoreData })
      .eq("pick_id", pickId)
      .eq("leg_number", legNumber);
  } catch {
    // Silent — non-critical
  }
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

  const eventDt = new Date(eventDate);
  const dateStr = eventDt.toISOString().split("T")[0].replace(/-/g, "");

  // For tennis, ESPN groups all matches under the tournament event
  // Try: exact date, then no date (current tournaments), then previous day
  const isTennisSport = sportSlug === "tennis"
    || (competition?.toLowerCase().includes("atp") ?? false)
    || (competition?.toLowerCase().includes("wta") ?? false);

  const datesToTry = [dateStr];
  if (isTennisSport) {
    datesToTry.push(""); // no date = current scoreboard
    const prevDay = new Date(eventDt.getTime() - 24 * 60 * 60 * 1000);
    datesToTry.push(prevDay.toISOString().split("T")[0].replace(/-/g, ""));
  }

  for (const slug of espnSlugs) {
    for (const tryDate of datesToTry) {
      const games = await fetchEspnScoreboard(slug, tryDate);
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
  }

  return null;
}

// ═══════════════════════════════════════════════
// FETCH: ESPN scoreboard (cached 60s)
// ═══════════════════════════════════════════════

async function fetchEspnScoreboard(espnSlug: string, dateStr: string): Promise<ParsedGame[]> {
  const cacheKey = `espn:${espnSlug}:${dateStr || "current"}`;
  const cached = getCached(cacheKey);
  if (cached) return cached as ParsedGame[];

  try {
    const url = dateStr
      ? `${ESPN_BASE}/${espnSlug}/scoreboard?dates=${dateStr}`
      : `${ESPN_BASE}/${espnSlug}/scoreboard`;

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