// src/app/api/tipster-stats/route.ts
// Stats perso d'un tipster (utilisé dans /espace/tipster et /pronos-abonnes/[pseudo])

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pseudo = searchParams.get("pseudo");

  let userId: string | null = null;

  if (pseudo) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("pseudo", pseudo)
      .single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    userId = user.id;
  } else {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = authUser.id;
  }

  try {
    const { data: allPicks } = await supabaseAdmin
      .from("tipster_picks")
      .select("status, result, units_result, odds, submitted_at, resolved_at")
      .eq("user_id", userId);

    const { data: userProfile } = await supabaseAdmin
      .from("users")
      .select("pseudo, avatar_url, subscription_status, created_at")
      .eq("id", userId)
      .single();

    const picks = allPicks || [];
    const livePicks = picks.filter((p) => p.status === "live");
    const resolvedPicks = picks.filter((p) => p.status === "resolved");

    const won = resolvedPicks.filter((p) => p.result === "won").length;
    const halfWon = resolvedPicks.filter((p) => p.result === "half_won").length;
    const refunded = resolvedPicks.filter((p) => p.result === "refunded").length;
    const halfLost = resolvedPicks.filter((p) => p.result === "half_lost").length;
    const lost = resolvedPicks.filter((p) => p.result === "lost").length;

    const totalUnits = resolvedPicks.reduce(
      (sum, p) => sum + (parseFloat(String(p.units_result)) || 0),
      0
    );

    const totalOdds = resolvedPicks.reduce(
      (sum, p) => sum + (parseFloat(String(p.odds)) || 0),
      0
    );

    const winPoints = won + halfWon * 0.5;
    const losePoints = lost + halfLost * 0.5;
    const winrate = winPoints + losePoints > 0
      ? Math.round((winPoints / (winPoints + losePoints)) * 1000) / 10
      : 0;

    const avgOdds = resolvedPicks.length > 0
      ? Math.round((totalOdds / resolvedPicks.length) * 100) / 100
      : 0;

    const roi = resolvedPicks.length > 0
      ? Math.round((totalUnits / resolvedPicks.length) * 1000) / 10
      : 0;

    // Best/worst streak
    const sortedByDate = [...resolvedPicks].sort(
      (a, b) => new Date(a.resolved_at!).getTime() - new Date(b.resolved_at!).getTime()
    );
    let currentStreak = 0;
    let bestStreak = 0;
    let worstStreak = 0;
    let tempStreak = 0;

    for (const p of sortedByDate) {
      const u = parseFloat(String(p.units_result)) || 0;
      if (u > 0) {
        tempStreak = tempStreak >= 0 ? tempStreak + 1 : 1;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else if (u < 0) {
        tempStreak = tempStreak <= 0 ? tempStreak - 1 : -1;
        if (tempStreak < worstStreak) worstStreak = tempStreak;
      } else {
        // refund ne casse pas la streak
      }
    }
    currentStreak = tempStreak;

    return NextResponse.json({
      profile: userProfile,
      stats: {
        total_picks: picks.length,
        live_picks: livePicks.length,
        resolved_picks: resolvedPicks.length,
        won, half_won: halfWon, refunded, half_lost: halfLost, lost,
        total_units: Math.round(totalUnits * 100) / 100,
        winrate,
        avg_odds: avgOdds,
        roi,
        current_streak: currentStreak,
        best_streak: bestStreak,
        worst_streak: worstStreak,
      },
    });

  } catch (err: any) {
    console.error("[tipster-stats] error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}