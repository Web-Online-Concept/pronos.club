/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-generate (v3)
 *
 * Pipeline tipster IA — version refondée le 02/05/2026.
 *
 * ARCHITECTURE :
 *   1. multi-sport-fetcher    → enrichit ~160 matchs (foot + tennis + basket + ...)
 *   2. claude-tipster         → 1 appel Claude Sonnet 4.6 → 1-10 picks JSON
 *   3. gpt-validator          → GPT-4o avocat du diable indulgent → veto/warning/approve
 *   4. persist-tipster-pick   → INSERT en BDD ai_picks pour chaque pick non-vetoé
 *
 * COÛTS ESTIMÉS / RUN :
 *   - api-football : ~5000 calls (gratuit, dans la fenêtre 7500 quota jour)
 *   - the-odds-api : ~50 calls (largement dans le quota)
 *   - matchstat    : ~100 calls (largement dans 10000/mois)
 *   - claude       : ~0.10€ par appel (input ~80k tokens, output ~5k tokens)
 *   - gpt-4o       : ~0.02€ par appel (input ~10k tokens, output ~1k tokens)
 *   - TOTAL        : ~0.12€ / jour soit ~3.60€ / mois
 *
 * DURÉE :
 *   - 5-15 minutes selon throttling api-football
 *   - Largement dans le timeout Vercel Pro (300s = 5min) → ⚠ peut nécessiter un upgrade
 *
 * ⚠ ATTENTION TIMEOUT VERCEL :
 *   - Vercel Pro = max 300s par cron
 *   - Si le run dépasse 5 min, il faudra :
 *     a) Soit splitter le fetch en 2 crons (fetch + génération)
 *     b) Soit passer à Vercel Enterprise (max 900s)
 *     c) Soit déporter le fetch sur un service externe (Render, Railway...)
 *   - Pour la v3, on accepte le risque et on monitore. Si dépassement → split.
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis (sécurité Vercel cron)
 *   - Sauf en dry_run=true (pour tests manuels)
 *
 * MODES :
 *   - GET / POST sans paramètre  → run normal, persiste en BDD
 *   - GET / POST ?dry_run=true   → run complet mais SANS insertion BDD (test)
 *   - GET / POST ?date=YYYY-MM-DD → run pour une date spécifique (replay)
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchMultiSportFixturesForDate } from "@/lib/ai-picks-v3/multi-sport-fetcher";
import { runClaudeTipster } from "@/lib/ai-picks-v3/claude-tipster";
import { runGptValidator } from "@/lib/ai-picks-v3/gpt-validator";
import {
  persistTipsterPick,
  buildFixturesByMatchMap,
  buildValidatedPick,
} from "@/lib/ai-picks-v3/persist-tipster-pick";
import type {
  GenerationStats,
  TipsterPick,
  ValidatorVerdict,
} from "@/lib/ai-picks-v3/tipster-types";

// ============================================================================
// CONFIGURATION
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (max Vercel Pro)

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ============================================================================
// HELPERS
// ============================================================================

const getTodayParisDate = (): string => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
};

const isAuthorized = (request: NextRequest): boolean => {
  if (!CRON_SECRET) return true; // dev local sans secret
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === CRON_SECRET;
};

