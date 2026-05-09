/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-clv-capture (V3.5)
 *
 * Capture périodique des cotes Pinnacle pré-match pour calculer la
 * Closing Line Value (CLV) au moment de la résolution.
 *
 * Schedule : */15 * * * * (toutes les 15 min)
 *
 * Logique :
 *   1. SELECT picks pending V3.5 dont kickoff dans [now, now+3h]
 *   2. Grouper par sport, fetch cotes Pinnacle live via The Odds API
 *   3. Append entry dans odds_comparison.closing_pinnacle_odds_history
 *   4. Si kickoff dans <30 min : marquer closing final
 *
 * Au resolve (J+1), clv_pct = (1 / opening_no_vig) - (1 / closing_no_vig)
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis
 */

import { NextRequest, NextResponse } from "next/server";
import { captureCLVForPendingPicks } from "@/lib/clv/capture";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 60s suffit largement (typiquement 5-15s par run)
export const maxDuration = 60;

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

const handleCLVCapture = async (request: NextRequest): Promise<NextResponse> => {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log(`[ai-picks-clv-capture] Start at ${new Date().toISOString()}`);

  try {
    const result = await captureCLVForPendingPicks();

    const status = result.success ? 200 : 500;
    return NextResponse.json(
      {
        ...result,
        total_duration_ms: Date.now() - startedAt,
      },
      { status }
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[ai-picks-clv-capture] FATAL ERROR:", error);
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
  return handleCLVCapture(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleCLVCapture(request);
}