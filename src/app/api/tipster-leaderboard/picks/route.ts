// src/app/api/tipster-leaderboard/picks/route.ts
//
// LOT 21 (11/05/2026)
// Retourne les picks détaillés d'un tipster sur une période donnée.
// Utilisé par l'accordéon de la page classement.

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Period = "week" | "month" | "all";

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

function getPeriodBounds(period: "week" | "month", periodStart?: string) {
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

  return { start, end };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");
  const period = (searchParams.get("period") || "all") as Period;
  const periodStart = searchParams.get("period_start") || undefined;

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  try {
    let query = supabaseAdmin
      .from("tipster_picks")
      .select(`
        id,
        match_date,
        sport,
        odds,
        pick_type,
        result,
        status,
        units_result,
        bookmaker,
        final_odds,
        image_url
      `)
      .eq("user_id", userId)
      .eq("status", "resolved")
      .order("match_date", { ascending: false });

    if (period === "week" || period === "month") {
      const bounds = getPeriodBounds(period, periodStart);
      query = query
        .gte("match_date", bounds.start.toISOString())
        .lte("match_date", bounds.end.toISOString());
    }

    const { data: picks, error } = await query;
    if (error) throw error;

    return NextResponse.json({ picks: picks || [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[tipster-leaderboard/picks] error:", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}