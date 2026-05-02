// src/app/api/tipster-concours/route.ts
// Concours tipsters : classements en cours (semaine/mois en cours) + historique gagnants
//
// CORRECTIONS (03/05/2026) :
//   - computeRanking filtre sur match_date (date du match) et non resolved_at
//   - getWeekBounds / getMonthBounds utilisent l'heure de Paris (Europe/Paris)
//     et non l'heure UTC du serveur Vercel

import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getConcoursConfig } from "@/lib/tipster-concours-config";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// HELPERS TIMEZONE PARIS
// ============================================================================

function getParisOffsetMs(utcDate: Date): number {
  const parisTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utcTime   = new Date(utcDate.toLocaleString("en-US", { timeZone: "UTC" }));
  return parisTime.getTime() - utcTime.getTime();
}

function parisMidnightUTC(year: number, month: number, day: number): Date {
  const noonUTC       = new Date(Date.UTC(year, month - 1, day, 12));
  const parisOffsetMs = getParisOffsetMs(noonUTC);
  const utcMidnight   = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcMidnight.getTime() - parisOffsetMs);
}

/** Récupère les composantes de la date actuelle en heure Paris */
function getParisTodayParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  return {
    year:  parseInt(parts.find(p => p.type === "year")!.value),
    month: parseInt(parts.find(p => p.type === "month")!.value),
    day:   parseInt(parts.find(p => p.type === "day")!.value),
  };
}

/**
 * Borne semaine en cours : lundi 00:00:00 → dimanche 23:59:59 (heure Paris)
 */
function getWeekBounds(): { start: Date; end: Date } {
  const { year, month, day } = getParisTodayParts();

  const currentDate = new Date(year, month - 1, day);
  const dow      = currentDate.getDay(); // 0=dim, 1=lun
  const daysBack = dow === 0 ? 6 : dow - 1;
  const monday   = new Date(year, month - 1, day - daysBack);
  const sunday   = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

  const start = parisMidnightUTC(monday.getFullYear(), monday.getMonth() + 1, monday.getDate());
  // Dimanche 23:59:59.999 Paris = minuit lundi Paris - 1ms
  const nextMonday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 1);
  const end = new Date(
    parisMidnightUTC(nextMonday.getFullYear(), nextMonday.getMonth() + 1, nextMonday.getDate()).getTime() - 1
  );

  return { start, end };
}

/**
 * Borne mois en cours : 1er du mois 00:00:00 → dernier jour 23:59:59 (heure Paris)
 */
function getMonthBounds(): { start: Date; end: Date } {
  const { year, month } = getParisTodayParts();

  const start = parisMidnightUTC(year, month, 1);

  // Dernier jour du mois = jour 0 du mois suivant
  const lastDay     = new Date(year, month, 0).getDate();
  const nextMonth1  = month === 12 ? 1 : month + 1;
  const nextMonthY  = month === 12 ? year + 1 : year;
  const end = new Date(
    parisMidnightUTC(nextMonthY, nextMonth1, 1).getTime() - 1
  );

  // lastDay utilisé pour cohérence mais end calculé via minuit du 1er suivant
  void lastDay;

  return { start, end };
}

// ============================================================================
// CALCUL DU CLASSEMENT
// ============================================================================

async function computeRanking(start: Date, end: Date, minPicks: number) {
  // Filtre sur match_date (date du match) et non resolved_at.
  // Un match du 30 avril résolu le 1er mai compte pour avril, pas mai.
  const { data: picks } = await supabaseAdmin
    .from("tipster_picks")
    .select(`
      user_id,
      match_date,
      odds,
      result,
      units_result,
      users:user_id (id, pseudo, avatar_url)
    `)
    .eq("status", "resolved")
    .gte("match_date", start.toISOString())
    .lte("match_date", end.toISOString());

  const statsMap = new Map<string, {
    user_id:     string;
    pseudo:      string;
    avatar_url:  string | null;
    total_picks: number;
    total_units: number;
    won:         number;
    half_won:    number;
    refunded:    number;
    half_lost:   number;
    lost:        number;
  }>();

  for (const pick of picks || []) {
    const userId = pick.user_id;
    const user   = (pick as any).users;
    if (!user) continue;

    if (!statsMap.has(userId)) {
      statsMap.set(userId, {
        user_id:     userId,
        pseudo:      user.pseudo || "TIPSTER",
        avatar_url:  user.avatar_url || null,
        total_picks: 0,
        total_units: 0,
        won:         0,
        half_won:    0,
        refunded:    0,
        half_lost:   0,
        lost:        0,
      });
    }

    const s = statsMap.get(userId)!;
    s.total_picks += 1;
    s.total_units += parseFloat(String(pick.units_result)) || 0;
    if      (pick.result === "won")       s.won       += 1;
    else if (pick.result === "half_won")  s.half_won  += 1;
    else if (pick.result === "refunded")  s.refunded  += 1;
    else if (pick.result === "half_lost") s.half_lost += 1;
    else if (pick.result === "lost")      s.lost      += 1;
  }

  const all = Array.from(statsMap.values()).map(s => ({
    ...s,
    total_units: Math.round(s.total_units * 100) / 100,
  }));

  // Éligibles : ont atteint le minimum de picks
  const eligible = all
    .filter(s => s.total_picks >= minPicks)
    .map(s => ({ ...s, eligible: true }))
    .sort((a, b) => b.total_units - a.total_units)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  // Non-éligibles : triés aussi par units pour affichage "proche éligibilité"
  const nonEligible = all
    .filter(s => s.total_picks < minPicks)
    .map(s => ({ ...s, eligible: false }))
    .sort((a, b) => b.total_units - a.total_units);

  return { ranking: eligible, non_eligible: nonEligible };
}

