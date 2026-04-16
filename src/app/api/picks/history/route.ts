import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  // count-only requests (limit=0) need all rows for accurate post-fetch filtering
  const isCountOnly = limit === 0;

  let query = supabase
    .from("picks")
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))", {
      count: "exact",
    })
    .order("pick_number", { ascending: false });

  if (!isCountOnly) {
    query = query.range(offset, offset + limit - 1);
  }

  if (status) {
    if (status === "awaiting") {
      query = query.eq("status", "pending");
    } else {
      query = query.eq("status", status);
    }
  } else if (excludePending) {
    query = query.or(`status.neq.pending,status.eq.pending`);
  }

  if (from) query = query.gte("event_date", `${from}T00:00:00Z`);
  if (to) query = query.lte("event_date", `${to}T23:59:59Z`);

  // Sport filter
  if (sportSlug && sportSlug !== "all" && sportSlug !== "combines") {
    const { data: sportRow } = await supabase
      .from("sports")
      .select("id")
      .eq("slug", sportSlug)
      .single();
    if (sportRow) {
      query = query.eq("sport_id", sportRow.id);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let filtered = data ?? [];

  // Helper: get the earliest event date (first leg for combinés)
  function getEarliestDate(pick: any): Date {
    const legDates = (pick.legs ?? [])
      .map((l: any) => l.event_date)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime());
    
    if (legDates.length > 0) return new Date(Math.min(...legDates));
    return new Date(pick.event_date);
  }

  const now = new Date();

  // Post-fetch filtering for pending picks
  if (status === "awaiting") {
    filtered = filtered.filter((pick: any) => getEarliestDate(pick) <= now);
  } else if (excludePending) {
    filtered = filtered.filter((pick: any) => {
      if (pick.status !== "pending") return true;
      return getEarliestDate(pick) <= now;
    });
  }

  // Helper: check if a pick is a multi-sport combi
  function isMultiSportCombi(pick: any): boolean {
    const legs = Array.isArray(pick.legs) ? pick.legs : [];
    if (legs.length < 2) return false;
    const sportSlugs = new Set<string>();
    legs.forEach((leg: any) => {
      const legSport = Array.isArray(leg.sport) ? leg.sport[0] : leg.sport;
      if (legSport?.slug) sportSlugs.add(legSport.slug);
    });
    return sportSlugs.size > 1;
  }

  if (sportSlug === "combines") {
    filtered = filtered.filter(isMultiSportCombi);
  } else if (sportSlug && sportSlug !== "all") {
    filtered = filtered.filter((pick) => !isMultiSportCombi(pick));
  }

  // For count-only requests: return accurate filtered count (no data needed)
  // For paginated requests: return filtered data + Supabase count (may be off by 1-2 for pending edge cases)
  if (isCountOnly) {
    return NextResponse.json({ data: [], count: filtered.length });
  }

  const useFilteredCount = sportSlug === "combines" || (sportSlug && sportSlug !== "all");
  return NextResponse.json({ data: filtered, count: useFilteredCount ? filtered.length : count });
}