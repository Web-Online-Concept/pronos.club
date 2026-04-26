import { NextRequest, NextResponse } from "next/server";
import { buildEnrichedFixturesData } from "@/lib/ai-picks-v2/fixtures-enrichment";
import { findValueBets } from "@/lib/ai-picks-v2/value-bet-engine";
import { findValueBetsScorer } from "@/lib/ai-picks-v2/value-bet-engine-scorer";
import { apiFootball } from "@/lib/ai-picks-v2/apifootball-client";
import {
  persistValueBet,
  persistValueBetScorer,
  persistDossier,
  updatePickDossierStatus,
} from "@/lib/ai-picks-v2/persist-picks";
import { generateDossier } from "@/lib/ai-picks-v2/dossier-generator";
import { aggregateMatchData } from "@/lib/ai-picks-v2/match-aggregator";
import type { ValueBet } from "@/lib/ai-picks-v2/value-bet-engine";
import type { ValueBetScorer } from "@/lib/ai-picks-v2/value-bet-engine-scorer";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";
import type { AggregatedMatchData } from "@/types/apifootball";

export const maxDuration = 300;

const isAuthorized = (req: NextRequest): boolean => {
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secretHeader = req.headers.get("x-admin-secret");
  if (secretHeader === process.env.CRON_SECRET) return true;
  const adminEmail = req.headers.get("x-admin-email");
  if (
    adminEmail &&
    ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"].includes(
      adminEmail.toLowerCase()
    )
  ) {
    return true;
  }
  return false;
};