const logSection = (title: string): void => {
  console.log(`\n${"=".repeat(60)}\n[ai-picks-generate v3] ${title}\n${"=".repeat(60)}`);
};

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const handleGenerate = async (request: NextRequest): Promise<NextResponse> => {
  const startedAt = Date.now();

  // ─── Auth (sauf si dry_run)
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const overrideDate = url.searchParams.get("date");
  const targetDate = overrideDate ?? getTodayParisDate();

  if (!dryRun && !isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  logSection(`Start - date=${targetDate} dry_run=${dryRun}`);

  // ─── ÉTAPE 1 : Fetch + enrichissement multi-sports
  logSection("STEP 1 - Multi-sport fetch + enrichment");
  let fetchOutput;
  try {
    fetchOutput = await fetchMultiSportFixturesForDate(targetDate);
    console.log(
      `[fetch] ${fetchOutput.matchs.length} matchs au total. Stats: ${JSON.stringify(fetchOutput.stats.matchs_par_sport)}`
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
      {
        success: false,
        stage: "fetch",
        error,
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }

  if (fetchOutput.matchs.length === 0) {
    console.warn("[fetch] Aucun match aujourd'hui. Arrêt.");
    return NextResponse.json({
      success: true,
      message: "Aucun match aujourd'hui",
      stats: {
        date: targetDate,
        duration_ms: Date.now() - startedAt,
        fetch: fetchOutput.stats,
        tipster: { picks_generated: 0, cost_usd: 0, error: null },
        validator: { approved: 0, warnings: 0, vetoed: 0, cost_usd: 0, error: null },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 2 : Claude tipster
  logSection("STEP 2 - Claude tipster (Sonnet 4.6 + prompt v2.2)");
  const tipsterResult = await runClaudeTipster(fetchOutput);
  console.log(
    `[tipster] model=${tipsterResult.meta.model} tokens_in=${tipsterResult.meta.tokens_input} tokens_out=${tipsterResult.meta.tokens_output} cost=${tipsterResult.meta.cost_usd}$`
  );

  if (tipsterResult.error || !tipsterResult.output) {
    console.error("[tipster] FATAL ERROR:", tipsterResult.error);
    return NextResponse.json(
      {
        success: false,
        stage: "tipster",
        error: tipsterResult.error,
        meta: tipsterResult.meta,
        narrative_text: tipsterResult.narrative_text,
        duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }

  const tipsterPicks = tipsterResult.output.pronostics;
  console.log(`[tipster] ${tipsterPicks.length} picks générés`);
  for (const pick of tipsterPicks) {
    if (pick.type === "simple") {
      console.log(
        `  - #${pick.id} ${pick.sport} ${pick.match} → "${pick.selection}" @ ${pick.cote_arjel ?? "?"} (confiance ${pick.confiance})`
      );
    } else {
      console.log(
        `  - #${pick.id} COMBINÉ ${pick.selections.length} sélections (cote totale ${pick.cote_totale_arjel ?? "?"}, confiance ${pick.confiance})`
      );
    }
  }

  if (tipsterPicks.length === 0) {
    console.log("[tipster] 0 pick — journée trop incertaine. Arrêt sain.");
    return NextResponse.json({
      success: true,
      message: "Aucun pick généré (journée trop incertaine)",
      narrative_text: tipsterResult.narrative_text,
      stats: {
        date: targetDate,
        duration_ms: Date.now() - startedAt,
        fetch: fetchOutput.stats,
        tipster: {
          picks_generated: 0,
          cost_usd: tipsterResult.meta.cost_usd,
          error: null,
        },
        validator: { approved: 0, warnings: 0, vetoed: 0, cost_usd: 0, error: null },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 3 : GPT validator
  logSection("STEP 3 - GPT validator (avocat du diable indulgent)");
  const validatorResult = await runGptValidator(fetchOutput, tipsterPicks);
  console.log(
    `[validator] model=${validatorResult.meta.model} tokens_in=${validatorResult.meta.tokens_input} cost=${validatorResult.meta.cost_usd}$`
  );

  // Stats verdicts
  const verdictCounts = { approved: 0, warnings: 0, vetoed: 0 };
  for (const v of validatorResult.verdicts) {
    if (v.decision === "approve") verdictCounts.approved++;
    else if (v.decision === "warning") verdictCounts.warnings++;
    else if (v.decision === "veto") verdictCounts.vetoed++;
  }
  console.log(
    `[validator] approve=${verdictCounts.approved} warning=${verdictCounts.warnings} veto=${verdictCounts.vetoed}`
  );

  // Logger les vetos pour traçabilité
  for (const v of validatorResult.verdicts) {
    if (v.decision === "veto") {
      console.warn(`[validator] VETO sur pick #${v.pick_id}: ${v.reason}`);
    } else if (v.decision === "warning") {
      console.warn(`[validator] WARNING sur pick #${v.pick_id}: ${v.reason}`);
    }
  }

  // ─── Filtrage des picks vetoés (on garde les approve + warning)
  const verdictsByPickId = new Map<number, ValidatorVerdict>(
    validatorResult.verdicts.map((v) => [v.pick_id, v])
  );
  const picksToKeep: TipsterPick[] = tipsterPicks.filter((p) => {
    const v = verdictsByPickId.get(p.id);
    return v && v.decision !== "veto";
  });

  console.log(`[validator] ${picksToKeep.length}/${tipsterPicks.length} picks conservés`);

  // ─── ÉTAPE 4 : Persistance BDD
  if (dryRun) {
    logSection("STEP 4 - DRY RUN (skip persist)");
    console.log("[persist] dry_run=true → aucune insertion BDD");

    return NextResponse.json({
      success: true,
      mode: "dry_run",
      message: `Dry run réussi : ${picksToKeep.length} picks auraient été persistés`,
      narrative_text: tipsterResult.narrative_text,
      tipster_output: tipsterResult.output,
      validator_verdicts: validatorResult.verdicts,
      picks_to_persist: picksToKeep.map((p) => {
        const verdict = verdictsByPickId.get(p.id)!;
        const validated = buildValidatedPick(p, verdict);
        return {
          pick_id: p.id,
          decision: verdict.decision,
          effective_odds: validated.effective_odds,
          effective_bookmaker: validated.effective_bookmaker,
        };
      }),
      stats: {
        date: targetDate,
        duration_ms: Date.now() - startedAt,
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

  logSection("STEP 4 - Persistance BDD ai_picks");
  const fixturesByMatch = buildFixturesByMatchMap(fetchOutput.matchs);
  const generationBatch = `tipster-v3-${targetDate}`;

  const persistedSuccess: Array<{ pick_id: number; db_id: string; slug: string }> = [];
  const persistedErrors: Array<{ pick_id: number; error: string }> = [];

  for (const pick of picksToKeep) {
    const verdict = verdictsByPickId.get(pick.id)!;
    const validated = buildValidatedPick(pick, verdict);

    const result = await persistTipsterPick({
      validated,
      generationBatch,
      fixturesByMatch,
    });

    if (result.success && result.pickId && result.slug) {
      persistedSuccess.push({
        pick_id: pick.id,
        db_id: result.pickId,
        slug: result.slug,
      });
      console.log(`  ✓ Pick #${pick.id} persisté (BDD id=${result.pickId}, slug=${result.slug})`);
    } else {
      persistedErrors.push({
        pick_id: pick.id,
        error: result.error ?? "Unknown error",
      });
      const reason = result.skipReason ? ` (${result.skipReason})` : "";
      console.warn(
        `  ✗ Pick #${pick.id} non persisté${reason}: ${result.error}`
      );
    }
  }

  // ─── Résultat final
  const stats: GenerationStats = {
    date: targetDate,
    duration_ms: Date.now() - startedAt,
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

  logSection(`Done in ${(stats.duration_ms / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(stats, null, 2));

  return NextResponse.json({
    success: true,
    mode: "live",
    persisted: persistedSuccess,
    stats,
  });
};

// ============================================================================
// EXPORTS NEXT.JS
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleGenerate(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleGenerate(request);
}