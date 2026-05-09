/**
 * PRONOS.CLUB — Bilan Hebdomadaire Generator (V3.5 - Étape 5)
 *
 * 2 fonctions principales :
 *
 *   1. **aggregateBilanHebdo(weekStart?)** : agrège les picks résolus d'une
 *      semaine ISO complète et retourne un BilanHebdo structuré (stats globales
 *      + par tier + par sport + évolution bankroll + liste picks).
 *
 *   2. **persistWeeklyBilan(bilan)** : UPSERT en BDD dans weekly_bilans
 *      pour permalink + cache de la page web.
 *
 * Convention semaine : ISO 8601 (lundi → dimanche).
 * Slug humanisé : "semaine-19-2026" (Q21-B validé).
 *
 * Le cron tourne le dimanche 22h Paris → on agrège la semaine courante
 * (lundi qui vient de se terminer → dimanche soir, presque entier).
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

// ============================================================================
// TYPES
// ============================================================================

export type BankrollEvolutionPoint = {
  date: string; // YYYY-MM-DD
  picks_count: number;
  daily_profit: number;
  cumulative_profit: number;
};

export type TierStats = {
  count: number;
  won: number;
  profit: number;
  roi_pct: number;
};

export type SportStats = {
  count: number;
  won: number;
  profit: number;
  roi_pct: number;
};

export type BilanHebdoPickEntry = {
  pick_id: string;
  slug: string | null;
  classic_number: number | null;
  date: string; // event_date YYYY-MM-DD
  sport: string;
  league: string;
  event_name: string;
  selection: string;
  odds: number;
  tier: string | null;
  drop_window: string | null;
  status: "won" | "lost" | "void";
  profit: number;
  final_score: string | null;
  clv_pct_final: number | null;
};

export type BilanHebdo = {
  // Identifiants semaine
  week_slug: string;     // "semaine-19-2026"
  week_iso: string;      // "2026-W19"
  week_start: string;    // ISO timestamp lundi 00:00 Paris
  week_end: string;      // ISO timestamp dimanche 23:59:59 Paris
  week_year: number;     // 2026
  week_number: number;   // 19
  week_label: string;    // "du 4 au 10 mai 2026" (humain, FR)

  // Stats globales
  total_picks: number;
  picks_won: number;
  picks_lost: number;
  picks_void: number;
  total_stake_units: number;
  total_profit_units: number;
  roi_pct: number;
  winrate_pct: number;
  clv_avg_pct: number | null;
  clv_picks_count: number;

  // Breakdown
  picks_by_tier: Record<string, TierStats>;
  picks_by_sport: Record<string, SportStats>;
  bankroll_evolution: BankrollEvolutionPoint[];
  picks: BilanHebdoPickEntry[];
};

type ResolvedPickRow = {
  id: string;
  slug: string | null;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  odds: number;
  status: string;
  profit: number | null;
  resolved_at: string | null;
  final_score: string | null;
  tier: string | null;
  drop_window: string | null;
  classic_number: number | null;
  odds_comparison: Record<string, unknown> | null;
};

// ============================================================================
// HELPERS - DATES & SEMAINE ISO
// ============================================================================

/**
 * Calcule le numéro de semaine ISO 8601 et l'année pour une date donnée.
 * Référence : https://en.wikipedia.org/wiki/ISO_week_date
 */
const getISOWeekAndYear = (date: Date): { year: number; week: number } => {
  const d = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ));
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week: weekNo };
};

/**
 * Calcule le lundi 00:00:00 Paris d'une semaine ISO donnée.
 * Référence : https://stackoverflow.com/questions/16590500/javascript-calculate-date-from-week-number
 */
const getISOWeekStart = (year: number, week: number): Date => {
  // Le 4 janvier est toujours dans la semaine 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  // Lundi de la semaine 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  // Lundi de la semaine cible
  const targetMonday = new Date(week1Monday);
  targetMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return targetMonday;
};

/**
 * Pour une date ISO (Paris), retourne lundi 00:00:00 Paris et dimanche 23:59:59 Paris
 * de la semaine ISO contenant cette date.
 */
