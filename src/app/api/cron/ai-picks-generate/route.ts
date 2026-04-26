import { NextRequest, NextResponse } from "next/server";
import { runConsensus } from "@/lib/ai-picks-v2/consensus";
import { GENERATOR_SYSTEM_PROMPT } from "@/lib/ai-picks-v2/prompts";
import { buildEnrichedFixturesData } from "@/lib/ai-picks-v2/fixtures-enrichment";
import {
  persistConsensusCandidate,
  persistDossier,
  updatePickDossierStatus,
} from "@/lib/ai-picks-v2/persist-picks";
import { generateDossier } from "@/lib/ai-picks-v2/dossier-generator";
import { aggregateMatchData } from "@/lib/ai-picks-v2/match-aggregator";
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
    const { promptUserText, apiFootballFixtures, oddsApiFixtures, oddsApiAllFixtures } =
      await buildEnrichedFixturesData(today);

    if (
      apiFootballFixtures.length === 0 &&
      oddsApiFixtures.length === 0
    ) {
      return NextResponse.json({
        ok: true,
        date: today,
        skipped: true,
        reason: "No fixtures available for today",
      });
    }

    const consensus = await runConsensus({
      systemPrompt: GENERATOR_SYSTEM_PROMPT,
      userPrompt: promptUserText,
    });

    if (consensus.errors.claude && consensus.errors.gpt) {
      return NextResponse.json(
        {
          ok: false,
          date: today,
          error: "Both AI generators failed",
          errors: consensus.errors,
        },
        { status: 500 }
      );
    }

    const allSelected = [
      ...consensus.selectedClassic,
      ...consensus.selectedScorer,
    ];

    const persistedPicks: Array<{
      candidate: ConsensusCandidate;
      pickId: string;
      slug: string;
    }> = [];
    const persistErrors: Array<{ candidate: string; error: string }> = [];
    const rejectedByValidation: Array<{ candidate: string; pickId: string }> = [];

    for (const candidate of allSelected) {
      const result = await persistConsensusCandidate({
        candidate,
        generationBatch: today,
        oddsApiFixtures: oddsApiAllFixtures, // TOUTES les fixtures OddsAPI du jour (avec Tier 1) pour le validator Best Odds + 10%
      });
      if (result.success && result.pickId && result.slug) {
        if (result.rejectedByValidation) {
          // Pick insere mais avec status='rejected_by_validation' (audit admin uniquement)
          rejectedByValidation.push({
            candidate: `${candidate.eventName} ${candidate.selection}`,
            pickId: result.pickId,
          });
        } else {
          persistedPicks.push({
            candidate,
            pickId: result.pickId,
            slug: result.slug,
          });
        }
      } else {
        persistErrors.push({
          candidate: `${candidate.eventName} ${candidate.selection}`,
          error: result.error ?? "unknown",
        });
      }
    }

    const persistDurationMs = Date.now() - startedAt;

    void (async () => {
      for (const { candidate, pickId } of persistedPicks) {
        try {
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
      apiFootballFixtures: apiFootballFixtures.length,
      oddsApiFixtures: oddsApiFixtures.length,
      consensus: {
        selectedClassic: consensus.selectedClassic.length,
        selectedScorer: consensus.selectedScorer.length,
        rejected: consensus.rejected.length,
        passes: consensus.passes,
      },
      persisted: {
        success: persistedPicks.length,
        rejected_by_validation: rejectedByValidation.length,
        rejected_picks: rejectedByValidation,
        errors: persistErrors,
      },
      cost: {
        consensus_usd: consensus.meta.totalCostUsd,
        claude: consensus.meta.claudeMeta,
        gpt: consensus.meta.gptMeta,
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