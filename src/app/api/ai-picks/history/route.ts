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

  const isCountOnly = limit === 0;

  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      "id, ai_pick_number, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, status, final_score, slug, consensus_tier, consensus_score, live_score_data, deleted_at",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("ai_pick_number", { ascending: false });

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
  // excludePending sera traité en post-fetch (besoin de vérifier event_date <= now)

  if (from) query = query.gte("event_date", `${from}T00:00:00Z`);
  if (to) query = query.lte("event_date", `${to}T23:59:59Z`);

  // Filtre sport — l'IA stocke le sport directement comme string, pas de jointure
  if (sportSlug && sportSlug !== "all") {
    query = query.eq("sport", sportSlug);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let filtered = data ?? [];
  const now = new Date();

  // Post-fetch filtering pour pending vs awaiting
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