/**
 * ═══════════════════════════════════════════════════════════════════
 * CRON — AUDIT DES PRONOS IA
 * ═══════════════════════════════════════════════════════════════════
 *
 * Route : /api/cron/ai-picks-audit
 * Planification : tous les jours à 07h15 UTC (15 min après génération)
 *
 * Pourquoi 15 min après ?
 *   - La génération tourne à 7h UTC
 *   - Prend ~15s, donc finie vers 7h01
 *   - On laisse 15 min de marge pour éviter tout souci de timing
 *
 * Fonctionnement :
 *   1. Vérifie l'auth CRON_SECRET
 *   2. Appelle auditTodayPicks() qui traite tous les picks 'pending_review'
 *   3. Retourne rapport JSON
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { auditTodayPicks } from "@/lib/ai/audit-agent";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300; // 5 min max (plusieurs appels Claude séquentiels)


function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const vercelSignature = req.headers.get("x-vercel-cron-signature");
  if (vercelSignature) return true;

  return false;
}


export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron] ▶ Démarrage ai-picks-audit");

  try {
    const report = await auditTodayPicks();
    return NextResponse.json(
      { status: report.success ? "ok" : "error", ...report },
      { status: report.success ? 200 : 500 },
    );
  } catch (err) {
    console.error("[Cron] ai-picks-audit fatal:", err);
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