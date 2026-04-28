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

/**
 * Schema PickCandidateClassic version v3 (anti-hallucination).
 *
 * Le LLM ne propose plus de cote ni de bookmaker — c'est l'odds-resolver
 * qui injecte la vraie cote depuis OddsAPI apres validation. Les champs
 * odds et bookmaker sont rendus optionnels pour permettre cette dissociation.
 *
 * Ajout de home_team et away_team (necessaires au resolver pour le matching
 * fuzzy des outcomes h2h).
 */
export const PickCandidateClassicSchema = z.object({
  fixture_id_or_event_id: z.string().min(1),
  data_source: z.enum(DATA_SOURCES),
  sport: z.string().min(1),
  league: z.string().min(1),
  event_name: z.string().min(1),
  event_date_iso: z.string().min(1),
  home_team: z.string().min(1).optional(),
  away_team: z.string().min(1).optional(),
  selection: z.string().min(1),
  market: z.enum(CLASSIC_MARKETS),
  /** Cote optionnelle (le resolver l'injecte apres si LLM ne fournit pas) */
  odds: z.number().min(1.0).max(20.0).optional(),
  /** Bookmaker optionnel (le resolver l'injecte apres) */
  bookmaker: z.string().optional(),
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
  /** Equipes (utiles pour le resolver) */
  homeTeam?: string;
  awayTeam?: string;
  /** Cote (peut etre 0 avant resolution par odds-resolver) */
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