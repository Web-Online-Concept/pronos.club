/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIStatsMiniBanner (V2 DESIGN)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bandeau stats rapide en haut de la page principale.
 * 3 états :
 *   - Aucun pick résolu    → message d'attente
 *   - < 10 picks résolus   → message "en construction"
 *   - ≥ 10 picks résolus   → stats réelles (wins / losses / %)
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import { Sparkles, CircleCheck, CircleX, TrendingUp } from "lucide-react";


const MIN_PICKS_FOR_STATS = 10;


interface Props {
  wins: number;
  losses: number;
  totalResolved: number;
  winRate: number | null;
  locale: string;
}


export default async function AIStatsMiniBanner({
  wins,
  losses,
  totalResolved,
  winRate,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  // CAS 1 : aucun pick résolu
  if (totalResolved === 0) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
        <div className="flex items-center justify-center gap-2.5 text-center text-xs text-neutral-500">
          <Sparkles size={14} strokeWidth={2.5} className="text-violet-500" />
          <span className="font-semibold text-neutral-700">
            {t("stats_banner_no_data_title")}
          </span>
          <span className="text-neutral-400">·</span>
          <span>{t("stats_banner_no_data_text")}</span>
        </div>
      </div>
    );
  }

  // CAS 2 : pas assez de picks résolus
  if (totalResolved < MIN_PICKS_FOR_STATS) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-4">
        <div className="flex flex-wrap items-center justify-center gap-2.5 text-center text-xs text-neutral-600">
          <Sparkles size={14} strokeWidth={2.5} className="text-violet-500" />
          <span className="font-semibold text-neutral-800">
            {t("stats_banner_building_title")}
          </span>
          <span className="text-neutral-400">·</span>
          <span>{t("stats_banner_building_text", { count: totalResolved })}</span>
        </div>
      </div>
    );
  }

  // CAS 3 : stats complètes
  const winRateDisplay = winRate !== null ? winRate.toFixed(1) : "—";

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-violet-200 bg-white px-5 py-4 shadow-sm"
    >
      {/* Barre gradient en haut (signature Pronos IA) */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #8b5cf6 50%, transparent 100%)",
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} strokeWidth={2.5} className="text-violet-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-violet-700">
            {t("stats_banner_label")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <StatItem
            Icon={CircleCheck}
            value={wins}
            label={t("stats_banner_wins")}
            color="text-emerald-600"
          />
          <StatItem
            Icon={CircleX}
            value={losses}
            label={t("stats_banner_losses")}
            color="text-red-600"
          />
          <StatItem
            Icon={TrendingUp}
            value={`${winRateDisplay}%`}
            label={t("stats_banner_win_rate")}
            color="text-violet-600"
          />
        </div>
      </div>

      <p className="mt-2 text-[11px] text-neutral-400">
        {t("stats_banner_footnote", { total: totalResolved })}
      </p>
    </div>
  );
}


function StatItem({
  Icon,
  value,
  label,
  color,
}: {
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={16} strokeWidth={2.5} className={color} />
      <div className="flex items-baseline gap-1.5">
        <span className={`font-mono text-lg font-extrabold ${color}`}>{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          {label}
        </span>
      </div>
    </div>
  );
}