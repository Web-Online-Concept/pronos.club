import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all followed pick IDs
  const { data: followedRows } = await supabase
    .from("user_picks")
    .select("pick_id")
    .eq("user_id", user.id)
    .eq("followed", true);

  const followedIds = (followedRows ?? []).map((r) => r.pick_id);

  if (followedIds.length === 0) {
    return NextResponse.json({
      totalFollowed: 0,
      won: 0,
      lost: 0,
      voidPicks: 0,
      profit: 0,
      roi: 0,
      winRate: 0,
    });
  }

  // Get the actual picks data
  const { data: picks } = await supabase
    .from("picks")
    .select("status, profit, stake")
    .in("id", followedIds);

  const allPicks = picks ?? [];
  const totalFollowed = allPicks.length;
  const won = allPicks.filter((p) => p.status === "won" || p.status === "half_won").length;
  const lost = allPicks.filter((p) => p.status === "lost" || p.status === "half_lost").length;
  const voidPicks = allPicks.filter((p) => p.status === "void").length;
  const resolved = totalFollowed - voidPicks - allPicks.filter((p) => p.status === "pending").length;
  const profit = allPicks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const staked = allPicks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  const winRate = resolved > 0 ? (won / resolved) * 100 : 0;

  return NextResponse.json({
    totalFollowed,
    won,
    lost,
    voidPicks,
    profit: Math.round(profit * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
  });
}