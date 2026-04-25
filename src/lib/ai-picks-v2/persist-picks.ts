import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildMatchSlug,
  buildScorerSlug,
} from "./slug-generator";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";

export type PersistInput = {
  candidate: ConsensusCandidate;
  generationBatch: string;
};

export type PersistResult = {
  success: boolean;
  pickId?: string;
  slug?: string;
  error?: string;
};

const SLUG_MAX_RETRIES = 5;

const generateUniqueSlug = async (
  baseSlug: string
): Promise<string> => {
  let candidate = baseSlug;
  for (let attempt = 0; attempt < SLUG_MAX_RETRIES; attempt++) {
    const { data } = await supabaseAdmin
      .from("ai_picks")
      .select("id")
      .eq("slug", candidate)
      .eq("generation_version", "v2")
      .maybeSingle();

    if (!data) return candidate;

    candidate = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
  }
  return `${baseSlug}-${Date.now().toString(36)}`;
};

const extractTeamsFromEventName = (
  eventName: string
): { home: string; away: string } => {
  const sep = eventName.includes(" vs ") ? " vs " : " - ";
  const parts = eventName.split(sep);
  return {
    home: parts[0]?.trim() ?? eventName,
    away: parts[1]?.trim() ?? "",
  };
};

const buildSlugForCandidate = (candidate: ConsensusCandidate): string => {
  const { home, away } = extractTeamsFromEventName(candidate.eventName);
  if (candidate.type === "scorer") {
    return buildScorerSlug({
      playerName: candidate.player ?? candidate.selection,
      homeTeam: home,
      awayTeam: away,
      eventDate: candidate.eventDateIso,
    });
  }
  return buildMatchSlug({
    homeTeam: home,
    awayTeam: away,
    league: candidate.league,
    eventDate: candidate.eventDateIso,
  });
};

const inferSportFromCandidate = (candidate: ConsensusCandidate): string => {
  if (candidate.type === "scorer") return "soccer";
  const leagueLower = candidate.league.toLowerCase();
  if (leagueLower.includes("nba") || leagueLower.includes("basketball"))
    return "basketball";
  if (leagueLower.includes("nfl") || leagueLower.includes("nca football"))
    return "americanfootball";
  if (leagueLower.includes("nhl") || leagueLower.includes("hockey"))
    return "hockey";
  if (leagueLower.includes("mlb") || leagueLower.includes("baseball"))
    return "baseball";
  if (
    leagueLower.includes("atp") ||
    leagueLower.includes("wta") ||
    leagueLower.includes("tennis")
  )
    return "tennis";
  if (leagueLower.includes("ufc") || leagueLower.includes("mma")) return "mma";
  if (leagueLower.includes("formula") || leagueLower.includes("f1"))
    return "motor";
  if (leagueLower.includes("rugby")) return "rugby";
  if (leagueLower.includes("golf")) return "golf";
  return "soccer";
};

export const persistConsensusCandidate = async (
  input: PersistInput
): Promise<PersistResult> => {
  const { candidate, generationBatch } = input;

  try {
    const baseSlug = buildSlugForCandidate(candidate);
    const slug = await generateUniqueSlug(baseSlug);

    const sport = inferSportFromCandidate(candidate);
    const eventDate = new Date(candidate.eventDateIso).toISOString();

    const apifootballFixtureId = /^\d+$/.test(candidate.fixtureRef)
      ? Number(candidate.fixtureRef)
      : null;

    const dominantReasoning =
      candidate.reasoningClaude ??
      candidate.reasoningGpt ??
      "Pick sélectionné par consensus IA";

    const modelUsed =
      candidate.source === "both"
        ? "claude-sonnet-4-6+gpt-5.4"
        : candidate.source === "claude"
        ? "claude-sonnet-4-6"
        : "gpt-5.4";

    const oddsComparison = {
      consensus_score: candidate.consensusScore,
      consensus_tier: candidate.consensusTier,
      source: candidate.source,
      confidence_claude: candidate.confidenceClaude,
      confidence_gpt: candidate.confidenceGpt,
      confidence_apifootball: candidate.confidenceApiFootball,
      bookmaker: candidate.bookmaker ?? null,
    };

    const insertData = {
      pick_type: candidate.type === "scorer" ? "scorer" : "classic",
      sport,
      league: candidate.league,
      event_name: candidate.eventName,
      event_date: eventDate,
      espn_event_id: null,
      apifootball_fixture_id: apifootballFixtureId,
      selection:
        candidate.type === "scorer"
          ? candidate.player ?? candidate.selection
          : candidate.selection,
      market: candidate.market ?? "scorer",
      odds: candidate.odds,
      odds_bookmaker: candidate.bookmaker ?? null,
      odds_comparison: oddsComparison,
      reasoning: dominantReasoning,
      reasoning_claude: candidate.reasoningClaude,
      reasoning_gpt: candidate.reasoningGpt,
      ai_confidence: Math.max(
        candidate.confidenceClaude ?? 0,
        candidate.confidenceGpt ?? 0
      ),
      confidence_claude: candidate.confidenceClaude,
      confidence_gpt: candidate.confidenceGpt,
      confidence_apifootball: candidate.confidenceApiFootball,
      consensus_score: candidate.consensusScore,
      consensus_tier: candidate.consensusTier,
      status: "pending",
      generation_version: "v2",
      generation_batch: generationBatch,
      model_used: modelUsed,
      slug,
      dossier_status: "queued",
      dossier_generated_at: null,
      resolution_source: null,
      resolved_by: null,
      resolved_at: null,
      deleted_at: null,
    };

    const { data, error } = await supabaseAdmin
      .from("ai_picks")
      .insert(insertData)
      .select("id")
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Insert returned no data",
      };
    }

    return {
      success: true,
      pickId: data.id,
      slug,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown persist error",
    };
  }
};

export const updatePickDossierStatus = async (
  pickId: string,
  status: "queued" | "generating" | "ready" | "failed",
  generatedAt?: Date
): Promise<void> => {
  const updateData: Record<string, unknown> = {
    dossier_status: status,
  };
  if (status === "ready" && generatedAt) {
    updateData.dossier_generated_at = generatedAt.toISOString();
  }
  await supabaseAdmin.from("ai_picks").update(updateData).eq("id", pickId);
};

export const persistDossier = async (
  pickId: string,
  fullText: string,
  sections: Record<string, string> | null,
  apiFootballSnapshot: unknown,
  modelUsed: string,
  tokensInput: number,
  tokensOutput: number,
  tokensCached: number,
  costUsd: number,
  locale: string = "fr"
): Promise<{ success: boolean; error?: string }> => {
  try {
    const insertData = {
      pick_id: pickId,
      locale,
      full_analysis: fullText,
      context_match: sections?.context_match ?? null,
      form_home: sections?.form_analysis ? { text: sections.form_analysis } : null,
      form_away: null,
      h2h: sections?.h2h_analysis ? { text: sections.h2h_analysis } : null,
      lineups_probable: sections?.lineups_and_injuries
        ? { text: sections.lineups_and_injuries }
        : null,
      injuries: null,
      apifootball_snapshot: apiFootballSnapshot,
      model_used: modelUsed,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      tokens_cached: tokensCached,
      cost_usd: costUsd,
    };

    const { error } = await supabaseAdmin
      .from("ai_picks_analysis")
      .upsert(insertData, { onConflict: "pick_id,locale" });

    if (error) {
      return { success: false, error: error.message };
    }

    await updatePickDossierStatus(pickId, "ready", new Date());
    return { success: true };
  } catch (err) {
    await updatePickDossierStatus(pickId, "failed");
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown dossier persist error",
    };
  }
};