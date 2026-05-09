/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/admin/picks-failed/list (V3.5 — Lot 9)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoint admin de diagnostic : liste les picks dont l'INSERT a échoué.
 *
 * Utile pour :
 *   - Voir tous les trous dans la séquence classic_number (=numéros perdus)
 *   - Identifier les patterns d'erreur récurrents
 *   - Décider de replay manuel d'un pick perdu
 *
 * Authentification : header `x-admin-secret: <ADMIN_SECRET>` (env var)
 * Si ADMIN_SECRET n'est pas défini, fallback sur CRON_SECRET.
 *
 * Path : src/app/api/admin/picks-failed/list/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";


const ADMIN_SECRET = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET ?? "";


export async function GET(request: Request) {
  // Auth
  const headerSecret = request.headers.get("x-admin-secret");
  const auth = request.headers.get("authorization");
  const tokenFromAuth = auth?.replace(/^Bearer\s+/i, "").trim();

  const provided = headerSecret ?? tokenFromAuth ?? "";

  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const onlyUnresolved = searchParams.get("only_unresolved") === "true";

  // ─── Fetch des picks failed
  let query = supabaseAdmin
    .from("ai_picks_failed")
    .select(
      "id, classic_number, event_name, event_date, sport, league, selection, error_message, error_code, postgres_code, postgres_details, postgres_hint, attempt_number, is_final_failure, retried_successfully, final_pick_id, final_classic_number, failed_at, resolved_at"
    )
    .order("failed_at", { ascending: false })
    .limit(limit);

  if (onlyUnresolved) {
    query = query.eq("retried_successfully", false);
  }

  const { data: failedPicks, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ─── Stats agrégées : trous dans la séquence
  // On compare la séquence ai_picks_classic_seq actuelle avec les classic_number
  // existants en BDD pour lister les trous.
  const { data: minMaxData } = await supabaseAdmin
    .from("ai_picks")
    .select("classic_number")
    .is("deleted_at", null)
    .not("classic_number", "is", null)
    .order("classic_number", { ascending: false })
    .limit(1);

  const maxClassicNumber =
    (minMaxData?.[0] as { classic_number: number | null } | undefined)
      ?.classic_number ?? 0;

  // Récupérer les classic_number existants pour identifier les trous
  const { data: existingNumbers } = await supabaseAdmin
    .from("ai_picks")
    .select("classic_number")
    .is("deleted_at", null)
    .not("classic_number", "is", null)
    .order("classic_number", { ascending: true });

  const existingSet = new Set(
    (existingNumbers ?? []).map((r) => r.classic_number as number)
  );

  const missingNumbers: number[] = [];
  for (let i = 1; i <= maxClassicNumber; i++) {
    if (!existingSet.has(i)) {
      missingNumbers.push(i);
    }
  }

  // ─── Stats par error_code
  const errorCodeCounts: Record<string, number> = {};
  for (const fp of failedPicks ?? []) {
    const key = (fp.error_code as string | null) ?? "UNKNOWN";
    errorCodeCounts[key] = (errorCodeCounts[key] ?? 0) + 1;
  }

  return NextResponse.json({
    success: true,
    summary: {
      max_classic_number: maxClassicNumber,
      total_existing: existingSet.size,
      total_missing: missingNumbers.length,
      missing_numbers: missingNumbers,
      total_failed_attempts: failedPicks?.length ?? 0,
      total_unresolved:
        failedPicks?.filter((f) => !f.retried_successfully && f.is_final_failure)
          .length ?? 0,
      error_code_distribution: errorCodeCounts,
    },
    failed_picks: failedPicks ?? [],
  });
}