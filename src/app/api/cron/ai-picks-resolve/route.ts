import { NextRequest, NextResponse } from "next/server";
import { resolveDailyPicks } from "@/lib/ai/espn-resolver";
import { resolveV2Picks } from "@/lib/ai-picks-v2/resolver-v2";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 180;

const isAuthorized = (req: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET non defini");
    return false;
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const vercelSignature = req.headers.get("x-vercel-cron-signature");
  if (vercelSignature) return true;

  const adminEmail = req.headers.get("x-admin-email");
  if (
    adminEmail &&
    ["flotoulouse7@gmail.com", "jbrulard@yahoo.fr"].includes(
      adminEmail.toLowerCase()
    )
  ) {
    return true;
  }

  return false;
};

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron] Start ai-picks-resolve (v1 + v2)");
  const startedAt = Date.now();

  let v1Report: Awaited<ReturnType<typeof resolveDailyPicks>> | null = null;
  let v1Error: string | null = null;

  try {
    v1Report = await resolveDailyPicks();
  } catch (err) {
    v1Error = err instanceof Error ? err.message : "Unknown v1 error";
    console.error("[Cron] v1 resolver fatal:", err);
  }

  let v2Report: Awaited<ReturnType<typeof resolveV2Picks>> | null = null;
  let v2Error: string | null = null;

  try {
    v2Report = await resolveV2Picks();
  } catch (err) {
    v2Error = err instanceof Error ? err.message : "Unknown v2 error";
    console.error("[Cron] v2 resolver fatal:", err);
  }

  const durationMs = Date.now() - startedAt;
  const overallSuccess =
    (v1Report?.success ?? false) || v2Report !== null;

  return NextResponse.json(
    {
      status: overallSuccess ? "ok" : "error",
      durationMs,
      v1: v1Report
        ? v1Report
        : { success: false, error: v1Error },
      v2: v2Report
        ? {
            success: true,
            totalChecked: v2Report.totalChecked,
            resolved: v2Report.resolved,
            stillPending: v2Report.stillPending,
            failed: v2Report.failed,
          }
        : { success: false, error: v2Error },
    },
    { status: overallSuccess ? 200 : 500 }
  );
}

export async function POST(req: NextRequest) {
  return GET(req);
}