// src/app/api/over-05/analyze/route.ts
//
// POST /api/over-05/analyze
// Body: { league_id, matchday_label, date_from, date_to }
//
// → Crée une session d'analyse (status='pending') et retourne immédiatement
//   l'analysis_id au frontend. L'analyse réelle tourne en background via
//   un appel fire-and-forget à /api/over-05/_internal/run-analysis.
//
// Le frontend poll ensuite GET /api/over-05/analyses/[id] toutes les 3s
// pour suivre l'avancement.
//
// Cache 24h : si une analyse récente existe pour (league_id, date_from,
// date_to), on retourne son ID au lieu d'en relancer une nouvelle.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";
import type {
  AnalyzeRequestBody,
  AnalyzeResponse,
} from "@/lib/over-05-buts-equipes/types";

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

  // Format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(body.date_from) || !dateRegex.test(body.date_to)) {
    return NextResponse.json(
      { error: "date_from and date_to must be YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  // Vérifier que le championnat existe
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
  // Chercher une analyse existante pour les mêmes paramètres,
  // créée par le même utilisateur, dans les dernières 24h, terminée.
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

  // ─── FIRE-AND-FORGET : déclenche le job background ───
  // Astuce Vercel : on appelle /api/over-05/_internal/run-analysis sans
  // attendre la réponse. La fonction tourne en serverless asynchrone.
  // Auth interne via header secret partagé.
  const internalSecret = process.env.CRON_SECRET ?? "PronosClub2026CronAuto";
  const baseUrl = req.nextUrl.origin;

  // Important : pas d'await ici, on lance et on oublie
  fetch(`${baseUrl}/api/over-05/_internal/run-analysis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": internalSecret,
    },
    body: JSON.stringify({ analysis_id: newAnalysis.id }),
  }).catch((err) => {
    console.error("[o05-analyze] Fire-and-forget failed:", err);
  });

  // Retour immédiat au frontend
  const response: AnalyzeResponse = {
    analysis_id: newAnalysis.id,
    status: newAnalysis.status as "pending",
  };
  return NextResponse.json(response);
}