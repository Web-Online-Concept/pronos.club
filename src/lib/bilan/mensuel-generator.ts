/**
 * PRONOS.CLUB — Bilan Mensuel Generator (V3.5 - Lot 11)
 *
 * Réplique du pattern hebdo-generator.ts pour granularité mensuelle.
 *
 * 2 fonctions principales :
 *
 *   1. **aggregateBilanMensuel(referenceDate?)** : agrège les picks résolus
 *      d'un mois calendaire complet et retourne un BilanMensuel structuré
 *      (stats globales + par tier + par sport + évolution bankroll + liste picks).
 *
 *   2. **persistMonthlyBilan(bilan)** : UPSERT en BDD dans monthly_bilans
 *      pour permalink + cache de la page web.
 *
 * Convention mois : calendaire (1er → dernier jour du mois).
 * Slug humanisé : "mois-mai-2026" (cohérent avec "semaine-19-2026").
 *
 * Le cron tourne le 1er du mois 22h Paris → on agrège le mois précédent
 * (= mois qui vient de se terminer, tous matchs résolus).
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

export type BilanMensuelPickEntry = {
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

export type BilanMensuel = {
  // Identifiants mois
  month_slug: string;     // "mois-mai-2026"
  month_iso: string;      // "2026-05"
  month_start: string;    // ISO timestamp 1er du mois 00:00 Paris
  month_end: string;      // ISO timestamp dernier jour 23:59:59 Paris
  month_year: number;     // 2026
  month_number: number;   // 5
  month_label: string;    // "Mai 2026" (humain, FR)

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
  bankroll_evolution: BankrollEvolutionPoint[]; // 1 point par jour du mois
  picks: BilanMensuelPickEntry[];
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
// HELPERS - DATES & MOIS CALENDAIRE
// ============================================================================

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/**
 * Calcule les bornes du mois calendaire contenant `date`.
 * Bornes en heure Paris.
 */
