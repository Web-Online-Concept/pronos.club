// src/app/api/tipster-concours/route.ts
// Concours tipsters : classements en cours (fig\u00e9 semaine/mois en cours) + historique gagnants

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getConcoursConfig } from "@/lib/tipster-concours-config";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Helpers ──
function getWeekBounds(date: Date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  // Lundi = 1. Si dimanche (0), reculer de 6 jours, sinon reculer de day-1
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getMonthBounds(date: Date = new Date()) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

async function computeRanking(
  start: Date,
  end: Date,
  minPicks: number
) {
  const { data: picks } = await supabaseAdmin
    .from("tipster_picks")
    .select(`
      user_id,
      odds,
      result,
      units_result,
      resolved_at,
      users:user_id (id, pseudo, avatar_url)
    `)
    .eq("status", "resolved")
    .gte("resolved_at", start.toISOString())
    .lte("resolved_at", end.toISOString());

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
        total_units: 0,
        won: 0,
        half_won: 0,
        refunded: 0,
        half_lost: 0,
        lost: 0,
      });
    }

    const s = statsMap.get(userId);
    s.total_picks += 1;
    s.total_units += parseFloat(String(pick.units_result)) || 0;
    if (pick.result === "won") s.won += 1;
    else if (pick.result === "half_won") s.half_won += 1;
    else if (pick.result === "refunded") s.refunded += 1;
    else if (pick.result === "half_lost") s.half_lost += 1;
    else if (pick.result === "lost") s.lost += 1;
  }

  const stats = Array.from(statsMap.values())
    .filter((s) => s.total_picks >= minPicks)
    .map((s) => ({
      ...s,
      total_units: Math.round(s.total_units * 100) / 100,
      eligible: true,
    }));

  stats.sort((a, b) => b.total_units - a.total_units);

  // Inclure aussi les non-\u00e9ligibles (pour afficher en "proche \u00e9ligibilit\u00e9")
  const nonEligible = Array.from(statsMap.values())
    .filter((s) => s.total_picks < minPicks)
    .map((s) => ({
      ...s,
      total_units: Math.round(s.total_units * 100) / 100,
      eligible: false,
    }));
  nonEligible.sort((a, b) => b.total_units - a.total_units);

  return {
    ranking: stats.map((s, i) => ({ ...s, rank: i + 1 })),
    non_eligible: nonEligible,
  };
}

// ── GET ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "current";

  try {
    if (action === "current") {
      // Classements en cours (semaine + mois)
      const weekBounds = getWeekBounds();
      const monthBounds = getMonthBounds();
      const config = await getConcoursConfig();

      const [weekData, monthData] = await Promise.all([
        computeRanking(weekBounds.start, weekBounds.end, config.week.min_picks),
        computeRanking(monthBounds.start, monthBounds.end, config.month.min_picks),
      ]);

      return NextResponse.json({
        week: {
          period_start: weekBounds.start.toISOString(),
          period_end: weekBounds.end.toISOString(),
          min_picks: config.week.min_picks,
          prize: config.week.prize_amount,
          active: config.week.active,
          ranking: weekData.ranking,
          non_eligible: weekData.non_eligible,
        },
        month: {
          period_start: monthBounds.start.toISOString(),
          period_end: monthBounds.end.toISOString(),
          min_picks: config.month.min_picks,
          prize: config.month.prize_amount,
          active: config.month.active,
          ranking: monthData.ranking,
          non_eligible: monthData.non_eligible,
        },
      });
    }

    if (action === "history") {
      // Historique des gagnants
      const { data: winners } = await supabaseAdmin
        .from("tipster_concours_winners")
        .select(`
          *,
          users:user_id (id, pseudo, avatar_url)
        `)
        .order("period_start", { ascending: false })
        .limit(50);

      return NextResponse.json({ winners: winners || [] });
    }

    if (action === "badges") {
      // Badges d'un user (pour profil)
      const userId = searchParams.get("user_id");
      if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

      const { data: wins } = await supabaseAdmin
        .from("tipster_concours_winners")
        .select("period_type")
        .eq("user_id", userId);

      const weekWins = (wins || []).filter((w: any) => w.period_type === "week").length;
      const monthWins = (wins || []).filter((w: any) => w.period_type === "month").length;

      return NextResponse.json({ week_wins: weekWins, month_wins: monthWins });
    }

    if (action === "my_ranking") {
      // Le user connect\u00e9 : sa position dans les concours en cours
      const userId = searchParams.get("user_id");
      if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

      const weekBounds = getWeekBounds();
      const monthBounds = getMonthBounds();
      const config = await getConcoursConfig();

      const [weekData, monthData] = await Promise.all([
        computeRanking(weekBounds.start, weekBounds.end, config.week.min_picks),
        computeRanking(monthBounds.start, monthBounds.end, config.month.min_picks),
      ]);

      const findUserRanking = (data: any) => {
        const inRanking = data.ranking.find((s: any) => s.user_id === userId);
        const inNonEligible = data.non_eligible.find((s: any) => s.user_id === userId);
        if (inRanking) {
          const leader = data.ranking[0];
          return {
            rank: inRanking.rank,
            total_picks: inRanking.total_picks,
            total_units: inRanking.total_units,
            eligible: true,
            leader_pseudo: leader?.pseudo || null,
            leader_units: leader?.total_units || 0,
            gap_to_leader: inRanking.rank === 1 ? 0 : Math.round((leader.total_units - inRanking.total_units) * 100) / 100,
            total_participants: data.ranking.length,
          };
        }
        if (inNonEligible) {
          const leader = data.ranking[0] || null;
          return {
            rank: null,
            total_picks: inNonEligible.total_picks,
            total_units: inNonEligible.total_units,
            eligible: false,
            leader_pseudo: leader?.pseudo || null,
            leader_units: leader?.total_units || 0,
            gap_to_leader: 0,
            total_participants: data.ranking.length,
          };
        }
        // Cas : user n'a aucun pick du tout sur la p\u00e9riode
        const leader = data.ranking[0] || null;
        return {
          rank: null,
          total_picks: 0,
          total_units: 0,
          eligible: false,
          leader_pseudo: leader?.pseudo || null,
          leader_units: leader?.total_units || 0,
          gap_to_leader: 0,
          total_participants: data.ranking.length,
        };
      };

      return NextResponse.json({
        week: {
          ...findUserRanking(weekData),
          min_picks: config.week.min_picks,
          prize: config.week.prize_amount,
        },
        month: {
          ...findUserRanking(monthData),
          min_picks: config.month.min_picks,
          prize: config.month.prize_amount,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err: any) {
    console.error("[tipster-concours] error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}