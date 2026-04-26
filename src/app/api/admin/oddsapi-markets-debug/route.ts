import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";


type OddsApiOutcome = {
  name: string;
  price: number;
  point?: number;
};

type OddsApiMarket = {
  key: string;
  outcomes: OddsApiOutcome[];
};

type OddsApiBookmaker = {
  key: string;
  title: string;
  markets: OddsApiMarket[];
};

type OddsApiEvent = {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: OddsApiBookmaker[];
};


export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      step: "missing_env",
      message: "ODDS_API_KEY n'est PAS definie",
    });
  }

  // Fetch toutes les ligues qu'on veut diagnostiquer
  const sportsToTest = [
    "soccer_germany_bundesliga",
    "soccer_italy_serie_a",
    "soccer_france_ligue_one",
    "soccer_spain_la_liga",
  ];

  const results: Record<string, unknown> = {};

  for (const sportKey of sportsToTest) {
    try {
      const oddsRes = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds?apiKey=${apiKey}&bookmakers=pinnacle,onexbet,betclic_fr,winamax_fr,unibet_fr,stake&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso&daysFrom=1`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!oddsRes.ok) {
        results[sportKey] = {
          status: oddsRes.status,
          error: `HTTP ${oddsRes.status}`,
        };
        continue;
      }

      const events = (await oddsRes.json()) as OddsApiEvent[];

      results[sportKey] = {
        eventsCount: events.length,
        events: events.map((e) => ({
          match: `${e.home_team} vs ${e.away_team}`,
          commence_time: e.commence_time,
          bookmakers: e.bookmakers.map((bk) => ({
            key: bk.key,
            title: bk.title,
            markets: bk.markets.map((m) => ({
              key: m.key,
              outcomesCount: m.outcomes.length,
              outcomes: m.outcomes.map((o) => ({
                name: o.name,
                price: o.price,
                point: o.point,
                point_type: typeof o.point,
              })),
            })),
          })),
        })),
      };
    } catch (err) {
      results[sportKey] = {
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  return NextResponse.json({
    ok: true,
    fetched_at: new Date().toISOString(),
    sports: results,
  });
}