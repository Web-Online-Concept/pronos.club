import {
  buildClassicConsensusKey,
  buildMatchKey,
  buildScorerConsensusKey,
  type ConsensusCandidate,
  type ConsensusOutcome,
  type ConsensusTier,
  type GeneratorMeta,
  type GeneratorOutput,
  type PickCandidateClassic,
  type PickCandidateScorer,
} from "@/types/ai-picks-v2";
import { runClaudeGenerator } from "./anthropic-client";
import { runGptGenerator } from "./openai-client";
import { trackApiCost } from "./cost-tracker";

const PASS1_THRESHOLD = 75;
const PASS2_THRESHOLD = 60;
const PASS3_THRESHOLD = 45;
const MAX_CLASSIC_PICKS = 5;
const MAX_SCORER_PICKS = 3;

const TOTAL_AGREEMENT_BONUS = 15;
const PARTIAL_AGREEMENT_MALUS = 15;
const ISOLATED_HIGH_MALUS = 10;
const ISOLATED_LOW_MALUS = 25;

export type RunConsensusInput = {
  systemPrompt: string;
  userPrompt: string;
  apiFootballPredictionsByFixture?: Record<
    string,
    {
      winnerId: number | null;
      winnerName: string | null;
      percentHome: number;
      percentDraw: number;
      percentAway: number;
      advice: string | null;
    }
  >;
};

export type RunConsensusResult = ConsensusOutcome & {
  errors: {
    claude?: string;
    gpt?: string;
  };
  rawOutputs: {
    claude: GeneratorOutput | null;
    gpt: GeneratorOutput | null;
  };
};

const computeConsensusScoreClassic = (
  candidate: ConsensusCandidate,
  apiFootballPercent: number | null
): { score: number; tier: ConsensusTier } => {
  const cClaude = candidate.confidenceClaude;
  const cGpt = candidate.confidenceGpt;

  if (cClaude !== null && cGpt !== null) {
    const avg = Math.round((cClaude + cGpt) / 2);
    const score = Math.min(100, avg + TOTAL_AGREEMENT_BONUS);
    return { score, tier: "total_agreement" };
  }

  const solo = cClaude ?? cGpt ?? 0;

  if (apiFootballPercent !== null && apiFootballPercent >= 50) {
    const adjusted = Math.max(0, solo - PARTIAL_AGREEMENT_MALUS);
    return { score: adjusted, tier: "partial" };
  }

  if (solo >= 80) {
    const adjusted = Math.max(0, solo - ISOLATED_HIGH_MALUS);
    return { score: adjusted, tier: "isolated_high" };
  }

  const adjusted = Math.max(0, solo - ISOLATED_LOW_MALUS);
  return { score: adjusted, tier: "isolated_low" };
};

const computeConsensusScoreScorer = (
  candidate: ConsensusCandidate
): { score: number; tier: ConsensusTier } => {
  const cClaude = candidate.confidenceClaude;
  const cGpt = candidate.confidenceGpt;

  if (cClaude !== null && cGpt !== null) {
    const avg = Math.round((cClaude + cGpt) / 2);
    const score = Math.min(100, avg + TOTAL_AGREEMENT_BONUS);
    return { score, tier: "total_agreement" };
  }

  const solo = cClaude ?? cGpt ?? 0;

  if (solo >= 80) {
    const adjusted = Math.max(0, solo - ISOLATED_HIGH_MALUS);
    return { score: adjusted, tier: "isolated_high" };
  }

  const adjusted = Math.max(0, solo - ISOLATED_LOW_MALUS);
  return { score: adjusted, tier: "isolated_low" };
};

