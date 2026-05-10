/**
 * PRONOS.CLUB — Helper partagé pour les routes ai-picks-generate (V3.5)
 *
 * Factorise la logique commune entre :
 *   - /api/cron/ai-picks-generate           (drop matin, kickoff < 20h Paris)
 *   - /api/cron/ai-picks-generate-evening   (drop soir, kickoff >= 20h Paris)
 *
 * Pipeline :
 *   1. multi-sport-fetcher (filtré par dropWindow)
 *   2. claude-tipster (avec dropWindow + plafonds)
 *   3. gpt-validator (avec validation tier + suggested_tier)
 *   4. persist-tipster-pick (avec tier + drop_window)
 *   5. generateDossier par pick
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchMultiSportFixturesForDate } from "@/lib/ai-picks-v3/multi-sport-fetcher";
import { runClaudeTipster } from "@/lib/ai-picks-v3/claude-tipster";
import { runGptValidator } from "@/lib/ai-picks-v3/gpt-validator";
import {
  persistTipsterPick,
  buildFixturesByMatchMap,
  buildValidatedPick,
} from "@/lib/ai-picks-v3/persist-tipster-pick";
import {
  persistDossier,
  updatePickDossierStatus,
} from "@/lib/ai-picks-v2/persist-picks";
import { generateDossier } from "@/lib/ai-picks-v2/dossier-generator";
import { aggregateMatchData } from "@/lib/ai-picks-v2/match-aggregator";
import type {
  GenerationStats,
  TipsterPick,
  TipsterPickSimple,
  TipsterPickCombine,
  ValidatedPick,
  ValidatorVerdict,
  EnrichedFixture,
  DropWindow,
} from "@/lib/ai-picks-v3/tipster-types";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";
import { buildClassicConsensusKey } from "@/types/ai-picks-v2";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ============================================================================
// HELPERS
// ============================================================================

const getTodayParisDate = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
};

const isAuthorized = (request: NextRequest): boolean => {
  if (!CRON_SECRET) return true;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === CRON_SECRET;
};

const logSection = (dropWindow: DropWindow, title: string): void => {
  const tag = `ai-picks-generate-${dropWindow}`;
  console.log(`\n${"=".repeat(60)}\n[${tag} v3.5] ${title}\n${"=".repeat(60)}`);
};

// ============================================================================
// LOG BDD : ai_picks_drop_log
// ============================================================================

/**
 * Type des arguments pour logDropEvaluation.
 * Tous les champs sont optionnels — la fonction écrit ce qui est disponible
 * au moment de l'appel (ex: si tipster a planté, on log quand même fetch).
 */
type DropEvaluationLog = {
  drop_window: DropWindow;
  generation_batch: string; // YYYY-MM-DD
  drop_started_at: string;  // ISO
  drop_ended_at: string;    // ISO
  duration_ms: number;
  // Fetch
  matches_raw_count?: number;
  matches_in_window_count?: number;
  matches_enriched_count?: number;
  fetch_stats?: Record<string, unknown>;
  // Tipster
  tipster_model?: string;
  tipster_tokens_in?: number;
  tipster_tokens_out?: number;
  tipster_cost_usd?: number;
  tipster_picks_count?: number;
  tipster_raw_response?: string | null;
  tipster_error?: string | null;
  // Sample matchs envoyés à Claude (max 50)
  matches_sample?: unknown;
  // Persist
  picks_persisted_count?: number;
  picks_persisted_ids?: string[];
  // Notes libres
  notes?: string | null;
};

/**
 * Écrit un row dans ai_picks_drop_log.
 * Cette fonction est best-effort : elle catche toutes les erreurs pour ne
 * jamais faire planter le drop. Si la table n'existe pas (migration pas faite),
 * on log un warning et on continue.
 */
