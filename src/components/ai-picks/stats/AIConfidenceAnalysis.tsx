/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIConfidenceAnalysis
 * ═══════════════════════════════════════════════════════════════════
 *
 * Analyse de la confiance IA : compare la confidence moyenne
 * des picks gagnés vs perdus.
 *
 * Permet de voir si la confidence IA est un bon prédicteur.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import { Brain, TrendingUp, TrendingDown } from "lucide-react";
import type {
  ClassicStatsRow,
} from "@/lib/ai/ai-stats-types";
import PronosIACard from "../ui/PronosIACard";


interface Props {
  classicsTotal: ClassicStatsRow | null;
  scorersTotal: null;
  locale: string;
}


export default async function AIConfidenceAnalysis({
  classicsTotal,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <section>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Brain size={24} strokeWidth={2.5} className="text-violet-600" />
          <h2 className="text-lg font-bold uppercase tracking-wider text-neutral-800">
            {t("stats_confidence_title")}
          </h2>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-violet-500/40 to-transparent" />
      </div>

      {/* Description */}
      <p className="mb-6 text-sm text-neutral-600">
        {t("stats_confidence_description")}
      </p>

      {/* 1 card : classiques uniquement (module Buteurs supprime) */}
      <div className="grid grid-cols-1 gap-4">
        {/* Classiques */}
        {classicsTotal &&
          classicsTotal.total_resolved > 0 &&
          (classicsTotal.avg_confidence_won !== null ||
            classicsTotal.avg_confidence_lost !== null) && (
            <PronosIACard accent="violet">
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <h3 className="text-base font-bold text-white">
                  {t("type_classic_label")}
                </h3>
              </div>

              <div className="space-y-3">
                <ConfidenceRow
                  Icon={TrendingUp}
                  label={t("stats_confidence_won")}
                  value={classicsTotal.avg_confidence_won}
                  color="emerald"
                />
                <ConfidenceRow
                  Icon={TrendingDown}
                  label={t("stats_confidence_lost")}
                  value={classicsTotal.avg_confidence_lost}
                  color="red"
                />
              </div>

              {/* Écart */}
              {classicsTotal.avg_confidence_won !== null &&
                classicsTotal.avg_confidence_lost !== null && (
                  <ConfidenceGapInsight
                    won={classicsTotal.avg_confidence_won}
                    lost={classicsTotal.avg_confidence_lost}
                    locale={locale}
                  />
                )}
            </PronosIACard>
          )}
      </div>
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════

function ConfidenceRow({
  Icon,
  label,
  value,
  color,
}: {
  Icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  label: string;
  value: number | null;
  color: "emerald" | "red";
}) {
  const displayValue = value !== null ? value.toFixed(2) : "—";
  const fillPct = value !== null ? (value / 10) * 100 : 0;

  const colorStyles = {
    emerald: {
      icon: "text-emerald-300",
      bar: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
      text: "text-emerald-200",
    },
    red: {
      icon: "text-red-300",
      bar: "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
      text: "text-red-200",
    },
  }[color];

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <Icon size={14} strokeWidth={2.5} className={colorStyles.icon} />
          <span className="font-semibold text-white/70">{label}</span>
        </div>
        <span className={`font-mono text-sm font-bold ${colorStyles.text}`}>
          {displayValue}/10
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${fillPct}%`,
            background: colorStyles.bar,
          }}
        />
      </div>
    </div>
  );
}


async function ConfidenceGapInsight({
  won,
  lost,
  locale,
}: {
  won: number;
  lost: number;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });
  const gap = won - lost;

  if (Math.abs(gap) < 0.3) {
    return (
      <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
        {t("stats_confidence_gap_neutral")}
      </div>
    );
  }

  const isPositive = gap > 0;
  return (
    <div
      className={`mt-4 rounded-lg border p-3 text-xs ${
        isPositive
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/30 bg-red-500/10 text-red-100"
      }`}
    >
      {isPositive
        ? t("stats_confidence_gap_positive", { gap: gap.toFixed(2) })
        : t("stats_confidence_gap_negative", { gap: Math.abs(gap).toFixed(2) })}
    </div>
  );
}