/**
 * PRONOS.CLUB — CLV Resolve & Bilan Jour (V3.5)
 *
 * Ce module gère 2 responsabilités au moment du publish-results J+1 :
 *
 *   1. **finalizeCLVForResolvedPicks()** : pour chaque pick résolu hier qui a
 *      un closing capturé, calcule clv_pct = (1/opening_no_vig) - (1/closing_no_vig)
 *      et le persiste dans odds_comparison.clv_pct_final.
 *
 *   2. **aggregateBilanJour(targetDate)** : agrège tous les picks résolus le
 *      jour cible (en heure Paris) et retourne un BilanJour structuré utilisable
 *      pour formater le message Telegram + thread X.
 *
 * Définition formelle du CLV (Closing Line Value) :
 *   - opening_no_vig_proba = 1 / opening_no_vig_odds
 *   - closing_no_vig_proba = 1 / closing_no_vig_odds
 *   - clv_pct = (closing_no_vig_proba / opening_no_vig_proba) - 1  (équivalent)
 *   - Positif = l'IA a battu le marché : la cote prise était plus haute que la cote
 *     "efficiente" finale du marché (Pinnacle se rapprochant de la vérité avec le temps)
 *   - Négatif = l'IA a sous-performé
 *
 * Note : on calcule clv_pct uniquement quand on a opening_no_vig ET closing_no_vig.
 * Si pas de closing capturé (ex: BTTS non couvert par Pinnacle, ou pick rapide
 * où le cron CLV n'a pas eu le temps de tourner avant kickoff) → clv_pct = null.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

// ============================================================================
// TYPES
// ============================================================================

type CLVHistoryEntry = {
  timestamp: string;
  pinnacle_odds: number;
  pinnacle_no_vig_odds: number | null;
  is_final_closing: boolean;
};

type ResolvedPick = {
  id: string;
  slug: string | null;
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number;
  status: string; // "won" | "lost" | "void"
  profit: number | null;
  resolved_at: string | null;
  final_score: string | null;
  tier: string | null;
  drop_window: string | null;
  classic_number: number | null;
  odds_comparison: Record<string, unknown> | null;
};

export type BilanPickEntry = {
  pickId: string;
  slug: string | null;
  classic_number: number | null;
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

export type BilanJour = {
  date: string; // YYYY-MM-DD (Paris)
  total_picks: number;
  picks_won: number;
  picks_lost: number;
  picks_void: number;
  total_stake_units: number; // somme des mises (1u par pick)
  total_profit_units: number; // somme des profits (positif/négatif)
  roi_pct: number; // (profit / stake) * 100
  picks_by_tier: {
    lock: { count: number; won: number; profit: number };
    strong: { count: number; won: number; profit: number };
    value: { count: number; won: number; profit: number };
    coup_de_coeur: { count: number; won: number; profit: number };
  };
  clv_avg_pct: number | null; // moyenne CLV des picks ayant un CLV
  clv_picks_count: number; // nb de picks avec CLV calculé
  picks: BilanPickEntry[];
};

export type ResolveCLVResult = {
  picks_processed: number;
  picks_with_clv_computed: number;
  picks_skipped_no_closing: number;
  errors: string[];
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Retourne la date d'hier au format YYYY-MM-DD en heure Paris.
 * Utilisé pour le filtre "picks résolus hier".
 */
const getYesterdayParisDate = (): string => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return yesterday.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
};

// ============================================================================
// HELPERS TIMEZONE PARIS (robuste été/hiver)
// ============================================================================

/**
 * Calcule l'offset Paris/UTC en millisecondes pour une date donnée.
 * Été : +2h, Hiver : +1h.
 */
const getParisOffsetMs = (utcDate: Date): number => {
  const parisTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utcTime = new Date(utcDate.toLocaleString("en-US", { timeZone: "UTC" }));
  return parisTime.getTime() - utcTime.getTime();
};

/**
 * Retourne le timestamp UTC correspondant à minuit (00:00:00) heure Paris
 * pour une date calendaire donnée (YYYY-MM-DD).
 *
 * Exemples :
 *   - "2026-05-10" été UTC+2 → "2026-05-09T22:00:00.000Z"
 *   - "2026-01-15" hiver UTC+1 → "2026-01-14T23:00:00.000Z"
 */
