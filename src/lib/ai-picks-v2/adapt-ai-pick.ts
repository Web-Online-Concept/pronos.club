/**
 * ═══════════════════════════════════════════════════════════════════
 * adaptAiPickToPickFormat
 * ═══════════════════════════════════════════════════════════════════
 *
 * Transforme un `ai_picks` row (table IA) en objet de forme `Pick`
 * (table Tipster) pour pouvoir être passé au composant <PickCard />.
 *
 * Le composant PickCard est strictement le même que pour Tipster.
 * Il est juste rendu avec la prop aiMode={true} pour adapter le
 * ribbon (🤖 IA) et le footer (Intelligence Artificielle).
 *
 * Numérotation séparée :
 * - pick_type "classic" -> classic_number -> "IA-0014"
 * - pick_type "scorer"  -> scorer_number  -> "BUT-0001"
 * ═══════════════════════════════════════════════════════════════════
 */

import type { Pick, Sport, Bookmaker } from "@/lib/supabase/types";


// ── Types côté IA ──────────────────────────────────────────────────

export interface AIPickRow {
  id: string;
  ai_pick_number?: number | null;
  classic_number?: number | null;
  scorer_number?: number | null;
  pick_type: "classic" | "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number | null;
  odds_bookmaker: string | null;
  reasoning: string | null;
  ai_confidence: number | null;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
  profit?: number | null;
  slug?: string | null;
  consensus_tier?:
    | "total_agreement"
    | "partial"
    | "isolated_high"
    | "isolated_low"
    | null;
  consensus_score?: number | null;
  /**
   * Snapshot complet du moteur value-bet (v3) : edge_pct, fair_odds, books, etc.
   * null pour les anciens picks v1/v2.
   */
  odds_comparison?: Record<string, unknown> | null;
  live_score_data?: unknown;
}


// ── Mapping sport slug → infos visuelles ───────────────────────────

const SPORT_DEFAULTS: Record<
  string,
  { name_fr: string; name_en: string; name_es: string; icon: string }
> = {
  football: { name_fr: "Football", name_en: "Football", name_es: "Fútbol", icon: "⚽" },
  tennis: { name_fr: "Tennis", name_en: "Tennis", name_es: "Tenis", icon: "🎾" },
  basketball: { name_fr: "Basketball", name_en: "Basketball", name_es: "Baloncesto", icon: "🏀" },
  hockey: { name_fr: "Hockey", name_en: "Hockey", name_es: "Hockey", icon: "🏒" },
  baseball: { name_fr: "Baseball", name_en: "Baseball", name_es: "Béisbol", icon: "⚾" },
  "football-americain": { name_fr: "Football US", name_en: "American Football", name_es: "Fútbol Americano", icon: "🏈" },
  rugby: { name_fr: "Rugby", name_en: "Rugby", name_es: "Rugby", icon: "🏉" },
  mma: { name_fr: "MMA", name_en: "MMA", name_es: "MMA", icon: "🥊" },
  // Compatibilite anciens picks v1 stockes avec les slugs OddsAPI
  soccer: { name_fr: "Football", name_en: "Football", name_es: "Fútbol", icon: "⚽" },
  americanfootball: { name_fr: "Football US", name_en: "American Football", name_es: "Fútbol Americano", icon: "🏈" },
};


// ── Mapping ligue (slug stocke en DB) → nom lisible ────────────────

const LEAGUE_DISPLAY_NAMES: Record<string, string> = {
  // Football majeurs (slugs OddsAPI / API-Football)
  soccer_epl: "Premier League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_france_ligue_one: "Ligue 1",
  soccer_france_ligue_two: "Ligue 2",
  soccer_uefa_champs_league: "Champions League",
  soccer_uefa_europa_league: "Europa League",
  soccer_uefa_europa_conference_league: "Conference League",
  soccer_belgium_first_div: "Belgique D1",
  soccer_netherlands_eredivisie: "Eredivisie",
  soccer_portugal_primeira_liga: "Primeira Liga",
  soccer_turkey_super_league: "Super Lig",
  soccer_usa_mls: "MLS",
  soccer_brazil_campeonato: "Brasileirão",
  soccer_argentina_primera_division: "Primera División",
  soccer_japan_j_league: "J League",
  soccer_korea_kleague1: "K League",
  // Tennis
  tennis_atp: "ATP",
  tennis_wta: "WTA",
  // US sports
  basketball_nba: "NBA",
  hockey_nhl: "NHL",
  baseball_mlb: "MLB",
  americanfootball_nfl: "NFL",
  // MMA
  mma_mixed_martial_arts: "MMA",
};


