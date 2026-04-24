import { NextRequest, NextResponse } from "next/server";
import { apiFootball } from "@/lib/ai-picks-v2/apifootball-client";

const ADMIN_EMAILS = ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"];

const isAdminRequest = (req: NextRequest): boolean => {
  const secretHeader = req.headers.get("x-admin-secret");
  if (secretHeader && secretHeader === process.env.CRON_SECRET) {
    return true;
  }
  const emailHeader = req.headers.get("x-admin-email");
  if (emailHeader && ADMIN_EMAILS.includes(emailHeader.toLowerCase())) {
    return true;
  }
  return false;
};

const callApiFootballRaw = async (
  path: string,
  params: Record<string, string>
): Promise<unknown> => {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    throw new Error("API_FOOTBALL_KEY missing");
  }
  const url = new URL(`https://v3.football.api-sports.io${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": apiKey, Accept: "application/json" },
  });
  return res.json();
};

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "league-seasons";
  const leagueParam = url.searchParams.get("league");
  const teamParam = url.searchParams.get("team");
  const seasonParam = url.searchParams.get("season");

  try {
    if (mode === "league-seasons") {
      const leagueId = leagueParam ? Number(leagueParam) : 140;
      const raw = await callApiFootballRaw("/leagues", { id: String(leagueId) });
      const typed = raw as {
        response?: Array<{
          league?: { id: number; name: string };
          country?: { name: string };
          seasons?: Array<{
            year: number;
            current: boolean;
            start: string;
            end: string;
            coverage?: {
              fixtures?: Record<string, boolean>;
              standings?: boolean;
              players?: boolean;
              top_scorers?: boolean;
              top_assists?: boolean;
              top_cards?: boolean;
              injuries?: boolean;
              predictions?: boolean;
              odds?: boolean;
            };
          }>;
        }>;
      };
      const entry = typed.response?.[0];
      return NextResponse.json({
        ok: true,
        mode,
        leagueId,
        leagueName: entry?.league?.name,
        country: entry?.country?.name,
        currentSeason: entry?.seasons?.find((s) => s.current) ?? null,
        recentSeasons: entry?.seasons?.slice(-5) ?? [],
      });
    }

    if (mode === "team-stats-raw") {
      if (!teamParam || !leagueParam || !seasonParam) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Missing params. Usage: ?mode=team-stats-raw&team=543&league=140&season=2025",
          },
          { status: 400 }
        );
      }
      const raw = await callApiFootballRaw("/teams/statistics", {
        team: teamParam,
        league: leagueParam,
        season: seasonParam,
      });
      return NextResponse.json({ ok: true, mode, raw });
    }

    if (mode === "odds-raw") {
      const fixtureParam = url.searchParams.get("fixture");
      if (!fixtureParam) {
        return NextResponse.json(
          { ok: false, error: "Missing fixture param" },
          { status: 400 }
        );
      }
      const raw = await callApiFootballRaw("/odds", { fixture: fixtureParam });
      const typed = raw as {
        results?: number;
        errors?: unknown;
        response?: Array<{ bookmakers?: Array<{ name: string }> }>;
      };
      return NextResponse.json({
        ok: true,
        mode,
        results: typed.results,
        errors: typed.errors,
        bookmakersCount: typed.response?.[0]?.bookmakers?.length ?? 0,
        bookmakerNames:
          typed.response?.[0]?.bookmakers?.map((b) => b.name) ?? [],
      });
    }

    if (mode === "fixture-details") {
      const fixtureParam = url.searchParams.get("fixture");
      if (!fixtureParam) {
        return NextResponse.json(
          { ok: false, error: "Missing fixture param" },
          { status: 400 }
        );
      }
      const raw = await callApiFootballRaw("/fixtures", { id: fixtureParam });
      const typed = raw as {
        response?: Array<{
          fixture?: { id: number; date: string };
          league?: { id: number; name: string; season: number; round: string };
          teams?: { home?: { id: number }; away?: { id: number } };
        }>;
      };
      const entry = typed.response?.[0];
      return NextResponse.json({
        ok: true,
        mode,
        fixtureId: entry?.fixture?.id,
        date: entry?.fixture?.date,
        leagueId: entry?.league?.id,
        leagueName: entry?.league?.name,
        season: entry?.league?.season,
        round: entry?.league?.round,
        homeTeamId: entry?.teams?.home?.id,
        awayTeamId: entry?.teams?.away?.id,
      });
    }

    if (mode === "health") {
      const res = await apiFootball.healthCheck();
      return NextResponse.json({ ok: true, mode, health: res });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Unknown mode '${mode}'. Valid: health | league-seasons | team-stats-raw | odds-raw | fixture-details`,
      },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}