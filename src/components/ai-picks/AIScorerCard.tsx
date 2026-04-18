/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIScorerCard (V2 DESIGN)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Card d'un pronostic buteur.
 * Style : card sombre, accent violet, pas de cote affichée.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import PronosIACard from "./ui/PronosIACard";
import PronosIAStatusBadge from "./ui/PronosIAStatusBadge";


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
  reasoning: string;
  ai_confidence: number;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
}


interface Props {
  pick: AIScorerRow;
  locale: string;
}


export default async function AIScorerCard({ pick, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const accent =
    pick.status === "won"
      ? "emerald"
      : pick.status === "lost"
        ? "red"
        : pick.status === "void"
          ? "neutral"
          : "violet";

  const eventTime = new Date(pick.event_date).toLocaleTimeString(
    { fr: "fr-FR", en: "en-US", es: "es-ES" }[locale] ?? "fr-FR",
    { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" },
  );

  const statusLabel = t(`status_${pick.status}`);

  return (
    <PronosIACard accent={accent} hoverable>
      {/* HEADER */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="text-base">⚽</span>
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

      {/* JOUEUR (buteur) */}
      <div className="mb-4 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4">
        <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
          <span>⚽</span>
          <span>{t("scorer_label")}</span>
        </div>
        <div className="text-xl font-extrabold text-white">{pick.selection}</div>
      </div>

      {/* REASONING */}
      <div className="flex items-start gap-2 text-xs italic text-white/60">
        <span className="mt-0.5 flex-shrink-0 text-violet-300">💬</span>
        <p className="leading-relaxed">{pick.reasoning}</p>
      </div>

      {/* FINAL SCORE */}
      {pick.status !== "pending" && pick.final_score && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 text-xs text-white/70">
          <span className="text-white/40">{t("final_score_label")}</span>
          <span className="font-mono font-bold text-white">{pick.final_score}</span>
        </div>
      )}
    </PronosIACard>
  );
}