const mergeClassicCandidates = (
  claudePicks: PickCandidateClassic[],
  gptPicks: PickCandidateClassic[],
  apiFootballPredictions: RunConsensusInput["apiFootballPredictionsByFixture"]
): ConsensusCandidate[] => {
  const map = new Map<string, ConsensusCandidate>();

  for (const pick of claudePicks) {
    const key = buildClassicConsensusKey(
      pick.fixture_id_or_event_id,
      pick.market,
      pick.selection
    );
    map.set(key, {
      key,
      type: "classic",
      fixtureRef: pick.fixture_id_or_event_id,
      market: pick.market,
      selection: pick.selection,
      league: pick.league,
      eventName: pick.event_name,
      eventDateIso: pick.event_date_iso,
      odds: pick.odds,
      bookmaker: pick.bookmaker,
      source: "claude",
      confidenceClaude: pick.confidence,
      confidenceGpt: null,
      confidenceApiFootball: null,
      reasoningClaude: pick.reasoning_short,
      reasoningGpt: null,
      consensusScore: 0,
      consensusTier: "isolated_low",
    });
  }

  for (const pick of gptPicks) {
    const key = buildClassicConsensusKey(
      pick.fixture_id_or_event_id,
      pick.market,
      pick.selection
    );
    const existing = map.get(key);
    if (existing) {
      existing.confidenceGpt = pick.confidence;
      existing.reasoningGpt = pick.reasoning_short;
      existing.source = "both";
      if (!existing.bookmaker) existing.bookmaker = pick.bookmaker;
    } else {
      map.set(key, {
        key,
        type: "classic",
        fixtureRef: pick.fixture_id_or_event_id,
        market: pick.market,
        selection: pick.selection,
        league: pick.league,
        eventName: pick.event_name,
        eventDateIso: pick.event_date_iso,
        odds: pick.odds,
        bookmaker: pick.bookmaker,
        source: "gpt",
        confidenceClaude: null,
        confidenceGpt: pick.confidence,
        confidenceApiFootball: null,
        reasoningClaude: null,
        reasoningGpt: pick.reasoning_short,
        consensusScore: 0,
        consensusTier: "isolated_low",
      });
    }
  }

  for (const candidate of map.values()) {
    const apiPred = apiFootballPredictions?.[candidate.fixtureRef];
    let apiPercent: number | null = null;
    if (apiPred && candidate.market === "1N2") {
      const sel = candidate.selection.toLowerCase();
      const eventLower = candidate.eventName.toLowerCase();
      const homeTeam = eventLower.split(" vs ")[0]?.trim();
      const awayTeam = eventLower.split(" vs ")[1]?.trim();
      if (homeTeam && sel.includes(homeTeam)) apiPercent = apiPred.percentHome;
      else if (awayTeam && sel.includes(awayTeam))
        apiPercent = apiPred.percentAway;
      else if (sel.includes("nul") || sel.includes("draw"))
        apiPercent = apiPred.percentDraw;
      candidate.confidenceApiFootball = apiPercent;
    }

    const { score, tier } = computeConsensusScoreClassic(candidate, apiPercent);
    candidate.consensusScore = score;
    candidate.consensusTier = tier;
  }

  return Array.from(map.values());
};

const mergeScorerCandidates = (
  claudePicks: PickCandidateScorer[],
  gptPicks: PickCandidateScorer[]
): ConsensusCandidate[] => {
  const map = new Map<string, ConsensusCandidate>();

  for (const pick of claudePicks) {
    const key = buildScorerConsensusKey(
      pick.fixture_id_or_event_id,
      pick.player_name
    );
    map.set(key, {
      key,
      type: "scorer",
      fixtureRef: pick.fixture_id_or_event_id,
      selection: pick.player_name,
      league: pick.league,
      eventName: pick.event_name,
      eventDateIso: pick.event_date_iso,
      odds: pick.odds_estimated,
      player: pick.player_name,
      team: pick.team,
      source: "claude",
      confidenceClaude: pick.confidence,
      confidenceGpt: null,
      confidenceApiFootball: null,
      reasoningClaude: pick.reasoning_short,
      reasoningGpt: null,
      consensusScore: 0,
      consensusTier: "isolated_low",
    });
  }

  for (const pick of gptPicks) {
    const key = buildScorerConsensusKey(
      pick.fixture_id_or_event_id,
      pick.player_name
    );
    const existing = map.get(key);
    if (existing) {
      existing.confidenceGpt = pick.confidence;
      existing.reasoningGpt = pick.reasoning_short;
      existing.source = "both";
    } else {
      map.set(key, {
        key,
        type: "scorer",
        fixtureRef: pick.fixture_id_or_event_id,
        selection: pick.player_name,
        league: pick.league,
        eventName: pick.event_name,
        eventDateIso: pick.event_date_iso,
        odds: pick.odds_estimated,
        player: pick.player_name,
        team: pick.team,
        source: "gpt",
        confidenceClaude: null,
        confidenceGpt: pick.confidence,
        confidenceApiFootball: null,
        reasoningClaude: null,
        reasoningGpt: pick.reasoning_short,
        consensusScore: 0,
        consensusTier: "isolated_low",
      });
    }
  }

  for (const candidate of map.values()) {
    const { score, tier } = computeConsensusScoreScorer(candidate);
    candidate.consensusScore = score;
    candidate.consensusTier = tier;
  }

  return Array.from(map.values());
};

const dedupByMatch = (candidates: ConsensusCandidate[]): ConsensusCandidate[] => {
  const byMatch = new Map<string, ConsensusCandidate>();
  for (const c of candidates) {
    const matchKey = buildMatchKey(c.fixtureRef);
    const current = byMatch.get(matchKey);
    if (!current || c.consensusScore > current.consensusScore) {
      byMatch.set(matchKey, c);
    }
  }
  return Array.from(byMatch.values());
};

