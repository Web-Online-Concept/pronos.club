/**
 * ═══════════════════════════════════════════════════════════════════
 * GENERATE DAILY PICKS — Pronos IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Orchestrateur principal du cron quotidien de génération.
 *
 * Flow :
 *  1. Fetch matchs ESPN du jour (6 ligues foot + 3 tennis + NBA)
 *  2. Fetch cotes The Odds API
 *  3. Fusion ESPN ↔ Odds via matching fuzzy
 *  4. Envoi à Claude pour analyse
 *  5. Insertion des picks validés en Supabase
 *  6. Log de l'exécution dans ai_generation_logs
 *
 * Ce module est appelé par la route API cron /api/crons/ai-picks-generate.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getAllTodayMatches, type NormalizedMatch } from "./espn-matches";
import { getAllOdds, type MatchWithOdds } from "./odds-api-client";
import { enrichMatchWithOdds, type EnrichedMatch } from "./prompts";
import { generateAIPicks } from "./anthropic-client";
import type { AIResponse } from "./schema";
import { createClient } from "@supabase/supabase-js";


// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface GenerationReport {
  success: boolean;
  startedAt: string;
  durationMs: number;

  // Phases
  phases: {
    espn: { matches: number; durationMs: number };
    odds: { matches: number; credits: number; durationMs: number };
    fusion: { enrichedMatches: number; matchedWithOdds: number };
    ai: {
      tokensUsed: number;
      costUsd: number;
      picksGenerated: { classics: number; scorers: number };
      durationMs: number;
    };
    db: { picksInserted: number; durationMs: number };
  };

  // Détail
  picksCreated?: number;
  errors?: string[];
  logId?: string;
}


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Supabase credentials manquantes (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


// ═══════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════

/**
 * Génère les pronos du jour.
 * Retourne un rapport détaillé de chaque phase.
 */
export async function generateDailyPicks(): Promise<GenerationReport> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];

  const report: GenerationReport = {
    success: false,
    startedAt,
    durationMs: 0,
    phases: {
      espn: { matches: 0, durationMs: 0 },
      odds: { matches: 0, credits: 0, durationMs: 0 },
      fusion: { enrichedMatches: 0, matchedWithOdds: 0 },
      ai: {
        tokensUsed: 0,
        costUsd: 0,
        picksGenerated: { classics: 0, scorers: 0 },
        durationMs: 0,
      },
      db: { picksInserted: 0, durationMs: 0 },
    },
  };

  try {
    // ═══════════════════════════════════════════════════
    // PHASE 1 : ESPN — matchs du jour
    // ═══════════════════════════════════════════════════
    const espnStart = Date.now();
    const espnMatches: NormalizedMatch[] = await getAllTodayMatches();
    report.phases.espn = {
      matches: espnMatches.length,
      durationMs: Date.now() - espnStart,
    };

    if (espnMatches.length === 0) {
      errors.push("Aucun match ESPN éligible aujourd'hui");
      // On continue quand même, peut-être qu'il y en aura demain
    }

    // ═══════════════════════════════════════════════════
    // PHASE 2 : The Odds API — cotes
    // ═══════════════════════════════════════════════════
    const oddsStart = Date.now();
    const oddsResult = await getAllOdds();
    const oddsMatches: MatchWithOdds[] = oddsResult.matches;
    report.phases.odds = {
      matches: oddsMatches.length,
      credits: oddsResult.stats.totalCreditsUsed,
      durationMs: Date.now() - oddsStart,
    };

    // ═══════════════════════════════════════════════════
    // PHASE 3 : Fusion ESPN ↔ Odds
    // ═══════════════════════════════════════════════════
    const enrichedMatches: EnrichedMatch[] = espnMatches.map((m) =>
      enrichMatchWithOdds(m, oddsMatches),
    );

    const matchedWithOdds = enrichedMatches.filter(
      (m) => m.odds.length > 0,
    ).length;

    report.phases.fusion = {
      enrichedMatches: enrichedMatches.length,
      matchedWithOdds,
    };

    console.log(
      `[Generate] Fusion: ${enrichedMatches.length} matchs, dont ${matchedWithOdds} avec cotes`,
    );

    // On ne filtre PAS les matchs sans cotes — l'IA peut les analyser
    // quand même (utile pour tennis/matchs exotiques sans cotes Odds API).

    // ═══════════════════════════════════════════════════
    // PHASE 4 : IA (Claude)
    // ═══════════════════════════════════════════════════
    if (enrichedMatches.length === 0) {
      errors.push("Aucun match à analyser, on skip l'appel IA");
      report.durationMs = Date.now() - startTime;
      report.errors = errors;
      await logGeneration(report, null, errors);
      return report;
    }

    const aiResult = await generateAIPicks(enrichedMatches);

    report.phases.ai = {
      tokensUsed: aiResult.metrics.tokensTotal,
      costUsd: aiResult.metrics.estimatedCostUsd,
      picksGenerated: {
        classics: aiResult.data?.classics.length ?? 0,
        scorers: aiResult.data?.scorers.length ?? 0,
      },
      durationMs: aiResult.metrics.durationMs,
    };

    if (!aiResult.success || !aiResult.data) {
      errors.push(...(aiResult.errors ?? ["IA a échoué sans raison claire"]));
      report.durationMs = Date.now() - startTime;
      report.errors = errors;
      await logGeneration(report, aiResult.rawResponse, errors);
      return report;
    }

    // ═══════════════════════════════════════════════════
    // PHASE 5 : Insertion en base
    // ═══════════════════════════════════════════════════
    const dbStart = Date.now();
    const inserted = await insertPicksToDb(aiResult.data, oddsMatches);
    report.phases.db = {
      picksInserted: inserted,
      durationMs: Date.now() - dbStart,
    };
    report.picksCreated = inserted;

    // ═══════════════════════════════════════════════════
    // FIN
    // ═══════════════════════════════════════════════════
    report.success = true;
    report.durationMs = Date.now() - startTime;

    // Log final
    const logId = await logGeneration(report, aiResult.rawResponse, errors);
    report.logId = logId ?? undefined;

    console.log(
      `[Generate] ✅ OK — ${inserted} picks insérés (${aiResult.data.classics.length} classiques + ${aiResult.data.scorers.length} buteurs) en ${report.durationMs}ms`,
    );

    return report;
  } catch (err) {
    const errorMsg = `Erreur fatale: ${err instanceof Error ? err.message : String(err)}`;
    errors.push(errorMsg);
    console.error(`[Generate] ${errorMsg}`, err);

    report.durationMs = Date.now() - startTime;
    report.errors = errors;
    await logGeneration(report, null, errors);
    return report;
  }
}


