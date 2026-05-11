// src/app/api/tipster-leaderboard/route.ts
//
// Classement des tipsters — 3 périodes (week, month, all), multi-critères
//
// LOT 21 (11/05/2026) — Extension :
//   - Nouveau param period_start (YYYY-MM-DD) pour voir une semaine/mois passé.
//   - Sans period_start, retourne la période en cours (comportement existant).
//   - period_start = lundi de la semaine ou 1er du mois (selon period).
//   - Retourne aussi la liste des period_starts disponibles (action=periods).
//
// CORRECTION (03/05/2026) :
//   Filtre sur match_date (date du match) au lieu de resolved_at.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Period = "week" | "month" | "all";

// ============================================================================
// HELPERS TIMEZONE PARIS
// ============================================================================

function getParisOffsetMs(utcDate: Date): number {
  const parisTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utcTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "UTC" }));
  return parisTime.getTime() - utcTime.getTime();
}

function parisMidnightUTC(year: number, month: number, day: number): Date {
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12));
  const parisOffsetMs = getParisOffsetMs(noonUTC);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcMidnight.getTime() - parisOffsetMs);
}

function getParisTodayParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return {
    year: parseInt(parts.find(p => p.type === "year")!.value),
    month: parseInt(parts.find(p => p.type === "month")!.value),
    day: parseInt(parts.find(p => p.type === "day")!.value),
  };
}

/**
 * Calcule les bornes d'une période.
 * @param period "week" | "month"
 * @param periodStart Optionnel : date YYYY-MM-DD (lundi pour week, 1er du mois pour month).
 *                    Si absent, retourne la période en cours.
 */
