/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-publish-results (V3.5)
 *
 * Publie les résultats des picks résolus la veille :
 *   1. Finalise le clv_pct sur tous les picks résolus hier
 *   2. Agrège le bilan jour (won/lost/void, ROI, CLV moyen, par tier, etc.)
 *   3. (Étapes 3+4 à venir) Publie sur Telegram + X
 *
 * Schedule : "0 6 * * *" (8h Paris été = 6h UTC)
 * Décalé de 30 min après ai-picks-resolve (qui tourne à 6h UTC) pour laisser
 * le temps au resolver de finir.
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis
 *
 * MODES :
 *   - GET / POST sans paramètre  → publish bilan d'hier
 *   - GET / POST ?date=YYYY-MM-DD → publish bilan d'une date spécifique (replay)
 *   - GET / POST ?dry_run=true → calcul + retour JSON sans publier sur Telegram/X
 */

import { NextRequest, NextResponse } from "next/server";
import {
  finalizeCLVForResolvedPicks,
  aggregateBilanJour,
} from "@/lib/clv/resolve";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Phase 1 : juste calcul CLV + agrégat. Phase 2 ajoutera Telegram/X.
// 120s suffit largement.
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ============================================================================
// HELPERS
// ============================================================================

const getYesterdayParisDate = (): string => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return yesterday.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
};

const isAuthorized = (request: NextRequest): boolean => {
  if (!CRON_SECRET) return true;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === CRON_SECRET;
};

// ============================================================================
// HANDLER
// ============================================================================

const handlePublishResults = async (
  request: NextRequest
): Promise<NextResponse> => {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const overrideDate = url.searchParams.get("date");
  const targetDate = overrideDate ?? getYesterdayParisDate();

  console.log(
    `[ai-picks-publish-results] Start - date=${targetDate} dry_run=${dryRun}`
  );

  try {
    // ─── ÉTAPE 1 : Finaliser le CLV sur les picks résolus hier
    console.log("[publish-results] STEP 1 - Finalize CLV for resolved picks");
    const clvResult = await finalizeCLVForResolvedPicks(targetDate);
    console.log(
      `[publish-results] CLV : ${clvResult.picks_with_clv_computed} computed, ${clvResult.picks_skipped_no_closing} skipped, ${clvResult.errors.length} errors`
    );

    // ─── ÉTAPE 2 : Agréger le bilan jour
    console.log("[publish-results] STEP 2 - Aggregate bilan jour");
    const bilan = await aggregateBilanJour(targetDate);

    if (!bilan) {
      // Q13 réponse A : skip silencieux si aucun pick résolu
      console.log(
        `[publish-results] Aucun pick résolu le ${targetDate}, skip silencieux (pas de post Telegram/X)`
      );
      return NextResponse.json({
        success: true,
        date: targetDate,
        message: "Aucun pick résolu, skip silencieux",
        clv_finalize: clvResult,
        bilan: null,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    console.log(
      `[publish-results] Bilan ${bilan.date} : ${bilan.total_picks} picks (${bilan.picks_won}V / ${bilan.picks_lost}D / ${bilan.picks_void}N), ROI ${bilan.roi_pct.toFixed(2)}%, CLV moy ${bilan.clv_avg_pct ?? "n/a"}%`
    );

    // ─── ÉTAPE 3 : Publication Telegram + X
    // À implémenter dans les Étapes 3 et 4 de la Session 2.
    // Pour l'instant, on retourne juste le bilan calculé.
    if (dryRun) {
      console.log(
        "[publish-results] dry_run=true → bilan calculé, aucune publication"
      );
      return NextResponse.json({
        success: true,
        mode: "dry_run",
        date: targetDate,
        clv_finalize: clvResult,
        bilan,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    // TODO Étape 3 : publishResultsBilanToPublicChannel(bilan)
    // TODO Étape 4 : postBilanThreadToX(bilan)

    console.log(
      `[publish-results] ✓ Bilan calculé, publication Telegram/X à implémenter (Étapes 3+4)`
    );

    return NextResponse.json({
      success: true,
      mode: "live",
      date: targetDate,
      clv_finalize: clvResult,
      bilan,
      published: {
        telegram: false,
        x: false,
        note: "Modules diffusion à implémenter en Étapes 3+4 Session 2",
      },
      total_duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[publish-results] FATAL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error,
        date: targetDate,
        total_duration_ms: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
};

// ============================================================================
// EXPORTS NEXT.JS
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handlePublishResults(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePublishResults(request);
}