const getWeekBounds = (date: Date): {
  startIso: string;
  endIso: string;
  year: number;
  week: number;
} => {
  const { year, week } = getISOWeekAndYear(date);
  // Le lundi 00:00 Paris est lundi 22:00 UTC dimanche précédent (été UTC+2)
  // Plus simple : on calcule en UTC puis on ajuste à 00:00 Paris (offset été = -2h UTC)
  const mondayUTC = getISOWeekStart(year, week);
  // Force 00:00 Paris été (= 22:00 UTC dimanche précédent)
  // On reconstitue : "lundi à 00:00 Paris été" = mondayUTC à 22h dimanche
  const mondayParisStart = new Date(
    `${mondayUTC.toISOString().slice(0, 10)}T00:00:00+02:00`
  );
  const sundayParisEnd = new Date(mondayParisStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  return {
    startIso: mondayParisStart.toISOString(),
    endIso: sundayParisEnd.toISOString(),
    year,
    week,
  };
};

/**
 * Formate un label humain "du 4 au 10 mai 2026" pour l'UI.
 */
const formatWeekLabel = (start: Date, end: Date): string => {
  const optsDay: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Paris",
    day: "numeric",
  };
  const optsDayMonth: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
  };
  const optsFull: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  // Si même mois et même année : "du 4 au 10 mai 2026"
  const startMonth = start.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", month: "numeric" });
  const endMonth = end.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", month: "numeric" });
  const startYear = start.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", year: "numeric" });
  const endYear = end.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", year: "numeric" });

  if (startMonth === endMonth && startYear === endYear) {
    const startDay = start.toLocaleDateString("fr-FR", optsDay);
    const endFull = end.toLocaleDateString("fr-FR", optsFull);
    return `du ${startDay} au ${endFull}`;
  }

  // Si même année mais mois différents : "du 28 avril au 4 mai 2026"
  if (startYear === endYear) {
    const startStr = start.toLocaleDateString("fr-FR", optsDayMonth);
    const endFull = end.toLocaleDateString("fr-FR", optsFull);
    return `du ${startStr} au ${endFull}`;
  }

  // Cas extrême : changement d'année (semaine 52 → 1)
  const startFull = start.toLocaleDateString("fr-FR", optsFull);
  const endFull = end.toLocaleDateString("fr-FR", optsFull);
  return `du ${startFull} au ${endFull}`;
};

// ============================================================================
// AGGREGATE BILAN HEBDO
// ============================================================================

/**
 * Agrège tous les picks résolus dans une semaine ISO et retourne un BilanHebdo.
 *
 * @param referenceDate Date de référence (par défaut maintenant). On prend la
 *                      semaine ISO contenant cette date.
 *                      Pour tester sur une semaine passée : passer une date dedans.
 */