const getMonthBounds = (date: Date): {
  year: number;
  month: number;       // 1-12
  startIso: string;
  endIso: string;
  startDate: Date;
  endDate: Date;
} => {
  // On utilise toLocaleDateString pour récupérer le mois Paris (cas changement
  // de mois en heure UTC vs Paris)
  const parisStr = date.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }); // YYYY-MM-DD
  const [yearStr, monthStr] = parisStr.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr); // 1-12

  // 1er du mois 00:00 Paris → ISO
  // Paris été = UTC+2, hiver = UTC+1. On évite les calculs manuels en utilisant
  // une approche directe : créer la date au format ISO local Paris puis convertir.
  // Méthode robuste : Date.UTC + offset Paris.
  const startDate = parseParisDate(`${year}-${String(month).padStart(2, "0")}-01T00:00:00`);

  // Dernier jour du mois 23:59:59 Paris
  // = 1er du mois suivant 00:00 Paris - 1 ms
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthStart = parseParisDate(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`);
  const endDate = new Date(nextMonthStart.getTime() - 1);

  return {
    year,
    month,
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
    startDate,
    endDate,
  };
};

/**
 * Parse une date locale Paris (sans offset) en Date UTC.
 * Gère automatiquement été/hiver.
 */
const parseParisDate = (parisStr: string): Date => {
  // parisStr format : "YYYY-MM-DDTHH:mm:ss"
  // On crée un objet Date en supposant UTC, puis on ajuste l'offset Paris
  const [datePart, timePart] = parisStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min, s] = timePart.split(":").map(Number);

  // Date UTC initiale
  const utcDate = new Date(Date.UTC(y, m - 1, d, h, min, s));

  // Calculer l'offset Paris pour cette date (été = +2h, hiver = +1h)
  const parisFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  });
  const parts = parisFormatter.formatToParts(utcDate);
  const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+2";
  const offsetMatch = offsetStr.match(/GMT([+-])(\d+)/);
  const offsetHours = offsetMatch
    ? parseInt(offsetMatch[2]) * (offsetMatch[1] === "-" ? -1 : 1)
    : 2;

  // Le timestamp doit être tel que quand on le lit en Paris, on retrouve parisStr.
  // Donc on soustrait l'offset Paris (la date Paris = date UTC + offset).
  return new Date(utcDate.getTime() - offsetHours * 60 * 60 * 1000);
};

/**
 * Format humain lisible : "Mai 2026"
 */
const formatMonthLabel = (year: number, month: number): string => {
  return `${MONTH_NAMES_FR[month - 1]} ${year}`;
};

/**
 * Référence pour le cron : si on est le 1er du mois à 22h Paris, on veut
 * agréger le MOIS PRÉCÉDENT (= mois qui vient de se terminer).
 *
 * Cette fonction prend une date et retourne une date "shiftée" dans le mois
 * précédent pour qu'on agrège bien le bon mois.
 */
export const getPreviousMonthReferenceDate = (referenceDate?: Date): Date => {
  const ref = referenceDate ?? new Date();
  // On retourne une date du milieu du mois précédent
  const parisStr = ref.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const [yearStr, monthStr] = parisStr.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr); // 1-12

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  // Milieu du mois précédent = 15 du mois
  return parseParisDate(`${prevYear}-${String(prevMonth).padStart(2, "0")}-15T12:00:00`);
};

// ============================================================================
// AGGREGATE BILAN MENSUEL
// ============================================================================

/**
 * Agrège tous les picks résolus dans un mois calendaire et retourne un BilanMensuel.
 *
 * @param referenceDate Date de référence (par défaut maintenant). On prend le
 *                      mois calendaire contenant cette date.
 *                      Pour le cron du 1er à 22h : on doit passer une date du
 *                      mois précédent (cf getPreviousMonthReferenceDate()).
 */
export const aggregateBilanMensuel = async (
  referenceDate?: Date
): Promise<BilanMensuel | null> => {
  const ref = referenceDate ?? new Date();
  const bounds = getMonthBounds(ref);

  const monthSlug = `mois-${MONTH_NAMES_FR[bounds.month - 1].toLowerCase()}-${bounds.year}`;
  const monthIso = `${bounds.year}-${String(bounds.month).padStart(2, "0")}`;
  const monthLabel = formatMonthLabel(bounds.year, bounds.month);

  // Récupérer tous les picks résolus dans le mois
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
    console.error(`[bilan-mensuel] fetch error: ${fetchError.message}`);
    return null;
  }

  const typedPicks = (picks ?? []) as ResolvedPickRow[];

  // Construction des entries détaillées
  const entries: BilanMensuelPickEntry[] = typedPicks.map((p) => {
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

  // ─── Stats par sport (dynamique)
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

  // ─── Bankroll evolution jour par jour (1 point par jour du mois)
  const bankrollEvolution: BankrollEvolutionPoint[] = [];
  let cumulative = 0;
  const daysInMonth = Math.round(
    (bounds.endDate.getTime() - bounds.startDate.getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;

  for (let dayOffset = 0; dayOffset < daysInMonth; dayOffset++) {
    const day = new Date(bounds.startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayStr = day.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
    // Filtrer les entries de ce jour (event_date au format YYYY-MM-DD)
    const dayEntries = entries.filter((e) => e.date === dayStr);
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
    month_slug: monthSlug,
    month_iso: monthIso,
    month_start: bounds.startIso,
    month_end: bounds.endIso,
    month_year: bounds.year,
    month_number: bounds.month,
    month_label: monthLabel,
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
// PERSIST MONTHLY BILAN
// ============================================================================

/**
 * UPSERT en BDD dans monthly_bilans pour permalink + cache.
 * Si un bilan existe déjà pour ce month_slug, on le met à jour.
 */
export const persistMonthlyBilan = async (
  bilan: BilanMensuel,
  publishMeta?: {
    telegram_message_id?: number;
    telegram_published_at?: string;
    x_root_tweet_id?: string;
    x_published_at?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  const payload = {
    month_slug: bilan.month_slug,
    month_iso: bilan.month_iso,
    month_start: bilan.month_start,
    month_end: bilan.month_end,
    month_year: bilan.month_year,
    month_number: bilan.month_number,
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
    .from("monthly_bilans")
    .upsert(payload, { onConflict: "month_slug" });

  if (error) {
    console.error(`[bilan-mensuel] persist failed: ${error.message}`);
    return { success: false, error: error.message };
  }

  console.log(`[bilan-mensuel] ✓ Bilan ${bilan.month_slug} persisté en BDD`);
  return { success: true };
};

/**
 * Récupère un bilan mensuel persisté par son slug.
 * Utilisé par la page /bilan-mensuel/[mois] pour render.
 *
 * @returns BilanMensuel enrichi de publish meta, ou null si pas trouvé
 */
export const getMonthlyBilanBySlug = async (
  monthSlug: string
): Promise<BilanMensuel | null> => {
  const { data, error } = await supabaseAdmin
    .from("monthly_bilans")
    .select("*")
    .eq("month_slug", monthSlug)
    .maybeSingle();

  if (error) {
    console.error(`[bilan-mensuel] getBySlug error: ${error.message}`);
    return null;
  }

  if (!data) return null;

  return {
    month_slug: data.month_slug,
    month_iso: data.month_iso,
    month_start: data.month_start,
    month_end: data.month_end,
    month_year: data.month_year,
    month_number: data.month_number,
    month_label: formatMonthLabel(data.month_year, data.month_number),
    total_picks: data.total_picks,
    picks_won: data.picks_won,
    picks_lost: data.picks_lost,
    picks_void: data.picks_void,
    total_stake_units: Number(data.total_stake_units),
    total_profit_units: Number(data.total_profit_units),
    roi_pct: Number(data.roi_pct),
    winrate_pct: Number(data.winrate_pct),
    clv_avg_pct: data.clv_avg_pct !== null ? Number(data.clv_avg_pct) : null,
    clv_picks_count: data.clv_picks_count,
    picks_by_tier: data.picks_by_tier ?? {},
    picks_by_sport: data.picks_by_sport ?? {},
    bankroll_evolution: data.bankroll_evolution ?? [],
    picks: data.picks_detail ?? [],
  };
};