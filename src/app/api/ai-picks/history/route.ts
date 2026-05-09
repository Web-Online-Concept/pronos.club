/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/ai-picks/history (V3.5 Lot 10 — tri classic_number DESC strict)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoint API qui alimente la page /pronos-ia/historique.
 *
 * V3.5 Lot 10 (09/05/2026) :
 *   - Tri principal : classic_number DESC strict (du plus récent au plus
 *     ancien numériquement). Impossible d'avoir un désordre visuel quels
 *     que soient les timestamps de création.
 *   - Plus de fallback sur created_at (qui pouvait piéger en cas de
 *     placeholder ou de re-run).
 *   - Garde tier + drop_window dans le SELECT et filtres.
 *
 * Path : src/app/api/ai-picks/history/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sportSlug = searchParams.get("sport");
  const tier = searchParams.get("tier");

  const isCountOnly = limit === 0;

  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      "id, ai_pick_number, classic_number, scorer_number, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, status, final_score, profit, slug, consensus_tier, consensus_score, live_score_data, deleted_at, tier, drop_window",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .eq("pick_type", "classic")
    // ─── TRI STRICT par classic_number DESC ──────────────────────
    // Plus de fallback sur created_at. classic_number étant unique et
    // séquentiel (garanti par insert_ai_pick_atomic), ce tri seul
    // garantit l'ordre numérique strict du plus récent au plus ancien.
    .order("classic_number", { ascending: false, nullsFirst: false });

  // ─── FILTRE STATUS ──────────────────────────────────────────────
  if (status === "awaiting") {
    const nowIso = new Date().toISOString();
    query = query.eq("status", "pending").lte("event_date", nowIso);
  } else if (status === "won" || status === "lost" || status === "void") {
    query = query.eq("status", status);
  }

  if (from) query = query.gte("event_date", `${from}T00:00:00Z`);
  if (to) query = query.lte("event_date", `${to}T23:59:59Z`);

  if (sportSlug && sportSlug !== "all") {
    query = query.eq("sport", sportSlug);
  }

  if (tier && tier !== "all") {
    query = query.eq("tier", tier);
  }

  // ─── PAGINATION ─────────────────────────────────────────────────
  if (!isCountOnly) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (isCountOnly) {
    return NextResponse.json({ data: [], count: count ?? 0 });
  }

  return NextResponse.json({
    data: data ?? [],
    count: count ?? 0,
  });
}