const logDropEvaluation = async (data: DropEvaluationLog): Promise<void> => {
  try {
    const { error } = await supabaseAdmin
      .from("ai_picks_drop_log")
      .insert({
        drop_window: data.drop_window,
        generation_batch: data.generation_batch,
        drop_started_at: data.drop_started_at,
        drop_ended_at: data.drop_ended_at,
        duration_ms: data.duration_ms,
        matches_raw_count: data.matches_raw_count ?? null,
        matches_in_window_count: data.matches_in_window_count ?? null,
        matches_enriched_count: data.matches_enriched_count ?? null,
        fetch_stats: data.fetch_stats ?? null,
        tipster_model: data.tipster_model ?? null,
        tipster_tokens_in: data.tipster_tokens_in ?? null,
        tipster_tokens_out: data.tipster_tokens_out ?? null,
        tipster_cost_usd: data.tipster_cost_usd ?? null,
        tipster_picks_count: data.tipster_picks_count ?? null,
        tipster_raw_response: data.tipster_raw_response ?? null,
        tipster_error: data.tipster_error ?? null,
        matches_sample: data.matches_sample ?? null,
        picks_persisted_count: data.picks_persisted_count ?? 0,
        picks_persisted_ids: data.picks_persisted_ids ?? null,
        notes: data.notes ?? null,
      });
    if (error) {
      console.warn(
        `[drop-log] Insert failed (table missing?): ${error.message.substring(0, 100)}`
      );
    } else {
      console.log(
        `[drop-log] ✓ Drop ${data.drop_window} ${data.generation_batch} loggé en BDD`
      );
    }
  } catch (err) {
    console.warn(
      `[drop-log] Exception: ${err instanceof Error ? err.message.substring(0, 100) : String(err)}`
    );
  }
};

/**
 * Construit l'échantillon des matchs envoyés au tipster, en gardant les
 * informations essentielles pour le debug. Limite à 50 matchs max.
 */
const buildMatchesSample = (
  matchesInWindow: EnrichedFixture[]
): Array<Record<string, unknown>> => {
  return matchesInWindow.slice(0, 50).map((m) => ({
    sport: m.sport,
    ligue: m.ligue,
    match: m.match,
    home_team: m.home_team,
    away_team: m.away_team,
    commence_time: m.commence_time_iso,
    forme: typeof m.forme_5_derniers === "string" ? m.forme_5_derniers : "OK",
    h2h: typeof m.h2h_5_derniers === "string" ? m.h2h_5_derniers : "OK",
    blessures: typeof m.blessures === "string" ? m.blessures : "OK",
    has_odds: !!m.cotes_books && Object.keys(m.cotes_books).length > 0,
  }));
};

// ============================================================================
// ADAPTER : TipsterPick → ConsensusCandidate (pour generateDossier)
// ============================================================================

/**
 * Adapte un TipsterPick v3.5 au format ConsensusCandidate attendu par
 * generateDossier() (système de dossier hérité de la v2).
 */
const adaptTipsterPickForDossier = (
  pick: TipsterPick,
  verdict: ValidatorVerdict,
  validated: ValidatedPick,
  fixture: EnrichedFixture | null
): ConsensusCandidate => {
  const isSimple = pick.type === "simple";

  const eventName = isSimple
    ? (pick as TipsterPickSimple).match
    : (pick as TipsterPickCombine).selections.map((s) => s.match).join(" + ");

  const league = isSimple
    ? (pick as TipsterPickSimple).ligue
    : "Multi";

  const selection = isSimple
    ? (pick as TipsterPickSimple).selection
    : (pick as TipsterPickCombine).selections
        .map((s) => `${s.selection} (${s.match})`)
        .join(" + ");

  const market = isSimple ? "1N2" : "COMBINE";

  const reasoningClaude = isSimple
    ? (pick as TipsterPickSimple).arguments.join(" • ")
    : (pick as TipsterPickCombine).arguments_globaux.join(" • ");

  const eventDateIso =
    fixture?.commence_time_iso ?? new Date().toISOString();

  const fixtureRef =
    fixture?.apifootball_fixture_id != null
      ? String(fixture.apifootball_fixture_id)
      : eventName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const key = buildClassicConsensusKey(fixtureRef, market, selection);

  const consensusTier =
    verdict.decision === "approve" ? "isolated_high" : "partial";

  return {
    key,
    type: "classic",
    fixtureRef,
    market,
    selection,
    league,
    eventName,
    eventDateIso,
    odds: validated.effective_odds,
    bookmaker: String(validated.effective_bookmaker),
    source: "claude",
    confidenceClaude: pick.confiance,
    confidenceGpt: null,
    confidenceApiFootball: null,
    reasoningClaude,
    reasoningGpt: verdict.reason,
    consensusScore: pick.confiance,
    consensusTier,
  };
};

