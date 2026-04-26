import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  buildMatchSlug,
  buildScorerSlug,
} from "./slug-generator";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";
import type { ValueBet } from "./value-bet-engine";
import type { ValueBetScorer } from "./value-bet-engine-scorer";

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

    const pickType = candidate.type === "scorer" ? "scorer" : "classic";
    const numbers = await getNextNumberForType(pickType);

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

// ═══════════════════════════════════════════════════════════════════
// VALUE BET PERSISTER (v3 — moteur mathématique anti-hallucination)
// ═══════════════════════════════════════════════════════════════════
//
// Persiste un pick issu du moteur value-bet (cotes 100% reelles,
// validation par +EV mathematique, plus de LLM dans le choix).
//
// La cote stockee = best soft odds reelle d'OddsAPI.
// Le bookmaker stocke = nom du soft book (1xbet, Betclic, etc.)
// Le snapshot des 6 books est stocke pour la page detail.
// ═══════════════════════════════════════════════════════════════════


const inferSportFromValueBet = (vb: ValueBet): string => {
  // IMPORTANT : les slugs DOIVENT etre en lowercase pour matcher
  // le mapping SPORT_DEFAULTS de adapt-ai-pick.ts (sinon icone medaille fallback).
  if (vb.sportKey.startsWith("soccer_")) return "football";
  if (vb.sportKey.startsWith("basketball_")) return "basketball";
  if (vb.sportKey.startsWith("tennis")) return "tennis";
  if (vb.sportKey.startsWith("icehockey_")) return "hockey";
  if (vb.sportKey.startsWith("baseball_")) return "baseball";
  if (vb.sportKey.startsWith("americanfootball_")) return "football-americain";
  if (vb.sportKey.startsWith("rugby")) return "rugby";
  if (vb.sportKey.startsWith("mma_")) return "mma";
  if (vb.sportKey.startsWith("boxing_")) return "mma"; // pas de mapping boxe distinct
  // Default fallback football (acceptable car la plupart des slugs sont mappes ci-dessus)
  return "football";
};


export type PersistValueBetInput = {
  valueBet: ValueBet;
  generationBatch: string;
  reasoningClaude?: string | null;
  reasoningGpt?: string | null;
  reasoningCombined?: string | null;
};


export type PersistValueBetResult = {
  success: boolean;
  pickId?: string;
  slug?: string;
  error?: string;
};