const generateDossierForPick = async (
  pickId: string,
  candidate: ConsensusCandidate
): Promise<void> => {
  await updatePickDossierStatus(pickId, "generating");

  let matchData: AggregatedMatchData | null = null;
  if (/^\d+$/.test(candidate.fixtureRef)) {
    try {
      matchData = await aggregateMatchData(Number(candidate.fixtureRef), {
        pickId,
      });
    } catch (err) {
      console.warn(
        `[ai-picks-generate] aggregateMatchData failed for ${candidate.fixtureRef}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const dossierResult = await generateDossier({
    pick: candidate,
    matchData,
    pickId,
  });

  if (dossierResult.error || !dossierResult.fullText) {
    await updatePickDossierStatus(pickId, "failed");
    return;
  }

  const apiFootballSnapshot = matchData
    ? {
        completeness: matchData.dataCompleteness,
        fixture_id: matchData.fixtureId,
        league: matchData.fixture.league,
        teams: matchData.fixture.teams,
        home_form: matchData.homeStats?.form ?? null,
        away_form: matchData.awayStats?.form ?? null,
        h2h_count: matchData.h2h?.length ?? 0,
        injuries_count: matchData.injuries?.length ?? 0,
        lineups_count: matchData.lineups?.length ?? 0,
        has_predictions: !!matchData.predictions,
      }
    : null;

  await persistDossier(
    pickId,
    dossierResult.fullText,
    dossierResult.sections,
    apiFootballSnapshot,
    dossierResult.meta.model,
    dossierResult.meta.tokensInput,
    dossierResult.meta.tokensOutput,
    dossierResult.meta.tokensCached,
    dossierResult.meta.costUsd
  );
};


/**
 * Adapter ValueBet -> ConsensusCandidate pour reutiliser
 * generateDossier() qui attend ce format.
 */
const valueBetToConsensusCandidate = (vb: ValueBet): ConsensusCandidate => {
  return {
    key: vb.uniqueKey,
    type: "classic",
    fixtureRef: vb.fixtureId,
    market: vb.marketCode,
    selection: vb.selection,
    league: vb.league,
    eventName: vb.eventName,
    eventDateIso: vb.commenceTime,
    odds: vb.bestSoftOdds,
    bookmaker: vb.bestSoftBookName,
    source: "both",
    confidenceClaude: Math.round(vb.fairProbability * 100),
    confidenceGpt: Math.round(vb.fairProbability * 100),
    confidenceApiFootball: null,
    reasoningClaude: `Value bet detectee : edge +${vb.edgePct.toFixed(2)}% par rapport aux fair odds Pinnacle (${vb.fairOdds.toFixed(3)}). Cote ${vb.bestSoftBookName} a ${vb.bestSoftOdds.toFixed(3)}.`,
    reasoningGpt: null,
    consensusScore: Math.min(100, Math.max(0, Math.round(vb.edgePct * 10))),
    consensusTier: vb.edgePct >= 7 ? "total_agreement" : vb.edgePct >= 5 ? "partial" : "isolated_high",
  };
};


/**
 * Adapter ValueBetScorer -> ConsensusCandidate (type scorer) pour
 * reutiliser generateDossier() qui attend ce format.
 *
 * fixtureRef = string du fixtureId API-Football (numerique), ce qui
 * permet a aggregateMatchData() de l'utiliser pour fetch le contexte.
 */
const valueBetScorerToConsensusCandidate = (
  vb: ValueBetScorer
): ConsensusCandidate => {
  const defenseLabel =
    vb.defenseMultiplier > 1.05
      ? "permissive"
      : vb.defenseMultiplier < 0.95
      ? "solide"
      : "moyenne";

  const reasoning = `Value bet buteur : ${vb.playerName} (${vb.playerTeam}) avec un xG/90 de ${vb.npxG_per_90.toFixed(2)} face a une defense ${defenseLabel} (multiplicateur ${vb.defenseMultiplier.toFixed(2)}). Probabilite mathematique de marquer : ${(vb.fairProbability * 100).toFixed(1)}%, soit cote juste ${vb.fairOdds.toFixed(2)}. Bet365 propose ${vb.bookmakerOdds.toFixed(2)} (edge +${vb.edgePct.toFixed(2)}%).`;

  return {
    key: `scorer-${vb.fixtureId}-${vb.playerName}`,
    type: "scorer",
    fixtureRef: String(vb.fixtureId),
    market: "ANYTIME_GOAL_SCORER",
    selection: vb.playerName,
    league: vb.league,
    eventName: vb.eventName,
    eventDateIso: vb.commenceTime,
    odds: vb.bookmakerOdds,
    bookmaker: vb.bookmakerName,
    player: vb.playerName,
    team: vb.playerTeam,
    source: "both",
    confidenceClaude: Math.round(vb.fairProbability * 100),
    confidenceGpt: Math.round(vb.fairProbability * 100),
    confidenceApiFootball: null,
    reasoningClaude: reasoning,
    reasoningGpt: null,
    consensusScore: Math.min(100, Math.max(0, Math.round(vb.edgePct * 10))),
    consensusTier:
      vb.edgePct >= 10
        ? "total_agreement"
        : vb.edgePct >= 7
        ? "partial"
        : "isolated_high",
  };
};

export async function GET(req: NextRequest) {
  return runGeneration(req);
}

export async function POST(req: NextRequest) {
  return runGeneration(req);
}

const runGeneration = async (req: NextRequest): Promise<NextResponse> => {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  try {
    // ─── ETAPE 1 : Fetch des fixtures (OddsAPI = source unique pour value bet) ───
    const { apiFootballFixtures, oddsApiAllFixtures } =
      await buildEnrichedFixturesData(today);

    if (oddsApiAllFixtures.length === 0) {
      return NextResponse.json({
        ok: true,
        date: today,
        skipped: true,
        reason: "No OddsAPI fixtures available for today",
      });
    }

    // ─── ETAPE 2 : Detection mathematique des value bets classics ───
    const engineResult = findValueBets(oddsApiAllFixtures);
    // Note : meme si engineResult.selected est vide, on continue pour
    // laisser le moteur scorer (etape 4) detecter des picks buteurs.

    // ─── ETAPE 3 : Persistance des picks selectionnes ───
    const persistedPicks: Array<{
      valueBet: ValueBet;
      pickId: string;
      slug: string;
    }> = [];
    const persistErrors: Array<{ candidate: string; error: string }> = [];

    for (const valueBet of engineResult.selected) {
      const result = await persistValueBet({
        valueBet,
        generationBatch: today,
      });
      if (result.success && result.pickId && result.slug) {
        persistedPicks.push({
          valueBet,
          pickId: result.pickId,
          slug: result.slug,
        });
      } else {
        persistErrors.push({
          candidate: `${valueBet.eventName} ${valueBet.selection}`,
          error: result.error ?? "unknown",
        });
      }
    }

    const persistDurationMs = Date.now() - startedAt;

    // ─── ETAPE 4 : Moteur SCORER (buteurs foot) ───
    // On scanne les Big 5 sur 2 jours (aujourd'hui + demain) car beaucoup
    // de matchs de soir+nuit dépassent la fenêtre kickoff > 30min quand
    // le cron tourne le matin/midi.
    const BIG5_LEAGUE_IDS = [39, 140, 78, 135, 61]; // EPL, La Liga, Bundesliga, Serie A, Ligue 1

    const tomorrow = new Date(Date.now() + 86400000)
      .toISOString()
      .slice(0, 10);

    // Aujourd'hui : on a deja apiFootballFixtures depuis buildEnrichedFixturesData
    const apiFootballFixturesToday = apiFootballFixtures.map((f) => ({
      id: f.fixture.id,
      leagueId: f.league.id,
      leagueName: f.league.name,
      homeTeam: f.teams.home.name,
      awayTeam: f.teams.away.name,
      commenceTime: f.fixture.date,
    }));

    // Demain : on fetch directement les Big 5
    const apiFootballFixturesTomorrow: Array<{
      id: number;
      leagueId: number;
      leagueName: string;
      homeTeam: string;
      awayTeam: string;
      commenceTime: string;
    }> = [];

    try {
      const tomorrowFixtures = await apiFootball.getFixturesByDate(
        tomorrow,
        BIG5_LEAGUE_IDS
      );
      for (const f of tomorrowFixtures) {
        apiFootballFixturesTomorrow.push({
          id: f.fixture.id,
          leagueId: f.league.id,
          leagueName: f.league.name,
          homeTeam: f.teams.home.name,
          awayTeam: f.teams.away.name,
          commenceTime: f.fixture.date,
        });
      }
    } catch (err) {
      console.warn(
        "[ai-picks-generate] Failed to fetch tomorrow fixtures:",
        err instanceof Error ? err.message : err
      );
    }

    // Concatene aujourd'hui + demain (dedup par id au cas ou)
    const seenFixtureIds = new Set<number>();
    const apiFootballFixturesForScorer: typeof apiFootballFixturesToday = [];
    for (const f of [
      ...apiFootballFixturesToday,
      ...apiFootballFixturesTomorrow,
    ]) {
      if (seenFixtureIds.has(f.id)) continue;
      seenFixtureIds.add(f.id);
      apiFootballFixturesForScorer.push(f);
    }

    // Anti-doublon "1 pick par match" entre classics (OddsAPI) et
    // scorers (API-Football) : on construit une cle "home|away|date"
    // pour chaque classic foot deja retenu, et on filtre les fixtures
    // scorer dont la cle correspond.
    const classicMatchKeys = new Set<string>();
    for (const vb of engineResult.selected) {
      const dateOnly = vb.commenceTime.slice(0, 10);
      classicMatchKeys.add(
        `${vb.homeTeam.toLowerCase()}|${vb.awayTeam.toLowerCase()}|${dateOnly}`
      );
    }

    const filteredScorerFixtures = apiFootballFixturesForScorer.filter((f) => {
      const dateOnly = f.commenceTime.slice(0, 10);
      const key = `${f.homeTeam.toLowerCase()}|${f.awayTeam.toLowerCase()}|${dateOnly}`;
      return !classicMatchKeys.has(key);
    });

    let scorerStats = null;
    let scorerSelected: ValueBetScorer[] = [];
    const scorerPersisted: Array<{
      valueBetScorer: ValueBetScorer;
      pickId: string;
      slug: string;
    }> = [];
    const scorerErrors: Array<{ candidate: string; error: string }> = [];

    try {
      const scorerResult = await findValueBetsScorer({
        apiFootballFixtures: filteredScorerFixtures,
        fixturesUsedByClassics: new Set(),
      });
      scorerStats = scorerResult.stats;
      scorerSelected = scorerResult.selected;

      for (const vbScorer of scorerSelected) {
        const result = await persistValueBetScorer({
          valueBetScorer: vbScorer,
          generationBatch: today,
        });
        if (result.success && result.pickId && result.slug) {
          scorerPersisted.push({
            valueBetScorer: vbScorer,
            pickId: result.pickId,
            slug: result.slug,
          });
        } else {
          scorerErrors.push({
            candidate: `${vbScorer.eventName} - ${vbScorer.playerName}`,
            error: result.error ?? "unknown",
          });
        }
      }
    } catch (err) {
      console.error(
        "[ai-picks-generate] Scorer engine failed:",
        err instanceof Error ? err.message : err
      );
    }

    // ─── ETAPE 5 : Generation des dossiers en arriere-plan (async) ───
    void (async () => {
      // Dossiers pour les classics
      for (const { valueBet, pickId } of persistedPicks) {
        try {
          const candidate = valueBetToConsensusCandidate(valueBet);
          await generateDossierForPick(pickId, candidate);
        } catch (err) {
          console.error(
            `[ai-picks-generate] Dossier failed for classic pick ${pickId}:`,
            err instanceof Error ? err.message : err
          );
          await updatePickDossierStatus(pickId, "failed");
        }
      }
      // Dossiers pour les scorers
      for (const { valueBetScorer, pickId } of scorerPersisted) {
        try {
          const candidate = valueBetScorerToConsensusCandidate(valueBetScorer);
          await generateDossierForPick(pickId, candidate);
        } catch (err) {
          console.error(
            `[ai-picks-generate] Dossier failed for scorer pick ${pickId}:`,
            err instanceof Error ? err.message : err
          );
          await updatePickDossierStatus(pickId, "failed");
        }
      }
    })();

    return NextResponse.json({
      ok: true,
      date: today,
      durationMs: persistDurationMs,
      strategy: "value_bet_v3",
      apiFootballFixtures: apiFootballFixtures.length,
      oddsApiFixtures: oddsApiAllFixtures.length,
      engine: {
        ...engineResult.stats,
        selected_picks: engineResult.selected.map((vb) => ({
          event: vb.eventName,
          sport: vb.sportTitle,
          selection: vb.selection,
          market: vb.marketCode,
          odds: vb.bestSoftOdds,
          bookmaker: vb.bestSoftBookName,
          fair_odds: parseFloat(vb.fairOdds.toFixed(3)),
          edge_pct: parseFloat(vb.edgePct.toFixed(2)),
        })),
      },
      scorer_engine: {
        stats: scorerStats,
        selected_picks: scorerSelected.map((vb) => ({
          event: vb.eventName,
          player: vb.playerName,
          team: vb.playerTeam,
          odds: vb.bookmakerOdds,
          bookmaker: vb.bookmakerName,
          npxG_per_90: parseFloat(vb.npxG_per_90.toFixed(3)),
          defense_multiplier: parseFloat(vb.defenseMultiplier.toFixed(2)),
          fair_odds: parseFloat(vb.fairOdds.toFixed(2)),
          edge_pct: parseFloat(vb.edgePct.toFixed(2)),
        })),
        persisted_ok: scorerPersisted.length,
        persist_errors: scorerErrors,
      },
      persisted: {
        success: persistedPicks.length,
        errors: persistErrors,
      },
      dossiers_status: "queued_async",
      pickIds: [
        ...persistedPicks.map((p) => p.pickId),
        ...scorerPersisted.map((p) => p.pickId),
      ],
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        date: today,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};