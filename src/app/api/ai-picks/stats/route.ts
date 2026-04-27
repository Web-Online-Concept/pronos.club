import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";


// Mapping local pour transformer les slugs sport/league IA en noms lisibles
const SPORT_INFO: Record<string, { name_fr: string; icon: string }> = {
  football: { name_fr: "Football", icon: "⚽" },
  tennis: { name_fr: "Tennis", icon: "🎾" },
  basketball: { name_fr: "Basketball", icon: "🏀" },
  hockey: { name_fr: "Hockey", icon: "🏒" },
  baseball: { name_fr: "Baseball", icon: "⚾" },
  "football-americain": { name_fr: "Football US", icon: "🏈" },
  rugby: { name_fr: "Rugby", icon: "🏉" },
  mma: { name_fr: "MMA", icon: "🥊" },
  // Compat anciens picks v1
  soccer: { name_fr: "Football", icon: "⚽" },
  americanfootball: { name_fr: "Football US", icon: "🏈" },
};


const BOOKMAKER_DISPLAY: Record<string, string> = {
  Pinnacle: "PS3838",
  pinnacle: "PS3838",
  "1xBet": "1xbet",
  onexbet: "1xbet",
  Betclic: "Betclic",
  betclic_fr: "Betclic",
  Winamax: "Winamax",
  winamax_fr: "Winamax",
  Unibet: "Unibet",
  unibet_fr: "Unibet",
  Stake: "Stake",
  stake: "Stake",
};

const normalizeBookmaker = (raw: string | null): string => {
  if (!raw) return "Inconnu";
  return BOOKMAKER_DISPLAY[raw] ?? raw;
};

