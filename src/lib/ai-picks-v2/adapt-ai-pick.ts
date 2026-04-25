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
 * ═══════════════════════════════════════════════════════════════════
 */

import type { Pick, Sport, Bookmaker } from "@/lib/supabase/types";


// ── Types côté IA ──────────────────────────────────────────────────

export interface AIPickRow {
  id: string;
  ai_pick_number?: number | null;
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
  slug?: string | null;
  consensus_tier?:
    | "total_agreement"
    | "partial"
    | "isolated_high"
    | "isolated_low"
    | null;
  consensus_score?: number | null;
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


// ── Fonction principale ────────────────────────────────────────────

export const adaptAiPickToPickFormat = (
  aiPick: AIPickRow & { live_score_data?: unknown }
): Pick & { live_score_data?: unknown } => {
  const sport = buildSportObject(aiPick.sport);
  const bookmaker = buildBookmakerObject(aiPick.odds_bookmaker);

  return {
    id: aiPick.id,
    pick_type: "simple", // L'IA fait des picks simples actuellement
    sport_id: sport.id,
    competition: aiPick.league,
    bookmaker_id: bookmaker?.id ?? "",
    event_name: aiPick.event_name,
    event_date: aiPick.event_date,
    selection: aiPick.selection,
    odds: aiPick.odds ?? 1,
    min_odds: null,
    stake: 1, // 1U fixe pour tous les picks IA
    is_premium: false, // L'IA n'a pas de notion premium (le ribbon est gere par aiMode)
    analysis_fr: aiPick.reasoning,
    analysis_en: null,
    analysis_es: null,
    screenshot_url: null, // Pas de ticket photo cote IA
    status: aiPick.status,
    profit: null, // Calcule cote serveur si besoin
    result_entered_at: null,
    published_at: aiPick.event_date,
    notify_sent: true,
    pick_number: aiPick.ai_pick_number ?? undefined,
    sport,
    bookmaker,
    legs: [], // Pas de combines IA actuellement
    // live_score_data passe through (lu par le composant LiveScore via savedScore)
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