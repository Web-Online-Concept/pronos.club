// src/app/api/over-05/analyze/route.ts
//
// VERSION 3 — FIABLE : appel direct de la fonction du job (pas de fetch interne).
//
// Au lieu d'utiliser fire-and-forget (fetch sans await) ou after()
// (qui se sont reveles peu fiables sur Vercel), on extrait la logique
// du job dans une fonction reutilisable et on l'appelle DIRECTEMENT
// depuis cette route.
//
// La cle : after() pour faire tourner le job APRES avoir renvoye la
// reponse au client, sans le ralentir.

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";
import type {
  AnalyzeRequestBody,
  AnalyzeResponse,
} from "@/lib/over-05-buts-equipes/types";
import { runAnalysisJob } from "@/lib/over-05-buts-equipes/run-analysis-job";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CACHE_DURATION_HOURS = 24;


export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email || !isO05Authorized(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validation body
  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (
    typeof body.league_id !== "number" ||
    typeof body.date_from !== "string" ||
    typeof body.date_to !== "string"
  ) {
    return NextResponse.json(
      { error: "Missing required fields: league_id, date_from, date_to" },
      { status: 400 }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(body.date_from) || !dateRegex.test(body.date_to)) {
    return NextResponse.json(
      { error: "date_from and date_to must be YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  // Verifier que le championnat existe
  const { data: league, error: leagueErr } = await supabaseAdmin
    .from("o05_leagues")
    .select("id, name")
    .eq("id", body.league_id)
    .single();

  if (leagueErr || !league) {
    return NextResponse.json(
      { error: "League not found" },
      { status: 404 }
    );
  }

  // ─── CACHE 24h ───
  const cacheThreshold = new Date(
    Date.now() - CACHE_DURATION_HOURS * 60 * 60 * 1000
  ).toISOString();

  const { data: existingAnalysis } = await supabaseAdmin
    .from("o05_analyses")
    .select("id, status")
    .eq("league_id", body.league_id)
    .eq("date_from", body.date_from)
    .eq("date_to", body.date_to)
    .eq("requested_by", user.email)
    .eq("status", "completed")
    .gte("created_at", cacheThreshold)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingAnalysis) {
    const response: AnalyzeResponse = {
      analysis_id: existingAnalysis.id,
      status: existingAnalysis.status as "completed",
    };
    return NextResponse.json(response);
  }

  // ─── CRÉATION nouvelle analyse ───
  const { data: newAnalysis, error: insertErr } = await supabaseAdmin
    .from("o05_analyses")
    .insert({
      league_id: body.league_id,
      matchday_label: body.matchday_label ?? null,
      date_from: body.date_from,
      date_to: body.date_to,
      status: "pending",
      total_matches: 0,
      matches_analyzed: 0,
      matches_failed: 0,
      requested_by: user.email,
    })
    .select("id, status")
    .single();

  if (insertErr || !newAnalysis) {
    console.error("[o05-analyze] Insert error:", insertErr?.message);
    return NextResponse.json(
      { error: "Failed to create analysis" },
      { status: 500 }
    );
  }

  const analysisId = newAnalysis.id;

  // ─── LANCEMENT DU JOB EN BACKGROUND ───
  // after() garantit l'execution APRES la reponse, sans bloquer le client.
  // Cette fois on appelle DIRECTEMENT la fonction (pas de fetch interne).
  // Plus de souci de propagation reseau, plus de 404, plus rien qui merdouille.
  after(async () => {
    try {
      console.log(`[o05-analyze] Starting job for ${analysisId}`);
      const result = await runAnalysisJob(analysisId);
      console.log(`[o05-analyze] Job completed for ${analysisId}:`, result);
    } catch (err) {
      console.error(
        `[o05-analyze] Job failed for ${analysisId}:`,
        err instanceof Error ? err.message : err
      );
      // Marquer en failed
      await supabaseAdmin
        .from("o05_analyses")
        .update({
          status: "failed",
          error_message: `Job error: ${
            err instanceof Error ? err.message : "unknown"
          }`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisId);
    }
  });

  // Retour immédiat au frontend
  const response: AnalyzeResponse = {
    analysis_id: newAnalysis.id,
    status: newAnalysis.status as "pending",
  };
  return NextResponse.json(response);
}