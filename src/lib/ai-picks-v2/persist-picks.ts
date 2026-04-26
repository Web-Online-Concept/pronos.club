import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildMatchSlug,
  buildScorerSlug,
} from "./slug-generator";
import { validateClassicPickOdds } from "./odds-validator";
import type { SimplifiedFixture } from "./odds-api-client";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";

export type PersistInput = {
  candidate: ConsensusCandidate;
  generationBatch: string;
  /**
   * Fixtures OddsAPI fraichement fetchees lors du run de generation.
   * Utilise par le validateur pour cross-checker les cotes hallucinees.
   *
   * IMPORTANT : si non fourni ou tableau vide pour un pick CLASSIC,
   * le pick est REJETE (status='rejected_by_validation') au lieu d'etre
   * publie sans verification. Securite anti-hallucination.
   */
  oddsApiFixtures?: SimplifiedFixture[];
};

export type PersistResult = {
  success: boolean;
  pickId?: string;
  slug?: string;
  error?: string;
  /** True si le pick a ete insere avec status='rejected_by_validation' */
  rejectedByValidation?: boolean;
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

/**
 * Slugs sport alignes sur ceux attendus par /lib/live-scores.ts (mapping ESPN).
 * Permet le live score automatique via le composant <LiveScore />.
 */
const inferSportFromCandidate = (candidate: ConsensusCandidate): string => {
  if (candidate.type === "scorer") return "football";
  const leagueLower = candidate.league.toLowerCase();
  if (leagueLower.includes("nba") || leagueLower.includes("basketball"))
    return "basketball";
  if (leagueLower.includes("nfl") || leagueLower.includes("nca football"))
    return "football-americain";
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
  if (leagueLower.includes("rugby")) return "rugby";
  return "football";
};

/**
 * Récupère la prochaine valeur de la séquence appropriée selon le type de pick.
 * - "classic" -> ai_picks_classic_seq -> classic_number
 * - "scorer"  -> ai_picks_scorer_seq  -> scorer_number
 */
const getNextNumberForType = async (
  pickType: "classic" | "scorer"
): Promise<{ classic_number: number | null; scorer_number: number | null }> => {
  const seqName =
    pickType === "scorer" ? "ai_picks_scorer_seq" : "ai_picks_classic_seq";

  const { data, error } = await supabaseAdmin.rpc("nextval_ai_seq", {
    seq_name: seqName,
  });

  if (error || data === null || data === undefined) {
    // Fallback : si la fonction RPC nextval_ai_seq n'existe pas, on calcule manuellement
    const column = pickType === "scorer" ? "scorer_number" : "classic_number";
    const { data: maxRow } = await supabaseAdmin
      .from("ai_picks")
      .select(column)
      .not(column, "is", null)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();

    const max = (maxRow as Record<string, number | null> | null)?.[column] ?? 0;
    const nextVal = max + 1;
    return pickType === "scorer"
      ? { classic_number: null, scorer_number: nextVal }
      : { classic_number: nextVal, scorer_number: null };
  }

  const nextVal = Number(data);
  return pickType === "scorer"
    ? { classic_number: null, scorer_number: nextVal }
    : { classic_number: nextVal, scorer_number: null };
};

export const persistConsensusCandidate = async (
  input: PersistInput
): Promise<PersistResult> => {
  const { candidate, generationBatch, oddsApiFixtures } = input;

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

    const pickType = candidate.type === "scorer" ? "scorer" : "classic";
    const numbers = await getNextNumberForType(pickType);

    // ═══════════════════════════════════════════════════════════════
    // VALIDATION COTES IA (Strategy C : Best Odds + 10%)
    // ═══════════════════════════════════════════════════════════════
    // Pour les classics seulement (les scorers passent en mode estime).
    //
    // STRICT MODE :
    // Si validation OK -> on insere avec la BEST ODDS reelle
    // Si validation KO -> on insere avec status='rejected_by_validation'
    //                     (audit admin uniquement, PAS publie)
    // Si oddsApiFixtures absent ou vide -> REJET aussi (securite anti-hallucination).
    //
    // Le pick PUBLIE n'a JAMAIS de cote non validee. Si OddsAPI tombe
    // en panne, on prefere ne rien publier que de publier des cotes
    // hallucinees par les LLM.

    let finalOdds = candidate.odds;
    let finalBookmaker = candidate.bookmaker ?? null;
    let validationStatus: "validated" | "rejected" | "skipped_scorer" = "skipped_scorer";
    let validationDetails: string | null = null;
    let validationDivergencePct: number | null = null;
    let bookmakersSnapshot: unknown = null;
    let pickStatus: "pending" | "rejected_by_validation" = "pending";

    if (pickType === "classic") {
      // 1) Aucune fixture OddsAPI fournie -> rejet automatique (securite)
      if (!oddsApiFixtures || oddsApiFixtures.length === 0) {
        validationStatus = "rejected";
        validationDetails =
          "[REJECTED missing_oddsapi_data] No OddsAPI fixtures provided to validator. Cannot cross-check LLM odds. Pick rejected for safety (anti-hallucination).";
        bookmakersSnapshot = null;
        pickStatus = "rejected_by_validation";

        console.warn(
          `[persist-picks] PICK REJETE (no OddsAPI data) : ${candidate.eventName} - ${candidate.selection}`
        );
      } else {
        // 2) Validation normale via le validateur
        const validation = validateClassicPickOdds(candidate, oddsApiFixtures);

        if (validation.ok) {
          // Cote validee : on remplace par la BEST ODDS reelle
          finalOdds = validation.bestOdds;
          finalBookmaker = validation.bestBookmakerName;
          validationStatus = "validated";
          validationDivergencePct = validation.divergencePct;
          bookmakersSnapshot = validation.snapshot;
          validationDetails = `LLM proposed ${validation.llmOdds.toFixed(3)} on ${candidate.bookmaker ?? "?"}, best odds ${validation.bestOdds.toFixed(3)} on ${validation.bestBookmakerName} (divergence ${validation.divergencePct.toFixed(1)}%). Cote remplacee par best odds reelle.`;
        } else {
          // Cote rejetee : on insere avec un status special pour audit admin
          validationStatus = "rejected";
          validationDetails = `[REJECTED ${validation.reason}] ${validation.details}`;
          validationDivergencePct =
            validation.reason === "odds_diverge_too_much" && validation.snapshot?.best && validation.llmOdds
              ? Math.abs((validation.llmOdds - validation.snapshot.best.odds) / validation.snapshot.best.odds) * 100
              : null;
          bookmakersSnapshot = validation.snapshot ?? null;
          pickStatus = "rejected_by_validation";

          console.warn(
            `[persist-picks] PICK REJETE par validation cotes : ${candidate.eventName} - ${candidate.selection} (${candidate.market}) - ${validation.reason} - ${validation.details}`
          );
        }
      }
    } else {
      // Buteurs : validation skipped (Q3=a, mode estime)
      validationDetails = "Validation skipped (scorer pick, estimated odds)";
    }

    const oddsComparison = {
      consensus_score: candidate.consensusScore,
      consensus_tier: candidate.consensusTier,
      source: candidate.source,
      confidence_claude: candidate.confidenceClaude,
      confidence_gpt: candidate.confidenceGpt,
      confidence_apifootball: candidate.confidenceApiFootball,
      bookmaker: finalBookmaker,
      // Snapshot complet des 6 books (pour la page detail comparateur)
      bookmakers_snapshot: bookmakersSnapshot,
      // Trace de la validation pour audit admin
      validation: {
        status: validationStatus,
        details: validationDetails,
        divergence_pct: validationDivergencePct,
        llm_odds_original: candidate.odds,
        llm_bookmaker_original: candidate.bookmaker ?? null,
      },
    };

    const insertData = {
      pick_type: pickType,
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
      odds: finalOdds,
      odds_bookmaker: finalBookmaker,
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
      status: pickStatus,
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
      classic_number: numbers.classic_number,
      scorer_number: numbers.scorer_number,
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
      rejectedByValidation: pickStatus === "rejected_by_validation",
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