/**
 * PRONOS.CLUB — Cron route /api/cron/ai-picks-publish-morning (V3.5)
 *
 * Publie sur Telegram public les picks générés au drop matin (8h45 Paris).
 *
 * Schedule : "30 7 * * *" (9h30 Paris été = 7h30 UTC)
 * Décalé de 45 min après ai-picks-generate (matin) qui tourne à 8h45 Paris,
 * pour laisser le temps de générer + valider + persister + dossier les picks.
 *
 * Logique : factorisée dans publishBatchForDropWindow("morning")
 *
 * AUTHENTIFICATION :
 *   - Header `Authorization: Bearer ${CRON_SECRET}` requis
 *
 * MODES :
 *   - GET / POST → publish picks d'aujourd'hui drop matin
 *   - GET / POST ?date=YYYY-MM-DD → publish d'une date spécifique (replay)
 */

import { NextRequest, NextResponse } from "next/server";
import { publishBatchForDropWindow } from "@/lib/telegram/publish-batch";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 8 picks max × ~2s par publication = ~20s + safety margin
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

const handlePublishMorning = async (
  request: NextRequest
): Promise<NextResponse> => {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const overrideDate = url.searchParams.get("date") ?? undefined;

  console.log(
    `[ai-picks-publish-morning] Start - date=${overrideDate ?? "today"}`
  );

  try {
    const result = await publishBatchForDropWindow("morning", overrideDate);

    return NextResponse.json(
      {
        ...result,
        total_duration_ms: Date.now() - startedAt,
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[ai-picks-publish-morning] FATAL ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        drop_window: "morning",
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
  return handlePublishMorning(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePublishMorning(request);
}