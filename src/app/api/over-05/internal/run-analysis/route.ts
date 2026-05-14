// src/app/api/over-05/internal/run-analysis/route.ts
//
// VERSION 3 — wrapper HTTP minimal qui appelle la fonction runAnalysisJob().
//
// Cette route reste disponible pour :
//   - tests directs depuis PowerShell (cf. Invoke-RestMethod)
//   - debug et compatibilite
//
// Mais en utilisation normale, la route /analyze appelle directement la
// fonction runAnalysisJob() sans passer par HTTP. Plus fiable.

import { NextRequest, NextResponse } from "next/server";
import { runAnalysisJob } from "@/lib/over-05-buts-equipes/run-analysis-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;


export async function POST(req: NextRequest) {
  // Auth interne
  const secret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.CRON_SECRET ?? "PronosClub2026CronAuto";
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { analysis_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.analysis_id) {
    return NextResponse.json({ error: "Missing analysis_id" }, { status: 400 });
  }

  try {
    const result = await runAnalysisJob(body.analysis_id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}