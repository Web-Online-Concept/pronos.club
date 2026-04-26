/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/admin/apifootball-scorer-debug
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoint de reconnaissance API-Football. Inspecte ce qui est dispo
 * pour un fixture donne, en se concentrant sur 3 questions :
 *
 *  1. Est-ce que le marche "Anytime Goalscorer" est expose ?
 *  2. Quels bookmakers europeens (1xbet, Betclic, Winamax, Unibet)
 *     proposent ce marche ?
 *  3. Est-ce que /predictions/ donne des infos buteurs utiles ?
 *
 * Usage :
 *   GET /api/admin/apifootball-scorer-debug?fixture=1234567
 *
 *   GET /api/admin/apifootball-scorer-debug?date=2026-04-27
 *     → liste les fixtures du jour (Ligue 1 par defaut) pour avoir
 *       un id sous la main si on n'en connait pas.
 *
 * Output : JSON brut + summary humanly-readable.
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";


export const dynamic = "force-dynamic";


const API_BASE = "https://v3.football.api-sports.io";

// Bookmakers que Florent utilise reellement
const TARGET_BOOKMAKERS = [
  "1xbet",
  "1xBet",
  "betclic",
  "Betclic",
  "winamax",
  "Winamax",
  "unibet",
  "Unibet",
  "stake",
  "Stake",
  "pinnacle",
  "Pinnacle",
  "ps3838",
  "PS3838",
  "bet365",
  "Bet365",
];


type ApiResponse = {
  errors?: unknown;
  results?: number;
  response: unknown;
};


