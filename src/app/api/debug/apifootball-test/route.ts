import { NextRequest, NextResponse } from "next/server";
import { apiFootball } from "@/lib/ai-picks-v2/apifootball-client";
import {
  aggregateMatchData,
  fetchFixturesForGeneration,
} from "@/lib/ai-picks-v2/match-aggregator";
import { MAJOR_LEAGUE_LIST } from "@/types/apifootball";
import { buildMatchSlug } from "@/lib/ai-picks-v2/slug-generator";

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

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "aggregate";
  const fixtureParam = url.searchParams.get("fixture");
  const dateParam = url.searchParams.get("date");

  try {
    if (mode === "health") {
      const health = await apiFootball.healthCheck();
      return NextResponse.json({ ok: true, mode, health });
    }

    if (mode === "fixtures-today") {
      const date = dateParam ?? new Date().toISOString().slice(0, 10);
      const fixtures = await fetchFixturesForGeneration({
        date,
        leagueIds: [...MAJOR_LEAGUE_LIST],
      });
      return NextResponse.json({
        ok: true,
        mode,
        date,
        leaguesFiltered: MAJOR_LEAGUE_LIST,
        count: fixtures.length,
        fixtures: fixtures.map((f) => ({
          id: f.fixture.id,
          date: f.fixture.date,
          status: f.fixture.status.short,
          league: `${f.league.country} - ${f.league.name}`,
          home: f.teams.home.name,
          away: f.teams.away.name,
          slug: buildMatchSlug({
            homeTeam: f.teams.home.name,
            awayTeam: f.teams.away.name,
            league: f.league.name,
            eventDate: f.fixture.date,
          }),
        })),
      });
    }

    if (mode === "aggregate") {
      if (!fixtureParam) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Missing 'fixture' query param. Usage: ?mode=aggregate&fixture=1234567",
          },
          { status: 400 }
        );
      }
      const fixtureId = Number.parseInt(fixtureParam, 10);
      if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
        return NextResponse.json(
          { ok: false, error: "Invalid fixture ID" },
          { status: 400 }
        );
      }

      const startedAt = Date.now();
      const data = await aggregateMatchData(fixtureId);
      const durationMs = Date.now() - startedAt;

      return NextResponse.json({
        ok: true,
        mode,
        fixtureId,
        durationMs,
        slug: buildMatchSlug({
          homeTeam: data.fixture.teams.home.name,
          awayTeam: data.fixture.teams.away.name,
          league: data.fixture.league.name,
          eventDate: data.fixture.date ?? data.fixture.fixture.date,
        }),
        data,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Unknown mode '${mode}'. Valid modes: health | fixtures-today | aggregate`,
      },
      { status: 400 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}