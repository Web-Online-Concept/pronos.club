// src/app/api/tipster-leaderboard/route.ts
// Classement des tipsters — 3 périodes (week, month, all), multi-critères
//
// CORRECTION (03/05/2026) :
//   Filtre sur match_date (date du match) au lieu de resolved_at.
//   Logique : un pick sur un match du 30 avril résolu le 1er mai appartient
//   à avril, pas à mai. La date du match est la seule référence cohérente
//   pour les périodes du concours hebdo/mensuel.
//   Les périodes sont calendaires (lundi 00:00 Paris / 1er du mois 00:00 Paris)
//   et non plus des fenêtres glissantes (now-7j / now-30j).

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

/**
 * Retourne l'offset Paris/UTC en millisecondes à une date UTC donnée.
 * Fonctionne quel que soit le timezone du serveur (Vercel = UTC).
 * Été : +7 200 000 ms (+2h). Hiver : +3 600 000 ms (+1h).
 */
function getParisOffsetMs(utcDate: Date): number {
  const parisTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utcTime   = new Date(utcDate.toLocaleString("en-US", { timeZone: "UTC" }));
  return parisTime.getTime() - utcTime.getTime();
}

/**
 * Retourne le timestamp UTC correspondant à minuit (00:00:00) heure de Paris
 * pour une date calendaire donnée (année, mois 1-12, jour).
 *
 * Exemple (été UTC+2) : Paris 2026-05-04 00:00 = UTC 2026-05-03 22:00:00Z
 */
function parisMidnightUTC(year: number, month: number, day: number): Date {
  const noonUTC       = new Date(Date.UTC(year, month - 1, day, 12));
  const parisOffsetMs = getParisOffsetMs(noonUTC);
  const utcMidnight   = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcMidnight.getTime() - parisOffsetMs);
}

/**
 * Calcule le début de période calendaire en heure Paris, retourné en ISO UTC.
 *
 * - "week"  : lundi 00:00:00 Europe/Paris de la semaine en cours
 * - "month" : 1er du mois 00:00:00 Europe/Paris du mois en cours
 */
function getParisStartOfPeriod(period: "week" | "month"): string {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
  }).formatToParts(now);

  const parisYear  = parseInt(parts.find(p => p.type === "year")!.value);
  const parisMonth = parseInt(parts.find(p => p.type === "month")!.value);
  const parisDay   = parseInt(parts.find(p => p.type === "day")!.value);

  if (period === "month") {
    return parisMidnightUTC(parisYear, parisMonth, 1).toISOString();
  }

  // Semaine : trouver le lundi de la semaine courante
  const currentDate = new Date(parisYear, parisMonth - 1, parisDay);
  const dow         = currentDate.getDay(); // 0=dim, 1=lun
  const daysBack    = dow === 0 ? 6 : dow - 1;
  const monday      = new Date(parisYear, parisMonth - 1, parisDay - daysBack);

  return parisMidnightUTC(
    monday.getFullYear(),
    monday.getMonth() + 1,
    monday.getDate()
  ).toISOString();
}

// ============================================================================
// ROUTE GET
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") || "all") as Period;

  try {
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

    // ── Filtrage par période calendaire sur match_date ──────────────
    // match_date = date du match = la seule référence logique.
    //   → Match le 30 avril, résolu le 1er mai : compte pour avril ✓
    //   → Pick posté le 28 avril, match le 15 mai : compte pour mai ✓
    if (period === "week" || period === "month") {
      const periodStart = getParisStartOfPeriod(period);
      query = query.gte("match_date", periodStart);
      console.log(`[tipster-leaderboard] period=${period} start=${periodStart}`);
    }

    const { data: picks, error } = await query;
    if (error) throw error;

    // ── Agrégation par user ─────────────────────────────────────────
    const statsMap = new Map<string, {
      user_id:        string;
      pseudo:         string;
      avatar_url:     string | null;
      total_picks:    number;
      won:            number;
      half_won:       number;
      refunded:       number;
      half_lost:      number;
      lost:           number;
      total_odds:     number;
      total_units:    number;
      recent_results: Array<{ date: string; result: string }>;
    }>();

    for (const pick of picks || []) {
      const userId = pick.user_id;
      const user   = (pick as any).users;
      if (!user) continue;

      if (!statsMap.has(userId)) {
        statsMap.set(userId, {
          user_id:        userId,
          pseudo:         user.pseudo || "TIPSTER",
          avatar_url:     user.avatar_url || null,
          total_picks:    0,
          won:            0,
          half_won:       0,
          refunded:       0,
          half_lost:      0,
          lost:           0,
          total_odds:     0,
          total_units:    0,
          recent_results: [],
        });
      }

      const s = statsMap.get(userId)!;
      s.total_picks += 1;
      s.total_odds  += parseFloat(String(pick.odds))         || 0;
      s.total_units += parseFloat(String(pick.units_result)) || 0;

      if      (pick.result === "won")       s.won       += 1;
      else if (pick.result === "half_won")  s.half_won  += 1;
      else if (pick.result === "refunded")  s.refunded  += 1;
      else if (pick.result === "half_lost") s.half_lost += 1;
      else if (pick.result === "lost")      s.lost      += 1;

      s.recent_results.push({
        date:   pick.resolved_at ?? pick.match_date,
        result: pick.result,
      });
    }

    // ── Calcul final + forme récente ────────────────────────────────
    const stats = Array.from(statsMap.values()).map((s) => {
      const winPicks               = s.won + s.half_won * 0.5;
      const losePicks              = s.lost + s.half_lost * 0.5;
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

      s.recent_results.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const recent_form = s.recent_results.slice(0, 5).map(r => r.result);

      return {
        user_id:     s.user_id,
        pseudo:      s.pseudo,
        avatar_url:  s.avatar_url,
        total_picks: s.total_picks,
        won:         s.won,
        half_won:    s.half_won,
        refunded:    s.refunded,
        half_lost:   s.half_lost,
        lost:        s.lost,
        winrate,
        avg_odds:    avgOdds,
        total_units: Math.round(s.total_units * 100) / 100,
        roi,
        recent_form,
      };
    });

    stats.sort((a, b) => b.total_units - a.total_units);
    const ranked = stats.map((s, i) => ({ ...s, rank: i + 1 }));

    return NextResponse.json({ period, leaderboard: ranked });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[tipster-leaderboard] error:", message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}