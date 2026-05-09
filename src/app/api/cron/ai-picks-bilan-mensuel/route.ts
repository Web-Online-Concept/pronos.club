/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-bilan-mensuel (V3.5 Lot 11)
 *
 * Génère et publie le bilan du mois calendaire qui vient de se terminer.
 *
 * Schedule : "0 20 1 * *" (1er du mois à 22h Paris été = 20h UTC)
 *
 * Logique :
 *   1. Détermine le MOIS PRÉCÉDENT (= mois qui vient de se terminer)
 *   2. Agrège tous les picks résolus dans ce mois
 *   3. UPSERT dans monthly_bilans (cache + permalink)
 *   4. Publie sur Telegram public canal
 *   5. Publie thread X (5 posts)
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis
 *
 * MODES :
 *   - GET / POST → bilan du mois précédent
 *   - GET / POST ?month=YYYY-MM → bilan du mois donné (replay)
 *   - GET / POST ?dry_run=true → calcul + persist sans publier sur Telegram/X
 *
 * Path : src/app/api/cron/ai-picks-bilan-mensuel/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import {
  aggregateBilanMensuel,
  persistMonthlyBilan,
  getPreviousMonthReferenceDate,
} from "@/lib/bilan/mensuel-generator";
import { publishMensuelBilanToPublicChannel } from "@/lib/telegram/public-channel";
import { postThread } from "@/lib/x/post";
import { buildBilanMensuelThreadForX } from "@/lib/x/format-bilan-mensuel";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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

const handleBilanMensuel = async (request: NextRequest): Promise<NextResponse> => {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "true";
  const overrideMonth = url.searchParams.get("month"); // YYYY-MM

  // Détermination de la date de référence
  // - Si paramètre month fourni : on prend le 15 de ce mois
  // - Sinon : on prend le 15 du mois précédent (logique cron)
  let referenceDate: Date;
  if (overrideMonth) {
    // Format attendu : YYYY-MM
    const match = overrideMonth.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return NextResponse.json(
        { error: "Invalid month format, expected YYYY-MM" },
        { status: 400 }
      );
    }
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    referenceDate = new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
  } else {
    referenceDate = getPreviousMonthReferenceDate();
  }

  console.log(
    `[ai-picks-bilan-mensuel] Start - reference=${referenceDate.toISOString()} dry_run=${dryRun}`
  );

  try {
    // ─── ÉTAPE 1 : Agréger le bilan mensuel
    console.log("[bilan-mensuel] STEP 1 - Aggregate bilan");
    const bilan = await aggregateBilanMensuel(referenceDate);

    if (!bilan) {
      return NextResponse.json(
        {
          success: false,
          error: "aggregateBilanMensuel a retourné null (erreur fetch BDD)",
          total_duration_ms: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    console.log(
      `[bilan-mensuel] Bilan ${bilan.month_slug} : ${bilan.total_picks} picks, ROI ${bilan.roi_pct.toFixed(2)}%, profit ${bilan.total_profit_units.toFixed(2)}U`
    );

    // Si aucun pick : on persist quand même (cohérent avec hebdo)
    if (bilan.total_picks === 0) {
      console.log("[bilan-mensuel] Aucun pick résolu ce mois → skip publication, mais on persist le bilan vide");
      const persistResult = await persistMonthlyBilan(bilan);
      return NextResponse.json({
        success: true,
        month_slug: bilan.month_slug,
        message: "Bilan mensuel vide, persisté sans publication",
        persisted: persistResult.success,
        published: { telegram: false, x: false, reason: "no_picks_resolved" },
        bilan,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    // ─── ÉTAPE 2 : Persist en BDD
    console.log("[bilan-mensuel] STEP 2 - Persist monthly_bilans");
    const persistResult = await persistMonthlyBilan(bilan);
    if (!persistResult.success) {
      console.warn(`[bilan-mensuel] Persist failed: ${persistResult.error}`);
    }

    // ─── ÉTAPE 3 : Publication
    if (dryRun) {
      console.log("[bilan-mensuel] dry_run=true → bilan persisté, aucune publication");
      const xThreadPreview = buildBilanMensuelThreadForX(bilan);
      return NextResponse.json({
        success: true,
        mode: "dry_run",
        month_slug: bilan.month_slug,
        persisted: persistResult.success,
        x_thread_preview: xThreadPreview,
        bilan,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    // ÉTAPE 3a : Telegram bilan mensuel
    console.log("[bilan-mensuel] STEP 3a - Publication Telegram public");
    const telegramResult = await publishMensuelBilanToPublicChannel(bilan);
    if (telegramResult.success) {
      console.log(`[bilan-mensuel] ✓ Telegram publié, message_id=${telegramResult.message_id}`);
    } else {
      console.warn(`[bilan-mensuel] ✗ Telegram échec: ${telegramResult.error}`);
    }

    // ÉTAPE 3b : X thread bilan mensuel (5 posts)
    console.log("[bilan-mensuel] STEP 3b - Publication X thread (5 posts)");
    const xThreadTexts = buildBilanMensuelThreadForX(bilan);
    const xThreadResult = await postThread(xThreadTexts);
    if (xThreadResult.success) {
      console.log(
        `[bilan-mensuel] ✓ X thread publié : ${xThreadResult.posted_count}/${xThreadResult.total_count} posts (root tweet_id=${xThreadResult.tweet_ids[0]})`
      );
    } else {
      console.warn(
        `[bilan-mensuel] ✗ X thread échec partiel : ${xThreadResult.posted_count}/${xThreadResult.total_count} posts publiés`
      );
    }

    // ─── ÉTAPE 4 : Update monthly_bilans avec publish meta
    if (persistResult.success && (telegramResult.success || xThreadResult.success)) {
      await persistMonthlyBilan(bilan, {
        telegram_message_id: telegramResult.message_id,
        telegram_published_at: telegramResult.success ? new Date().toISOString() : undefined,
        x_root_tweet_id: xThreadResult.tweet_ids[0],
        x_published_at: xThreadResult.success ? new Date().toISOString() : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      mode: "live",
      month_slug: bilan.month_slug,
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
    console.error("[bilan-mensuel] FATAL ERROR:", error);
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
  return handleBilanMensuel(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleBilanMensuel(request);
}