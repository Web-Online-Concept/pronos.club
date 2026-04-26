import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint debug temporaire :
 * GET /api/admin/apifootball-fixtures-debug?date=2026-04-27&league=39&season=2025
 *
 * Appelle directement l'API API-Football pour voir ce qu'elle retourne
 * avec/sans le parametre season. Permet de savoir si notre client
 * apiFootball.getFixturesByDate() rate des fixtures parce qu'il oublie
 * de passer season.
 *
 * A SUPPRIMER une fois le diagnostic fini.
 */

const ADMIN_EMAILS = ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"];

const isAuthorized = (req: NextRequest): boolean => {
  const adminEmail = req.headers.get("x-admin-email");
  if (
    adminEmail &&
    ADMIN_EMAILS.includes(adminEmail.toLowerCase())
  ) {
    return true;
  }
  return false;
};

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const league = searchParams.get("league");
  const season = searchParams.get("season");
  const apiKey = process.env.API_FOOTBALL_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "API_FOOTBALL_KEY not set in env" },
      { status: 500 }
    );
  }

  const tests: Record<string, unknown> = {};

  // Test 1 : avec date + league + season
  if (league && season) {
    const url1 = `https://v3.football.api-sports.io/fixtures?date=${date}&league=${league}&season=${season}`;
    try {
      const r1 = await fetch(url1, {
        headers: { "x-apisports-key": apiKey },
      });
      const j1 = await r1.json();
      tests.with_league_season = {
        url: url1,
        status: r1.status,
        results: j1.results,
        errors: j1.errors,
        sample: (j1.response ?? []).slice(0, 5).map((f: { fixture: { id: number; date: string }; teams: { home: { name: string }; away: { name: string } }; league: { name: string; season: number } }) => ({
          id: f.fixture.id,
          date: f.fixture.date,
          home: f.teams.home.name,
          away: f.teams.away.name,
          league: f.league.name,
          season: f.league.season,
        })),
      };
    } catch (err) {
      tests.with_league_season = {
        url: url1,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Test 2 : avec date + league SANS season (= ce que notre client fait actuellement)
  if (league) {
    const url2 = `https://v3.football.api-sports.io/fixtures?date=${date}&league=${league}`;
    try {
      const r2 = await fetch(url2, {
        headers: { "x-apisports-key": apiKey },
      });
      const j2 = await r2.json();
      tests.with_league_no_season = {
        url: url2,
        status: r2.status,
        results: j2.results,
        errors: j2.errors,
        sample: (j2.response ?? []).slice(0, 5).map((f: { fixture: { id: number; date: string }; teams: { home: { name: string }; away: { name: string } }; league: { name: string; season: number } }) => ({
          id: f.fixture.id,
          date: f.fixture.date,
          home: f.teams.home.name,
          away: f.teams.away.name,
          league: f.league.name,
          season: f.league.season,
        })),
      };
    } catch (err) {
      tests.with_league_no_season = {
        url: url2,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Test 3 : avec date seule (tous matchs)
  const url3 = `https://v3.football.api-sports.io/fixtures?date=${date}`;
  try {
    const r3 = await fetch(url3, {
      headers: { "x-apisports-key": apiKey },
    });
    const j3 = await r3.json();
    tests.date_only = {
      url: url3,
      status: r3.status,
      results: j3.results,
      errors: j3.errors,
      // On ne renvoie pas les samples de tous les matchs - juste un compte par ligue
      leagues_count: (() => {
        const map: Record<string, number> = {};
        for (const f of j3.response ?? []) {
          const fx = f as { league: { id: number; name: string } };
          const key = `${fx.league.id}:${fx.league.name}`;
          map[key] = (map[key] ?? 0) + 1;
        }
        return map;
      })(),
    };
  } catch (err) {
    tests.date_only = {
      url: url3,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json({
    ok: true,
    params: { date, league, season },
    tests,
  });
}