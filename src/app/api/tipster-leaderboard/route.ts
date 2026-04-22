// src/app/api/tipster-leaderboard/route.ts
// Classement des tipsters — 3 périodes (week, month, all), multi-critères

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Period = "week" | "month" | "all";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") || "all") as Period;

  try {
    let query = supabaseAdmin
      .from("tipster_picks")
      .select(`
        user_id,
        odds,
        result,
        units_result,
        resolved_at,
        users:user_id (id, pseudo, avatar_url)
      `)
      .eq("status", "resolved");

    // Filtrage par période (sur resolved_at)
    const now = new Date();
    if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      query = query.gte("resolved_at", weekAgo.toISOString());
    } else if (period === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      query = query.gte("resolved_at", monthAgo.toISOString());
    }

    const { data: picks, error } = await query;
    if (error) throw error;

    // Agrégation côté Node
    const statsMap = new Map<string, any>();

    for (const pick of picks || []) {
      const userId = pick.user_id;
      const user = (pick as any).users;
      if (!user) continue;

      if (!statsMap.has(userId)) {
        statsMap.set(userId, {
          user_id: userId,
          pseudo: user.pseudo || "TIPSTER",
          avatar_url: user.avatar_url || null,
          total_picks: 0,
          won: 0,
          half_won: 0,
          refunded: 0,
          half_lost: 0,
          lost: 0,
          total_odds: 0,
          total_units: 0,
          recent_results: [], // 5 derniers résultats
        });
      }

      const s = statsMap.get(userId);
      s.total_picks += 1;
      s.total_odds += parseFloat(String(pick.odds)) || 0;
      s.total_units += parseFloat(String(pick.units_result)) || 0;

      if (pick.result === "won") s.won += 1;
      else if (pick.result === "half_won") s.half_won += 1;
      else if (pick.result === "refunded") s.refunded += 1;
      else if (pick.result === "half_lost") s.half_lost += 1;
      else if (pick.result === "lost") s.lost += 1;

      // Forme récente : tableau trié par resolved_at DESC, on garde les 5 premiers
      s.recent_results.push({
        date: pick.resolved_at,
        result: pick.result,
      });
    }

    // Calcul final par user + tri forme récente
    const stats = Array.from(statsMap.values()).map((s) => {
      const winPicks = s.won + s.half_won * 0.5;
      const losePicks = s.lost + s.half_lost * 0.5;
      const totalResolvedExcludingRefunded = winPicks + losePicks;
      const winrate = totalResolvedExcludingRefunded > 0
        ? Math.round((winPicks / totalResolvedExcludingRefunded) * 1000) / 10
        : 0;
      const avgOdds = s.total_picks > 0
        ? Math.round((s.total_odds / s.total_picks) * 100) / 100
        : 0;
      const roi = s.total_picks > 0
        ? Math.round((s.total_units / s.total_picks) * 1000) / 10
        : 0;

      // Trier les 5 derniers (par date DESC)
      s.recent_results.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const recent_form = s.recent_results.slice(0, 5).map((r: any) => r.result);

      return {
        user_id: s.user_id,
        pseudo: s.pseudo,
        avatar_url: s.avatar_url,
        total_picks: s.total_picks,
        won: s.won,
        half_won: s.half_won,
        refunded: s.refunded,
        half_lost: s.half_lost,
        lost: s.lost,
        winrate,
        avg_odds: avgOdds,
        total_units: Math.round(s.total_units * 100) / 100,
        roi,
        recent_form,
      };
    });

    // Tri par total_units DESC (défaut)
    stats.sort((a, b) => b.total_units - a.total_units);

    // Ajouter le rang
    const ranked = stats.map((s, i) => ({ ...s, rank: i + 1 }));

    return NextResponse.json({ period, leaderboard: ranked });

  } catch (err: any) {
    console.error("[tipster-leaderboard] error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}