const parisDateToUTCMidnight = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Référence à 12h UTC pour être sûr d'être dans le bon jour Paris
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12));
  const parisOffsetMs = getParisOffsetMs(noonUTC);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return new Date(utcMidnight.getTime() - parisOffsetMs);
};

/**
 * Retourne les bornes UTC pour une journée Paris donnée.
 * - dayStart = minuit Paris du jour cible (UTC)
 * - dayEnd = minuit Paris du jour SUIVANT (UTC), exclusif (utiliser .lt())
 *
 * Exemple ("2026-05-10" été) :
 *   dayStart = 2026-05-09T22:00:00Z
 *   dayEnd   = 2026-05-10T22:00:00Z
 */
const getParisDayBoundsUTC = (dateStr: string): { dayStart: Date; dayEnd: Date } => {
  const dayStart = parisDateToUTCMidnight(dateStr);

  // Calcul du jour suivant en Paris
  const [year, month, day] = dateStr.split("-").map(Number);
  const nextDay = new Date(year, month - 1, day + 1);
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, "0")}-${String(nextDay.getDate()).padStart(2, "0")}`;
  const dayEnd = parisDateToUTCMidnight(nextDayStr);

  return { dayStart, dayEnd };
};

/**
 * Calcule le clv_pct à partir des cotes opening et closing no-vig.
 *
 * Formule : clv_pct = (closing_no_vig_proba / opening_no_vig_proba) - 1
 *         = (opening_no_vig / closing_no_vig) - 1
 *
 * Exemple :
 *   - opening_no_vig = 2.10 (cote prise au moment de la génération)
 *   - closing_no_vig = 2.00 (cote efficient finale du marché)
 *   - opening_no_vig_proba = 0.476, closing_no_vig_proba = 0.500
 *   - clv_pct = (0.500 / 0.476) - 1 = +0.050 = +5.0%
 *   - L'IA a pris la cote 2.10 alors que le marché a fini à 2.00 = +5% d'edge
 */
const computeCLVPct = (
  openingNoVig: number,
  closingNoVig: number
): number => {
  if (openingNoVig <= 0 || closingNoVig <= 0) return 0;
  return openingNoVig / closingNoVig - 1;
};

/**
 * Extrait le closing no-vig depuis l'history capturée.
 * Stratégie :
 *   - Préférer une entrée avec is_final_closing=true (capturée dans les 30 min avant kickoff)
 *   - Sinon prendre la dernière entrée chronologique
 *   - Sinon retourner null
 */
const extractClosingNoVigOdds = (
  oddsComparison: Record<string, unknown> | null
): number | null => {
  if (!oddsComparison) return null;

  // Cas 1 : closing déjà calculé et stocké lors de la capture finale
  const finalClosing = oddsComparison.closing_pinnacle_no_vig_odds;
  if (typeof finalClosing === "number" && finalClosing > 0) {
    return finalClosing;
  }

  // Cas 2 : on parcourt l'history et on prend la dernière entrée valide
  const history = oddsComparison.closing_pinnacle_odds_history as
    | CLVHistoryEntry[]
    | undefined;
  if (!Array.isArray(history) || history.length === 0) return null;

  // Préférer is_final_closing
  const finalEntry = history.find((e) => e.is_final_closing);
  if (finalEntry?.pinnacle_no_vig_odds && finalEntry.pinnacle_no_vig_odds > 0) {
    return finalEntry.pinnacle_no_vig_odds;
  }

  // Sinon dernière entrée chronologique avec no_vig dispo
  const sorted = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  for (const entry of sorted) {
    if (
      typeof entry.pinnacle_no_vig_odds === "number" &&
      entry.pinnacle_no_vig_odds > 0
    ) {
      return entry.pinnacle_no_vig_odds;
    }
  }

  return null;
};

/**
 * Extrait l'opening no-vig depuis odds_comparison.
 * Si pas de no-vig stocké explicitement (capture initiale n'a pas calculé le no-vig),
 * on utilise la cote brute Pinnacle d'opening comme fallback (moins précis mais utile).
 */
const extractOpeningNoVigOdds = (
  oddsComparison: Record<string, unknown> | null
): number | null => {
  if (!oddsComparison) return null;

  // Pour l'instant, on stocke directement opening_pinnacle_odds (cote brute)
  // dans persist-tipster-pick.ts. Si on a un no-vig opening explicite plus tard,
  // on l'utilisera ici en priorité.
  const openingNoVig = oddsComparison.opening_pinnacle_no_vig_odds;
  if (typeof openingNoVig === "number" && openingNoVig > 0) {
    return openingNoVig;
  }

  // Fallback : cote brute Pinnacle d'opening
  const openingRaw = oddsComparison.opening_pinnacle_odds;
  if (typeof openingRaw === "number" && openingRaw > 0) {
    return openingRaw;
  }

  return null;
};

// ============================================================================
// FINALIZE CLV (calcul + persist clv_pct_final)
// ============================================================================

/**
 * Pour tous les picks résolus le jour cible, calcule le clv_pct final si
 * on a opening_no_vig et closing_no_vig dispo, et le persiste dans
 * odds_comparison.clv_pct_final.
 *
 * @param targetDate Date au format YYYY-MM-DD (Paris). Par défaut : hier.
 */
export const finalizeCLVForResolvedPicks = async (
  targetDate?: string
): Promise<ResolveCLVResult> => {
  const date = targetDate ?? getYesterdayParisDate();
  const result: ResolveCLVResult = {
    picks_processed: 0,
    picks_with_clv_computed: 0,
    picks_skipped_no_closing: 0,
    errors: [],
  };

  // Bornes Paris robustes (été/hiver)
  // On filtre sur event_date pour rester cohérent avec aggregateBilanJour :
  // un pick est "du 10 mai" si son match était le 10 mai (peu importe quand résolu).
  const { dayStart, dayEnd } = getParisDayBoundsUTC(date);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();

  const { data: picks, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select("id, odds_comparison, status")
    .eq("generation_version", "v3")
    .in("status", ["won", "lost", "void"])
    .is("deleted_at", null)
    .gte("event_date", dayStartIso)
    .lt("event_date", dayEndIso);

  if (fetchError) {
    result.errors.push(`Supabase fetch failed: ${fetchError.message}`);
    return result;
  }

  if (!picks || picks.length === 0) {
    console.log(`[clv-resolve] Aucun pick résolu le ${date}, rien à faire.`);
    return result;
  }

  result.picks_processed = picks.length;
  console.log(`[clv-resolve] ${picks.length} pick(s) résolu(s) le ${date} à finaliser`);

  for (const pick of picks as Array<{
    id: string;
    odds_comparison: Record<string, unknown> | null;
    status: string;
  }>) {
    const openingNoVig = extractOpeningNoVigOdds(pick.odds_comparison);
    const closingNoVig = extractClosingNoVigOdds(pick.odds_comparison);

    if (openingNoVig === null || closingNoVig === null) {
      result.picks_skipped_no_closing++;
      continue;
    }

    const clvPct = computeCLVPct(openingNoVig, closingNoVig);

    const updatedOC: Record<string, unknown> = {
      ...(pick.odds_comparison ?? {}),
      clv_pct_final: clvPct,
      clv_finalized_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from("ai_picks")
      .update({ odds_comparison: updatedOC })
      .eq("id", pick.id);

    if (updateError) {
      result.errors.push(`Update ${pick.id}: ${updateError.message}`);
      continue;
    }

    result.picks_with_clv_computed++;
  }

  console.log(
    `[clv-resolve] Terminé : ${result.picks_with_clv_computed} CLV calculés, ${result.picks_skipped_no_closing} skip sans closing, ${result.errors.length} erreurs`
  );

  return result;
};

// ============================================================================
// AGGREGATE BILAN JOUR
// ============================================================================

/**
 * Agrège tous les picks résolus le jour cible et retourne un BilanJour
 * structuré pour formater les messages Telegram / X.
 *
 * @param targetDate Date au format YYYY-MM-DD (Paris). Par défaut : hier.
 */
export const aggregateBilanJour = async (
  targetDate?: string
): Promise<BilanJour | null> => {
  const date = targetDate ?? getYesterdayParisDate();

  // Bornes Paris robustes (été/hiver)
  // On filtre sur event_date (date du match) — un pick appartient au bilan
  // du jour où il a été disputé, peu importe quand il a été résolu.
  const { dayStart, dayEnd } = getParisDayBoundsUTC(date);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();

  const { data: picks, error: fetchError } = await supabaseAdmin
    .from("ai_picks")
    .select(
      "id, slug, sport, league, event_name, event_date, selection, market, odds, status, profit, resolved_at, final_score, tier, drop_window, classic_number, odds_comparison"
    )
    .eq("generation_version", "v3")
    .in("status", ["won", "lost", "void"])
    .is("deleted_at", null)
    .gte("event_date", dayStartIso)
    .lt("event_date", dayEndIso)
    .order("event_date", { ascending: true });

  if (fetchError) {
    console.error(`[bilan-jour] fetch error: ${fetchError.message}`);
    return null;
  }

  if (!picks || picks.length === 0) {
    return null;
  }

  const typedPicks = picks as ResolvedPick[];

  // Construction des entries détaillées
  const bilanEntries: BilanPickEntry[] = typedPicks.map((p) => {
    const oc = p.odds_comparison ?? {};
    const clvPct = typeof oc.clv_pct_final === "number" ? oc.clv_pct_final : null;

    return {
      pickId: p.id,
      slug: p.slug,
      classic_number: p.classic_number,
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

  // Stats globales (on exclut les void du calcul ROI)
  const won = bilanEntries.filter((e) => e.status === "won").length;
  const lost = bilanEntries.filter((e) => e.status === "lost").length;
  const voidCount = bilanEntries.filter((e) => e.status === "void").length;
  const stakedPicks = bilanEntries.filter((e) => e.status !== "void");
  const totalStakeUnits = stakedPicks.length; // 1u par pick
  const totalProfit = bilanEntries.reduce((sum, e) => sum + e.profit, 0);
  const roiPct =
    totalStakeUnits > 0 ? (totalProfit / totalStakeUnits) * 100 : 0;

  // Stats par tier
  const tiers: Array<"lock" | "strong" | "value" | "coup_de_coeur"> = [
    "lock", "strong", "value", "coup_de_coeur",
  ];
  const picksByTier: BilanJour["picks_by_tier"] = {
    lock: { count: 0, won: 0, profit: 0 },
    strong: { count: 0, won: 0, profit: 0 },
    value: { count: 0, won: 0, profit: 0 },
    coup_de_coeur: { count: 0, won: 0, profit: 0 },
  };
  for (const entry of bilanEntries) {
    if (entry.tier && tiers.includes(entry.tier as typeof tiers[number])) {
      const t = entry.tier as keyof BilanJour["picks_by_tier"];
      picksByTier[t].count++;
      if (entry.status === "won") picksByTier[t].won++;
      picksByTier[t].profit += entry.profit;
    }
  }

  // Stats CLV (moyenne sur les picks avec CLV calculé)
  const picksWithClv = bilanEntries.filter((e) => e.clv_pct_final !== null);
  const clvSum = picksWithClv.reduce(
    (sum, e) => sum + (e.clv_pct_final ?? 0),
    0
  );
  const clvAvgPct =
    picksWithClv.length > 0 ? (clvSum / picksWithClv.length) * 100 : null;

  return {
    date,
    total_picks: bilanEntries.length,
    picks_won: won,
    picks_lost: lost,
    picks_void: voidCount,
    total_stake_units: totalStakeUnits,
    total_profit_units: parseFloat(totalProfit.toFixed(2)),
    roi_pct: parseFloat(roiPct.toFixed(2)),
    picks_by_tier: picksByTier,
    clv_avg_pct: clvAvgPct !== null ? parseFloat(clvAvgPct.toFixed(2)) : null,
    clv_picks_count: picksWithClv.length,
    picks: bilanEntries,
  };
};