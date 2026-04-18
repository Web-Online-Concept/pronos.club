/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIStatsMiniBanner
 * ═══════════════════════════════════════════════════════════════════
 *
 * Mini-résumé des stats cumulées des Pronos IA.
 *
 * 3 états possibles :
 *  1. Aucune donnée (0 picks résolus)
 *     → "Première génération en cours"
 *  2. Pas assez de données (< 10 picks résolus)
 *     → "Les stats apparaîtront dans quelques jours"
 *  3. Stats normales (≥ 10 picks résolus)
 *     → "✅ X · ❌ Y · 📊 Z%"
 *
 * Seuil de 10 évite d'afficher un taux peu significatif
 * (ex: 25% sur 4 picks = pas représentatif).
 *
 * Server component.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";


interface Props {
  wins: number;
  losses: number;
  totalResolved: number;
  winRate: number | null;
  locale: string;
}

/** Seuil en-dessous duquel on ne montre pas de % (pas assez significatif) */
const MIN_PICKS_FOR_STATS = 10;


export default async function AIStatsMiniBanner({
  wins,
  losses,
  totalResolved,
  winRate,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  // ═══ ÉTAT 1 : Aucune résolution encore ═══
  if (totalResolved === 0) {
    return (
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-5 text-center">
        <div className="mb-2 text-3xl">🤖</div>
        <div className="text-sm font-semibold text-cyan-200">
          {t("stats_banner_no_data_title")}
        </div>
        <p className="mt-1 text-xs text-cyan-200/60">
          {t("stats_banner_no_data_text")}
        </p>
      </div>
    );
  }

  // ═══ ÉTAT 2 : Pas assez de données ═══
  if (totalResolved < MIN_PICKS_FOR_STATS) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 text-center">
        <div className="mb-2 text-3xl">📊</div>
        <div className="text-sm font-semibold text-neutral-200">
          {t("stats_banner_building_title")}
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          {t("stats_banner_building_text", { count: totalResolved })}
        </p>
      </div>
    );
  }

  // ═══ ÉTAT 3 : Stats significatives ═══
  const displayRate = winRate !== null ? winRate.toFixed(1) : "—";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
      <div className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-neutral-500">
        {t("stats_banner_label")}
      </div>

      <div className="grid grid-cols-3 gap-4 divide-x divide-neutral-800">
        {/* Gagnés */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xl font-bold text-emerald-400">
            <span>✅</span>
            <span>{wins}</span>
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {t("stats_banner_wins")}
          </div>
        </div>

        {/* Perdus */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xl font-bold text-red-400">
            <span>❌</span>
            <span>{losses}</span>
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {t("stats_banner_losses")}
          </div>
        </div>

        {/* Taux de réussite */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xl font-bold text-cyan-400">
            <span>📊</span>
            <span>{displayRate}%</span>
          </div>
          <div className="mt-1 text-xs text-neutral-500">
            {t("stats_banner_win_rate")}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-neutral-500">
        {t("stats_banner_footnote", { total: totalResolved })}
      </p>
    </div>
  );
}