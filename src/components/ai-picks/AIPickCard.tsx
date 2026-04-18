/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIPickCard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Card compacte pour un pronostic classique IA (1N2, Over/Under, BTTS).
 *
 * États :
 *  - pending : bordure neutre, badge "À venir" jaune
 *  - won     : bordure emerald, badge "Gagné" vert + score final
 *  - lost    : bordure rouge, badge "Perdu" rouge + score final
 *  - void    : bordure grise, badge "Annulé"
 *
 * Server component (pas de state).
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";


// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface AIPickRow {
  id: string;
  pick_type: "classic";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number | null;
  odds_bookmaker: string | null;
  odds_comparison: Array<{ book: string; odds: number }> | null;
  reasoning: string;
  ai_confidence: number;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
}

interface Props {
  pick: AIPickRow;
  locale: string;
}


// ═══════════════════════════════════════════════════════════════════
// MAPPINGS VISUELS
// ═══════════════════════════════════════════════════════════════════

const LEAGUE_CONFIG: Record<string, { name: string; emoji: string }> = {
  soccer_epl: { name: "Premier League", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  soccer_france_ligue_one: { name: "Ligue 1", emoji: "🇫🇷" },
  soccer_spain_la_liga: { name: "La Liga", emoji: "🇪🇸" },
  soccer_germany_bundesliga: { name: "Bundesliga", emoji: "🇩🇪" },
  soccer_italy_serie_a: { name: "Serie A", emoji: "🇮🇹" },
  soccer_uefa_champs_league: { name: "Champions League", emoji: "🏆" },
  tennis_atp: { name: "ATP", emoji: "🎾" },
  tennis_wta: { name: "WTA", emoji: "🎾" },
  basketball_nba: { name: "NBA", emoji: "🏀" },
};

const BOOKMAKER_LABELS: Record<string, string> = {
  pinnacle: "Pinnacle",
  winamax_fr: "Winamax",
  betclic_fr: "Betclic",
  unibet_fr: "Unibet",
  onexbet: "1xBet",
};


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function getLeagueInfo(league: string): { name: string; emoji: string } {
  return LEAGUE_CONFIG[league] ?? { name: league, emoji: "⚽" };
}

function formatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  const map: Record<string, string> = { fr: "fr-FR", en: "en-US", es: "es-ES" };
  return date.toLocaleTimeString(map[locale] ?? "fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMarketLabel(market: string, selection: string, t: (k: string) => string): string {
  switch (market) {
    case "h2h":
      return selection;
    case "ou25":
      return selection; // "Over 2.5" ou "Under 2.5"
    case "btts":
      return selection.toLowerCase() === "yes"
        ? t("market_btts_yes")
        : t("market_btts_no");
    case "totals":
      return selection; // "Over 225.5" etc.
    default:
      return selection;
  }
}

function getStatusStyles(status: AIPickRow["status"]): {
  cardBorder: string;
  badgeBg: string;
  badgeText: string;
} {
  switch (status) {
    case "won":
      return {
        cardBorder: "border-emerald-500/40 bg-emerald-950/20",
        badgeBg: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
        badgeText: "",
      };
    case "lost":
      return {
        cardBorder: "border-red-500/40 bg-red-950/20",
        badgeBg: "bg-red-500/20 text-red-300 border border-red-500/40",
        badgeText: "",
      };
    case "void":
      return {
        cardBorder: "border-neutral-700 bg-neutral-900/40",
        badgeBg: "bg-neutral-700/40 text-neutral-400 border border-neutral-600",
        badgeText: "",
      };
    case "pending":
    default:
      return {
        cardBorder: "border-neutral-800 bg-neutral-900/40",
        badgeBg: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
        badgeText: "",
      };
  }
}


// ═══════════════════════════════════════════════════════════════════
// COMPOSANT
// ═══════════════════════════════════════════════════════════════════

export default async function AIPickCard({ pick, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });
  const league = getLeagueInfo(pick.league);
  const time = formatTime(pick.event_date, locale);
  const styles = getStatusStyles(pick.status);

  const statusLabel = {
    pending: t("status_pending"),
    won: t("status_won"),
    lost: t("status_lost"),
    void: t("status_void"),
  }[pick.status];

  const statusIcon = { pending: "⏳", won: "✅", lost: "❌", void: "⊘" }[pick.status];

  const selectionLabel = formatMarketLabel(pick.market, pick.selection, t);
  const bookmakerLabel = pick.odds_bookmaker
    ? BOOKMAKER_LABELS[pick.odds_bookmaker] ?? pick.odds_bookmaker
    : null;

  return (
    <article
      className={`rounded-xl border p-5 transition-colors ${styles.cardBorder}`}
    >
      {/* ═══ Ligne du haut : ligue + heure + statut ═══ */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
          <span>{league.emoji}</span>
          <span className="truncate">{league.name}</span>
          <span className="text-neutral-600">·</span>
          <span>{time}</span>
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badgeBg}`}
        >
          <span>{statusIcon}</span>
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* ═══ Titre match ═══ */}
      <h3 className="mb-3 text-lg font-bold text-neutral-100">
        {pick.event_name}
        {pick.final_score && (
          <span className="ml-2 text-sm font-normal text-neutral-400">
            ({pick.final_score})
          </span>
        )}
      </h3>

      {/* ═══ Séparateur ═══ */}
      <div className="mb-3 border-t border-neutral-800" />

      {/* ═══ Pick + cote ═══ */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">🎯</span>
          <span className="font-semibold text-neutral-100">{selectionLabel}</span>
        </div>
        {pick.odds !== null && (
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <span className="text-cyan-400">💰</span>
            <span className="font-mono font-semibold">
              {pick.odds.toFixed(2)}
            </span>
            {bookmakerLabel && (
              <span className="text-xs text-neutral-500">
                · {bookmakerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ═══ Justification IA ═══ */}
      <div className="flex items-start gap-2 text-sm text-neutral-400">
        <span className="mt-0.5 flex-shrink-0">💬</span>
        <p className="italic">{pick.reasoning}</p>
      </div>
    </article>
  );
}