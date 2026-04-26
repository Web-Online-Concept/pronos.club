import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";


export async function GET(_req: NextRequest) {
  // Auth admin via session (cookie) - meme pattern que les pages admin
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ODDS_API_KEY;

  // 1) Verification cle
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      step: "missing_env",
      message: "ODDS_API_KEY n'est PAS definie dans les env vars Vercel",
    });
  }

  const keyInfo = {
    length: apiKey.length,
    prefix: apiKey.substring(0, 6) + "...",
    suffix: "..." + apiKey.substring(apiKey.length - 4),
  };

  // 2) Test simple : endpoint /sports
  let sportsTest: {
    status: number;
    requestsRemaining: string | null;
    requestsUsed: string | null;
    sportsCount: number;
    activeSoccerLeagues: number;
    error?: string;
  };

  try {
    const sportsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}&all=false`,
      { signal: AbortSignal.timeout(15000) }
    );

    const requestsRemaining = sportsRes.headers.get("x-requests-remaining");
    const requestsUsed = sportsRes.headers.get("x-requests-used");

    if (!sportsRes.ok) {
      sportsTest = {
        status: sportsRes.status,
        requestsRemaining,
        requestsUsed,
        sportsCount: 0,
        activeSoccerLeagues: 0,
        error: `HTTP ${sportsRes.status}: ${sportsRes.statusText}`,
      };
    } else {
      const sportsList = (await sportsRes.json()) as Array<{
        key: string;
        active: boolean;
        has_outrights: boolean;
        group: string;
      }>;
      const activeSoccerLeagues = sportsList.filter(
        (s) => s.group === "Soccer" && s.active && !s.has_outrights
      ).length;

      sportsTest = {
        status: sportsRes.status,
        requestsRemaining,
        requestsUsed,
        sportsCount: sportsList.length,
        activeSoccerLeagues,
      };
    }
  } catch (err) {
    sportsTest = {
      status: 0,
      requestsRemaining: null,
      requestsUsed: null,
      sportsCount: 0,
      activeSoccerLeagues: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  // 3) Test reel : recuperer les odds Bundesliga du jour
  let oddsTest: {
    status: number;
    eventsCount: number;
    eventsWithBookmakers: number;
    sample: unknown;
    error?: string;
  };

  try {
    const oddsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/soccer_germany_bundesliga/odds?apiKey=${apiKey}&bookmakers=pinnacle,onexbet,betclic_fr,winamax_fr,unibet_fr,stake&markets=h2h,totals&oddsFormat=decimal&dateFormat=iso&daysFrom=1`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!oddsRes.ok) {
      oddsTest = {
        status: oddsRes.status,
        eventsCount: 0,
        eventsWithBookmakers: 0,
        sample: null,
        error: `HTTP ${oddsRes.status}: ${oddsRes.statusText}`,
      };
    } else {
      const events = (await oddsRes.json()) as Array<{
        id: string;
        home_team: string;
        away_team: string;
        commence_time: string;
        bookmakers: Array<{ key: string; title: string }>;
      }>;
      const withBooks = events.filter((e) => e.bookmakers.length > 0);

      oddsTest = {
        status: oddsRes.status,
        eventsCount: events.length,
        eventsWithBookmakers: withBooks.length,
        sample: events.slice(0, 3).map((e) => ({
          match: `${e.home_team} vs ${e.away_team}`,
          date: e.commence_time,
          bookmakersCount: e.bookmakers.length,
          bookmakers: e.bookmakers.map((b) => b.key),
        })),
      };
    }
  } catch (err) {
    oddsTest = {
      status: 0,
      eventsCount: 0,
      eventsWithBookmakers: 0,
      sample: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  // 4) Diagnostic global
  let diagnosis: string;
  if (sportsTest.status === 401) {
    diagnosis = "❌ CLE INVALIDE — La cle ODDS_API_KEY est rejetee par OddsAPI (401 Unauthorized).";
  } else if (sportsTest.status === 429) {
    diagnosis = "❌ QUOTA EPUISE — Le quota mensuel de la cle est atteint (429 Too Many Requests). Il faut soit attendre le prochain renouvellement, soit upgrader le plan.";
  } else if (sportsTest.status !== 200) {
    diagnosis = `❌ ERREUR API — Status ${sportsTest.status}. Erreur: ${sportsTest.error ?? "inconnue"}.`;
  } else if (oddsTest.status !== 200) {
    diagnosis = `⚠️ Sports OK mais Odds KO — Status ${oddsTest.status}. Erreur: ${oddsTest.error ?? "inconnue"}.`;
  } else if (oddsTest.eventsCount === 0) {
    diagnosis = "⚠️ Cle valide mais 0 matches Bundesliga remontes. Possible : pas de matches dans les prochaines 24h, ou les 6 bookmakers Tipster ne couvrent pas ces matches.";
  } else if (oddsTest.eventsWithBookmakers === 0) {
    diagnosis = "⚠️ Matches trouves mais aucun de tes 6 bookmakers Tipster ne les couvre. Anomalie a investiguer.";
  } else {
    diagnosis = `✅ TOUT OK — Cle valide, ${oddsTest.eventsWithBookmakers} matches Bundesliga avec cotes des 6 books.`;
  }

  return NextResponse.json({
    ok: true,
    diagnosis,
    keyInfo,
    sportsTest,
    oddsTest,
  });
}