/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-publish-results (V3.5)
 *
 * Publie les résultats des picks résolus la veille :
 *   1. Finalise le clv_pct sur tous les picks résolus hier
 *   2. Agrège le bilan jour
 *   3. Publie le bilan sur Telegram public canal @pronos_club_ia
 *   4. Publie le thread bilan sur X (4 posts)
 *
 * Schedule : "30 6 * * *" (8h30 Paris été)
 *
 * V3.5 (mise à jour 09/05/2026 - Étape 4) :
 *   - Ajout publication X thread (~4 posts) du bilan jour
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
import { publishResultsBilanToPublicChannel } from "@/lib/telegram/public-channel";
import { postThread } from "@/lib/x/post";
import { buildBilanJourThreadForX } from "@/lib/x/format-bilan";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// CLV finalize + aggregate + 1 post Telegram + thread X 4 posts (~10s) = ~60s typique
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
      console.log(
        `[publish-results] Aucun pick résolu le ${targetDate}, skip silencieux (pas de post Telegram/X)`
      );
      return NextResponse.json({
        success: true,
        date: targetDate,
        message: "Aucun pick résolu, skip silencieux",
        clv_finalize: clvResult,
        bilan: null,
        published: { telegram: false, x: false, reason: "no_picks_resolved" },
        total_duration_ms: Date.now() - startedAt,
      });
    }

    console.log(
      `[publish-results] Bilan ${bilan.date} : ${bilan.total_picks} picks (${bilan.picks_won}V / ${bilan.picks_lost}D / ${bilan.picks_void}N), ROI ${bilan.roi_pct.toFixed(2)}%, CLV moy ${bilan.clv_avg_pct ?? "n/a"}%`
    );

    // ─── ÉTAPE 3 : Publication
    if (dryRun) {
      console.log(
        "[publish-results] dry_run=true → bilan calculé, aucune publication"
      );
      // Pour debug : on génère quand même les textes du thread X
      const xThreadPreview = buildBilanJourThreadForX(bilan);
      return NextResponse.json({
        success: true,
        mode: "dry_run",
        date: targetDate,
        clv_finalize: clvResult,
        bilan,
        x_thread_preview: xThreadPreview,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    // ÉTAPE 3a : Telegram bilan jour
    console.log("[publish-results] STEP 3a - Publication Telegram public");
    const telegramResult = await publishResultsBilanToPublicChannel(bilan);
    if (telegramResult.success) {
      console.log(
        `[publish-results] ✓ Telegram bilan publié, message_id=${telegramResult.message_id}`
      );
    } else {
      console.warn(
        `[publish-results] ✗ Telegram bilan échec: ${telegramResult.error}`
      );
    }

    // ÉTAPE 3b : X thread bilan jour
    console.log("[publish-results] STEP 3b - Publication X thread (4 posts)");
    const xThreadTexts = buildBilanJourThreadForX(bilan);
    console.log(`[publish-results] X thread : ${xThreadTexts.length} posts à publier`);
    const xThreadResult = await postThread(xThreadTexts);
    if (xThreadResult.success) {
      console.log(
        `[publish-results] ✓ X thread publié : ${xThreadResult.posted_count}/${xThreadResult.total_count} posts (root tweet_id=${xThreadResult.tweet_ids[0]})`
      );
    } else {
      console.warn(
        `[publish-results] ✗ X thread échec partiel : ${xThreadResult.posted_count}/${xThreadResult.total_count} posts publiés, ${xThreadResult.errors.length} erreurs`
      );
    }

    return NextResponse.json({
      success: true,
      mode: "live",
      date: targetDate,
      clv_finalize: clvResult,
      bilan,
      published: {
        telegram: telegramResult.success,
        telegram_message_id: telegramResult.message_id,
        telegram_error: telegramResult.error,
        x: xThreadResult.success,
        x_posted_count: xThreadResult.posted_count,
        x_total_count: xThreadResult.total_count,
        x_root_tweet_id: xThreadResult.tweet_ids[0] ?? null,
        x_tweet_ids: xThreadResult.tweet_ids,
        x_errors: xThreadResult.errors,
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