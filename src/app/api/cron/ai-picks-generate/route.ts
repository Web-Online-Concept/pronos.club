/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-generate (v3)
 *
 * Pipeline tipster IA — version refondée le 02/05/2026.
 * Dossier par pick restauré le 02/05/2026 (fix régression v3).
 *
 * ARCHITECTURE :
 *   1. multi-sport-fetcher    → enrichit ~160 matchs (foot + tennis + basket + ...)
 *   2. claude-tipster         → 1 appel Claude Sonnet 4.6 → 1-10 picks JSON
 *   3. gpt-validator          → GPT-4o avocat du diable indulgent → veto/warning/approve
 *   4. persist-tipster-pick   → INSERT en BDD ai_picks pour chaque pick non-vetoé
 *   5. generateDossier        → 1 appel Claude DOSSIER par pick (analyse complète 7 sections)
 *                               + aggregateMatchData() si fixture_id dispo (foot)
 *   6. persistDossier         → INSERT ai_picks_analysis (full_text + sections JSON)
 *
 * COÛTS ESTIMÉS / RUN :
 *   - api-football : ~5000 calls (gratuit, dans la fenêtre 7500 quota jour)
 *   - the-odds-api : ~50 calls (largement dans le quota)
 *   - matchstat    : ~100 calls (largement dans 10000/mois)
 *   - claude tipster  : ~0.10€ par appel (input ~80k tokens, output ~5k tokens)
 *   - claude dossier  : ~0.04€ par pick × N picks/jour
 *   - gpt-4o validator: ~0.02€ par appel
 *   - TOTAL           : ~0.20-0.40€ / jour selon volume picks
 *
 * ⚠ ATTENTION TIMEOUT VERCEL :
 *   - Vercel Pro = max 300s par cron
 *   - La génération de dossier par pick ajoute ~15-20s par pick
 *   - Si > 5 picks : risque de timeout → monitorer, splitter si nécessaire
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis
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
} from "@/lib/ai-picks-v3/tipster-types";
import type { ConsensusCandidate } from "@/types/ai-picks-v2";
import { buildClassicConsensusKey } from "@/types/ai-picks-v2";

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
  if (!CRON_SECRET) return true;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === CRON_SECRET;
};

const logSection = (title: string): void => {
  console.log(`\n${"=".repeat(60)}\n[ai-picks-generate v3] ${title}\n${"=".repeat(60)}`);
};

// ============================================================================
// ADAPTER : TipsterPick → ConsensusCandidate (pour generateDossier)
// ============================================================================

/**
 * Adapte un TipsterPick v3 au format ConsensusCandidate attendu par
 * generateDossier() (système de dossier hérité de la v2).
 *
 * generateDossier() utilise ConsensusCandidate pour construire le prompt
 * dossier — on lui passe toutes les infos disponibles du pick Claude tipster.
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

  // fixtureRef : fixture_id api-football si dispo, sinon eventName slugifié
  const fixtureRef =
    fixture?.apifootball_fixture_id != null
      ? String(fixture.apifootball_fixture_id)
      : eventName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const key = buildClassicConsensusKey(fixtureRef, market, selection);

  // consensusTier : mapping vers les valeurs valides de ConsensusTier
  // approve → "isolated_high" (pick retenu avec confiance élevée)
  // warning → "partial"       (pick retenu mais avec réserves)
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logSection(`Start - date=${targetDate} dry_run=${dryRun}`);

  // ─── ÉTAPE 1 : Fetch + enrichissement multi-sports
  logSection("STEP 1 - Multi-sport fetch + enrichment");
  let fetchOutput;
  try {
    fetchOutput = await fetchMultiSportFixturesForDate(targetDate);
    console.log(
      `[fetch] ${fetchOutput.matchs.length} matchs. Stats: ${JSON.stringify(fetchOutput.stats.matchs_par_sport)}`
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
      { success: false, stage: "fetch", error, duration_ms: Date.now() - startedAt },
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
  logSection("STEP 2 - Claude tipster (Sonnet 4.6 + prompt v2.3)");
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
        `  - #${pick.id} COMBINÉ ${pick.selections.length} sélections (confiance ${pick.confiance})`
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
        tipster: { picks_generated: 0, cost_usd: tipsterResult.meta.cost_usd, error: null },
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
    logSection("STEP 4 - DRY RUN (skip persist + dossier)");
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
        const validated = buildValidatedPick(p, verdict, fixturesByMatch);
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

  // ─── ÉTAPE 4 + 5 : Persist + Dossier par pick
  logSection("STEP 4+5 - Persist BDD + Dossier par pick");
  const generationBatch = `tipster-v3-${targetDate}`;

  const persistedSuccess: Array<{ pick_id: number; db_id: string; slug: string }> = [];
  const persistedErrors: Array<{ pick_id: number; error: string }> = [];

  for (const pick of picksToKeep) {
    const verdict = verdictsByPickId.get(pick.id)!;
    const validated = buildValidatedPick(pick, verdict, fixturesByMatch);

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

    persistedSuccess.push({ pick_id: pick.id, db_id: result.pickId, slug: result.slug });
    console.log(`  ✓ Pick #${pick.id} persisté (id=${result.pickId}, slug=${result.slug})`);

    // ── 4b. Dossier complet par pick (comme l'ancien système v2)
    try {
      // Fixture du pick (pour api-football fixture_id + event_date)
      const fixture =
        pick.type === "simple"
          ? fixturesByMatch.get((pick as TipsterPickSimple).match) ?? null
          : null;

      const apifootballFixtureId = fixture?.apifootball_fixture_id ?? null;

      // Données api-football enrichies (foot uniquement, si fixture_id dispo)
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
          // matchData reste null → dossier généré sans données api-football
        }
      }

      // Adapter le pick v3 vers ConsensusCandidate (format attendu par generateDossier)
      const consensusCandidate = adaptTipsterPickForDossier(
        pick,
        verdict,
        validated,
        fixture ?? null
      );

      // Génération dossier Claude (1 appel dédié par pick, ~4500 tokens output)
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

      // Persist dossier → ai_picks_analysis + dossier_status = "ready"
      const dossierPersistResult = await persistDossier(
        result.pickId,
        dossierResult.fullText ?? "",
        dossierResult.sections,
        null, // pas de snapshot bookmakers spécifique v3
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
      // On ne bloque pas le pick — il est persisté, juste sans dossier
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