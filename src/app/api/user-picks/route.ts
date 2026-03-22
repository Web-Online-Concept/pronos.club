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
      .select("followed, user_odds, user_bookmaker_id, user_bookmaker_other, user_leg_odds")
      .eq("user_id", user.id)
      .eq("pick_id", pickId)
      .single();

    return NextResponse.json({
      followed: data?.followed ?? false,
      user_odds: data?.user_odds ?? null,
      user_bookmaker_id: data?.user_bookmaker_id ?? null,
      user_bookmaker_other: data?.user_bookmaker_other ?? null,
      user_leg_odds: data?.user_leg_odds ?? null,
    });
  }

  const { data } = await supabase
    .from("user_picks")
    .select("pick_id, user_odds, user_bookmaker_id, user_bookmaker_other, user_leg_odds")
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

  const { pick_id, followed, user_odds, user_bookmaker_id, user_bookmaker_other, user_leg_odds } = await request.json();

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
  }

  const { error } = await supabase
    .from("user_picks")
    .upsert(row, { onConflict: "user_id,pick_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, followed });
}