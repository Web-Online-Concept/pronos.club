/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIPickCard (V2 DESIGN)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Card d'un pronostic classique.
 * Style : card sombre sur fond blanc, accent violet, boutons gradient.
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


interface Props {
  pick: AIPickRow;
  locale: string;
}


export default async function AIPickCard({ pick, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const isResolved = pick.status !== "pending";
  const accent =
    pick.status === "won"
      ? "emerald"
      : pick.status === "lost"
        ? "red"
        : pick.status === "void"
          ? "neutral"
          : "violet";

  const sportEmoji = SPORT_EMOJI[pick.sport] ?? "🏅";
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
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="text-base">{sportEmoji}</span>
            <span className="font-medium text-white/70">{pick.league}</span>
          </span>
          <span className="text-white/30">·</span>
          <span className="font-mono">{eventTime}</span>
        </div>
        <PronosIAStatusBadge status={pick.status} label={statusLabel} size="sm" />
      </div>

      {/* MATCH */}
      <h3 className="mb-4 text-base font-bold text-white sm:text-lg">
        {pick.event_name}
      </h3>

      {/* PICK + COTE */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div>
          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
            {t("pick_label")}
          </div>
          <div className="text-lg font-bold text-white">{pick.selection}</div>
        </div>
        {pick.odds !== null && (
          <div className="text-right">
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
              {t("odds_label")}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-white">
                {pick.odds.toFixed(2)}
              </span>
              {bookmakerLabel && (
                <span className="text-[10px] text-white/40">
                  {bookmakerLabel}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* REASONING */}
      <div className="flex items-start gap-2 text-xs italic text-white/60">
        <span className="mt-0.5 flex-shrink-0 text-violet-300">💬</span>
        <p className="leading-relaxed">{pick.reasoning}</p>
      </div>

      {/* FINAL SCORE (si résolu) */}
      {isResolved && pick.final_score && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-xs text-white/70">
          <span className="text-white/40">{t("final_score_label")}</span>
          <span className="font-mono font-bold text-white">{pick.final_score}</span>
        </div>
      )}
    </PronosIACard>
  );
}