const normalizeSport = (raw: string): string => {
  if (raw === "soccer") return "football";
  if (raw === "americanfootball") return "football-americain";
  return raw;
};


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sportSlug = searchParams.get("sport");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Module Buteurs supprime : on n'expose plus que les picks classics.
  const activeType: "classic" = "classic";

  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      "id, ai_pick_number, classic_number, scorer_number, pick_type, sport, league, event_name, event_date, selection, odds, odds_bookmaker, status, profit, resolved_at"
    )
    .neq("status", "pending")
    .is("deleted_at", null)
    .eq("pick_type", activeType)
    .order("classic_number", { ascending: true, nullsFirst: false });

  if (from) query = query.gte("resolved_at", `${from}T00:00:00Z`);
  if (to) query = query.lte("resolved_at", `${to}T23:59:59Z`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allPicks = data ?? [];

  // ── Sports list (avant filtre sport) ───────────────────────────
  const allSportMap = new Map<string, { name: string; icon: string; slug: string }>();
  allPicks.forEach((p) => {
    const sportNorm = normalizeSport(p.sport);
    const info = SPORT_INFO[sportNorm];
    if (!info) return;
    if (!allSportMap.has(sportNorm)) {
      allSportMap.set(sportNorm, { name: info.name_fr, icon: info.icon, slug: sportNorm });
    }
  });
  const allSports = Array.from(allSportMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // ── Mois disponibles ───────────────────────────────────────────
  const monthSet = new Set<string>();
  allPicks.forEach((p) => {
    const date = p.resolved_at?.split("T")[0] ?? "";
    if (date) monthSet.add(date.slice(0, 7));
  });
  const availableMonths = Array.from(monthSet).sort();

  // Meta-only mode (pour dropdowns filtres)
  const metaOnly = searchParams.get("meta_only");
  if (metaOnly === "true") {
    return NextResponse.json({ allSports, availableMonths });
  }

  // ── Filtre par sport ───────────────────────────────────────────
  const picks =
    sportSlug && sportSlug !== "all"
      ? allPicks.filter((p) => normalizeSport(p.sport) === sportSlug)
      : allPicks;

  // ── Stake fixe IA = 1U partout ─────────────────────────────────
  const STAKE_PER_PICK = 1;

  const totalPicks = picks.length;
  const wonPicks = picks.filter((p) => p.status === "won").length;
  const lostPicks = picks.filter((p) => p.status === "lost").length;
  const voidPicks = picks.filter((p) => p.status === "void").length;
  const resolvedPicks = totalPicks - voidPicks;

  const totalProfit = picks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const totalStaked = totalPicks * STAKE_PER_PICK;
  const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0;
  const winRate = resolvedPicks > 0 ? (wonPicks / resolvedPicks) * 100 : 0;
  const avgOdds =
    resolvedPicks > 0
      ? picks
          .filter((p) => p.status !== "void")
          .reduce((s, p) => s + (p.odds ?? 0), 0) / resolvedPicks
      : 0;

  // Best pick
  const bestPick = picks.reduce<typeof picks[number] | null>((best, p) => {
    const pProfit = p.profit ?? 0;
    const bProfit = best?.profit ?? -Infinity;
    if (pProfit > bProfit) return p;
    if (pProfit === bProfit && (p.odds ?? 0) > (best?.odds ?? -Infinity)) return p;
    return best;
  }, null);

  // Worst pick
  const worstPick = picks.reduce<typeof picks[number] | null>((worst, p) => {
    const pProfit = p.profit ?? 0;
    const wProfit = worst?.profit ?? Infinity;
    if (pProfit < wProfit) return p;
    if (pProfit === wProfit && (p.odds ?? 0) < (worst?.odds ?? Infinity)) return p;
    return worst;
  }, null);

  // Streaks
  let maxWinStreak = 0,
    maxLoseStreak = 0,
    currentWinStreak = 0,
    currentLoseStreak = 0;
  let currentStreakType = "";
  let currentStreakCount = 0;

  picks.forEach((p) => {
    if (p.status === "won") {
      currentWinStreak++;
      currentLoseStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      currentStreakType = "W";
      currentStreakCount = currentWinStreak;
    } else if (p.status === "lost") {
      currentLoseStreak++;
      currentWinStreak = 0;
      if (currentLoseStreak > maxLoseStreak) maxLoseStreak = currentLoseStreak;
      currentStreakType = "L";
      currentStreakCount = currentLoseStreak;
    }
  });

  // Cotes moyennes won vs lost
  const wonOdds = picks.filter((p) => p.status === "won");
  const lostOddsArr = picks.filter((p) => p.status === "lost");
  const avgOddsWon =
    wonOdds.length > 0
      ? wonOdds.reduce((s, p) => s + (p.odds ?? 0), 0) / wonOdds.length
      : 0;
  const avgOddsLost =
    lostOddsArr.length > 0
      ? lostOddsArr.reduce((s, p) => s + (p.odds ?? 0), 0) / lostOddsArr.length
      : 0;

  // Profit timeline
  let cumProfit = 0;
  const profitTimeline = picks.map((p, i) => {
    cumProfit += p.profit ?? 0;
    const num = p.classic_number ?? p.ai_pick_number;
    return {
      idx: i + 1,
      date: p.resolved_at?.split("T")[0] ?? "",
      profit: Math.round(cumProfit * 1000) / 1000,
      event: p.event_name,
      pickNumber: num ?? i + 1,
    };
  });

  // ROI timeline
  let cumStaked = 0;
  let cumProfitRoi = 0;
  const roiTimeline = picks.map((p, i) => {
    cumStaked += STAKE_PER_PICK;
    cumProfitRoi += p.profit ?? 0;
    const num = p.classic_number ?? p.ai_pick_number;
    return {
      idx: i + 1,
      date: p.resolved_at?.split("T")[0] ?? "",
      roi: cumStaked > 0 ? Math.round((cumProfitRoi / cumStaked) * 10000) / 100 : 0,
      pickNumber: num ?? i + 1,
    };
  });

  // Drawdown timeline
  let peak = 0;
  let maxDrawdown = 0;
  let cumDD = 0;
  const drawdownTimeline = picks.map((p, i) => {
    cumDD += p.profit ?? 0;
    if (cumDD > peak) peak = cumDD;
    const dd = peak - cumDD;
    if (dd > maxDrawdown) maxDrawdown = dd;
    const num = p.classic_number ?? p.ai_pick_number;
    return {
      idx: i + 1,
      date: p.resolved_at?.split("T")[0] ?? "",
      drawdown: -Math.round(dd * 1000) / 1000,
      pickNumber: num ?? i + 1,
    };
  });

  // Par sport
  const sportMap = new Map<
    string,
    { name: string; icon: string; slug: string; won: number; lost: number; total: number; profit: number; staked: number }
  >();
  picks.forEach((p) => {
    const sportNorm = normalizeSport(p.sport);
    const info = SPORT_INFO[sportNorm] ?? { name_fr: sportNorm, icon: "🏅" };
    if (!sportMap.has(sportNorm)) {
      sportMap.set(sportNorm, {
        name: info.name_fr,
        icon: info.icon,
        slug: sportNorm,
        won: 0,
        lost: 0,
        total: 0,
        profit: 0,
        staked: 0,
      });
    }
    const s = sportMap.get(sportNorm)!;
    s.total++;
    s.staked += STAKE_PER_PICK;
    if (p.status === "won") s.won++;
    if (p.status === "lost") s.lost++;
    s.profit += p.profit ?? 0;
  });
  const bySport = Array.from(sportMap.values())
    .map((s) => ({
      ...s,
      roi: s.staked > 0 ? Math.round((s.profit / s.staked) * 10000) / 100 : 0,
      winRate:
        s.won + s.lost > 0
          ? Math.round((s.won / (s.won + s.lost)) * 10000) / 100
          : 0,
      profit: Math.round(s.profit * 1000) / 1000,
    }))
    .sort((a, b) => b.profit - a.profit);

  // Par mois
  const monthMap = new Map<
    string,
    { month: string; won: number; lost: number; total: number; profit: number; staked: number }
  >();
  picks.forEach((p) => {
    const date = p.resolved_at?.split("T")[0] ?? "";
    const month = date.slice(0, 7);
    if (!month) return;
    if (!monthMap.has(month)) {
      monthMap.set(month, { month, won: 0, lost: 0, total: 0, profit: 0, staked: 0 });
    }
    const m = monthMap.get(month)!;
    m.total++;
    m.staked += STAKE_PER_PICK;
    if (p.status === "won") m.won++;
    if (p.status === "lost") m.lost++;
    m.profit += p.profit ?? 0;
  });
  const byMonth = Array.from(monthMap.values())
    .map((m) => ({
      ...m,
      roi: m.staked > 0 ? Math.round((m.profit / m.staked) * 10000) / 100 : 0,
      profit: Math.round(m.profit * 1000) / 1000,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Par bookmaker
  const bookmakerMap = new Map<
    string,
    { name: string; slug: string; won: number; lost: number; total: number; profit: number; staked: number }
  >();
  picks.forEach((p) => {
    const bkName = normalizeBookmaker(p.odds_bookmaker);
    const slug = bkName.toLowerCase().replace(/\s+/g, "-");
    if (!bookmakerMap.has(slug)) {
      bookmakerMap.set(slug, {
        name: bkName,
        slug,
        won: 0,
        lost: 0,
        total: 0,
        profit: 0,
        staked: 0,
      });
    }
    const b = bookmakerMap.get(slug)!;
    b.total++;
    b.staked += STAKE_PER_PICK;
    if (p.status === "won") b.won++;
    if (p.status === "lost") b.lost++;
    b.profit += p.profit ?? 0;
  });
  const byBookmaker = Array.from(bookmakerMap.values())
    .map((b) => ({
      ...b,
      roi: b.staked > 0 ? Math.round((b.profit / b.staked) * 10000) / 100 : 0,
      winRate:
        b.won + b.lost > 0
          ? Math.round((b.won / (b.won + b.lost)) * 10000) / 100
          : 0,
      profit: Math.round(b.profit * 1000) / 1000,
    }))
    .sort((a, b) => b.profit - a.profit);

  // Distribution cotes
  const oddsRanges = [
    { label: "1.00-1.50", min: 1, max: 1.5 },
    { label: "1.50-2.00", min: 1.5, max: 2 },
    { label: "2.00-2.50", min: 2, max: 2.5 },
    { label: "2.50-3.00", min: 2.5, max: 3 },
    { label: "3.00+", min: 3, max: 999 },
  ];
  const oddsDist = oddsRanges.map((range) => {
    const inRange = picks.filter(
      (p) => (p.odds ?? 0) >= range.min && (p.odds ?? 0) < range.max
    );
    const won = inRange.filter((p) => p.status === "won").length;
    const total = inRange.length;
    const profit = inRange.reduce((s, p) => s + (p.profit ?? 0), 0);
    return {
      label: range.label,
      total,
      won,
      winRate: total > 0 ? Math.round((won / total) * 100) : 0,
      profit: Math.round(profit * 1000) / 1000,
    };
  });

  // ── Bankroll IA classics ───────────────────────────────────────
  const { data: aiBkRow } = await supabaseAdmin
    .from("configs")
    .select("blob_json")
    .eq("kind", "ai_bankroll")
    .single();

  const aiBankroll = aiBkRow?.blob_json ?? null;

  const bestPickNum = bestPick
    ? bestPick.classic_number ?? bestPick.ai_pick_number
    : null;
  const worstPickNum = worstPick
    ? worstPick.classic_number ?? worstPick.ai_pick_number
    : null;

  return NextResponse.json({
    pickType: activeType,
    overview: {
      totalPicks,
      wonPicks,
      lostPicks,
      voidPicks,
      totalProfit: Math.round(totalProfit * 1000) / 1000,
      totalStaked: Math.round(totalStaked * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      avgOdds: Math.round(avgOdds * 1000) / 1000,
      avgOddsWon: Math.round(avgOddsWon * 1000) / 1000,
      avgOddsLost: Math.round(avgOddsLost * 1000) / 1000,
      maxWinStreak,
      maxLoseStreak,
      currentStreak: currentStreakType ? `${currentStreakType}${currentStreakCount}` : "-",
      maxDrawdown: Math.round(maxDrawdown * 1000) / 1000,
      bestPick: bestPick
        ? {
            event: bestPick.event_name,
            profit: bestPick.profit,
            odds: bestPick.odds,
            pickNumber: bestPickNum,
          }
        : null,
      worstPick: worstPick
        ? {
            event: worstPick.event_name,
            profit: worstPick.profit,
            odds: worstPick.odds,
            pickNumber: worstPickNum,
          }
        : null,
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
    aiBankroll,
  });
}