function getPeriodBounds(
  period: "week" | "month",
  periodStart?: string
): { start: Date; end: Date; startDate: string } {
  let year: number, month: number, day: number;

  if (periodStart) {
    const parts = periodStart.split("-");
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  } else {
    const today = getParisTodayParts();
    year = today.year;
    month = today.month;
    day = today.day;

    if (period === "week") {
      const currentDate = new Date(year, month - 1, day);
      const dow = currentDate.getDay();
      const daysBack = dow === 0 ? 6 : dow - 1;
      const monday = new Date(year, month - 1, day - daysBack);
      year = monday.getFullYear();
      month = monday.getMonth() + 1;
      day = monday.getDate();
    } else {
      day = 1;
    }
  }

  const start = parisMidnightUTC(year, month, day);

  let end: Date;
  if (period === "week") {
    const nextMonday = new Date(year, month - 1, day + 7);
    end = new Date(parisMidnightUTC(nextMonday.getFullYear(), nextMonday.getMonth() + 1, nextMonday.getDate()).getTime() - 1);
  } else {
    const nextMonth1 = month === 12 ? 1 : month + 1;
    const nextMonthY = month === 12 ? year + 1 : year;
    end = new Date(parisMidnightUTC(nextMonthY, nextMonth1, 1).getTime() - 1);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const startDate = `${year}-${pad(month)}-${pad(day)}`;

  return { start, end, startDate };
}

// ============================================================================
// GET
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "leaderboard";
  const period = (searchParams.get("period") || "all") as Period;
  const periodStart = searchParams.get("period_start") || undefined;

  try {
    // ───────────────────────────────────────────────────────────────
    // ACTION : periods (liste des semaines/mois disponibles avec data)
    // ───────────────────────────────────────────────────────────────
    if (action === "periods") {
      const periodType = (searchParams.get("period_type") || "week") as "week" | "month";

      // Récupérer toutes les dates de matchs distinctes
      const { data: matchDates } = await supabaseAdmin
        .from("tipster_picks")
        .select("match_date")
        .eq("status", "resolved")
        .order("match_date", { ascending: false })
        .limit(10000);

      if (!matchDates) return NextResponse.json({ periods: [] });

      // Construire le set des periodStart distincts
      const periodsSet = new Set<string>();
      for (const row of matchDates) {
        const d = new Date(row.match_date);
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Paris",
          year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(d);
        const py = parseInt(parts.find(p => p.type === "year")!.value);
        const pm = parseInt(parts.find(p => p.type === "month")!.value);
        const pd = parseInt(parts.find(p => p.type === "day")!.value);

        if (periodType === "week") {
          const cur = new Date(py, pm - 1, pd);
          const dow = cur.getDay();
          const daysBack = dow === 0 ? 6 : dow - 1;
          const monday = new Date(py, pm - 1, pd - daysBack);
          const pad = (n: number) => String(n).padStart(2, "0");
          periodsSet.add(
            `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`
          );
        } else {
          const pad = (n: number) => String(n).padStart(2, "0");
          periodsSet.add(`${py}-${pad(pm)}-01`);
        }
      }

      // Aussi inclure la période en cours même si pas encore de pick résolu
      const current = getPeriodBounds(periodType);
      periodsSet.add(current.startDate);

      const periods = Array.from(periodsSet)
        .sort()
        .reverse();

      // Marquer la période en cours
      const currentStart = current.startDate;

      return NextResponse.json({
        periods: periods.map((p) => ({
          period_start: p,
          is_current: p === currentStart,
        })),
      });
    }

    // ───────────────────────────────────────────────────────────────
    // ACTION : leaderboard (par défaut)
    // ───────────────────────────────────────────────────────────────
    let query = supabaseAdmin
      .from("tipster_picks")
      .select(`
        user_id,
        match_date,
        odds,
        result,
        units_result,
        resolved_at,
        users:user_id (id, pseudo, avatar_url)
      `)
      .eq("status", "resolved");

    // Filtrage par période
    if (period === "week" || period === "month") {
      const bounds = getPeriodBounds(period, periodStart);
      query = query
        .gte("match_date", bounds.start.toISOString())
        .lte("match_date", bounds.end.toISOString());
      console.log(`[tipster-leaderboard] period=${period} start=${bounds.start.toISOString()} end=${bounds.end.toISOString()}`);
    }

    const { data: picks, error } = await query;
    if (error) throw error;

    // Agrégation
    const statsMap = new Map<string, {
      user_id: string;
      pseudo: string;
      avatar_url: string | null;
      total_picks: number;
      won: number;
      half_won: number;
      refunded: number;
      half_lost: number;
      lost: number;
      total_odds: number;
      total_units: number;
      recent_results: Array<{ date: string; result: string }>;
    }>();

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
          recent_results: [],
        });
      }

      const s = statsMap.get(userId)!;
      s.total_picks += 1;
      s.total_odds += parseFloat(String(pick.odds)) || 0;
      s.total_units += parseFloat(String(pick.units_result)) || 0;

      if (pick.result === "won") s.won += 1;
      else if (pick.result === "half_won") s.half_won += 1;
      else if (pick.result === "refunded") s.refunded += 1;
      else if (pick.result === "half_lost") s.half_lost += 1;
      else if (pick.result === "lost") s.lost += 1;

      s.recent_results.push({
        date: pick.resolved_at ?? pick.match_date,
        result: pick.result,
      });
    }

    const stats = Array.from(statsMap.values()).map((s) => {
      const winPicks = s.won + s.half_won * 0.5;
      const losePicks = s.lost + s.half_lost * 0.5;
      const totalExcludingRefunded = winPicks + losePicks;

      const winrate = totalExcludingRefunded > 0
        ? Math.round((winPicks / totalExcludingRefunded) * 1000) / 10
        : 0;
      const avgOdds = s.total_picks > 0
        ? Math.round((s.total_odds / s.total_picks) * 100) / 100
        : 0;
      const roi = s.total_picks > 0
        ? Math.round((s.total_units / s.total_picks) * 1000) / 10
        : 0;

      s.recent_results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const recent_form = s.recent_results.slice(0, 5).map(r => r.result);

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

    stats.sort((a, b) => b.total_units - a.total_units);
    const ranked = stats.map((s, i) => ({ ...s, rank: i + 1 }));

    return NextResponse.json({ period, period_start: periodStart || null, leaderboard: ranked });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[tipster-leaderboard] error:", message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}