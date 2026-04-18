/**
 * ═══════════════════════════════════════════════════════════════════
 * CRON — RÉSOLUTION QUOTIDIENNE DES PRONOS IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Route : /api/crons/ai-picks-resolve
 * Planification : tous les jours à 08h00 (heure Paris)
 *
 * Fonctionnement :
 *   1. Vérifie l'authentification CRON_SECRET
 *   2. Appelle resolveDailyPicks() qui résout tous les picks pending
 *   3. Retourne un rapport JSON avec stats
 *
 * L'heure 8h est choisie pour que tous les matchs de la veille
 * (même les NBA nocturnes qui finissent à 5-6h du matin Paris)
 * soient terminés avant qu'on tente de les résoudre.
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveDailyPicks } from "@/lib/ai/espn-resolver";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Résolution peut prendre du temps si beaucoup de picks à résoudre
export const maxDuration = 120;


function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET non défini");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const vercelSignature = req.headers.get("x-vercel-cron-signature");
  if (vercelSignature) return true;

  return false;
}


export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  console.log("[Cron] ▶ Démarrage ai-picks-resolve");

  try {
    const report = await resolveDailyPicks();

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
    console.error("[Cron] ai-picks-resolve fatal:", err);
    return NextResponse.json(
      {
        status: "fatal_error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}


export async function POST(req: NextRequest) {
  return GET(req);
}