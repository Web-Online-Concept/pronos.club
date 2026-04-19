/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIScorerCard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Card d'un pronostic buteur.
 * Contenu optimisé pour le fond violet-bleu profond.
 * Pas de cote affichée (contrainte du projet).
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import PronosIACard from "./ui/PronosIACard";
import PronosIAStatusBadge from "./ui/PronosIAStatusBadge";
import AIPickDetailsTrigger from "./AIPickDetailsTrigger";


export interface AIScorerRow {
  id: string;
  pick_type: "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number | null;
  odds_bookmaker?: string | null;
  odds_comparison: Array<{ book: string; odds: number }> | null;
  reasoning: string;
  ai_confidence: number;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
}


const LEAGUE_LABELS: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_france_ligue_one: "Ligue 1",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_italy_serie_a: "Serie A",
  soccer_spain_la_liga: "La Liga",
  soccer_uefa_champs_league: "Champions League",
};


interface Props {
  pick: AIScorerRow;
  locale: string;
}


export default async function AIScorerCard({ pick, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  // Détection du statut affiché : si pending mais match passé → "awaiting"
  const eventTimestamp = new Date(pick.event_date).getTime();
  const isAwaiting = pick.status === "pending" && eventTimestamp <= Date.now();
  const displayStatus = isAwaiting ? "awaiting" : pick.status;

  const accent =
    displayStatus === "won"
      ? "emerald"
      : displayStatus === "lost"
        ? "red"
        : displayStatus === "void"
          ? "neutral"
          : "violet";

  const leagueLabel = LEAGUE_LABELS[pick.league] ?? pick.league;

  const localeMap: Record<string, string> = {
    fr: "fr-FR",
    en: "en-US",
    es: "es-ES",
  };
  const dateLocale = localeMap[locale] ?? "fr-FR";

  const eventDate = new Date(pick.event_date);
  const formattedDate = eventDate.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Paris",
  });
  const formattedTime = eventDate.toLocaleTimeString(dateLocale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  const statusLabel = t(`status_${displayStatus}`);

  return (
    <PronosIACard accent={accent} hoverable>
      {/* HEADER */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            <span className="text-sm">⚽</span>
            <span>{leagueLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
            <span>{formattedDate}</span>
            <span className="text-white/30">·</span>
            <span className="font-mono">{formattedTime}</span>
          </span>
        </div>
        <PronosIAStatusBadge
          status={displayStatus}
          label={statusLabel}
          size="sm"
        />
      </div>

      {/* MATCH */}
      <h3 className="mb-5 text-lg font-bold leading-tight text-white sm:text-xl">
        {pick.event_name}
      </h3>

      {/* JOUEUR BUTEUR — zone mise en valeur */}
      <div className="mb-5 rounded-xl border border-violet-400/30 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 p-4 backdrop-blur">
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
          <span>⚽</span>
          <span>{t("scorer_label")}</span>
        </div>
        <div
          className="text-2xl font-black leading-tight tracking-tight"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #c4b5fd 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {pick.selection}
        </div>
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

      {/* BOUTON VOIR DÉTAILS */}
      <AIPickDetailsTrigger
        pick={{ ...pick, odds_bookmaker: pick.odds_bookmaker ?? null }}
        locale={locale}
      />
    </PronosIACard>
  );
}