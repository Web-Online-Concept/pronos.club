import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sportSlug = searchParams.get("sport");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabaseAdmin
    .from("picks")
    .select("*, sport:sports(id, name_fr, icon, slug), bookmaker:bookmakers(id, name, slug)")
    .neq("status", "pending")
    .order("result_entered_at", { ascending: true });

  if (from) query = query.gte("result_entered_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("result_entered_at", `${to}T23:59:59Z`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allPicks = data ?? [];

  // Sport list (before sport filter)
  const allSportMap = new Map<string, { name: string; icon: string; slug: string }>();
  allPicks.forEach((p) => {
    const sport = Array.isArray(p.sport) ? p.sport[0] : p.sport;
    if (!sport) return;
    if (!allSportMap.has(sport.slug)) {
      allSportMap.set(sport.slug, { name: sport.name_fr, icon: sport.icon ?? "", slug: sport.slug });
    }
  });
  const allSports = Array.from(allSportMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  // Available months
  const monthSet = new Set<string>();
  allPicks.forEach((p) => {
    const date = p.result_entered_at?.split("T")[0] ?? "";
    if (date) monthSet.add(date.slice(0, 7));
  });
  const availableMonths = Array.from(monthSet).sort();

  // Meta-only mode: return just sports + months for filter dropdowns
  const metaOnly = searchParams.get("meta_only");
  if (metaOnly === "true") {
    return NextResponse.json({ allSports, availableMonths });
  }
  
  // Filter by sport
  const picks = sportSlug && sportSlug !== "all"
    ? allPicks.filter((p) => {
        const sport = Array.isArray(p.sport) ? p.sport[0] : p.sport;
        return sport?.slug === sportSlug;
      })
    : allPicks;

  const totalPicks = picks.length;
  const wonPicks = picks.filter((p) => p.status === "won" || p.status === "half_won").length;
  const lostPicks = picks.filter((p) => p.status === "lost" || p.status === "half_lost").length;
  const voidPicks = picks.filter((p) => p.status === "void").length;
  const resolvedPicks = totalPicks - voidPicks;
  const totalProfit = picks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const totalStaked = picks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
  const winRate = resolvedPicks > 0 ? (wonPicks / resolvedPicks) * 100 : 0;
  const avgOdds = totalPicks > 0 ? picks.reduce((s, p) => s + p.odds, 0) / totalPicks : 0;

  const bestPick = picks.reduce((best, p) => ((p.profit ?? 0) > (best?.profit ?? -Infinity) ? p : best), picks[0]);
  const worstPick = picks.reduce((worst, p) => ((p.profit ?? 0) < (worst?.profit ?? Infinity) ? p : worst), picks[0]);

  // Streaks
  let maxWinStreak = 0, maxLoseStreak = 0, currentWinStreak = 0, currentLoseStreak = 0;
  let currentStreakType = "";
  let currentStreakCount = 0;

  picks.forEach((p) => {
    if (p.status === "won" || p.status === "half_won") {
      currentWinStreak++;
      currentLoseStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      currentStreakType = "W";
      currentStreakCount = currentWinStreak;
    } else if (p.status === "lost" || p.status === "half_lost") {
      currentLoseStreak++;
      currentWinStreak = 0;
      if (currentLoseStreak > maxLoseStreak) maxLoseStreak = currentLoseStreak;
      currentStreakType = "L";
      currentStreakCount = currentLoseStreak;
    }
  });

  // Avg odds won vs lost
  const wonOdds = picks.filter((p) => p.status === "won" || p.status === "half_won");
  const lostOddsArr = picks.filter((p) => p.status === "lost" || p.status === "half_lost");
  const avgOddsWon = wonOdds.length > 0 ? wonOdds.reduce((s, p) => s + p.odds, 0) / wonOdds.length : 0;
  const avgOddsLost = lostOddsArr.length > 0 ? lostOddsArr.reduce((s, p) => s + p.odds, 0) / lostOddsArr.length : 0;

  // Profit timeline
  let cumProfit = 0;
  const profitTimeline = picks.map((p) => {
    cumProfit += p.profit ?? 0;
    return {
      date: p.result_entered_at?.split("T")[0] ?? "",
      profit: Math.round(cumProfit * 100) / 100,
      event: p.event_name,
    };
  });

  // ROI timeline
  let cumStaked = 0;
  let cumProfitRoi = 0;
  const roiTimeline = picks.map((p) => {
    cumStaked += p.stake ?? 0;
    cumProfitRoi += p.profit ?? 0;
    return {
      date: p.result_entered_at?.split("T")[0] ?? "",
      roi: cumStaked > 0 ? Math.round((cumProfitRoi / cumStaked) * 10000) / 100 : 0,
    };
  });

  // Drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let cumDD = 0;
  const drawdownTimeline = picks.map((p) => {
    cumDD += p.profit ?? 0;
    if (cumDD > peak) peak = cumDD;
    const dd = peak - cumDD;
    if (dd > maxDrawdown) maxDrawdown = dd;
    return {
      date: p.result_entered_at?.split("T")[0] ?? "",
      drawdown: -Math.round(dd * 100) / 100,
    };
  });

  // By sport
  const sportMap = new Map<string, { name: string; icon: string; slug: string; won: number; lost: number; total: number; profit: number; staked: number }>();
  picks.forEach((p) => {
    const sport = Array.isArray(p.sport) ? p.sport[0] : p.sport;
    if (!sport) return;
    const key = sport.slug;
    if (!sportMap.has(key)) {
      sportMap.set(key, { name: sport.name_fr, icon: sport.icon ?? "", slug: key, won: 0, lost: 0, total: 0, profit: 0, staked: 0 });
    }
    const s = sportMap.get(key)!;
    s.total++;
    s.staked += p.stake ?? 0;
    if (p.status === "won" || p.status === "half_won") s.won++;
    if (p.status === "lost" || p.status === "half_lost") s.lost++;
    s.profit += p.profit ?? 0;
  });
  const bySport = Array.from(sportMap.values())
    .map((s) => ({ ...s, roi: s.staked > 0 ? Math.round((s.profit / s.staked) * 10000) / 100 : 0, winRate: (s.won + s.lost) > 0 ? Math.round((s.won / (s.won + s.lost)) * 10000) / 100 : 0 }))
    .sort((a, b) => b.profit - a.profit);

  // By month
  const monthMap = new Map<string, { month: string; won: number; lost: number; total: number; profit: number; staked: number }>();
  picks.forEach((p) => {
    const date = p.result_entered_at?.split("T")[0] ?? "";
    const month = date.slice(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { month, won: 0, lost: 0, total: 0, profit: 0, staked: 0 });
    }
    const m = monthMap.get(month)!;
    m.total++;
    m.staked += p.stake ?? 0;
    if (p.status === "won" || p.status === "half_won") m.won++;
    if (p.status === "lost" || p.status === "half_lost") m.lost++;
    m.profit += p.profit ?? 0;
  });
  const byMonth = Array.from(monthMap.values())
    .map((m) => ({ ...m, roi: m.staked > 0 ? Math.round((m.profit / m.staked) * 10000) / 100 : 0, profit: Math.round(m.profit * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // By bookmaker
  const bookmakerMap = new Map<string, { name: string; slug: string; won: number; lost: number; total: number; profit: number; staked: number }>();
  picks.forEach((p) => {
    const bk = Array.isArray(p.bookmaker) ? p.bookmaker[0] : p.bookmaker;
    if (!bk) return;
    const key = bk.slug;
    if (!bookmakerMap.has(key)) {
      bookmakerMap.set(key, { name: bk.name, slug: key, won: 0, lost: 0, total: 0, profit: 0, staked: 0 });
    }
    const b = bookmakerMap.get(key)!;
    b.total++;
    b.staked += p.stake ?? 0;
    if (p.status === "won" || p.status === "half_won") b.won++;
    if (p.status === "lost" || p.status === "half_lost") b.lost++;
    b.profit += p.profit ?? 0;
  });
  const byBookmaker = Array.from(bookmakerMap.values())
    .map((b) => ({ ...b, roi: b.staked > 0 ? Math.round((b.profit / b.staked) * 10000) / 100 : 0, winRate: (b.won + b.lost) > 0 ? Math.round((b.won / (b.won + b.lost)) * 10000) / 100 : 0, profit: Math.round(b.profit * 100) / 100 }))
    .sort((a, b) => b.profit - a.profit);

  // Odds distribution
  const oddsRanges = [
    { label: "1.00-1.50", min: 1, max: 1.5 },
    { label: "1.50-2.00", min: 1.5, max: 2 },
    { label: "2.00-2.50", min: 2, max: 2.5 },
    { label: "2.50-3.00", min: 2.5, max: 3 },
    { label: "3.00+", min: 3, max: 999 },
  ];
  const oddsDist = oddsRanges.map((range) => {
    const inRange = picks.filter((p) => p.odds >= range.min && p.odds < range.max);
    const won = inRange.filter((p) => p.status === "won" || p.status === "half_won").length;
    const total = inRange.length;
    const profit = inRange.reduce((s, p) => s + (p.profit ?? 0), 0);
    return { label: range.label, total, won, winRate: total > 0 ? Math.round((won / total) * 100) : 0, profit: Math.round(profit * 100) / 100 };
  });

  // Fetch tipster bankroll config
  const { data: tipsterBkRow } = await supabaseAdmin
    .from("configs")
    .select("blob_json")
    .eq("kind", "tipster_bankroll")
    .single();

  const tipsterBankroll = tipsterBkRow?.blob_json ?? null;

  return NextResponse.json({
    overview: {
      totalPicks, wonPicks, lostPicks, voidPicks,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalStaked: Math.round(totalStaked * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      avgOdds: Math.round(avgOdds * 100) / 100,
      avgOddsWon: Math.round(avgOddsWon * 100) / 100,
      avgOddsLost: Math.round(avgOddsLost * 100) / 100,
      maxWinStreak,
      maxLoseStreak,
      currentStreak: currentStreakType ? `${currentStreakType}${currentStreakCount}` : "-",
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      bestPick: bestPick ? { event: bestPick.event_name, profit: bestPick.profit, odds: bestPick.odds } : null,
      worstPick: worstPick ? { event: worstPick.event_name, profit: worstPick.profit, odds: worstPick.odds } : null,
    },
    profitTimeline,
    roiTimeline,
    drawdownTimeline,
    allSports,
    availableMonths,
    bySport,
    byMonth,
    byBookmaker,
    oddsDist,
    tipsterBankroll,
  });
}