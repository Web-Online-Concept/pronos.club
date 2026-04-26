import { NextRequest, NextResponse } from "next/server";
import { buildEnrichedFixturesData } from "@/lib/ai-picks-v2/fixtures-enrichment";
import { findValueBets } from "@/lib/ai-picks-v2/value-bet-engine";
import {
  persistValueBet,
  persistDossier,
  updatePickDossierStatus,
} from "@/lib/ai-picks-v2/persist-picks";
import { generateDossier } from "@/lib/ai-picks-v2/dossier-generator";
import { aggregateMatchData } from "@/lib/ai-picks-v2/match-aggregator";
import type { ValueBet } from "@/lib/ai-picks-v2/value-bet-engine";
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
    consensusScore: Math.round(vb.edgePct * 10),
    consensusTier: vb.edgePct >= 7 ? "strong" : vb.edgePct >= 5 ? "moderate" : "isolated_high",
  };
};
    dossierResult.meta.tokensOutput,
    dossierResult.meta.tokensCached,
    dossierResult.meta.costUsd
  );
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

    // ─── ETAPE 2 : Detection mathematique des value bets ───
    const engineResult = findValueBets(oddsApiAllFixtures);

    if (engineResult.selected.length === 0) {
      const persistDurationMs = Date.now() - startedAt;
      return NextResponse.json({
        ok: true,
        date: today,
        durationMs: persistDurationMs,
        skipped: true,
        reason: "No value bets found matching criteria (edge >= 3%, odds 1.5-3.0)",
        stats: engineResult.stats,
        oddsApiFixtures: oddsApiAllFixtures.length,
        apiFootballFixtures: apiFootballFixtures.length,
      });
    }

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

    // ─── ETAPE 4 : Generation des dossiers en arriere-plan (async) ───
    void (async () => {
      for (const { valueBet, pickId } of persistedPicks) {
        try {
          const candidate = valueBetToConsensusCandidate(valueBet);
          await generateDossierForPick(pickId, candidate);
        } catch (err) {
          console.error(
            `[ai-picks-generate] Dossier failed for pick ${pickId}:`,
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
      persisted: {
        success: persistedPicks.length,
        errors: persistErrors,
      },
      dossiers_status: "queued_async",
      pickIds: persistedPicks.map((p) => p.pickId),
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