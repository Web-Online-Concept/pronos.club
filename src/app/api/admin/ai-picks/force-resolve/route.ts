/**
 * ═══════════════════════════════════════════════════════════════════
 * ROUTE API — POST /api/admin/ai-picks/force-resolve
 * ═══════════════════════════════════════════════════════════════════
 *
 * Déclenche manuellement la résolution des picks pending dont les
 * matchs sont terminés (depuis +2h).
 *
 * Utilise exactement la même fonction que le cron automatique de 6h UTC.
 * Pratique pour résoudre les picks le soir même sans attendre le lendemain.
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveDailyPicks } from "@/lib/ai/espn-resolver";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 min max


export async function POST() {
  // Auth admin
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[admin force-resolve] Déclenché par ${user.email}`);

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
    console.error("[admin force-resolve] Erreur:", err);
    return NextResponse.json(
      {
        status: "fatal_error",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}