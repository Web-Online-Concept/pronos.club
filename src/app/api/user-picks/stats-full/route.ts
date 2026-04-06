import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sportSlug = searchParams.get("sport");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Get followed pick IDs WITH euro stake + unit value
  const { data: followedRows } = await supabase
    .from("user_picks")
    .select("pick_id, user_unit_value, user_stake_euro")
    .eq("user_id", user.id)
    .eq("followed", true);

  const followedMap = new Map(
    (followedRows ?? []).map((r) => [r.pick_id, r])
  );
  const followedIds = [...followedMap.keys()];

  if (followedIds.length === 0) {
    return NextResponse.json({
      overview: { totalFollowed: 0, won: 0, lost: 0, voidPicks: 0, profit: 0, profitEuro: 0, staked: 0, stakedEuro: 0, roi: 0, winRate: 0, avgOdds: 0, avgOddsWon: 0, avgOddsLost: 0, maxWinStreak: 0, maxLoseStreak: 0, currentStreak: "-", maxDrawdown: 0, maxDrawdownEuro: 0, bestPick: null, worstPick: null },
      profitTimeline: [], roiTimeline: [], drawdownTimeline: [], allSports: [], availableMonths: [], bySport: [], byMonth: [], oddsDist: [],
    });
  }

  let query = supabase
    .from("picks")
    .select("*, sport:sports(id, name_fr, icon, slug)")
    .in("id", followedIds)
    .neq("status", "pending")
    .order("pick_number", { ascending: true });

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

  // Filter by sport
  const picks = sportSlug && sportSlug !== "all"
    ? allPicks.filter((p) => {
        const sport = Array.isArray(p.sport) ? p.sport[0] : p.sport;
        return sport?.slug === sportSlug;
      })
    : allPicks;

  // Helper: get user's euro stake for a pick
  // Priority: user_stake_euro > (stake × user_unit_value) > 0
  function getUserStakeEuro(pickId: string, tipsterStake: number): number {
    const row = followedMap.get(pickId);
    if (!row) return 0;
    if (row.user_stake_euro && Number(row.user_stake_euro) > 0) return Number(row.user_stake_euro);
    if (row.user_unit_value && Number(row.user_unit_value) > 0) return tipsterStake * Number(row.user_unit_value);
    return 0;
  }

  // Helper: calculate euro profit for a pick using user's real stake
  function getEuroProfit(pick: { id: string; profit: number; stake: number; status: string }): number {
    const stakeEuro = getUserStakeEuro(pick.id, pick.stake);
    const stake = pick.stake ?? 0;
    if (stakeEuro === 0 || stake === 0) return 0;
    // profit in units / stake in units = ratio, then × stakeEuro
    // This preserves half_won/half_lost/void nuances
    return ((pick.profit ?? 0) / stake) * stakeEuro;
  }

  const totalFollowed = picks.length;
  const won = picks.filter((p) => p.status === "won" || p.status === "half_won").length;
  const lost = picks.filter((p) => p.status === "lost" || p.status === "half_lost").length;
  const voidPicks = picks.filter((p) => p.status === "void").length;
  const resolved = totalFollowed - voidPicks;
  const profit = picks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const profitEuro = picks.reduce((s, p) => s + getEuroProfit(p), 0);
  const staked = picks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const stakedEuro = picks.reduce((s, p) => s + getUserStakeEuro(p.id, p.stake), 0);
  const roi = staked > 0 ? (profit / staked) * 100 : 0;
  const winRate = resolved > 0 ? (won / resolved) * 100 : 0;
  const avgOdds = resolved > 0 ? picks.filter((p) => p.status !== "void").reduce((s, p) => s + p.odds, 0) / resolved : 0;

  // Best/worst pick with tiebreaker on odds
  const bestPick = picks.reduce((best, p) => {
    const pProfit = p.profit ?? 0;
    const bProfit = best?.profit ?? -Infinity;
    if (pProfit > bProfit) return p;
    if (pProfit === bProfit && p.odds > (best?.odds ?? -Infinity)) return p;
    return best;
  }, picks[0]);

  const worstPick = picks.reduce((worst, p) => {
    const pProfit = p.profit ?? 0;
    const wProfit = worst?.profit ?? Infinity;
    if (pProfit < wProfit) return p;
    if (pProfit === wProfit && p.odds < (worst?.odds ?? Infinity)) return p;
    return worst;
  }, picks[0]);

  // Avg odds won vs lost
  const wonOdds = picks.filter((p) => p.status === "won" || p.status === "half_won");
  const lostOddsArr = picks.filter((p) => p.status === "lost" || p.status === "half_lost");
  const avgOddsWon = wonOdds.length > 0 ? wonOdds.reduce((s, p) => s + p.odds, 0) / wonOdds.length : 0;
  const avgOddsLost = lostOddsArr.length > 0 ? lostOddsArr.reduce((s, p) => s + p.odds, 0) / lostOddsArr.length : 0;

  // Streaks
  let maxWinStreak = 0, maxLoseStreak = 0, curWin = 0, curLose = 0;
  let streakType = "", streakCount = 0;
  picks.forEach((p) => {
    if (p.status === "won" || p.status === "half_won") {
      curWin++; curLose = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
      streakType = "W"; streakCount = curWin;
    } else if (p.status === "lost" || p.status === "half_lost") {
      curLose++; curWin = 0;
      if (curLose > maxLoseStreak) maxLoseStreak = curLose;
      streakType = "L"; streakCount = curLose;
    }
  });

  // Profit timeline
  let cumProfit = 0;
  let cumProfitEuro = 0;
  const profitTimeline = picks.map((p) => {
    cumProfit += p.profit ?? 0;
    cumProfitEuro += getEuroProfit(p);
    return {
      date: p.result_entered_at?.split("T")[0] ?? "",
      profit: Math.round(cumProfit * 1000) / 1000,
      profitEuro: Math.round(cumProfitEuro * 100) / 100,
      event: p.event_name,
    };
  });

  // ROI timeline
  let cumStaked = 0, cumProfitRoi = 0;
  const roiTimeline = picks.map((p) => {
    cumStaked += p.stake ?? 0;
    cumProfitRoi += p.profit ?? 0;
    return { date: p.result_entered_at?.split("T")[0] ?? "", roi: cumStaked > 0 ? Math.round((cumProfitRoi / cumStaked) * 10000) / 100 : 0 };
  });

  // Drawdown
  let peak = 0, peakEuro = 0, maxDrawdown = 0, maxDrawdownEuro = 0, cumDD = 0, cumDDEuro = 0;
  const drawdownTimeline = picks.map((p) => {
    cumDD += p.profit ?? 0;
    cumDDEuro += getEuroProfit(p);
    if (cumDD > peak) peak = cumDD;
    if (cumDDEuro > peakEuro) peakEuro = cumDDEuro;
    const dd = peak - cumDD;
    const ddEuro = peakEuro - cumDDEuro;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (ddEuro > maxDrawdownEuro) maxDrawdownEuro = ddEuro;
    return {
      date: p.result_entered_at?.split("T")[0] ?? "",
      drawdown: -Math.round(dd * 1000) / 1000,
      drawdownEuro: -Math.round(ddEuro * 100) / 100,
    };
  });

  // By sport
  const sportMap = new Map<string, { name: string; icon: string; slug: string; won: number; lost: number; total: number; profit: number; profitEuro: number; staked: number }>();
  picks.forEach((p) => {
    const sport = Array.isArray(p.sport) ? p.sport[0] : p.sport;
    if (!sport) return;
    const key = sport.slug;
    if (!sportMap.has(key)) sportMap.set(key, { name: sport.name_fr, icon: sport.icon ?? "", slug: key, won: 0, lost: 0, total: 0, profit: 0, profitEuro: 0, staked: 0 });
    const s = sportMap.get(key)!;
    s.total++; s.staked += p.stake ?? 0;
    if (p.status === "won" || p.status === "half_won") s.won++;
    if (p.status === "lost" || p.status === "half_lost") s.lost++;
    s.profit += p.profit ?? 0;
    s.profitEuro += getEuroProfit(p);
  });
  const bySport = Array.from(sportMap.values())
    .map((s) => ({ ...s, roi: s.staked > 0 ? Math.round((s.profit / s.staked) * 10000) / 100 : 0, winRate: (s.won + s.lost) > 0 ? Math.round((s.won / (s.won + s.lost)) * 10000) / 100 : 0, profit: Math.round(s.profit * 1000) / 1000, profitEuro: Math.round(s.profitEuro * 100) / 100 }))
    .sort((a, b) => b.profit - a.profit);

  // By month
  const monthMap = new Map<string, { month: string; won: number; lost: number; total: number; profit: number; profitEuro: number; staked: number }>();
  picks.forEach((p) => {
    const date = p.result_entered_at?.split("T")[0] ?? "";
    const month = date.slice(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, { month, won: 0, lost: 0, total: 0, profit: 0, profitEuro: 0, staked: 0 });
    const m = monthMap.get(month)!;
    m.total++; m.staked += p.stake ?? 0;
    if (p.status === "won" || p.status === "half_won") m.won++;
    if (p.status === "lost" || p.status === "half_lost") m.lost++;
    m.profit += p.profit ?? 0;
    m.profitEuro += getEuroProfit(p);
  });
  const byMonth = Array.from(monthMap.values())
    .map((m) => ({ ...m, roi: m.staked > 0 ? Math.round((m.profit / m.staked) * 10000) / 100 : 0, profit: Math.round(m.profit * 1000) / 1000, profitEuro: Math.round(m.profitEuro * 100) / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month));

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
    const w = inRange.filter((p) => p.status === "won" || p.status === "half_won").length;
    const total = inRange.length;
    const pr = inRange.reduce((s, p) => s + (p.profit ?? 0), 0);
    const prEuro = inRange.reduce((s, p) => s + getEuroProfit(p), 0);
    return { label: range.label, total, won: w, winRate: total > 0 ? Math.round((w / total) * 100) : 0, profit: Math.round(pr * 1000) / 1000, profitEuro: Math.round(prEuro * 100) / 100 };
  });

  return NextResponse.json({
    overview: {
      totalFollowed, won, lost, voidPicks,
      profit: Math.round(profit * 1000) / 1000,
      profitEuro: Math.round(profitEuro * 100) / 100,
      staked: Math.round(staked * 100) / 100,
      stakedEuro: Math.round(stakedEuro * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      avgOdds: Math.round(avgOdds * 1000) / 1000,
      avgOddsWon: Math.round(avgOddsWon * 1000) / 1000,
      avgOddsLost: Math.round(avgOddsLost * 1000) / 1000,
      maxWinStreak, maxLoseStreak,
      currentStreak: streakType ? `${streakType}${streakCount}` : "-",
      maxDrawdown: Math.round(maxDrawdown * 1000) / 1000,
      maxDrawdownEuro: Math.round(maxDrawdownEuro * 100) / 100,
      bestPick: bestPick ? { event: bestPick.event_name, profit: bestPick.profit, profitEuro: Math.round(getEuroProfit(bestPick) * 100) / 100, odds: bestPick.odds, pickNumber: bestPick.pick_number } : null,
      worstPick: worstPick ? { event: worstPick.event_name, profit: worstPick.profit, profitEuro: Math.round(getEuroProfit(worstPick) * 100) / 100, odds: worstPick.odds, pickNumber: worstPick.pick_number } : null,
    },
    profitTimeline,
    roiTimeline,
    drawdownTimeline,
    allSports,
    availableMonths,
    bySport,
    byMonth,
    oddsDist,
  });
}