const selectInPasses = (
  candidates: ConsensusCandidate[],
  maxCount: number
): {
  selected: ConsensusCandidate[];
  rejected: ConsensusCandidate[];
  candidatesAfterPass1: number;
  candidatesAfterPass2: number;
  candidatesAfterPass3: number;
} => {
  const sorted = [...candidates].sort(
    (a, b) => b.consensusScore - a.consensusScore
  );

  const pass1 = sorted.filter((c) => c.consensusScore >= PASS1_THRESHOLD);
  const pass2 = sorted.filter(
    (c) =>
      c.consensusScore >= PASS2_THRESHOLD && c.consensusScore < PASS1_THRESHOLD
  );
  const pass3 = sorted.filter(
    (c) =>
      c.consensusScore >= PASS3_THRESHOLD && c.consensusScore < PASS2_THRESHOLD
  );

  const selected: ConsensusCandidate[] = [];
  for (const c of pass1) {
    if (selected.length >= maxCount) break;
    selected.push(c);
  }
  for (const c of pass2) {
    if (selected.length >= maxCount) break;
    selected.push(c);
  }
  for (const c of pass3) {
    if (selected.length >= maxCount) break;
    selected.push(c);
  }

  const selectedKeys = new Set(selected.map((s) => s.key));
  const rejected = sorted
    .filter((c) => !selectedKeys.has(c.key))
    .map((c) => ({
      ...c,
      rejectedReason:
        c.consensusScore < PASS3_THRESHOLD
          ? "Score under minimum threshold"
          : "Selected limit reached",
    }));

  return {
    selected,
    rejected,
    candidatesAfterPass1: pass1.length,
    candidatesAfterPass2: pass2.length,
    candidatesAfterPass3: pass3.length,
  };
};

export const runConsensus = async (
  input: RunConsensusInput
): Promise<RunConsensusResult> => {
  const startedAt = Date.now();

  const [claudeResult, gptResult] = await Promise.all([
    runClaudeGenerator({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    }),
    runGptGenerator({
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
    }),
  ]);

  const claudeOutput = claudeResult.output;
  const gptOutput = gptResult.output;

  const claudeClassic = claudeOutput?.candidates_classic ?? [];
  const claudeScorer = claudeOutput?.candidates_scorer ?? [];
  const gptClassic = gptOutput?.candidates_classic ?? [];
  const gptScorer = gptOutput?.candidates_scorer ?? [];

  const mergedClassic = mergeClassicCandidates(
    claudeClassic,
    gptClassic,
    input.apiFootballPredictionsByFixture
  );
  const mergedScorer = mergeScorerCandidates(claudeScorer, gptScorer);

  const dedupClassic = dedupByMatch(mergedClassic);
  const dedupScorer = dedupByMatch(mergedScorer);

  const classicSelection = selectInPasses(dedupClassic, MAX_CLASSIC_PICKS);
  const scorerSelection = selectInPasses(dedupScorer, MAX_SCORER_PICKS);

  const allSelectedMatchRefs = new Set<string>();
  for (const s of classicSelection.selected) {
    allSelectedMatchRefs.add(s.fixtureRef);
  }
  const scorerSelectedFinal: ConsensusCandidate[] = [];
  const scorerRejectedExtra: ConsensusCandidate[] = [];
  for (const candidate of scorerSelection.selected) {
    if (allSelectedMatchRefs.has(candidate.fixtureRef)) {
      scorerRejectedExtra.push({
        ...candidate,
        rejectedReason: "Match already has a classic pick selected",
      });
    } else {
      scorerSelectedFinal.push(candidate);
      allSelectedMatchRefs.add(candidate.fixtureRef);
    }
  }

  const totalCostUsd =
    claudeResult.meta.costUsd + gptResult.meta.costUsd;

  await trackApiCost({
    eventType: "consensus",
    provider: "anthropic",
    model: "consensus-orchestrator",
    apiCalls: 0,
    costUsd: 0,
    metadata: {
      claudeTokens: claudeResult.meta.tokensInput + claudeResult.meta.tokensOutput,
      gptTokens: gptResult.meta.tokensInput + gptResult.meta.tokensOutput,
      candidatesClassic: dedupClassic.length,
      candidatesScorer: dedupScorer.length,
      selectedClassic: classicSelection.selected.length,
      selectedScorer: scorerSelectedFinal.length,
      durationMs: Date.now() - startedAt,
    },
  });

  return {
    selectedClassic: classicSelection.selected,
    selectedScorer: scorerSelectedFinal,
    rejected: [
      ...classicSelection.rejected,
      ...scorerSelection.rejected,
      ...scorerRejectedExtra,
    ],
    passes: {
      pass1Threshold: PASS1_THRESHOLD,
      pass2Threshold: PASS2_THRESHOLD,
      pass3Threshold: PASS3_THRESHOLD,
      candidatesAfterDedup: dedupClassic.length + dedupScorer.length,
      candidatesAfterPass1:
        classicSelection.candidatesAfterPass1 +
        scorerSelection.candidatesAfterPass1,
      candidatesAfterPass2:
        classicSelection.candidatesAfterPass2 +
        scorerSelection.candidatesAfterPass2,
      candidatesAfterPass3:
        classicSelection.candidatesAfterPass3 +
        scorerSelection.candidatesAfterPass3,
    },
    meta: {
      claudeMeta: claudeResult.meta,
      gptMeta: gptResult.meta,
      totalCostUsd,
      consensusComputedAtIso: new Date().toISOString(),
    },
    errors: {
      claude: claudeResult.error,
      gpt: gptResult.error,
    },
    rawOutputs: {
      claude: claudeOutput,
      gpt: gptOutput,
    },
  };
};