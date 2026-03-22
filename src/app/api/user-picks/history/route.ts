import { createClient } from "@/lib/supabase/server";
import { calculateProfit, calculateCombinedResult } from "@/lib/calculations";
import { NextResponse } from "next/server";
import type { PickStatus } from "@/lib/supabase/types";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const sportSlug = searchParams.get("sport");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  // Get followed picks WITH user_odds
  const { data: followedRows } = await supabase
    .from("user_picks")
    .select("pick_id, user_odds, user_bookmaker_id, user_bookmaker_other, user_leg_odds")
    .eq("user_id", user.id)
    .eq("followed", true);

  const followedMap = new Map(
    (followedRows ?? []).map((r) => [r.pick_id, r])
  );
  const followedIds = [...followedMap.keys()];

  if (followedIds.length === 0) {
    return NextResponse.json({ data: [], count: 0 });
  }

  let query = supabase
    .from("picks")
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))", { count: "exact" })
    .in("id", followedIds)
    .order("pick_number", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") {
    if (status === "awaiting") {
      query = query.eq("status", "pending").lte("event_date", new Date().toISOString());
    } else if (status === "pending") {
      query = query.eq("status", "pending").gt("event_date", new Date().toISOString());
    } else {
      query = query.eq("status", status);
    }
  }
  // No filter when "all" → show everything the user has followed

  if (from) query = query.gte("event_date", `${from}T00:00:00Z`);
  if (to) query = query.lte("event_date", `${to}T23:59:59Z`);

  if (sportSlug && sportSlug !== "all") {
    const { data: sportRow } = await supabase
      .from("sports")
      .select("id")
      .eq("slug", sportSlug)
      .single();
    if (sportRow) {
      query = query.eq("sport_id", sportRow.id);
    }
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich picks with user_odds and user_profit
  const enriched = (data ?? []).map((pick) => {
    const userInfo = followedMap.get(pick.id);
    const userOdds = userInfo?.user_odds ?? null;
    const userLegOdds: { leg_number: number; odds: number }[] = userInfo?.user_leg_odds ?? null;

    let userProfit: number | null = null;

    // Only calculate user profit if pick is resolved and user has custom odds
    if (pick.status !== "pending" && userOdds) {
      const isCombi = pick.pick_type === "combine" && (pick.legs?.length ?? 0) > 1;

      if (isCombi) {
        const allLegs = pick.legs ?? [];
        const allResolved = allLegs.every((l: { status: string }) => l.status !== "pending");

        if (allResolved && allLegs.length > 0) {
          // Check if any leg lost → whole pick lost
          const anyLost = allLegs.some((l: { status: string }) => l.status === "lost" || l.status === "half_lost");

          if (anyLost) {
            userProfit = -pick.stake;
          } else if (userLegOdds && userLegOdds.length > 0) {
            // Use per-leg user odds for accurate calculation
            // Only include non-void legs
            const activeUserOdds: number[] = allLegs
              .filter((l: { status: string }) => l.status !== "void")
              .map((l: { leg_number: number }) => {
                const userLeg = userLegOdds.find((ul: { leg_number: number; odds: number }) => ul.leg_number === l.leg_number);
                return userLeg?.odds ?? 0;
              })
              .filter((o: number) => o > 0);

            if (activeUserOdds.length === 0) {
              // All void
              userProfit = 0;
            } else {
              const effectiveOdds = activeUserOdds.reduce((acc: number, o: number) => acc * o, 1);
              userProfit = parseFloat(((effectiveOdds - 1) * pick.stake).toFixed(2));
            }
          } else {
            // Fallback: no per-leg odds, use global user_odds
            userProfit = calculateProfit(pick.status as PickStatus, userOdds, pick.stake);
          }
        }
      } else {
        userProfit = calculateProfit(pick.status as PickStatus, userOdds, pick.stake);
      }
    }

    return {
      ...pick,
      user_odds: userOdds,
      user_leg_odds: userLegOdds,
      user_profit: userProfit,
      user_bookmaker_id: userInfo?.user_bookmaker_id ?? null,
      user_bookmaker_other: userInfo?.user_bookmaker_other ?? null,
    };
  });

  return NextResponse.json({ data: enriched, count });
}