async function callApiFootball(
  endpoint: string,
  params: Record<string, string | number>
): Promise<{ ok: boolean; data: ApiResponse | null; error: string | null; status: number }> {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return {
      ok: false,
      data: null,
      error: "API_FOOTBALL_KEY is not set",
      status: 500,
    };
  }

  const url = new URL(`${API_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-apisports-key": apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const json = (await res.json()) as ApiResponse;

    return {
      ok: res.ok,
      data: json,
      error: !res.ok ? `HTTP ${res.status}` : null,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      data: null,
      error: err instanceof Error ? err.message : "fetch failed",
      status: 0,
    };
  }
}


// ─── Parse /odds → grouper par marche pour vue claire ─────────────


type ParsedBet = {
  betId: number;
  betName: string;
  bookmakers: Array<{
    id: number;
    name: string;
    valuesCount: number;
    sampleValues: Array<{ value: string; odd: string }>;
  }>;
};


function parseOddsResponse(rawResponse: unknown): {
  fixtureCount: number;
  bookmakersFound: string[];
  betsFound: ParsedBet[];
  scorerBets: ParsedBet[];
  targetBookmakersOffering: Record<string, string[]>;
} {
  const fixtures = Array.isArray(rawResponse) ? rawResponse : [];
  const betMap = new Map<number, ParsedBet>();
  const allBookmakerNames = new Set<string>();

  for (const fixture of fixtures) {
    const fx = fixture as Record<string, unknown>;
    const bookmakers = Array.isArray(fx.bookmakers) ? fx.bookmakers : [];

    for (const bm of bookmakers) {
      const bookmaker = bm as Record<string, unknown>;
      const bmName = String(bookmaker.name ?? "");
      const bmId = Number(bookmaker.id ?? 0);
      allBookmakerNames.add(bmName);

      const bets = Array.isArray(bookmaker.bets) ? bookmaker.bets : [];

      for (const bet of bets) {
        const b = bet as Record<string, unknown>;
        const betId = Number(b.id ?? 0);
        const betName = String(b.name ?? "");
        const values = Array.isArray(b.values) ? b.values : [];

        if (!betMap.has(betId)) {
          betMap.set(betId, {
            betId,
            betName,
            bookmakers: [],
          });
        }
        const entry = betMap.get(betId)!;
        const existingBm = entry.bookmakers.find((x) => x.id === bmId);
        if (!existingBm) {
          entry.bookmakers.push({
            id: bmId,
            name: bmName,
            valuesCount: values.length,
            sampleValues: (values as Array<Record<string, unknown>>)
              .slice(0, 5)
              .map((v) => ({
                value: String(v.value ?? ""),
                odd: String(v.odd ?? ""),
              })),
          });
        }
      }
    }
  }

  const betsFound = Array.from(betMap.values()).sort((a, b) => a.betId - b.betId);

  // Heuristique : on cherche les bets avec "scorer" ou "goalscorer" dans le nom
  const scorerBets = betsFound.filter((b) => {
    const n = b.betName.toLowerCase();
    return (
      n.includes("scorer") ||
      n.includes("goalscorer") ||
      n.includes("buteur") ||
      n.includes("anytime")
    );
  });

  // Pour chacun des bookmakers cibles, lister les marches qu'ils proposent
  const targetBookmakersOffering: Record<string, string[]> = {};
  for (const bookmaker of TARGET_BOOKMAKERS) {
    const lcTarget = bookmaker.toLowerCase();
    const bets: string[] = [];
    for (const bet of betsFound) {
      const offered = bet.bookmakers.some(
        (bm) => bm.name.toLowerCase() === lcTarget
      );
      if (offered) bets.push(`${bet.betId}: ${bet.betName}`);
    }
    if (bets.length > 0) {
      targetBookmakersOffering[bookmaker] = bets;
    }
  }

  return {
    fixtureCount: fixtures.length,
    bookmakersFound: Array.from(allBookmakerNames).sort(),
    betsFound,
    scorerBets,
    targetBookmakersOffering,
  };
}


// ─── Parse /predictions → look for buteur / top scorer info ──────


function parsePredictionsForScorerHints(rawResponse: unknown): {
  hasResponse: boolean;
  topScorers: Array<{ playerName: string; goals: number; team: string }>;
  comparisonHints: Record<string, unknown>;
} {
  const items = Array.isArray(rawResponse) ? rawResponse : [];
  if (items.length === 0) {
    return { hasResponse: false, topScorers: [], comparisonHints: {} };
  }

  const item = items[0] as Record<string, unknown>;
  const teams = (item.teams ?? {}) as Record<string, unknown>;
  const home = (teams.home ?? {}) as Record<string, unknown>;
  const away = (teams.away ?? {}) as Record<string, unknown>;

  const topScorers: Array<{ playerName: string; goals: number; team: string }> =
    [];

  for (const teamSide of [home, away] as Array<Record<string, unknown>>) {
    const teamName = String((teamSide.team as Record<string, unknown>)?.name ?? "");
    const league = (teamSide.league ?? {}) as Record<string, unknown>;
    const goals = (league.goals ?? {}) as Record<string, unknown>;
    void goals;
    // API-Football's predictions ne renvoie pas directement les top
    // scorers du match, mais retourne des stats globales d'equipe.
    // On expose le bloc "league" raw pour inspection.

    // Si une cle "goals" est presente, on l'expose
    if (teamSide.league) {
      // pas de joueurs, juste stats
    }
    void teamName;
  }

  return {
    hasResponse: true,
    topScorers, // sera vide, on le note pour Florent
    comparisonHints: (item.comparison ?? {}) as Record<string, unknown>,
  };
}


// ─── Endpoint handler ─────────────────────────────────────────────


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fixtureParam = searchParams.get("fixture");
  const dateParam = searchParams.get("date");
  const leagueParam = searchParams.get("league"); // optional
  const seasonParam = searchParams.get("season"); // optional

  // Mode 1 : lister les fixtures du jour pour donner des IDs
  if (!fixtureParam && dateParam) {
    const params: Record<string, string | number> = { date: dateParam };
    if (leagueParam) params.league = leagueParam;
    if (seasonParam) params.season = seasonParam;

    const res = await callApiFootball("/fixtures", params);
    if (!res.ok || !res.data) {
      return NextResponse.json(
        { error: res.error ?? "fetch failed", status: res.status },
        { status: 500 }
      );
    }

    const fixtures = Array.isArray(res.data.response) ? res.data.response : [];
    const summary = fixtures.map((f) => {
      const fx = f as Record<string, unknown>;
      const fixture = (fx.fixture ?? {}) as Record<string, unknown>;
      const teams = (fx.teams ?? {}) as Record<string, unknown>;
      const league = (fx.league ?? {}) as Record<string, unknown>;
      return {
        id: fixture.id,
        date: fixture.date,
        league: league.name,
        country: league.country,
        home: (teams.home as Record<string, unknown>)?.name,
        away: (teams.away as Record<string, unknown>)?.name,
      };
    });

    return NextResponse.json({
      mode: "list_fixtures",
      date: dateParam,
      league: leagueParam ?? "all",
      count: summary.length,
      fixtures: summary,
      hint: "Pick a fixture id and call again with ?fixture=ID",
    });
  }

  // Mode 2 : inspect un fixture
  if (!fixtureParam) {
    return NextResponse.json(
      {
        error: "missing param",
        hint: "Use ?fixture=ID or ?date=YYYY-MM-DD&league=LEAGUE_ID",
        examples: [
          "/api/admin/apifootball-scorer-debug?date=2026-04-27&league=61",
          "/api/admin/apifootball-scorer-debug?fixture=1234567",
        ],
        leagueIds: {
          ligue1: 61,
          premierLeague: 39,
          laLiga: 140,
          serieA: 135,
          bundesliga: 78,
          championsLeague: 2,
        },
      },
      { status: 400 }
    );
  }

  const fixtureId = parseInt(fixtureParam, 10);
  if (Number.isNaN(fixtureId)) {
    return NextResponse.json(
      { error: "invalid fixture id" },
      { status: 400 }
    );
  }

  // Lance les 3 fetchs en parallele
  const [fixtureRes, oddsRes, predictionsRes] = await Promise.all([
    callApiFootball("/fixtures", { id: fixtureId }),
    callApiFootball("/odds", { fixture: fixtureId }),
    callApiFootball("/predictions", { fixture: fixtureId }),
  ]);

  // ─── Fixture metadata ──────────────────────────────────────────
  let fixtureMeta: Record<string, unknown> = {};
  if (fixtureRes.ok && fixtureRes.data) {
    const fxArr = Array.isArray(fixtureRes.data.response)
      ? fixtureRes.data.response
      : [];
    if (fxArr.length > 0) {
      const f = fxArr[0] as Record<string, unknown>;
      const fixture = (f.fixture ?? {}) as Record<string, unknown>;
      const teams = (f.teams ?? {}) as Record<string, unknown>;
      const league = (f.league ?? {}) as Record<string, unknown>;
      fixtureMeta = {
        id: fixture.id,
        date: fixture.date,
        status: (fixture.status as Record<string, unknown>)?.short,
        league: league.name,
        country: league.country,
        season: league.season,
        home: (teams.home as Record<string, unknown>)?.name,
        away: (teams.away as Record<string, unknown>)?.name,
      };
    }
  }

  // ─── Odds analysis ─────────────────────────────────────────────
  const oddsAnalysis = oddsRes.ok && oddsRes.data
    ? parseOddsResponse(oddsRes.data.response)
    : null;

  // ─── Predictions ───────────────────────────────────────────────
  const predictionsAnalysis = predictionsRes.ok && predictionsRes.data
    ? parsePredictionsForScorerHints(predictionsRes.data.response)
    : null;

  // ─── Verdict scorer ────────────────────────────────────────────
  let scorerVerdict: {
    canDoValueBetEngine: boolean;
    reason: string;
    targetBookmakersWithScorer: string[];
  } = {
    canDoValueBetEngine: false,
    reason: "Aucune donnee analysee",
    targetBookmakersWithScorer: [],
  };

  if (oddsAnalysis) {
    if (oddsAnalysis.scorerBets.length === 0) {
      scorerVerdict = {
        canDoValueBetEngine: false,
        reason: `Aucun marche scorer/goalscorer trouve sur ce match. Marches dispos : ${oddsAnalysis.betsFound
          .map((b) => `${b.betId}=${b.betName}`)
          .slice(0, 10)
          .join(" | ")}`,
        targetBookmakersWithScorer: [],
      };
    } else {
      // Check si les bookmakers de Florent proposent le marche scorer
      const targetWithScorer: string[] = [];
      for (const scorerBet of oddsAnalysis.scorerBets) {
        for (const bm of scorerBet.bookmakers) {
          const lcName = bm.name.toLowerCase();
          if (
            TARGET_BOOKMAKERS.some(
              (target) => target.toLowerCase() === lcName
            ) &&
            !targetWithScorer.includes(bm.name)
          ) {
            targetWithScorer.push(bm.name);
          }
        }
      }

      if (targetWithScorer.length > 0) {
        scorerVerdict = {
          canDoValueBetEngine: true,
          reason: `OK : marche scorer trouve (${oddsAnalysis.scorerBets
            .map((b) => b.betName)
            .join(", ")}) chez ${targetWithScorer.length} bookmaker(s) cible(s).`,
          targetBookmakersWithScorer: targetWithScorer,
        };
      } else {
        scorerVerdict = {
          canDoValueBetEngine: false,
          reason: `Marche scorer existe (${oddsAnalysis.scorerBets
            .map((b) => b.betName)
            .join(", ")}) mais AUCUN de tes bookmakers cible (1xbet, Betclic, Winamax, Unibet, Stake) ne le propose. Bookmakers offrant ce marche : ${oddsAnalysis.scorerBets
            .flatMap((b) => b.bookmakers.map((bm) => bm.name))
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .join(", ")}`,
          targetBookmakersWithScorer: [],
        };
      }
    }
  }

  return NextResponse.json({
    mode: "inspect_fixture",
    fixtureId,
    fixtureMeta,
    rawApiCalls: {
      fixture: { ok: fixtureRes.ok, status: fixtureRes.status, error: fixtureRes.error },
      odds: { ok: oddsRes.ok, status: oddsRes.status, error: oddsRes.error },
      predictions: { ok: predictionsRes.ok, status: predictionsRes.status, error: predictionsRes.error },
    },
    scorerVerdict,
    oddsAnalysis: oddsAnalysis
      ? {
          fixtureCountReturned: oddsAnalysis.fixtureCount,
          totalBookmakersFound: oddsAnalysis.bookmakersFound.length,
          allBookmakers: oddsAnalysis.bookmakersFound,
          totalBetsFound: oddsAnalysis.betsFound.length,
          allBetsList: oddsAnalysis.betsFound.map(
            (b) => `${b.betId}: ${b.betName} (${b.bookmakers.length} books)`
          ),
          scorerBetsDetail: oddsAnalysis.scorerBets,
          targetBookmakersOfferingMarkets: oddsAnalysis.targetBookmakersOffering,
        }
      : null,
    predictionsAnalysis,
  });
}