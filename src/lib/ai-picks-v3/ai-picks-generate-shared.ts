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

/**
 * V3.5 patch (Option A) — Vérifie si un combiné a déjà été pris aujourd'hui.
 *
 * Utilisé par le drop soir pour appliquer le verrou métier "1 combiné max/jour".
 * Si un combiné existe déjà pour cette date, on indique au tipster qu'il ne
 * doit générer QUE des simples au drop soir.
 *
 * Détection : un pick combiné est stocké avec `odds_comparison.combine_meta`
 * non null (cf persist-tipster-pick.ts buildOddsComparison branche `else`).
 *
 * @param targetDate Date au format YYYY-MM-DD (Paris timezone)
 * @returns true si au moins un pick combiné existe pour cette date, false sinon
 */
const hasCombineForDateAlready = async (
  targetDate: string
): Promise<boolean> => {
  try {
    // On récupère tous les picks v3 du jour et on filtre côté JS sur la
    // présence de combine_meta dans odds_comparison (plus robuste qu'une
    // requête JSON path Supabase qui peut être casse-pieds).
    const { data, error } = await supabaseAdmin
      .from("ai_picks")
      .select("id, odds_comparison")
      .eq("event_date", targetDate)
      .eq("generation_version", "v3")
      .is("deleted_at", null);

    if (error) {
      console.warn(
        `[combine-check] Query error: ${error.message} — défaut: pas de combiné pris`
      );
      return false;
    }

    if (!data || data.length === 0) return false;

    const hasCombine = data.some((row) => {
      const oc = row.odds_comparison as Record<string, unknown> | null;
      if (!oc) return false;
      const combineMeta = oc.combine_meta as Record<string, unknown> | undefined;
      return combineMeta != null;
    });

    return hasCombine;
  } catch (err) {
    console.warn(
      `[combine-check] Exception: ${(err as Error).message} — défaut: pas de combiné pris`
    );
    return false;
  }
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
  logSection(dropWindow, `STEP 2 - Claude tipster (Sonnet 4.6 + prompt v2.6, drop=${dropWindow})`);

  // V3.5 Option A : vérifier si un combiné a déjà été pris aujourd'hui
  // (uniquement utile au drop soir, mais on check pour les deux pour les logs).
  const combineAlreadyTakenToday = await hasCombineForDateAlready(targetDate);
  if (combineAlreadyTakenToday) {
    console.log(
      `[combine-check] ✅ Un combiné a déjà été pris pour ${targetDate} — drop ${dropWindow} générera UNIQUEMENT des simples`
    );
  } else {
    console.log(
      `[combine-check] Aucun combiné pris pour ${targetDate} — drop ${dropWindow} peut générer 1 combiné max`
    );
  }

  const tipsterResult = await runClaudeTipster(
    fetchOutput,
    dropWindow,
    combineAlreadyTakenToday
  );
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

  return NextResponse.json({
    success: true,
    mode: "live",
    drop_window: dropWindow,
    persisted: persistedSuccess,
    stats,
  });
};