export const persistValueBet = async (
  input: PersistValueBetInput
): Promise<PersistValueBetResult> => {
  const { valueBet, generationBatch, reasoningClaude, reasoningGpt, reasoningCombined } = input;

  try {
    const baseSlug = buildMatchSlug({
      homeTeam: valueBet.homeTeam,
      awayTeam: valueBet.awayTeam,
      league: valueBet.league,
      eventDate: valueBet.commenceTime,
    });
    const slug = await generateUniqueSlug(baseSlug);

    const sport = inferSportFromValueBet(valueBet);
    const eventDate = new Date(valueBet.commenceTime).toISOString();

    const reasoning =
      reasoningCombined ??
      reasoningClaude ??
      reasoningGpt ??
      `Value bet detectee : edge +${valueBet.edgePct.toFixed(2)}% sur ${valueBet.bestSoftBookName}.`;

    const oddsComparison = {
      // Strategy v3 : value bet detection
      strategy: "value_bet_v3",
      // Donnees mathematiques
      pinnacle_raw_odds: valueBet.pinnacleRawOdds,
      fair_odds: valueBet.fairOdds,
      fair_probability: valueBet.fairProbability,
      best_soft_odds: valueBet.bestSoftOdds,
      best_soft_book_key: valueBet.bestSoftBookKey,
      best_soft_book_name: valueBet.bestSoftBookName,
      edge_pct: valueBet.edgePct,
      // Snapshot pour la page detail comparateur
      bookmakers_snapshot: {
        market: valueBet.market,
        market_code: valueBet.marketCode,
        selection: valueBet.selection,
        fetched_at: new Date().toISOString(),
        books: valueBet.books,
        best: {
          key: valueBet.bestSoftBookKey,
          name: valueBet.bestSoftBookName,
          odds: valueBet.bestSoftOdds,
        },
      },
      // Compatibilite avec ancien format (pour la page detail si elle utilise ces champs)
      bookmaker: valueBet.bestSoftBookName,
      validation: {
        status: "validated",
        method: "value_bet_engine",
        details: `Edge +${valueBet.edgePct.toFixed(2)}%, fair odds ${valueBet.fairOdds.toFixed(3)}, best soft ${valueBet.bestSoftOdds.toFixed(3)} sur ${valueBet.bestSoftBookName}.`,
      },
    };

    const numbers = await getNextNumberForType("classic");

    const insertData = {
      pick_type: "classic",
      sport,
      league: valueBet.league,
      event_name: valueBet.eventName,
      event_date: eventDate,
      espn_event_id: null,
      apifootball_fixture_id: null, // value bet vient d'OddsAPI, pas API-Football
      selection: valueBet.selection,
      market: valueBet.marketCode,
      odds: valueBet.bestSoftOdds, // VRAIE COTE OddsAPI
      odds_bookmaker: valueBet.bestSoftBookName,
      odds_comparison: oddsComparison,
      reasoning,
      reasoning_claude: reasoningClaude ?? null,
      reasoning_gpt: reasoningGpt ?? null,
      ai_confidence: Math.min(99, Math.round(valueBet.fairProbability * 100)),
      confidence_claude: null,
      confidence_gpt: null,
      confidence_apifootball: null,
      consensus_score: Math.min(100, Math.max(0, Math.round(valueBet.edgePct * 10))), // edge % * 10, clampe 0-100
      consensus_tier: valueBet.edgePct >= 7 ? "total_agreement" : valueBet.edgePct >= 5 ? "partial" : "isolated_high",
      status: "pending",
      generation_version: "v2",
      generation_batch: generationBatch,
      model_used: "value-bet-engine-v3",
      slug,
      dossier_status: "queued",
      dossier_generated_at: null,
      resolution_source: null,
      resolved_by: null,
      resolved_at: null,
      deleted_at: null,
      classic_number: numbers.classic_number,
      scorer_number: null,
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

// ═══════════════════════════════════════════════════════════════════
// Persist VALUE BET SCORER (buteurs)
// ═══════════════════════════════════════════════════════════════════
//
// Identique a persistValueBet mais :
// - pick_type = "scorer"
// - utilise scorer_number au lieu de classic_number
// - structure odds_comparison adaptee au scorer (xG, defense_mult, etc.)
// - apifootball_fixture_id rempli (on a le fixture id directement)


export type PersistValueBetScorerInput = {
  valueBetScorer: ValueBetScorer;
  generationBatch: string;
  reasoningCombined?: string | null;
};


export const persistValueBetScorer = async (
  input: PersistValueBetScorerInput
): Promise<PersistValueBetResult> => {
  const { valueBetScorer: vb, generationBatch, reasoningCombined } = input;

  try {
    // Slug : pour les scorers on utilise buildScorerSlug
    const baseSlug = buildScorerSlug({
      playerName: vb.playerName,
      homeTeam: vb.homeTeam,
      awayTeam: vb.awayTeam,
      eventDate: vb.commenceTime,
    });
    const slug = await generateUniqueSlug(baseSlug);

    const eventDate = new Date(vb.commenceTime).toISOString();

    const reasoning =
      reasoningCombined ??
      `Value bet buteur : ${vb.playerName} (${vb.playerTeam}) avec un xG/90 de ${vb.npxG_per_90.toFixed(2)} face a une defense ${vb.defenseMultiplier > 1.05 ? "permissive" : vb.defenseMultiplier < 0.95 ? "solide" : "moyenne"}. Probabilite mathematique de marquer : ${(vb.fairProbability * 100).toFixed(1)}%, soit cote juste ${vb.fairOdds.toFixed(2)}. Bet365 propose ${vb.bookmakerOdds.toFixed(2)} (edge +${vb.edgePct.toFixed(2)}%).`;

    const oddsComparison = {
      strategy: "value_bet_scorer_v1",
      npxG_per_90: vb.npxG_per_90,
      defense_multiplier: vb.defenseMultiplier,
      xG_expected: vb.xG_expected,
      fair_odds: vb.fairOdds,
      fair_probability: vb.fairProbability,
      bookmaker_name: vb.bookmakerName,
      bookmaker_odds: vb.bookmakerOdds,
      edge_pct: vb.edgePct,
      bookmakers_snapshot: {
        market: "Anytime Goal Scorer",
        market_code: "ANYTIME_GOAL_SCORER",
        selection: vb.playerName,
        fetched_at: new Date().toISOString(),
        books: [
          {
            key: vb.bookmakerName.toLowerCase(),
            name: vb.bookmakerName,
            odds: vb.bookmakerOdds,
          },
        ],
        best: {
          key: vb.bookmakerName.toLowerCase(),
          name: vb.bookmakerName,
          odds: vb.bookmakerOdds,
        },
      },
      bookmaker: vb.bookmakerName,
      validation: {
        status: "validated",
        method: "value_bet_scorer_engine",
        details: `Joueur ${vb.playerName} : npxG/90 = ${vb.npxG_per_90.toFixed(3)}, defense mult = ${vb.defenseMultiplier.toFixed(2)}, xG attendu = ${vb.xG_expected.toFixed(3)}, fair P = ${(vb.fairProbability * 100).toFixed(1)}%, fair odds = ${vb.fairOdds.toFixed(2)}, Bet365 = ${vb.bookmakerOdds.toFixed(2)}, edge = +${vb.edgePct.toFixed(2)}%.`,
      },
    };

    const numbers = await getNextNumberForType("scorer");

    const insertData = {
      pick_type: "scorer",
      sport: "football",
      league: vb.league,
      event_name: vb.eventName,
      event_date: eventDate,
      espn_event_id: null,
      apifootball_fixture_id: vb.fixtureId,
      selection: vb.playerName,
      market: "ANYTIME_GOAL_SCORER",
      odds: vb.bookmakerOdds,
      odds_bookmaker: vb.bookmakerName,
      odds_comparison: oddsComparison,
      reasoning,
      reasoning_claude: null,
      reasoning_gpt: null,
      ai_confidence: Math.min(99, Math.round(vb.fairProbability * 100)),
      confidence_claude: null,
      confidence_gpt: null,
      confidence_apifootball: null,
      consensus_score: Math.min(100, Math.max(0, Math.round(vb.edgePct * 10))),
      consensus_tier:
        vb.edgePct >= 10
          ? "total_agreement"
          : vb.edgePct >= 7
          ? "partial"
          : "isolated_high",
      status: "pending",
      generation_version: "v2",
      generation_batch: generationBatch,
      model_used: "value-bet-scorer-engine-v1",
      slug,
      dossier_status: "queued",
      dossier_generated_at: null,
      resolution_source: null,
      resolved_by: null,
      resolved_at: null,
      deleted_at: null,
      classic_number: null,
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
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown persist error",
    };
  }
};