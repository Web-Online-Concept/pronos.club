/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-generate (v3)
 *
 * ÉTAPE 1/2 du pipeline : fetch + tipster + validator + persist uniquement.
 * La génération de dossier est déléguée au cron /api/cron/ai-picks-dossier
 * qui tourne 30 minutes plus tard (9h15 Paris) pour éviter le timeout Vercel.
 *
 * ARCHITECTURE :
 *   1. multi-sport-fetcher → enrichit ~160 matchs
 *   2. claude-tipster      → 1 appel Claude Sonnet → 1-10 picks JSON
 *   3. gpt-validator       → GPT-4o validator → veto/warning/approve
 *   4. persist-tipster-pick → INSERT ai_picks (dossier_status="queued")
 *
 * Le cron ai-picks-dossier prend ensuite les picks "queued" et génère
 * les dossiers d'analyse complets (7 sections + api-football).
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
export const maxDuration = 300;

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
  return authHeader.replace(/^Bearer\s+/i, "").trim() === CRON_SECRET;
};

const logSection = (title: string): void => {
  console.log(`\n${"=".repeat(60)}\n[ai-picks-generate v3] ${title}\n${"=".repeat(60)}`);
};

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

const handleGenerate = async (request: NextRequest): Promise<NextResponse> => {
  const startedAt = Date.now();
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const overrideDate = url.searchParams.get("date");
  const targetDate = overrideDate ?? getTodayParisDate();

  if (!dryRun && !isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logSection(`Start - date=${targetDate} dry_run=${dryRun}`);

  // ─── ÉTAPE 1 : Fetch
  logSection("STEP 1 - Multi-sport fetch + enrichment");
  let fetchOutput;
  try {
    fetchOutput = await fetchMultiSportFixturesForDate(targetDate);
    console.log(`[fetch] ${fetchOutput.matchs.length} matchs. Stats: ${JSON.stringify(fetchOutput.stats.matchs_par_sport)}`);
    if (fetchOutput.stats.unresolved_leagues.length > 0) {
      console.warn(`[fetch] ${fetchOutput.stats.unresolved_leagues.length} ligue(s) NON résolue(s):`, fetchOutput.stats.unresolved_leagues);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[fetch] FATAL ERROR:", error);
    return NextResponse.json({ success: false, stage: "fetch", error, duration_ms: Date.now() - startedAt }, { status: 500 });
  }

  if (fetchOutput.matchs.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Aucun match aujourd'hui",
      stats: {
        date: targetDate, duration_ms: Date.now() - startedAt,
        fetch: fetchOutput.stats,
        tipster: { picks_generated: 0, cost_usd: 0, error: null },
        validator: { approved: 0, warnings: 0, vetoed: 0, cost_usd: 0, error: null },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 2 : Claude tipster
  logSection("STEP 2 - Claude tipster (Sonnet 4.6 + prompt v2.3)");
  const tipsterResult = await runClaudeTipster(fetchOutput);
  console.log(`[tipster] model=${tipsterResult.meta.model} tokens_in=${tipsterResult.meta.tokens_input} tokens_out=${tipsterResult.meta.tokens_output} cost=${tipsterResult.meta.cost_usd}$`);

  if (tipsterResult.error || !tipsterResult.output) {
    console.error("[tipster] FATAL ERROR:", tipsterResult.error);
    return NextResponse.json({ success: false, stage: "tipster", error: tipsterResult.error, duration_ms: Date.now() - startedAt }, { status: 500 });
  }

  const tipsterPicks = tipsterResult.output.pronostics;
  console.log(`[tipster] ${tipsterPicks.length} picks générés`);
  for (const pick of tipsterPicks) {
    if (pick.type === "simple") {
      console.log(`  - #${pick.id} ${pick.sport} ${pick.match} → "${pick.selection}" @ ${pick.cote_arjel ?? "?"} (confiance ${pick.confiance})`);
    } else {
      console.log(`  - #${pick.id} COMBINÉ ${pick.selections.length} sélections (confiance ${pick.confiance})`);
    }
  }

  if (tipsterPicks.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Aucun pick généré (journée trop incertaine)",
      stats: {
        date: targetDate, duration_ms: Date.now() - startedAt,
        fetch: fetchOutput.stats,
        tipster: { picks_generated: 0, cost_usd: tipsterResult.meta.cost_usd, error: null },
        validator: { approved: 0, warnings: 0, vetoed: 0, cost_usd: 0, error: null },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 3 : GPT validator
  logSection("STEP 3 - GPT validator");
  const validatorResult = await runGptValidator(fetchOutput, tipsterPicks);
  console.log(`[validator] model=${validatorResult.meta.model} cost=${validatorResult.meta.cost_usd}$`);

  const verdictCounts = { approved: 0, warnings: 0, vetoed: 0 };
  for (const v of validatorResult.verdicts) {
    if (v.decision === "approve") verdictCounts.approved++;
    else if (v.decision === "warning") verdictCounts.warnings++;
    else if (v.decision === "veto") verdictCounts.vetoed++;
  }
  console.log(`[validator] approve=${verdictCounts.approved} warning=${verdictCounts.warnings} veto=${verdictCounts.vetoed}`);
  for (const v of validatorResult.verdicts) {
    if (v.decision === "veto") console.warn(`[validator] VETO pick #${v.pick_id}: ${v.reason}`);
    else if (v.decision === "warning") console.warn(`[validator] WARNING pick #${v.pick_id}: ${v.reason}`);
  }

  const verdictsByPickId = new Map<number, ValidatorVerdict>(
    validatorResult.verdicts.map((v) => [v.pick_id, v])
  );
  const picksToKeep: TipsterPick[] = tipsterPicks.filter((p) => {
    const v = verdictsByPickId.get(p.id);
    return v && v.decision !== "veto";
  });
  console.log(`[validator] ${picksToKeep.length}/${tipsterPicks.length} picks conservés`);

  const fixturesByMatch = buildFixturesByMatchMap(fetchOutput.matchs);

  // ─── DRY RUN
  if (dryRun) {
    logSection("STEP 4 - DRY RUN (skip persist)");
    return NextResponse.json({
      success: true,
      mode: "dry_run",
      message: `Dry run réussi : ${picksToKeep.length} picks auraient été persistés`,
      narrative_text: tipsterResult.narrative_text,
      tipster_output: tipsterResult.output,
      validator_verdicts: validatorResult.verdicts,
      picks_to_persist: picksToKeep.map((p) => {
        const verdict = verdictsByPickId.get(p.id)!;
        const validated = buildValidatedPick(p, verdict, fixturesByMatch);
        return { pick_id: p.id, decision: verdict.decision, effective_odds: validated.effective_odds, effective_bookmaker: validated.effective_bookmaker };
      }),
      stats: {
        date: targetDate, duration_ms: Date.now() - startedAt,
        fetch: fetchOutput.stats,
        tipster: { picks_generated: tipsterPicks.length, cost_usd: tipsterResult.meta.cost_usd, error: null },
        validator: { ...verdictCounts, cost_usd: validatorResult.meta.cost_usd, error: null },
        persisted: { success: 0, errors: [] },
      } as GenerationStats,
    });
  }

  // ─── ÉTAPE 4 : Persist uniquement (dossier_status="queued")
  logSection("STEP 4 - Persist BDD (dossier_status=queued → cron ai-picks-dossier à 9h15)");
  const generationBatch = targetDate;

  const persistedSuccess: Array<{ pick_id: number; db_id: string; slug: string }> = [];
  const persistedErrors: Array<{ pick_id: number; error: string }> = [];

  for (const pick of picksToKeep) {
    const verdict = verdictsByPickId.get(pick.id)!;
    const validated = buildValidatedPick(pick, verdict, fixturesByMatch);

    const result = await persistTipsterPick({ validated, generationBatch, fixturesByMatch });

    if (result.success && result.pickId && result.slug) {
      persistedSuccess.push({ pick_id: pick.id, db_id: result.pickId, slug: result.slug });
      console.log(`  ✓ Pick #${pick.id} persisté (id=${result.pickId}, slug=${result.slug}) — dossier en attente`);
    } else {
      persistedErrors.push({ pick_id: pick.id, error: result.error ?? "Unknown error" });
      const reason = result.skipReason ? ` (${result.skipReason})` : "";
      console.warn(`  ✗ Pick #${pick.id} non persisté${reason}: ${result.error}`);
    }
  }

  const stats: GenerationStats = {
    date: targetDate,
    duration_ms: Date.now() - startedAt,
    fetch: fetchOutput.stats,
    tipster: { picks_generated: tipsterPicks.length, cost_usd: tipsterResult.meta.cost_usd, error: null },
    validator: { ...verdictCounts, cost_usd: validatorResult.meta.cost_usd, error: null },
    persisted: { success: persistedSuccess.length, errors: persistedErrors },
  };

  logSection(`Done in ${(stats.duration_ms / 1000).toFixed(1)}s — ${persistedSuccess.length} picks persistés, dossiers générés par cron 9h15`);
  console.log(JSON.stringify(stats, null, 2));

  return NextResponse.json({ success: true, mode: "live", persisted: persistedSuccess, stats });
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleGenerate(request);
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleGenerate(request);
}