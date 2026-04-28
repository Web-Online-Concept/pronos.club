import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all followed pick IDs WITH override fields
  const { data: followedRows } = await supabase
    .from("user_picks")
    .select("pick_id, user_status_override, user_profit_override")
    .eq("user_id", user.id)
    .eq("followed", true);

  const followedMap = new Map(
    (followedRows ?? []).map((r) => [r.pick_id, r])
  );
  const followedIds = [...followedMap.keys()];

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
    .select("id, status, profit, stake")
    .in("id", followedIds);

  const allPicks = picks ?? [];
  const totalFollowed = allPicks.length;

  // Compute effective status & profit per pick (override priority)
  const effective = allPicks.map((p) => {
    const userPick = followedMap.get(p.id);
    const status = userPick?.user_status_override ?? p.status;
    const profit = userPick?.user_profit_override !== null && userPick?.user_profit_override !== undefined
      ? Number(userPick.user_profit_override)
      : (p.profit ?? 0);
    return { id: p.id, status, profit, stake: p.stake ?? 0 };
  });

  const won = effective.filter((p) => p.status === "won" || p.status === "half_won").length;
  const lost = effective.filter((p) => p.status === "lost" || p.status === "half_lost").length;
  const voidPicks = effective.filter((p) => p.status === "void").length;
  const pending = effective.filter((p) => p.status === "pending").length;
  const resolved = totalFollowed - voidPicks - pending;
  const profit = effective.reduce((s, p) => s + p.profit, 0);
  const staked = effective.reduce((s, p) => s + p.stake, 0);
  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  const winRate = resolved > 0 ? (won / resolved) * 100 : 0;

  return NextResponse.json({
    totalFollowed,
    won,
    lost,
    voidPicks,
    profit: Math.round(profit * 1000) / 1000,
    roi: Math.round(roi * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
  });
}