// ============================================================================
// HANDLER PRINCIPAL (factorisé pour matin et soir)
// ============================================================================

/**
 * V3.5 : pipeline de génération de picks pour un drop window donné.
 *
 * @param request Next.js request (auth Bearer)
 * @param dropWindow "morning" (kickoff < 20h Paris) | "evening" (kickoff >= 20h Paris)
 */
export const handleGenerateForDropWindow = async (
  request: NextRequest,
  dropWindow: DropWindow
): Promise<NextResponse> => {
  const startedAt = Date.now();

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const overrideDate = url.searchParams.get("date");
  const targetDate = overrideDate ?? getTodayParisDate();

  if (!dryRun && !isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logSection(dropWindow, `Start - date=${targetDate} drop=${dropWindow} dry_run=${dryRun}`);

  // ─── ÉTAPE 1 : Fetch + enrichissement multi-sports filtré par dropWindow
  logSection(dropWindow, "STEP 1 - Multi-sport fetch + enrichment (filtered by drop window)");
  let fetchOutput;
  try {
    fetchOutput = await fetchMultiSportFixturesForDate(targetDate, dropWindow);
    console.log(
      `[fetch] ${fetchOutput.matchs.length} matchs (drop=${dropWindow}). Stats: ${JSON.stringify(fetchOutput.stats.matchs_par_sport)}`
    );
    if (fetchOutput.stats.unresolved_leagues.length > 0) {
      console.warn(
        `[fetch] ${fetchOutput.stats.unresolved_leagues.length} ligue(s) NON résolue(s):`,
        fetchOutput.stats.unresolved_leagues
      );
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[fetch] FATAL ERROR:", error);
    return NextResponse.json(
      { success: false, stage: "fetch", drop_window: dropWindow, error, duration_ms: Date.now() - startedAt },
      { status: 500 }
    );
  }

  if (fetchOutput.matchs.length === 0) {
    console.warn(`[fetch] Aucun match dans le drop ${dropWindow}. Arrêt sain.`);

    // Log BDD pour debug a posteriori
    await logDropEvaluation({
      drop_window: dropWindow,
      generation_batch: targetDate,
      drop_started_at: new Date(startedAt).toISOString(),
      drop_ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      matches_raw_count: fetchOutput.stats.total_matchs ?? null,
      matches_in_window_count: 0,
      matches_enriched_count: 0,
      fetch_stats: fetchOutput.stats as unknown as Record<string, unknown>,
      tipster_picks_count: 0,
      picks_persisted_count: 0,
      notes: "Fetch retourné 0 match — drop window vide ou enrichment 100% KO",
    });

    return NextResponse.json({
      success: true,
      message: `Aucun match dans le drop ${dropWindow}`,
      drop_window: dropWindow,
      stats: {
        date: targetDate,
        duration_ms: Date.now() - startedAt,
        drop_window: dropWindow,
        fetch: fetchOutput.stats,
        tipster: { picks_generated: 0, cost_usd: 0, error: null },
        validator: { approved: 0, warnings: 0, vetoed: 0, cost_usd: 0, error: null },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 2 : Claude tipster avec dropWindow
  logSection(dropWindow, `STEP 2 - Claude tipster (Sonnet 4.6 + prompt v2.5, drop=${dropWindow})`);
  const tipsterResult = await runClaudeTipster(fetchOutput, dropWindow);
  console.log(
    `[tipster] model=${tipsterResult.meta.model} tokens_in=${tipsterResult.meta.tokens_input} tokens_out=${tipsterResult.meta.tokens_output} cost=${tipsterResult.meta.cost_usd}$`
  );

  if (tipsterResult.error || !tipsterResult.output) {
    console.error("[tipster] FATAL ERROR:", tipsterResult.error);
    return NextResponse.json(
      {
        success: false,
        stage: "tipster",
        drop_window: dropWindow,
        error: tipsterResult.error,
        meta: tipsterResult.meta,
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }

  const tipsterPicks = tipsterResult.output.pronostics;
  console.log(`[tipster] ${tipsterPicks.length} picks générés (drop=${dropWindow})`);
  for (const pick of tipsterPicks) {
    if (pick.type === "simple") {
      console.log(
        `  - #${pick.id} [${pick.tier}] ${pick.sport} ${pick.match} → "${pick.selection}" @ ${pick.cote_arjel ?? "?"} (confiance ${pick.confiance})`
      );
    } else {
      console.log(
        `  - #${pick.id} [${pick.tier}] COMBINÉ ${pick.selections.length} sélections (confiance ${pick.confiance})`
      );
    }
  }

  if (tipsterPicks.length === 0) {
    console.log("[tipster] 0 pick — journée trop incertaine pour ce drop. Arrêt sain.");

    // Log BDD pour debug a posteriori
    await logDropEvaluation({
      drop_window: dropWindow,
      generation_batch: targetDate,
      drop_started_at: new Date(startedAt).toISOString(),
      drop_ended_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      matches_raw_count: fetchOutput.stats.total_matchs ?? null,
      matches_in_window_count: fetchOutput.matchs.length,
      matches_enriched_count: fetchOutput.matchs.length,
      fetch_stats: fetchOutput.stats as unknown as Record<string, unknown>,
      tipster_model: tipsterResult.meta.model,
      tipster_tokens_in: tipsterResult.meta.tokens_input,
      tipster_tokens_out: tipsterResult.meta.tokens_output,
      tipster_cost_usd: tipsterResult.meta.cost_usd,
      tipster_picks_count: 0,
      tipster_raw_response: tipsterResult.narrative_text ?? null,
      tipster_error: null,
      matches_sample: buildMatchesSample(fetchOutput.matchs),
      picks_persisted_count: 0,
      notes: "0 pick — journée trop incertaine selon Claude",
    });

    return NextResponse.json({
      success: true,
      message: `Aucun pick généré pour le drop ${dropWindow} (journée trop incertaine)`,
      drop_window: dropWindow,
      narrative_text: tipsterResult.narrative_text,
      stats: {
        date: targetDate,
        duration_ms: Date.now() - startedAt,
        drop_window: dropWindow,
        fetch: fetchOutput.stats,
        tipster: { picks_generated: 0, cost_usd: tipsterResult.meta.cost_usd, error: null },
        validator: { approved: 0, warnings: 0, vetoed: 0, cost_usd: 0, error: null },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 3 : GPT validator
  logSection(dropWindow, "STEP 3 - GPT validator (avocat du diable indulgent + validation tier)");
  const validatorResult = await runGptValidator(fetchOutput, tipsterPicks);
  console.log(
    `[validator] model=${validatorResult.meta.model} tokens_in=${validatorResult.meta.tokens_input} cost=${validatorResult.meta.cost_usd}$`
  );

  const verdictCounts = { approved: 0, warnings: 0, vetoed: 0 };
  for (const v of validatorResult.verdicts) {
    if (v.decision === "approve") verdictCounts.approved++;
    else if (v.decision === "warning") verdictCounts.warnings++;
    else if (v.decision === "veto") verdictCounts.vetoed++;
  }
  console.log(
    `[validator] approve=${verdictCounts.approved} warning=${verdictCounts.warnings} veto=${verdictCounts.vetoed}`
  );

  for (const v of validatorResult.verdicts) {
    if (v.decision === "veto") {
      console.warn(`[validator] VETO pick #${v.pick_id}: ${v.reason}`);
    } else if (v.decision === "warning") {
      console.warn(`[validator] WARNING pick #${v.pick_id}: ${v.reason}`);
    }
    if (v.suggested_tier) {
      console.log(`[validator] tier downgrade suggéré pour pick #${v.pick_id} → ${v.suggested_tier}`);
    }
  }

  // Filtrage des picks vetoés
  const verdictsByPickId = new Map<number, ValidatorVerdict>(
    validatorResult.verdicts.map((v) => [v.pick_id, v])
  );
  const picksToKeep: TipsterPick[] = tipsterPicks.filter((p) => {
    const v = verdictsByPickId.get(p.id);
    return v && v.decision !== "veto";
  });

  console.log(`[validator] ${picksToKeep.length}/${tipsterPicks.length} picks conservés`);

  const fixturesByMatch = buildFixturesByMatchMap(fetchOutput.matchs);

  // ─── DRY RUN : skip persist + dossier
  if (dryRun) {
    logSection(dropWindow, "STEP 4 - DRY RUN (skip persist + dossier)");
    console.log("[persist] dry_run=true → aucune insertion BDD");

    return NextResponse.json({
      success: true,
      mode: "dry_run",
      drop_window: dropWindow,
      message: `Dry run réussi : ${picksToKeep.length} picks auraient été persistés`,
      narrative_text: tipsterResult.narrative_text,
      tipster_output: tipsterResult.output,
      validator_verdicts: validatorResult.verdicts,
      picks_to_persist: picksToKeep.map((p) => {
        const verdict = verdictsByPickId.get(p.id)!;
        // V3.5 : signature avec dropWindow
        const validated = buildValidatedPick(p, verdict, dropWindow, fixturesByMatch);
        return {
          pick_id: p.id,
          tier: p.tier,
          final_tier: validated.final_tier,
          decision: verdict.decision,
          effective_odds: validated.effective_odds,
          effective_bookmaker: validated.effective_bookmaker,
        };
      }),
      stats: {
        date: targetDate,
        duration_ms: Date.now() - startedAt,
        drop_window: dropWindow,
        fetch: fetchOutput.stats,
        tipster: {
          picks_generated: tipsterPicks.length,
          cost_usd: tipsterResult.meta.cost_usd,
          error: tipsterResult.error ?? null,
        },
        validator: {
          ...verdictCounts,
          cost_usd: validatorResult.meta.cost_usd,
          error: validatorResult.error ?? null,
        },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 4 + 5 : Persist + Dossier par pick
  logSection(dropWindow, "STEP 4+5 - Persist BDD + Dossier par pick");
  const generationBatch = targetDate; // format YYYY-MM-DD

  const persistedSuccess: Array<{ pick_id: number; db_id: string; slug: string; tier: string }> = [];
  const persistedErrors: Array<{ pick_id: number; error: string }> = [];

  for (const pick of picksToKeep) {
    const verdict = verdictsByPickId.get(pick.id)!;
    // V3.5 : nouvelle signature avec dropWindow
    const validated = buildValidatedPick(pick, verdict, dropWindow, fixturesByMatch);

    // ── 4a. INSERT ai_picks
    const result = await persistTipsterPick({
      validated,
      generationBatch,
      fixturesByMatch,
    });

    if (!result.success || !result.pickId || !result.slug) {
      persistedErrors.push({
        pick_id: pick.id,
        error: result.error ?? "Unknown persist error",
      });
      const reason = result.skipReason ? ` (${result.skipReason})` : "";
      console.warn(`  ✗ Pick #${pick.id} non persisté${reason}: ${result.error}`);
      continue;
    }

    persistedSuccess.push({
      pick_id: pick.id,
      db_id: result.pickId,
      slug: result.slug,
      tier: validated.final_tier,
    });
    console.log(`  ✓ Pick #${pick.id} persisté [${validated.final_tier}] (id=${result.pickId}, slug=${result.slug})`);

    // ── 4b. Dossier complet par pick
    try {
      const fixture =
        pick.type === "simple"
          ? fixturesByMatch.get((pick as TipsterPickSimple).match) ?? null
          : null;

      const apifootballFixtureId = fixture?.apifootball_fixture_id ?? null;

      let matchData = null;
      if (apifootballFixtureId) {
        try {
          matchData = await aggregateMatchData(apifootballFixtureId, {
            pickId: result.pickId,
          });
          console.log(
            `  [dossier] api-football aggregateMatchData OK pour fixture ${apifootballFixtureId}`
          );
        } catch (err) {
          console.warn(
            `  [dossier] api-football aggregateMatchData failed (fixture ${apifootballFixtureId}):`,
            err instanceof Error ? err.message : err
          );
        }
      }

      const consensusCandidate = adaptTipsterPickForDossier(
        pick,
        verdict,
        validated,
        fixture ?? null
      );

      console.log(`  [dossier] Génération dossier pour pick #${pick.id}...`);
      const dossierResult = await generateDossier({
        pick: consensusCandidate,
        matchData,
        pickId: result.pickId,
      });

      if (dossierResult.error && !dossierResult.fullText) {
        console.warn(
          `  [dossier] Génération échouée pour pick #${pick.id}: ${dossierResult.error}`
        );
        await updatePickDossierStatus(result.pickId, "failed").catch(() => {});
        continue;
      }

      const dossierPersistResult = await persistDossier(
        result.pickId,
        dossierResult.fullText ?? "",
        dossierResult.sections,
        null,
        dossierResult.meta.model,
        dossierResult.meta.tokensInput,
        dossierResult.meta.tokensOutput,
        dossierResult.meta.tokensCached,
        dossierResult.meta.costUsd,
        "fr"
      );

      if (!dossierPersistResult.success) {
        console.warn(
          `  [dossier] Persist échoué pour pick #${pick.id}: ${dossierPersistResult.error}`
        );
        await updatePickDossierStatus(result.pickId, "failed").catch(() => {});
      } else {
        console.log(
          `  [dossier] ✓ Dossier persisté pour pick #${pick.id} (cost=${dossierResult.meta.costUsd}$)`
        );
      }
    } catch (err) {
      console.warn(
        `  [dossier] Exception pour pick #${pick.id}:`,
        err instanceof Error ? err.message : err
      );
      await updatePickDossierStatus(result.pickId, "failed").catch(() => {});
    }
  }

  // ─── Résultat final
  const stats: GenerationStats = {
    date: targetDate,
    duration_ms: Date.now() - startedAt,
    drop_window: dropWindow,
    fetch: fetchOutput.stats,
    tipster: {
      picks_generated: tipsterPicks.length,
      cost_usd: tipsterResult.meta.cost_usd,
      error: tipsterResult.error ?? null,
    },
    validator: {
      ...verdictCounts,
      cost_usd: validatorResult.meta.cost_usd,
      error: validatorResult.error ?? null,
    },
    persisted: {
      success: persistedSuccess.length,
      errors: persistedErrors,
    },
  };

  logSection(dropWindow, `Done in ${(stats.duration_ms / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(stats, null, 2));

  // Log BDD pour debug a posteriori (succès ou partial success)
  await logDropEvaluation({
    drop_window: dropWindow,
    generation_batch: targetDate,
    drop_started_at: new Date(startedAt).toISOString(),
    drop_ended_at: new Date().toISOString(),
    duration_ms: stats.duration_ms,
    matches_raw_count: fetchOutput.stats.total_matchs ?? null,
    matches_in_window_count: fetchOutput.matchs.length,
    matches_enriched_count: fetchOutput.matchs.length,
    fetch_stats: fetchOutput.stats as unknown as Record<string, unknown>,
    tipster_model: tipsterResult.meta.model,
    tipster_tokens_in: tipsterResult.meta.tokens_input,
    tipster_tokens_out: tipsterResult.meta.tokens_output,
    tipster_cost_usd: tipsterResult.meta.cost_usd,
    tipster_picks_count: tipsterPicks.length,
    tipster_raw_response: tipsterResult.narrative_text ?? null,
    tipster_error: tipsterResult.error ?? null,
    matches_sample: buildMatchesSample(fetchOutput.matchs),
    picks_persisted_count: persistedSuccess.length,
    picks_persisted_ids: persistedSuccess.map((p) => p.db_id).filter(Boolean) as string[],
    notes: persistedErrors.length > 0 ? `${persistedErrors.length} erreur(s) de persist` : null,
  });

  return NextResponse.json({
    success: true,
    mode: "live",
    drop_window: dropWindow,
    persisted: persistedSuccess,
    stats,
  });
};