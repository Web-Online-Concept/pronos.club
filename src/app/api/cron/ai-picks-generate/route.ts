/**
 * ═══════════════════════════════════════════════════════════════════
 * CRON — GÉNÉRATION QUOTIDIENNE DES PRONOS IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Route : /api/crons/ai-picks-generate
 * Planification : tous les jours à 09h00 (heure Paris)
 *
 * Vercel appelle cette route avec un header "Authorization: Bearer ${CRON_SECRET}"
 * ou "x-vercel-cron-signature" (via la config dans vercel.json).
 *
 * Fonctionnement :
 *   1. Vérifie l'authentification CRON_SECRET
 *   2. Appelle generateDailyPicks() qui fait tout le boulot
 *   3. Retourne un rapport JSON avec stats
 *
 * Peut aussi être appelée manuellement avec :
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://pronos.club/api/crons/ai-picks-generate
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { generateDailyPicks } from "@/lib/ai/generate-daily-picks";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Cron peut être long (fetch ESPN + Odds + Claude = 30-60s)
export const maxDuration = 120;


// ═══════════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET non défini");
    return false;
  }

  // Auth via header "Authorization: Bearer xxx" (appel manuel ou cron Vercel)
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  // Auth via "x-vercel-cron-signature" (cron Vercel natif)
  const vercelSignature = req.headers.get("x-vercel-cron-signature");
  if (vercelSignature) return true; // Vercel n'envoie ce header que si c'est un vrai cron

  return false;
}


// ═══════════════════════════════════════════════════════════════════
// HANDLER GET (Vercel appelle toujours en GET pour les crons)
// ═══════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  console.log("[Cron] ▶ Démarrage ai-picks-generate");

  try {
    const report = await generateDailyPicks();

    return NextResponse.json(
      {
        status: report.success ? "ok" : "error",
        ...report,
      },
      {
        status: report.success ? 200 : 500,
      },
    );
  } catch (err) {
    console.error("[Cron] ai-picks-generate fatal:", err);
    return NextResponse.json(
      {
        status: "fatal_error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}


// ═══════════════════════════════════════════════════════════════════
// HANDLER POST (alternative si besoin d'appel manuel avec body)
// ═══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  return GET(req);
}