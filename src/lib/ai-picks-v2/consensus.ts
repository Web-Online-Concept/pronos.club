import {
  buildClassicConsensusKey,
  buildMatchKey,
  type ConsensusCandidate,
  type ConsensusOutcome,
  type ConsensusTier,
  type GeneratorOutput,
  type PickCandidateClassic,
} from "@/types/ai-picks-v2";
import { runClaudeGenerator } from "./anthropic-client";
import { runGptGenerator } from "./openai-client";
import { trackApiCost } from "./cost-tracker";

const PASS1_THRESHOLD = 75;
const PASS2_THRESHOLD = 60;
const PASS3_THRESHOLD = 45;
const MAX_CLASSIC_PICKS = 5;

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

/**
 * v3 : merge des candidates Claude + GPT.
 *
 * Differences vs v2 :
 *   - On IGNORE odds et bookmaker du LLM (ils seront resolus apres
 *     par odds-resolver.ts). On stocke odds=0 et bookmaker=undefined
 *     en attendant la resolution.
 *   - On stocke homeTeam et awayTeam (necessaires au resolver).
 *   - On accepte les picks sans odds dans le payload LLM.
 */
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
      homeTeam: pick.home_team,
      awayTeam: pick.away_team,
      // odds/bookmaker du LLM ignores (v3 anti-hallucination)
      odds: 0,
      bookmaker: undefined,
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
      // Si Claude n'a pas fourni les equipes mais GPT oui, on les recupere
      if (!existing.homeTeam && pick.home_team) existing.homeTeam = pick.home_team;
      if (!existing.awayTeam && pick.away_team) existing.awayTeam = pick.away_team;
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
        homeTeam: pick.home_team,
        awayTeam: pick.away_team,
        odds: 0,
        bookmaker: undefined,
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
  const gptClassic = gptOutput?.candidates_classic ?? [];

  // v3 : on n'utilise plus les buteurs LLM (candidates_scorer ignores).

  const mergedClassic = mergeClassicCandidates(
    claudeClassic,
    gptClassic,
    input.apiFootballPredictionsByFixture
  );

  const dedupClassic = dedupByMatch(mergedClassic);

  const classicSelection = selectInPasses(dedupClassic, MAX_CLASSIC_PICKS);

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
      selectedClassic: classicSelection.selected.length,
      durationMs: Date.now() - startedAt,
    },
  });

  return {
    selectedClassic: classicSelection.selected,
    selectedScorer: [],
    rejected: classicSelection.rejected,
    passes: {
      pass1Threshold: PASS1_THRESHOLD,
      pass2Threshold: PASS2_THRESHOLD,
      pass3Threshold: PASS3_THRESHOLD,
      candidatesAfterDedup: dedupClassic.length,
      candidatesAfterPass1: classicSelection.candidatesAfterPass1,
      candidatesAfterPass2: classicSelection.candidatesAfterPass2,
      candidatesAfterPass3: classicSelection.candidatesAfterPass3,
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