export const aggregateBilanHebdo = async (
  referenceDate?: Date
): Promise<BilanHebdo | null> => {
  const ref = referenceDate ?? new Date();
  const bounds = getWeekBounds(ref);

  const weekSlug = `semaine-${bounds.week}-${bounds.year}`;
  const weekIso = `${bounds.year}-W${String(bounds.week).padStart(2, "0")}`;
  const weekStart = new Date(bounds.startIso);
  const weekEnd = new Date(bounds.endIso);
  const weekLabel = formatWeekLabel(weekStart, weekEnd);

  // Récupérer tous les picks résolus dans la semaine
  const { data: picks, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, slug, sport, league, event_name, event_date, selection, odds, status, profit, resolved_at, final_score, tier, drop_window, classic_number, odds_comparison"
    )
    .eq("generation_version", "v3")
    .in("status", ["won", "lost", "void"])
    .is("deleted_at", null)
    .gte("resolved_at", bounds.startIso)
    .lte("resolved_at", bounds.endIso)
    .order("resolved_at", { ascending: true });

  if (fetchError) {
    console.error(`[bilan-hebdo] fetch error: ${fetchError.message}`);
    return null;
  }

  // Si aucun pick : on retourne quand même un bilan vide (utile pour debug + permalink)
  const typedPicks = (picks ?? []) as ResolvedPickRow[];

  // Construction des entries détaillées
  const entries: BilanHebdoPickEntry[] = typedPicks.map((p) => {
    const oc = p.odds_comparison ?? {};
    const clvPct = typeof oc.clv_pct_final === "number" ? oc.clv_pct_final : null;
    return {
      pick_id: p.id,
      slug: p.slug,
      classic_number: p.classic_number,
      date: p.event_date.slice(0, 10), // YYYY-MM-DD
      sport: p.sport,
      league: p.league,
      event_name: p.event_name,
      selection: p.selection,
      odds: p.odds,
      tier: p.tier,
      drop_window: p.drop_window,
      status: p.status as "won" | "lost" | "void",
      profit: p.profit ?? 0,
      final_score: p.final_score,
      clv_pct_final: clvPct,
    };
  });

  // ─── Stats globales
  const won = entries.filter((e) => e.status === "won").length;
  const lost = entries.filter((e) => e.status === "lost").length;
  const voidCount = entries.filter((e) => e.status === "void").length;
  const stakedPicks = entries.filter((e) => e.status !== "void");
  const totalStake = stakedPicks.length;
  const totalProfit = entries.reduce((sum, e) => sum + e.profit, 0);
  const roiPct = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
  const winrate = totalStake > 0 ? (won / totalStake) * 100 : 0;

  // ─── Stats par tier
  const tiers = ["lock", "strong", "value", "coup_de_coeur"] as const;
  const picksByTier: Record<string, TierStats> = {};
  for (const t of tiers) {
    const tierEntries = entries.filter((e) => e.tier === t);
    const tierStaked = tierEntries.filter((e) => e.status !== "void");
    const tierWon = tierEntries.filter((e) => e.status === "won").length;
    const tierProfit = tierEntries.reduce((sum, e) => sum + e.profit, 0);
    picksByTier[t] = {
      count: tierEntries.length,
      won: tierWon,
      profit: parseFloat(tierProfit.toFixed(2)),
      roi_pct: tierStaked.length > 0
        ? parseFloat(((tierProfit / tierStaked.length) * 100).toFixed(2))
        : 0,
    };
  }

  // ─── Stats par sport (dynamique : tous sports rencontrés)
  const allSports = Array.from(new Set(entries.map((e) => e.sport)));
  const picksBySport: Record<string, SportStats> = {};
  for (const sport of allSports) {
    const sportEntries = entries.filter((e) => e.sport === sport);
    const sportStaked = sportEntries.filter((e) => e.status !== "void");
    const sportWon = sportEntries.filter((e) => e.status === "won").length;
    const sportProfit = sportEntries.reduce((sum, e) => sum + e.profit, 0);
    picksBySport[sport] = {
      count: sportEntries.length,
      won: sportWon,
      profit: parseFloat(sportProfit.toFixed(2)),
      roi_pct: sportStaked.length > 0
        ? parseFloat(((sportProfit / sportStaked.length) * 100).toFixed(2))
        : 0,
    };
  }

  // ─── Bankroll evolution jour par jour (pour line chart)
  // On itère lundi → dimanche, on cumule le profit
  const bankrollEvolution: BankrollEvolutionPoint[] = [];
  let cumulative = 0;
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayStr = day.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    const dayEntries = entries.filter((e) => {
      // event_date du pick au format YYYY-MM-DD pour comparaison directe
      return e.date === dayStr;
    });
    const dailyProfit = dayEntries.reduce((sum, e) => sum + e.profit, 0);
    cumulative += dailyProfit;
    bankrollEvolution.push({
      date: dayStr,
      picks_count: dayEntries.length,
      daily_profit: parseFloat(dailyProfit.toFixed(2)),
      cumulative_profit: parseFloat(cumulative.toFixed(2)),
    });
  }

  // ─── CLV
  const picksWithClv = entries.filter((e) => e.clv_pct_final !== null);
  const clvSum = picksWithClv.reduce((sum, e) => sum + (e.clv_pct_final ?? 0), 0);
  const clvAvgPct = picksWithClv.length > 0
    ? parseFloat(((clvSum / picksWithClv.length) * 100).toFixed(2))
    : null;

  return {
    week_slug: weekSlug,
    week_iso: weekIso,
    week_start: bounds.startIso,
    week_end: bounds.endIso,
    week_year: bounds.year,
    week_number: bounds.week,
    week_label: weekLabel,
    total_picks: entries.length,
    picks_won: won,
    picks_lost: lost,
    picks_void: voidCount,
    total_stake_units: totalStake,
    total_profit_units: parseFloat(totalProfit.toFixed(2)),
    roi_pct: parseFloat(roiPct.toFixed(2)),
    winrate_pct: parseFloat(winrate.toFixed(2)),
    clv_avg_pct: clvAvgPct,
    clv_picks_count: picksWithClv.length,
    picks_by_tier: picksByTier,
    picks_by_sport: picksBySport,
    bankroll_evolution: bankrollEvolution,
    picks: entries,
  };
};