// ═══════════════════════════════════════════════════════════════════
// INSERTION EN BASE
// ═══════════════════════════════════════════════════════════════════

async function insertPicksToDb(
  aiResponse: AIResponse,
  oddsMatches: MatchWithOdds[],
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().split("T")[0];

  const rows: Record<string, unknown>[] = [];

  // Pronos classiques
  for (const pick of aiResponse.classics) {
    // Trouver le bookmaker qui propose cette cote exacte (pour tracer la source)
    const bookmakerSource = findBookmakerForOdds(
      pick.event_name,
      pick.market,
      pick.selection,
      pick.odds,
      oddsMatches,
    );

    // Extraire les cotes de tous les bookmakers pour mini-comparateur
    const oddsComparison = extractOddsComparison(
      pick.event_name,
      pick.market,
      pick.selection,
      oddsMatches,
    );

    rows.push({
      pick_type: "classic",
      sport: pick.sport,
      league: pick.league,
      event_name: pick.event_name,
      event_date: pick.event_date,
      espn_event_id: pick.espn_event_id,
      selection: pick.selection,
      market: pick.market,
      odds: pick.odds,
      odds_bookmaker: bookmakerSource,
      odds_comparison: oddsComparison,
      reasoning: pick.reasoning,
      ai_confidence: pick.confidence,
      status: "pending",
      model_used: "claude-sonnet-4-6",
      generation_batch: today,
    });
  }

  // Pronos buteurs
  for (const pick of aiResponse.scorers) {
    rows.push({
      pick_type: "scorer",
      sport: "soccer",
      league: pick.league,
      event_name: pick.event_name,
      event_date: pick.event_date,
      espn_event_id: pick.espn_event_id,
      selection: pick.player_name,
      market: "scorer",
      odds: null,
      odds_bookmaker: null,
      odds_comparison: null,
      reasoning: pick.reasoning,
      ai_confidence: pick.confidence,
      status: "pending",
      model_used: "claude-sonnet-4-6",
      generation_batch: today,
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("ai_picks").insert(rows);

  if (error) {
    console.error("[Generate] Erreur insertion ai_picks:", error);
    throw new Error(`Erreur Supabase: ${error.message}`);
  }

  return rows.length;
}


// ═══════════════════════════════════════════════════════════════════
// HELPERS DE MATCHING COTES
// ═══════════════════════════════════════════════════════════════════

/**
 * Tente de trouver le bookmaker qui propose la cote du pick.
 * Retourne la clé du bookmaker, ou null si pas trouvé.
 */
function findBookmakerForOdds(
  eventName: string,
  market: string,
  selection: string,
  odds: number,
  oddsMatches: MatchWithOdds[],
): string | null {
  // Trouver le match correspondant
  const match = oddsMatches.find((m) =>
    eventName.includes(m.home_team) || eventName.includes(m.away_team),
  );
  if (!match) return null;

  for (const bookmaker of match.bookmakers) {
    if (market === "h2h" && bookmaker.markets.h2h) {
      const found = bookmaker.markets.h2h.find(
        (o) => Math.abs(o.price - odds) < 0.01 && o.name === selection,
      );
      if (found) return bookmaker.key;
    }

    if ((market === "ou25" || market === "totals") && bookmaker.markets.totals) {
      const found = bookmaker.markets.totals.find(
        (o) => Math.abs(o.price - odds) < 0.01,
      );
      if (found) return bookmaker.key;
    }

    if (market === "btts" && bookmaker.markets.btts) {
      const found = bookmaker.markets.btts.find(
        (o) => Math.abs(o.price - odds) < 0.01,
      );
      if (found) return bookmaker.key;
    }
  }

  return null;
}

/**
 * Extrait les cotes de tous les bookmakers pour affichage mini-comparateur.
 * Retourne un tableau [{ book: "pinnacle", odds: 1.72 }, ...] ou null.
 */
function extractOddsComparison(
  eventName: string,
  market: string,
  selection: string,
  oddsMatches: MatchWithOdds[],
): Array<{ book: string; odds: number }> | null {
  const match = oddsMatches.find((m) =>
    eventName.includes(m.home_team) || eventName.includes(m.away_team),
  );
  if (!match) return null;

  const result: Array<{ book: string; odds: number }> = [];

  for (const bookmaker of match.bookmakers) {
    let price: number | undefined;

    if (market === "h2h" && bookmaker.markets.h2h) {
      price = bookmaker.markets.h2h.find((o) => o.name === selection)?.price;
    } else if ((market === "ou25" || market === "totals") && bookmaker.markets.totals) {
      // Pour Over/Under, matcher par le nom ("Over 2.5")
      price = bookmaker.markets.totals.find((o) =>
        `${o.name} ${o.point}` === selection ||
        o.name.includes(selection.split(" ")[0]),
      )?.price;
    } else if (market === "btts" && bookmaker.markets.btts) {
      price = bookmaker.markets.btts.find(
        (o) => o.name.toLowerCase() === selection.toLowerCase(),
      )?.price;
    }

    if (price !== undefined) {
      result.push({ book: bookmaker.key, odds: price });
    }
  }

  return result.length > 0 ? result : null;
}


// ═══════════════════════════════════════════════════════════════════
// LOG DE L'EXÉCUTION
// ═══════════════════════════════════════════════════════════════════

async function logGeneration(
  report: GenerationReport,
  rawResponse: string | null | undefined,
  errors: string[],
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("ai_generation_logs")
      .insert({
        run_type: "generation",
        run_date: new Date().toISOString().split("T")[0],
        status: report.success ? "success" : errors.length > 0 ? "error" : "partial",
        picks_created: report.picksCreated ?? 0,
        errors_count: errors.length,
        raw_response: rawResponse ? { text: rawResponse.slice(0, 10000) } : null,
        errors: errors.length > 0 ? errors : null,
        tokens_input: 0,  // Ajouté via phases.ai (simplifié)
        tokens_output: 0,
        tokens_used: report.phases.ai.tokensUsed,
        estimated_cost: report.phases.ai.costUsd,
        duration_ms: report.durationMs,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[Generate] Erreur log ai_generation_logs:", error);
      return null;
    }

    return data?.id ?? null;
  } catch (err) {
    console.error("[Generate] Erreur log (catch):", err);
    return null;
  }
}