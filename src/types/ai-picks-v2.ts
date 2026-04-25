import { z } from "zod";

export const CLASSIC_MARKETS = [
  "1N2",
  "DOUBLE_CHANCE",
  "OVER_UNDER_1_5",
  "OVER_UNDER_2_5",
  "OVER_UNDER_3_5",
  "BTTS",
] as const;

export type ClassicMarket = (typeof CLASSIC_MARKETS)[number];

export const DATA_SOURCES = ["apifootball", "oddsapi", "espn"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const CONSENSUS_TIERS = [
  "total_agreement",
  "partial",
  "isolated_high",
  "isolated_low",
] as const;

export type ConsensusTier = (typeof CONSENSUS_TIERS)[number];

export const PickCandidateClassicSchema = z.object({
  fixture_id_or_event_id: z.string().min(1),
  data_source: z.enum(DATA_SOURCES),
  sport: z.string().min(1),
  league: z.string().min(1),
  event_name: z.string().min(1),
  event_date_iso: z.string().min(1),
  selection: z.string().min(1),
  market: z.enum(CLASSIC_MARKETS),
  odds: z.number().min(1.5).max(3.0),
  bookmaker: z.string().min(1),
  confidence: z.number().int().min(0).max(100),
  reasoning_short: z.string().min(20).max(800),
});

export type PickCandidateClassic = z.infer<typeof PickCandidateClassicSchema>;

export const PickCandidateScorerSchema = z.object({
  fixture_id_or_event_id: z.string().min(1),
  league: z.string().min(1),
  event_name: z.string().min(1),
  event_date_iso: z.string().min(1),
  player_name: z.string().min(1),
  team: z.string().min(1),
  odds_estimated: z.number().min(1.8).max(4.0),
  confidence: z.number().int().min(0).max(100),
  reasoning_short: z.string().min(20).max(800),
});

export type PickCandidateScorer = z.infer<typeof PickCandidateScorerSchema>;

export const GeneratorOutputSchema = z.object({
  candidates_classic: z.array(PickCandidateClassicSchema).max(10),
  candidates_scorer: z.array(PickCandidateScorerSchema).max(6),
});

export type GeneratorOutput = z.infer<typeof GeneratorOutputSchema>;

export type GeneratorMeta = {
  model: string;
  provider: "anthropic" | "openai";
  tokensInput: number;
  tokensOutput: number;
  tokensCached: number;
  costUsd: number;
  latencyMs: number;
};

export type GeneratorResult = {
  output: GeneratorOutput | null;
  meta: GeneratorMeta;
  rawResponse?: string;
  error?: string;
};

export type ConsensusKey = string;

export type ConsensusCandidate = {
  key: ConsensusKey;
  type: "classic" | "scorer";
  fixtureRef: string;
  market?: string;
  selection: string;
  league: string;
  eventName: string;
  eventDateIso: string;
  odds: number;
  bookmaker?: string;
  player?: string;
  team?: string;
  source: "claude" | "gpt" | "both";
  confidenceClaude: number | null;
  confidenceGpt: number | null;
  confidenceApiFootball: number | null;
  reasoningClaude: string | null;
  reasoningGpt: string | null;
  consensusScore: number;
  consensusTier: ConsensusTier;
  rejectedReason?: string;
};

export type ConsensusOutcome = {
  selectedClassic: ConsensusCandidate[];
  selectedScorer: ConsensusCandidate[];
  rejected: ConsensusCandidate[];
  passes: {
    pass1Threshold: number;
    pass2Threshold: number;
    pass3Threshold: number;
    candidatesAfterDedup: number;
    candidatesAfterPass1: number;
    candidatesAfterPass2: number;
    candidatesAfterPass3: number;
  };
  meta: {
    claudeMeta: GeneratorMeta;
    gptMeta: GeneratorMeta;
    totalCostUsd: number;
    consensusComputedAtIso: string;
  };
};

export const DossierSectionSchema = z.object({
  context_match: z.string().min(50),
  form_analysis: z.string().min(50),
  h2h_analysis: z.string().min(30),
  lineups_and_injuries: z.string().min(30),
  tactical_analysis: z.string().min(50),
  ai_consensus_explanation: z.string().min(50),
  conclusion: z.string().min(30),
});

export type DossierSection = z.infer<typeof DossierSectionSchema>;

export type DossierResult = {
  sections: DossierSection | null;
  fullText: string;
  meta: GeneratorMeta;
  error?: string;
};

export const buildClassicConsensusKey = (
  fixtureRef: string,
  market: string,
  selection: string
): ConsensusKey => `classic|${fixtureRef}|${market}|${selection.toLowerCase().trim()}`;

export const buildScorerConsensusKey = (
  fixtureRef: string,
  player: string
): ConsensusKey => `scorer|${fixtureRef}|${player.toLowerCase().trim()}`;

export const buildMatchKey = (fixtureRef: string): string => `match|${fixtureRef}`;