// ============================================================================
// PERSIST WEEKLY BILAN
// ============================================================================

/**
 * UPSERT en BDD dans weekly_bilans pour permalink + cache.
 * Si un bilan existe déjà pour ce week_slug, on le met à jour.
 */
export const persistWeeklyBilan = async (
  bilan: BilanHebdo,
  publishMeta?: {
    telegram_message_id?: number;
    telegram_published_at?: string;
    x_root_tweet_id?: string;
    x_published_at?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  const payload = {
    week_slug: bilan.week_slug,
    week_iso: bilan.week_iso,
    week_start: bilan.week_start,
    week_end: bilan.week_end,
    week_year: bilan.week_year,
    week_number: bilan.week_number,
    total_picks: bilan.total_picks,
    picks_won: bilan.picks_won,
    picks_lost: bilan.picks_lost,
    picks_void: bilan.picks_void,
    total_stake_units: bilan.total_stake_units,
    total_profit_units: bilan.total_profit_units,
    roi_pct: bilan.roi_pct,
    winrate_pct: bilan.winrate_pct,
    clv_avg_pct: bilan.clv_avg_pct,
    clv_picks_count: bilan.clv_picks_count,
    picks_by_tier: bilan.picks_by_tier,
    picks_by_sport: bilan.picks_by_sport,
    bankroll_evolution: bilan.bankroll_evolution,
    picks_detail: bilan.picks,
    ...(publishMeta ?? {}),
  };

  const { error } = await supabaseAdmin
    .from("weekly_bilans")
    .upsert(payload, { onConflict: "week_slug" });

  if (error) {
    console.error(`[bilan-hebdo] persist failed: ${error.message}`);
    return { success: false, error: error.message };
  }

  console.log(`[bilan-hebdo] ✓ Bilan ${bilan.week_slug} persisté en BDD`);
  return { success: true };
};

/**
 * Récupère un bilan hebdo persisté par son slug.
 * Utilisé par la page /bilan-hebdo/[semaine] pour render.
 *
 * @returns BilanHebdo enrichi de publish meta, ou null si pas trouvé
 */
export const getWeeklyBilanBySlug = async (
  weekSlug: string
): Promise<BilanHebdo | null> => {
  const { data, error } = await supabaseAdmin
    .from("weekly_bilans")
    .select("*")
    .eq("week_slug", weekSlug)
    .maybeSingle();

  if (error || !data) return null;

  return {
    week_slug: data.week_slug,
    week_iso: data.week_iso,
    week_start: data.week_start,
    week_end: data.week_end,
    week_year: data.week_year,
    week_number: data.week_number,
    week_label: formatWeekLabel(new Date(data.week_start), new Date(data.week_end)),
    total_picks: data.total_picks,
    picks_won: data.picks_won,
    picks_lost: data.picks_lost,
    picks_void: data.picks_void,
    total_stake_units: parseFloat(data.total_stake_units),
    total_profit_units: parseFloat(data.total_profit_units),
    roi_pct: parseFloat(data.roi_pct),
    winrate_pct: parseFloat(data.winrate_pct),
    clv_avg_pct: data.clv_avg_pct !== null ? parseFloat(data.clv_avg_pct) : null,
    clv_picks_count: data.clv_picks_count,
    picks_by_tier: data.picks_by_tier ?? {},
    picks_by_sport: data.picks_by_sport ?? {},
    bankroll_evolution: data.bankroll_evolution ?? [],
    picks: data.picks_detail ?? [],
  };
};