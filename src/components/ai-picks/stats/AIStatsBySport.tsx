/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIStatsBySport
 * ═══════════════════════════════════════════════════════════════════
 *
 * Grille de mini-cards pour les classiques par sport.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import { CircleCheck, CircleX } from "lucide-react";
import type { ClassicStatsRow } from "@/lib/ai/ai-stats-types";
import PronosIACard from "../ui/PronosIACard";


interface Props {
  stats: ClassicStatsRow[];
  locale: string;
}


const SPORT_CONFIG: Record<string, { emoji: string; key: string }> = {
  soccer: { emoji: "⚽", key: "sport_soccer" },
  tennis: { emoji: "🎾", key: "sport_tennis" },
  basketball: { emoji: "🏀", key: "sport_basketball" },
};


export default async function AIStatsBySport({ stats, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const visible = stats.filter((s) => s.total_resolved > 0);
  if (visible.length === 0) return null;

  return (
    <section>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg font-bold uppercase tracking-wider text-neutral-800">
            {t("stats_by_sport_title")}
          </h2>
          <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
            {visible.length}
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-violet-500/40 to-transparent" />
      </div>

      {/* Grille */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((row) => {
          if (!row.sport) return null;
          const config = SPORT_CONFIG[row.sport] ?? {
            emoji: "🏅",
            key: row.sport,
          };
          const sportName = t(config.key);
          const winRate =
            row.win_rate_pct !== null ? row.win_rate_pct.toFixed(1) : "—";
          const avgOdds = row.avg_odds !== null ? row.avg_odds.toFixed(2) : "—";
          const roi =
            row.simulation_roi_pct !== null
              ? `${row.simulation_roi_pct >= 0 ? "+" : ""}${row.simulation_roi_pct.toFixed(2)}%`
              : null;
          const isRoiProfit = (row.simulation_roi_pct ?? 0) >= 0;

          return (
            <PronosIACard key={row.sport} accent="violet">
              {/* Header du sport */}
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl">{config.emoji}</span>
                <div>
                  <div className="text-base font-bold text-white">
                    {sportName}
                  </div>
                  <div className="text-[11px] text-white/50">
                    {row.total_resolved} {t("stats_resolved_total")}
                  </div>
                </div>
              </div>

              {/* Stats clés */}
              <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur">
                <div className="flex items-center gap-1.5">
                  <CircleCheck
                    size={14}
                    strokeWidth={2.5}
                    className="text-emerald-300"
                  />
                  <span className="font-mono text-sm font-bold text-emerald-300">
                    {row.wins}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CircleX
                    size={14}
                    strokeWidth={2.5}
                    className="text-red-300"
                  />
                  <span className="font-mono text-sm font-bold text-red-300">
                    {row.losses}
                  </span>
                </div>
                <div
                  className="font-mono text-base font-black tabular-nums"
                  style={{
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {winRate}%
                </div>
              </div>

              {/* Cote moy + ROI */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-center backdrop-blur">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                    {t("stats_avg_odds_short")}
                  </div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-white">
                    {avgOdds}
                  </div>
                </div>
                <div
                  className={`rounded-lg border p-2.5 text-center backdrop-blur ${
                    roi !== null
                      ? isRoiProfit
                        ? "border-emerald-400/30 bg-emerald-500/10"
                        : "border-red-400/30 bg-red-500/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/50">
                    {t("stats_roi_short")}
                  </div>
                  <div
                    className={`mt-0.5 font-mono text-sm font-bold ${
                      roi !== null
                        ? isRoiProfit
                          ? "text-emerald-200"
                          : "text-red-200"
                        : "text-white/40"
                    }`}
                  >
                    {roi ?? "—"}
                  </div>
                </div>
              </div>
            </PronosIACard>
          );
        })}
      </div>
    </section>
  );
}