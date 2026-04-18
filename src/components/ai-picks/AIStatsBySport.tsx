/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIStatsBySport
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tableau des stats par sport (classiques uniquement).
 * Pour chaque sport : wins, losses, %, cote moyenne, ROI de la simulation.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import type { ClassicStatsRow } from "@/lib/ai/ai-stats-types";


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

  // Ne garder que les lignes avec total_resolved > 0
  const visible = stats.filter((s) => s.total_resolved > 0);

  if (visible.length === 0) return null;

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 sm:p-8">
      <h2 className="mb-6 text-xl font-bold text-neutral-100">
        {t("stats_by_sport_title")}
      </h2>

      <div className="space-y-3">
        {visible.map((row) => {
          if (!row.sport) return null;
          const config = SPORT_CONFIG[row.sport] ?? { emoji: "🏅", key: row.sport };
          const sportName = t(config.key);

          return (
            <div
              key={row.sport}
              className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4"
            >
              {/* Entête sport */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl">{config.emoji}</span>
                <span className="text-base font-semibold text-neutral-100">
                  {sportName}
                </span>
              </div>

              {/* Grille de stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat
                  label={t("stats_banner_wins")}
                  value={`${row.wins}`}
                  color="text-emerald-400"
                />
                <MiniStat
                  label={t("stats_banner_losses")}
                  value={`${row.losses}`}
                  color="text-red-400"
                />
                <MiniStat
                  label={t("stats_banner_win_rate")}
                  value={row.win_rate_pct !== null ? `${row.win_rate_pct.toFixed(1)}%` : "—"}
                  color="text-cyan-400"
                />
                <MiniStat
                  label={t("stats_avg_odds_short")}
                  value={row.avg_odds !== null ? row.avg_odds.toFixed(2) : "—"}
                  color="text-neutral-200"
                />
              </div>

              {/* Simulation ROI si dispo */}
              {row.simulation_roi_pct !== null && row.simulation_stake > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-lg bg-neutral-900/60 px-3 py-2 text-xs">
                  <span className="text-neutral-500">
                    {t("stats_simulation_inline_label")}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      row.simulation_roi_pct >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {row.simulation_roi_pct >= 0 ? "+" : ""}
                    {row.simulation_roi_pct.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPOSANT : mini stat
// ═══════════════════════════════════════════════════════════════════

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-0.5 font-mono text-base font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}