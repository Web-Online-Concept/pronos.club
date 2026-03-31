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

  let query = supabase
    .from("picks")
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))", {
      count: "exact",
    })
    .order("pick_number", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    if (status === "awaiting") {
      // Pending picks where match has started
      query = query.eq("status", "pending").lte("event_date", new Date().toISOString());
    } else {
      query = query.eq("status", status);
    }
  } else if (excludePending) {
    // Show resolved picks + pending picks where match has started (awaiting MAJ)
    query = query.or(`status.neq.pending,and(status.eq.pending,event_date.lte.${new Date().toISOString()})`);
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

  // Post-filter for "combines" — keep only picks with legs having different sports
  let filtered = data ?? [];
  if (sportSlug === "combines") {
    filtered = filtered.filter((pick) => {
      const legs = Array.isArray(pick.legs) ? pick.legs : [];
      if (legs.length < 2) return false;
      const sportSlugs = new Set<string>();
      legs.forEach((leg: any) => {
        const legSport = Array.isArray(leg.sport) ? leg.sport[0] : leg.sport;
        if (legSport?.slug) sportSlugs.add(legSport.slug);
      });
      return sportSlugs.size > 1;
    });
  }

  return NextResponse.json({ data: filtered, count: sportSlug === "combines" ? filtered.length : count });
}