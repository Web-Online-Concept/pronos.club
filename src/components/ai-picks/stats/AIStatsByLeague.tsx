/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIStatsByLeague
 * ═══════════════════════════════════════════════════════════════════
 *
 * Grille de mini-cards pour les buteurs par ligue.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import { CircleCheck, CircleX } from "lucide-react";
import type { ScorerStatsRow } from "@/lib/ai/ai-stats-types";
import PronosIACard from "../ui/PronosIACard";


interface Props {
  stats: ScorerStatsRow[];
  locale: string;
}


const LEAGUE_LABELS: Record<string, string> = {
  soccer_epl: "Premier League",
  soccer_france_ligue_one: "Ligue 1",
  soccer_germany_bundesliga: "Bundesliga",
  soccer_italy_serie_a: "Serie A",
  soccer_spain_la_liga: "La Liga",
  soccer_uefa_champs_league: "Champions League",
};


export default async function AIStatsByLeague({ stats, locale }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const visible = stats.filter((s) => s.total_resolved > 0);
  if (visible.length === 0) return null;

  return (
    <section>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚽</span>
          <h2 className="text-lg font-bold uppercase tracking-wider text-neutral-800">
            {t("stats_scorers_by_league_title")}
          </h2>
          <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-700">
            {visible.length}
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-fuchsia-500/40 to-transparent" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((row) => {
          if (!row.league) return null;
          const leagueLabel = LEAGUE_LABELS[row.league] ?? row.league;
          const winRate =
            row.win_rate_pct !== null ? row.win_rate_pct.toFixed(1) : "—";

          return (
            <PronosIACard key={row.league} accent="fuchsia">
              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl">⚽</span>
                <div>
                  <div className="text-base font-bold text-white">
                    {leagueLabel}
                  </div>
                  <div className="text-[11px] text-white/50">
                    {row.total_resolved} {t("stats_resolved_total")}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur">
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
                      "linear-gradient(135deg, #ffffff 0%, #f0abfc 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {winRate}%
                </div>
              </div>
            </PronosIACard>
          );
        })}
      </div>
    </section>
  );
}