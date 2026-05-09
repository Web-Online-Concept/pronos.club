/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/ai-picks/history
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoint API qui alimente la page /pronos-ia/historique.
 *
 * V3.5 (09/05/2026) :
 *   - Ajout `tier` dans le SELECT (pour affichage du badge dans la card)
 *   - Ajout query param `tier` (lock | strong | value | coup_de_coeur)
 *
 * Path : src/app/api/ai-picks/history/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const excludePending = searchParams.get("exclude_pending") === "true";
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const sportSlug = searchParams.get("sport");
  // V3.5 : filtre par tier
  const tier = searchParams.get("tier");

  const isCountOnly = limit === 0;

  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      // V3.5 : ajout de `tier` et `drop_window` dans le SELECT
      "id, ai_pick_number, classic_number, scorer_number, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, status, final_score, profit, slug, consensus_tier, consensus_score, live_score_data, deleted_at, tier, drop_window",
      { count: "exact" }
    )
    .is("deleted_at", null)
    // Module Buteurs supprime : on n'expose que les picks classiques
    .eq("pick_type", "classic")
    .order("created_at", { ascending: false })
    // Fallback stable quand created_at est identique (bulk insert IA)
    .order("classic_number", { ascending: false, nullsFirst: false });

  if (!isCountOnly) {
    query = query.range(offset, offset + limit - 1);
  }

  if (status) {
    if (status === "awaiting") {
      query = query.eq("status", "pending");
    } else {
      query = query.eq("status", status);
    }
  }

  if (from) query = query.gte("event_date", `${from}T00:00:00Z`);
  if (to) query = query.lte("event_date", `${to}T23:59:59Z`);

  if (sportSlug && sportSlug !== "all") {
    query = query.eq("sport", sportSlug);
  }

  // V3.5 : filtre tier
  if (tier && tier !== "all") {
    query = query.eq("tier", tier);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let filtered = data ?? [];
  const now = new Date();

  if (status === "awaiting") {
    filtered = filtered.filter(
      (pick) => new Date(pick.event_date) <= now
    );
  } else if (excludePending) {
    filtered = filtered.filter((pick) => {
      if (pick.status !== "pending") return true;
      return new Date(pick.event_date) <= now;
    });
  }

  if (isCountOnly) {
    return NextResponse.json({ data: [], count: filtered.length });
  }

  const useFilteredCount = excludePending || status === "awaiting";
  return NextResponse.json({
    data: filtered,
    count: useFilteredCount ? filtered.length : count,
  });
}