/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIPickCard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Card d'un pronostic classique (1N2, Over/Under, BTTS).
 * Contenu optimisé pour le fond violet-bleu profond.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import PronosIACard from "./ui/PronosIACard";
import PronosIAStatusBadge from "./ui/PronosIAStatusBadge";


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
  reasoning: string;
  ai_confidence: number;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
}


const SPORT_EMOJI: Record<string, string> = {
  soccer: "⚽",
  tennis: "🎾",
  basketball: "🏀",
};


const BOOKMAKER_LABELS: Record<string, string> = {
  pinnacle: "Pinnacle",
  onexbet: "1xBet",
  winamax_fr: "Winamax",
  betclic_fr: "Betclic",
  unibet_fr: "Unibet",
};


const LEAGUE_LABELS: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_france_ligue_one: "Ligue 1",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_italy_serie_a: "Serie A",
  soccer_spain_la_liga: "La Liga",
  soccer_uefa_champs_league: "Champions League",
  tennis_atp: "ATP",
  tennis_wta: "WTA",
  basketball_nba: "NBA",
};


interface Props {
  pick: AIPickRow;
  locale: string;
}


export default async function AIPickCard({ pick, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const accent =
    pick.status === "won"
      ? "emerald"
      : pick.status === "lost"
        ? "red"
        : pick.status === "void"
          ? "neutral"
          : "violet";

  const sportEmoji = SPORT_EMOJI[pick.sport] ?? "🏅";
  const leagueLabel = LEAGUE_LABELS[pick.league] ?? pick.league;
  const bookmakerLabel = pick.odds_bookmaker
    ? (BOOKMAKER_LABELS[pick.odds_bookmaker] ?? pick.odds_bookmaker)
    : null;

  const eventTime = new Date(pick.event_date).toLocaleTimeString(
    { fr: "fr-FR", en: "en-US", es: "es-ES" }[locale] ?? "fr-FR",
    { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" },
  );

  const statusLabel = t(`status_${pick.status}`);

  return (
    <PronosIACard accent={accent} hoverable>
      {/* HEADER — Sport, ligue, heure, statut */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            <span className="text-sm">{sportEmoji}</span>
            <span>{leagueLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 font-mono text-xs font-semibold text-white/80">
            {eventTime}
          </span>
        </div>
        <PronosIAStatusBadge status={pick.status} label={statusLabel} size="sm" />
      </div>

      {/* MATCH */}
      <h3 className="mb-5 text-lg font-bold leading-tight text-white sm:text-xl">
        {pick.event_name}
      </h3>

      {/* PICK + COTE — zone mise en valeur avec backdrop */}
      <div className="mb-5 grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        {/* Pick */}
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300">
            {t("pick_label")}
          </div>
          <div className="truncate text-xl font-extrabold text-white">
            {pick.selection}
          </div>
        </div>

        {/* Cote */}
        {pick.odds !== null && (
          <div className="flex-shrink-0 text-right">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              {t("odds_label")}
            </div>
            <div
              className="font-mono text-3xl font-black tabular-nums"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {pick.odds.toFixed(2)}
            </div>
            {bookmakerLabel && (
              <div className="mt-0.5 text-[10px] font-medium text-white/50">
                {bookmakerLabel}
              </div>
            )}
          </div>
        )}
      </div>

      {/* REASONING */}
      <div className="flex items-start gap-2.5 text-sm italic text-white/70">
        <span className="mt-0.5 flex-shrink-0 text-violet-300">💬</span>
        <p className="leading-relaxed">{pick.reasoning}</p>
      </div>

      {/* FINAL SCORE (si résolu) */}
      {pick.status !== "pending" && pick.final_score && (
        <div className="mt-5 flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/20 py-2.5 backdrop-blur">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
            {t("final_score_label")}
          </span>
          <span className="font-mono text-lg font-bold text-white">{pick.final_score}</span>
        </div>
      )}
    </PronosIACard>
  );
}