// ── Mapping bookmaker title API → display name côté Tipster ────────

const BOOKMAKER_DISPLAY_NAMES: Record<string, string> = {
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


// ── Helpers ────────────────────────────────────────────────────────

const buildSportObject = (sportSlug: string): Sport => {
  const defaults = SPORT_DEFAULTS[sportSlug] ?? {
    name_fr: sportSlug,
    name_en: sportSlug,
    name_es: sportSlug,
    icon: "🏅",
  };
  return {
    id: `ai-sport-${sportSlug}`,
    slug: sportSlug,
    name_fr: defaults.name_fr,
    name_en: defaults.name_en,
    name_es: defaults.name_es,
    icon: defaults.icon,
  } as Sport;
};

const buildBookmakerObject = (bookmakerName: string | null): Bookmaker | undefined => {
  if (!bookmakerName) return undefined;
  const displayName = BOOKMAKER_DISPLAY_NAMES[bookmakerName] ?? bookmakerName;
  return {
    id: `ai-bk-${displayName.toLowerCase()}`,
    name: displayName,
    slug: displayName.toLowerCase().replace(/\s+/g, "-"),
    logo_url: null,
    affiliate_url: null,
  } as Bookmaker;
};

const formatLeagueName = (leagueSlug: string): string => {
  if (LEAGUE_DISPLAY_NAMES[leagueSlug]) return LEAGUE_DISPLAY_NAMES[leagueSlug];
  return leagueSlug
    .replace(/^soccer_/, "")
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};


/**
 * Génère le label complet du pick : "IA-0014" ou "BUT-0001"
 * - classic -> "IA-XXXX" (basé sur classic_number)
 * - scorer  -> "BUT-XXXX" (basé sur scorer_number)
 *
 * Fallback sur ai_pick_number (ancien champ) si les nouveaux sont null
 * pour compat avec les picks v1.
 */
export const buildAiPickLabel = (aiPick: AIPickRow): string | null => {
  if (aiPick.pick_type === "scorer") {
    const num = aiPick.scorer_number ?? null;
    if (num == null) return null;
    return `BUT-${String(num).padStart(4, "0")}`;
  }
  // pick_type === "classic"
  const num = aiPick.classic_number ?? aiPick.ai_pick_number ?? null;
  if (num == null) return null;
  return `IA-${String(num).padStart(4, "0")}`;
};


// ── Fonction principale ────────────────────────────────────────────

export const adaptAiPickToPickFormat = (
  aiPick: AIPickRow & { live_score_data?: unknown }
): Pick & { live_score_data?: unknown } => {
  const sport = buildSportObject(aiPick.sport);
  const bookmaker = buildBookmakerObject(aiPick.odds_bookmaker);
  const competitionLabel = formatLeagueName(aiPick.league);

  // Fournir le numéro brut (utilisé en fallback si aiPickLabel pas géré)
  // Pour les classiques, utiliser classic_number, pour les scorers utiliser scorer_number
  const rawNumber =
    aiPick.pick_type === "scorer"
      ? aiPick.scorer_number
      : aiPick.classic_number ?? aiPick.ai_pick_number;

  return {
    id: aiPick.id,
    pick_type: "simple",
    sport_id: sport.id,
    competition: competitionLabel,
    bookmaker_id: bookmaker?.id ?? "",
    event_name: aiPick.event_name,
    event_date: aiPick.event_date,
    selection: aiPick.selection,
    odds: aiPick.odds ?? 1,
    min_odds: null,
    stake: 1,
    is_premium: false,
    analysis_fr: aiPick.reasoning,
    analysis_en: null,
    analysis_es: null,
    screenshot_url: null,
    status: aiPick.status,
    profit: null,
    result_entered_at: null,
    published_at: aiPick.event_date,
    notify_sent: true,
    pick_number: rawNumber ?? undefined,
    sport,
    bookmaker,
    legs: [],
    live_score_data: aiPick.live_score_data,
  } as Pick & { live_score_data?: unknown };
};


/**
 * Construit le href de la page détail dossier pour un pick IA.
 * Retourne null si pas de slug (pick v1 ancien).
 */
export const buildAiPickDetailHref = (
  aiPick: AIPickRow,
  locale: string
): string | null => {
  if (!aiPick.slug) return null;
  return `/${locale}/pronos-ia/match/${aiPick.slug}`;
};


// ═══════════════════════════════════════════════════════════════════
// Adapter pour <AiPickCard /> (composant autonome)
// ═══════════════════════════════════════════════════════════════════
//
// Contrairement à adaptAiPickToPickFormat() qui transforme un ai_pick
// en format Tipster (Pick), celle-ci construit directement le format
// minimal attendu par AiPickCard (composant 100% séparé de Tipster).
//
// Utilisée par les pages /pronos-ia, /pronos-ia/historique, etc.

export interface AiPickCardData {
  id: string;
  pick_label: string | null;
  sport_slug: string;
  sport_name: string;
  sport_icon: string;
  competition: string;
  event_name: string;
  event_date: string;
  selection: string;
  odds: number | null;
  bookmaker_name: string | null;
  reasoning: string | null;
  status: "pending" | "won" | "lost" | "void";
  profit: number | null;
  detail_href: string | null;
  /**
   * Edge mathematique +EV en % (pour les picks v3 value-bet).
   * null pour les anciens picks (LLM v1/v2).
   */
  edge_pct: number | null;
  live_score_data?: unknown;
}


/**
 * Transforme un row `ai_picks` en données pour <AiPickCard />.
 * Format simplifié, pas de mapping vers la table picks Tipster.
 */
export const adaptAiPickToCardData = (
  aiPick: AIPickRow & { live_score_data?: unknown },
  locale: string
): AiPickCardData => {
  const sportSlug =
    aiPick.sport === "soccer"
      ? "football"
      : aiPick.sport === "americanfootball"
        ? "football-americain"
        : aiPick.sport;

  const sportInfo = SPORT_DEFAULTS[sportSlug] ?? {
    name_fr: sportSlug,
    name_en: sportSlug,
    name_es: sportSlug,
    icon: "🏅",
  };

  const sportName =
    locale === "en"
      ? sportInfo.name_en
      : locale === "es"
        ? sportInfo.name_es
        : sportInfo.name_fr;

  const competition = formatLeagueName(aiPick.league);

  const bookmakerName = aiPick.odds_bookmaker
    ? BOOKMAKER_DISPLAY_NAMES[aiPick.odds_bookmaker] ?? aiPick.odds_bookmaker
    : null;

  // Extraire l'edge depuis odds_comparison (picks v3 value-bet uniquement)
  const oc = aiPick.odds_comparison ?? {};
  const edgePct =
    typeof oc.edge_pct === "number" && Number.isFinite(oc.edge_pct)
      ? oc.edge_pct
      : null;

  return {
    id: aiPick.id,
    pick_label: buildAiPickLabel(aiPick),
    sport_slug: sportSlug,
    sport_name: sportName,
    sport_icon: sportInfo.icon,
    competition,
    event_name: aiPick.event_name,
    event_date: aiPick.event_date,
    selection: aiPick.selection,
    odds: aiPick.odds,
    bookmaker_name: bookmakerName,
    reasoning: aiPick.reasoning,
    status: aiPick.status,
    profit: aiPick.profit ?? null,
    detail_href: buildAiPickDetailHref(aiPick, locale),
    edge_pct: edgePct,
    live_score_data: aiPick.live_score_data,
  };
};