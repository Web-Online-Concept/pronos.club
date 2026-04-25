import { NextRequest, NextResponse } from "next/server";
import { runConsensus } from "@/lib/ai-picks-v2/consensus";
import { GENERATOR_SYSTEM_PROMPT } from "@/lib/ai-picks-v2/prompts";
import { generateDossier } from "@/lib/ai-picks-v2/dossier-generator";
import { aggregateMatchData } from "@/lib/ai-picks-v2/match-aggregator";
import { buildEnrichedFixturesData } from "@/lib/ai-picks-v2/fixtures-enrichment";
import { runClaudeGenerator } from "@/lib/ai-picks-v2/anthropic-client";
import { runGptGenerator } from "@/lib/ai-picks-v2/openai-client";

export const maxDuration = 300;

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
  const mode = url.searchParams.get("mode") ?? "consensus";
  const fixtureParam = url.searchParams.get("fixture");
  const dateParam =
    url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  try {
    if (mode === "raw-claude") {
      const { promptUserText, apiFootballFixtures, oddsApiFixtures } =
        await buildEnrichedFixturesData(dateParam);
      const result = await runClaudeGenerator({
        systemPrompt: GENERATOR_SYSTEM_PROMPT,
        userPrompt: promptUserText,
      });
      return NextResponse.json({
        ok: true,
        mode,
        apiFootballFixturesCount: apiFootballFixtures.length,
        oddsApiFixturesCount: oddsApiFixtures.length,
        userPromptLength: promptUserText.length,
        meta: result.meta,
        error: result.error,
        rawResponse: result.rawResponse,
        output: result.output,
      });
    }

    if (mode === "raw-gpt") {
      const { promptUserText, apiFootballFixtures, oddsApiFixtures } =
        await buildEnrichedFixturesData(dateParam);
      const result = await runGptGenerator({
        systemPrompt: GENERATOR_SYSTEM_PROMPT,
        userPrompt: promptUserText,
      });
      return NextResponse.json({
        ok: true,
        mode,
        apiFootballFixturesCount: apiFootballFixtures.length,
        oddsApiFixturesCount: oddsApiFixtures.length,
        userPromptLength: promptUserText.length,
        meta: result.meta,
        error: result.error,
        rawResponse: result.rawResponse,
        output: result.output,
      });
    }

    if (mode === "consensus") {
      const startedAt = Date.now();
      const { promptUserText, apiFootballFixtures, oddsApiFixtures } =
        await buildEnrichedFixturesData(dateParam);

      const consensus = await runConsensus({
        systemPrompt: GENERATOR_SYSTEM_PROMPT,
        userPrompt: promptUserText,
      });

      const totalDurationMs = Date.now() - startedAt;

      return NextResponse.json({
        ok: true,
        mode,
        date: dateParam,
        apiFootballFixturesCount: apiFootballFixtures.length,
        oddsApiFixturesCount: oddsApiFixtures.length,
        userPromptLength: promptUserText.length,
        totalDurationMs,
        selectedClassicCount: consensus.selectedClassic.length,
        selectedScorerCount: consensus.selectedScorer.length,
        rejectedCount: consensus.rejected.length,
        passes: consensus.passes,
        meta: consensus.meta,
        errors: consensus.errors,
        rawClaudeOutputSummary: {
          classicCount: consensus.rawOutputs.claude?.candidates_classic.length ?? 0,
          scorerCount: consensus.rawOutputs.claude?.candidates_scorer.length ?? 0,
        },
        rawGptOutputSummary: {
          classicCount: consensus.rawOutputs.gpt?.candidates_classic.length ?? 0,
          scorerCount: consensus.rawOutputs.gpt?.candidates_scorer.length ?? 0,
        },
        selectedClassic: consensus.selectedClassic.map((c) => ({
          fixtureRef: c.fixtureRef,
          eventName: c.eventName,
          league: c.league,
          market: c.market,
          selection: c.selection,
          odds: c.odds,
          consensusScore: c.consensusScore,
          consensusTier: c.consensusTier,
          source: c.source,
          confidenceClaude: c.confidenceClaude,
          confidenceGpt: c.confidenceGpt,
          confidenceApiFootball: c.confidenceApiFootball,
          reasoningClaude: c.reasoningClaude,
          reasoningGpt: c.reasoningGpt,
        })),
        selectedScorer: consensus.selectedScorer.map((c) => ({
          fixtureRef: c.fixtureRef,
          eventName: c.eventName,
          league: c.league,
          player: c.player,
          team: c.team,
          odds: c.odds,
          consensusScore: c.consensusScore,
          consensusTier: c.consensusTier,
          source: c.source,
          confidenceClaude: c.confidenceClaude,
          confidenceGpt: c.confidenceGpt,
          reasoningClaude: c.reasoningClaude,
          reasoningGpt: c.reasoningGpt,
        })),
      });
    }

    if (mode === "dossier") {
      if (!fixtureParam) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Missing 'fixture' query param. Usage: ?mode=dossier&fixture=1391131",
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

      const aggregated = await aggregateMatchData(fixtureId);

      const fakeCandidate = {
        key: `classic|${fixtureId}|1N2|${aggregated.fixture.teams.home.name}`,
        type: "classic" as const,
        fixtureRef: String(fixtureId),
        market: "1N2",
        selection: aggregated.fixture.teams.home.name,
        league: aggregated.fixture.league.name,
        eventName: `${aggregated.fixture.teams.home.name} vs ${aggregated.fixture.teams.away.name}`,
        eventDateIso: aggregated.fixture.fixture.date,
        odds: 1.85,
        bookmaker: "Pinnacle",
        source: "both" as const,
        confidenceClaude: 78,
        confidenceGpt: 75,
        confidenceApiFootball: 60,
        reasoningClaude:
          "Test reasoning Claude pour validation du pipeline dossier.",
        reasoningGpt:
          "Test reasoning GPT pour validation du pipeline dossier.",
        consensusScore: 91,
        consensusTier: "total_agreement" as const,
      };

      const dossier = await generateDossier({
        pick: fakeCandidate,
        matchData: aggregated,
      });

      return NextResponse.json({
        ok: true,
        mode,
        fixtureId,
        dataCompleteness: aggregated.dataCompleteness,
        dossierMeta: dossier.meta,
        dossierSections: dossier.sections,
        dossierError: dossier.error,
        rawDossierFirst500: dossier.fullText.slice(0, 500),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Unknown mode '${mode}'. Valid: consensus | dossier | raw-claude | raw-gpt`,
      },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}