import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pickId = searchParams.get("pick_id");

  if (pickId) {
    const { data } = await supabase
      .from("user_picks")
      .select("followed, user_odds, user_bookmaker_id, user_bookmaker_other, user_leg_odds, user_unit_value, user_stake_euro, user_status_override, user_profit_override, user_profit_euro_override")
      .eq("user_id", user.id)
      .eq("pick_id", pickId)
      .single();

    return NextResponse.json({
      followed: data?.followed ?? false,
      user_odds: data?.user_odds ?? null,
      user_bookmaker_id: data?.user_bookmaker_id ?? null,
      user_bookmaker_other: data?.user_bookmaker_other ?? null,
      user_leg_odds: data?.user_leg_odds ?? null,
      user_unit_value: data?.user_unit_value ?? null,
      user_stake_euro: data?.user_stake_euro ?? null,
      user_status_override: data?.user_status_override ?? null,
      user_profit_override: data?.user_profit_override ?? null,
      user_profit_euro_override: data?.user_profit_euro_override ?? null,
    });
  }

  const { data } = await supabase
    .from("user_picks")
    .select("pick_id, user_odds, user_bookmaker_id, user_bookmaker_other, user_leg_odds, user_unit_value, user_stake_euro")
    .eq("user_id", user.id)
    .eq("followed", true);

  const followedIds = (data ?? []).map((d) => d.pick_id);
  return NextResponse.json({ followedIds });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    pick_id,
    followed,
    user_odds,
    user_bookmaker_id,
    user_bookmaker_other,
    user_leg_odds,
    user_stake_euro,
    user_status_override,
    user_profit_override,
    user_profit_euro_override,
  } = await request.json();

  if (!pick_id || typeof followed !== "boolean") {
    return NextResponse.json({ error: "Missing pick_id or followed" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    pick_id,
    followed,
  };

  if (followed) {
    if (user_odds !== undefined) row.user_odds = user_odds;
    if (user_bookmaker_id !== undefined) row.user_bookmaker_id = user_bookmaker_id || null;
    if (user_bookmaker_other !== undefined) row.user_bookmaker_other = user_bookmaker_other || null;
    if (user_leg_odds !== undefined) row.user_leg_odds = user_leg_odds || null;
    if (user_stake_euro !== undefined && user_stake_euro !== null) row.user_stake_euro = user_stake_euro;

    // Override : status + profit U + profit EUR
    if (user_status_override !== undefined) row.user_status_override = user_status_override || null;
    if (user_profit_override !== undefined) row.user_profit_override = user_profit_override === null ? null : Number(user_profit_override);
    if (user_profit_euro_override !== undefined) row.user_profit_euro_override = user_profit_euro_override === null ? null : Number(user_profit_euro_override);

    // Freeze user's unit value at the time of follow
    try {
      const { data: bankrollData } = await supabase
        .from("user_bankroll")
        .select("mode, unit_value, unit_percent, current_bankroll")
        .eq("user_id", user.id)
        .single();

      if (bankrollData && bankrollData.mode !== "units_only") {
        const unitValue = bankrollData.mode === "fixed_unit"
          ? bankrollData.unit_value ?? 0
          : bankrollData.mode === "percent_bankroll"
          ? ((bankrollData.current_bankroll ?? 0) * (bankrollData.unit_percent ?? 0)) / 100
          : 0;

        if (unitValue > 0) {
          row.user_unit_value = unitValue;
          // If user_stake_euro not explicitly provided, auto-calculate
          if (user_stake_euro === undefined || user_stake_euro === null) {
            // Fetch pick stake to calculate default
            const { data: pickData } = await supabase
              .from("picks")
              .select("stake")
              .eq("id", pick_id)
              .single();
            if (pickData) {
              row.user_stake_euro = Math.round(pickData.stake * unitValue * 100) / 100;
            }
          }
        }
      }
    } catch {
      // Bankroll not configured -- stays null
    }
  }

  const { error } = await supabase
    .from("user_picks")
    .upsert(row, { onConflict: "user_id,pick_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, followed });
}