// ============================================================================
// ROUTE GET
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "current";

  try {

    // ── Classements en cours ──────────────────────────────────────
    if (action === "current") {
      const weekBounds  = getWeekBounds();
      const monthBounds = getMonthBounds();
      const config      = await getConcoursConfig();

      const [weekData, monthData] = await Promise.all([
        computeRanking(weekBounds.start, weekBounds.end, config.week.min_picks),
        computeRanking(monthBounds.start, monthBounds.end, config.month.min_picks),
      ]);

      return NextResponse.json({
        week: {
          period_start: weekBounds.start.toISOString(),
          period_end:   weekBounds.end.toISOString(),
          min_picks:    config.week.min_picks,
          prize:        config.week.prize_amount,
          active:       config.week.active,
          ranking:      weekData.ranking,
          non_eligible: weekData.non_eligible,
        },
        month: {
          period_start: monthBounds.start.toISOString(),
          period_end:   monthBounds.end.toISOString(),
          min_picks:    config.month.min_picks,
          prize:        config.month.prize_amount,
          active:       config.month.active,
          ranking:      monthData.ranking,
          non_eligible: monthData.non_eligible,
        },
      });
    }

    // ── Historique des gagnants ───────────────────────────────────
    if (action === "history") {
      const { data: winners } = await supabaseAdmin
        .from("tipster_concours_winners")
        .select(`*, users:user_id (id, pseudo, avatar_url)`)
        .order("period_start", { ascending: false })
        .limit(50);

      return NextResponse.json({ winners: winners || [] });
    }

    // ── Badges d'un user ─────────────────────────────────────────
    if (action === "badges") {
      const userId = searchParams.get("user_id");
      if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

      const { data: wins } = await supabaseAdmin
        .from("tipster_concours_winners")
        .select("period_type")
        .eq("user_id", userId);

      const weekWins  = (wins || []).filter((w: any) => w.period_type === "week").length;
      const monthWins = (wins || []).filter((w: any) => w.period_type === "month").length;

      return NextResponse.json({ week_wins: weekWins, month_wins: monthWins });
    }

    // ── Position du user connecté dans les concours en cours ─────
    if (action === "my_ranking") {
      const userId = searchParams.get("user_id");
      if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

      const weekBounds  = getWeekBounds();
      const monthBounds = getMonthBounds();
      const config      = await getConcoursConfig();

      const [weekData, monthData] = await Promise.all([
        computeRanking(weekBounds.start, weekBounds.end, config.week.min_picks),
        computeRanking(monthBounds.start, monthBounds.end, config.month.min_picks),
      ]);

      const findUserRanking = (data: { ranking: any[]; non_eligible: any[] }) => {
        const inRanking     = data.ranking.find(s => s.user_id === userId);
        const inNonEligible = data.non_eligible.find(s => s.user_id === userId);
        const leader        = data.ranking[0] || null;

        if (inRanking) {
          return {
            rank:               inRanking.rank,
            total_picks:        inRanking.total_picks,
            total_units:        inRanking.total_units,
            eligible:           true,
            leader_pseudo:      leader?.pseudo || null,
            leader_units:       leader?.total_units || 0,
            gap_to_leader:      inRanking.rank === 1
              ? 0
              : Math.round((leader.total_units - inRanking.total_units) * 100) / 100,
            total_participants: data.ranking.length,
          };
        }
        if (inNonEligible) {
          return {
            rank:               null,
            total_picks:        inNonEligible.total_picks,
            total_units:        inNonEligible.total_units,
            eligible:           false,
            leader_pseudo:      leader?.pseudo || null,
            leader_units:       leader?.total_units || 0,
            gap_to_leader:      0,
            total_participants: data.ranking.length,
          };
        }
        return {
          rank: null, total_picks: 0, total_units: 0, eligible: false,
          leader_pseudo: leader?.pseudo || null,
          leader_units:  leader?.total_units || 0,
          gap_to_leader: 0,
          total_participants: data.ranking.length,
        };
      };

      return NextResponse.json({
        week: {
          ...findUserRanking(weekData),
          min_picks: config.week.min_picks,
          prize:     config.week.prize_amount,
        },
        month: {
          ...findUserRanking(monthData),
          min_picks: config.month.min_picks,
          prize:     config.month.prize_amount,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[tipster-concours] error:", message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}