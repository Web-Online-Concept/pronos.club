/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-bilan-hebdo (V3.5 - Étape 5)
 *
 * Génère et publie le bilan de la semaine ISO qui vient de se terminer.
 *
 * Schedule : "0 20 * * 0" (dimanche 22h Paris été = 20h UTC)
 *
 * Logique :
 *   1. Agrège la semaine ISO contenant aujourd'hui (= dimanche)
 *   2. UPSERT dans weekly_bilans (cache + permalink)
 *   3. Publie sur Telegram public canal
 *   4. Publie thread X (5 posts)
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis
 *
 * MODES :
 *   - GET / POST → bilan de la semaine en cours (= semaine du dimanche actuel)
 *   - GET / POST ?week=YYYY-MM-DD → bilan de la semaine ISO contenant cette date (replay)
 *   - GET / POST ?dry_run=true → calcul + persist sans publier sur Telegram/X
 */

import { NextRequest, NextResponse } from "next/server";
import {
  aggregateBilanHebdo,
  persistWeeklyBilan,
} from "@/lib/bilan/hebdo-generator";
import { publishHebdoBilanToPublicChannel } from "@/lib/telegram/public-channel";
import { postThread } from "@/lib/x/post";
import { buildBilanHebdoThreadForX } from "@/lib/x/format-bilan-hebdo";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Aggregate + persist + 1 Telegram post + thread X 5 posts = ~30s typique
export const maxDuration = 120;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// ============================================================================
// HELPERS
// ============================================================================

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

const handleBilanHebdo = async (request: NextRequest): Promise<NextResponse> => {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const overrideWeekDate = url.searchParams.get("week");

  // Référence = soit la date passée en param, soit aujourd'hui
  const referenceDate = overrideWeekDate
    ? new Date(`${overrideWeekDate}T12:00:00+02:00`)
    : new Date();

  console.log(
    `[ai-picks-bilan-hebdo] Start - reference=${referenceDate.toISOString()} dry_run=${dryRun}`
  );

  try {
    // ─── ÉTAPE 1 : Agréger le bilan hebdo
    console.log("[bilan-hebdo] STEP 1 - Aggregate bilan");
    const bilan = await aggregateBilanHebdo(referenceDate);

    if (!bilan) {
      return NextResponse.json(
        {
          success: false,
          error: "aggregateBilanHebdo a retourné null (erreur fetch BDD)",
          total_duration_ms: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    console.log(
      `[bilan-hebdo] Bilan ${bilan.week_slug} : ${bilan.total_picks} picks, ROI ${bilan.roi_pct.toFixed(2)}%, profit ${bilan.total_profit_units.toFixed(2)}U`
    );

    // Si aucun pick : on persist quand même (page web vide possible)
    // mais on skip la publication Telegram/X (cohérent avec Q13-A)
    if (bilan.total_picks === 0) {
      console.log("[bilan-hebdo] Aucun pick résolu cette semaine → skip publication, mais on persist le bilan vide");
      const persistResult = await persistWeeklyBilan(bilan);
      return NextResponse.json({
        success: true,
        week_slug: bilan.week_slug,
        message: "Bilan hebdo vide, persisté sans publication",
        persisted: persistResult.success,
        published: { telegram: false, x: false, reason: "no_picks_resolved" },
        bilan,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    // ─── ÉTAPE 2 : Persist en BDD (avant publication, comme ça le permalink existe quand le post arrive)
    console.log("[bilan-hebdo] STEP 2 - Persist weekly_bilans");
    const persistResult = await persistWeeklyBilan(bilan);
    if (!persistResult.success) {
      console.warn(`[bilan-hebdo] Persist failed: ${persistResult.error}`);
      // On continue : la publication ne peut pas pointer vers une page sans data
      // mais on tente quand même Telegram/X (le link tombera sur 404, gracieux)
    }

    // ─── ÉTAPE 3 : Publication
    if (dryRun) {
      console.log("[bilan-hebdo] dry_run=true → bilan persisté, aucune publication");
      const xThreadPreview = buildBilanHebdoThreadForX(bilan);
      return NextResponse.json({
        success: true,
        mode: "dry_run",
        week_slug: bilan.week_slug,
        persisted: persistResult.success,
        x_thread_preview: xThreadPreview,
        bilan,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    // ÉTAPE 3a : Telegram bilan hebdo
    console.log("[bilan-hebdo] STEP 3a - Publication Telegram public");
    const telegramResult = await publishHebdoBilanToPublicChannel(bilan);
    if (telegramResult.success) {
      console.log(`[bilan-hebdo] ✓ Telegram publié, message_id=${telegramResult.message_id}`);
    } else {
      console.warn(`[bilan-hebdo] ✗ Telegram échec: ${telegramResult.error}`);
    }

    // ÉTAPE 3b : X thread bilan hebdo (5 posts)
    console.log("[bilan-hebdo] STEP 3b - Publication X thread (5 posts)");
    const xThreadTexts = buildBilanHebdoThreadForX(bilan);
    const xThreadResult = await postThread(xThreadTexts);
    if (xThreadResult.success) {
      console.log(
        `[bilan-hebdo] ✓ X thread publié : ${xThreadResult.posted_count}/${xThreadResult.total_count} posts (root tweet_id=${xThreadResult.tweet_ids[0]})`
      );
    } else {
      console.warn(
        `[bilan-hebdo] ✗ X thread échec partiel : ${xThreadResult.posted_count}/${xThreadResult.total_count} posts publiés`
      );
    }

    // ─── ÉTAPE 4 : Update weekly_bilans avec publish meta
    if (persistResult.success && (telegramResult.success || xThreadResult.success)) {
      await persistWeeklyBilan(bilan, {
        telegram_message_id: telegramResult.message_id,
        telegram_published_at: telegramResult.success ? new Date().toISOString() : undefined,
        x_root_tweet_id: xThreadResult.tweet_ids[0],
        x_published_at: xThreadResult.success ? new Date().toISOString() : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      mode: "live",
      week_slug: bilan.week_slug,
      persisted: persistResult.success,
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
      bilan_summary: {
        total_picks: bilan.total_picks,
        roi_pct: bilan.roi_pct,
        profit: bilan.total_profit_units,
        winrate_pct: bilan.winrate_pct,
        clv_avg_pct: bilan.clv_avg_pct,
      },
      total_duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[bilan-hebdo] FATAL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        error,
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
  return handleBilanHebdo(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleBilanHebdo(request);
}