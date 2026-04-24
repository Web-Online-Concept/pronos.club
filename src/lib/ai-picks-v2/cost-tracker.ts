import { supabaseAdmin } from "@/lib/supabase/admin";

export type CostEventType =
  | "generate"
  | "consensus"
  | "analysis"
  | "translation"
  | "apifootball_call";

export type CostProvider = "anthropic" | "openai" | "apifootball";

export type CostTrackerInput = {
  eventType: CostEventType;
  provider: CostProvider;
  model?: string;
  pickId?: string | null;
  tokensInput?: number;
  tokensOutput?: number;
  tokensCached?: number;
  apiCalls?: number;
  costUsd: number;
  metadata?: Record<string, unknown>;
};

export const trackApiCost = async (input: CostTrackerInput): Promise<void> => {
  try {
    const { error } = await supabaseAdmin.from("ai_cost_tracking").insert({
      event_type: input.eventType,
      provider: input.provider,
      model: input.model ?? null,
      pick_id: input.pickId ?? null,
      tokens_input: input.tokensInput ?? 0,
      tokens_output: input.tokensOutput ?? 0,
      tokens_cached: input.tokensCached ?? 0,
      api_calls: input.apiCalls ?? 1,
      cost_usd: input.costUsd,
      metadata: input.metadata ?? null,
    });

    if (error) {
      console.error("[cost-tracker] Failed to insert cost event", error);
    }
  } catch (err) {
    console.error("[cost-tracker] Unexpected error", err);
  }
};

export const APIFOOTBALL_COST_PER_CALL_USD = 19 / 30 / 7500;

export const trackApiFootballCall = async (
  endpoint: string,
  pickId?: string | null
): Promise<void> => {
  await trackApiCost({
    eventType: "apifootball_call",
    provider: "apifootball",
    pickId: pickId ?? null,
    apiCalls: 1,
    costUsd: APIFOOTBALL_COST_PER_CALL_USD,
    metadata: { endpoint },
  });
};

export type CostSummary = {
  totalUsd: number;
  byProvider: Record<CostProvider, number>;
  byEventType: Record<CostEventType, number>;
  callCount: number;
};

export const getCostSummary = async (
  fromIso: string,
  toIso: string
): Promise<CostSummary> => {
  const { data, error } = await supabaseAdmin
    .from("ai_cost_tracking")
    .select("event_type, provider, cost_usd, api_calls")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  if (error || !data) {
    return {
      totalUsd: 0,
      byProvider: { anthropic: 0, openai: 0, apifootball: 0 },
      byEventType: {
        generate: 0,
        consensus: 0,
        analysis: 0,
        translation: 0,
        apifootball_call: 0,
      },
      callCount: 0,
    };
  }

  const summary: CostSummary = {
    totalUsd: 0,
    byProvider: { anthropic: 0, openai: 0, apifootball: 0 },
    byEventType: {
      generate: 0,
      consensus: 0,
      analysis: 0,
      translation: 0,
      apifootball_call: 0,
    },
    callCount: 0,
  };

  for (const row of data) {
    const cost = Number(row.cost_usd) || 0;
    const calls = Number(row.api_calls) || 0;
    summary.totalUsd += cost;
    summary.byProvider[row.provider as CostProvider] += cost;
    summary.byEventType[row.event_type as CostEventType] += cost;
    summary.callCount += calls;
  }

  return summary;
};