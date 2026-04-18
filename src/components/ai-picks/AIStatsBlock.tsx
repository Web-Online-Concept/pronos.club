/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIStatsBlock
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bloc générique d'affichage des stats d'un groupe de picks.
 * Utilisé pour "Classiques" et "Buteurs".
 *
 * Mode compact : masque les cotes moyennes (pour les buteurs qui n'en ont pas).
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";


interface Props {
  title: string;
  subtitle: string;
  wins: number;
  losses: number;
  winRate: number | null;
  avgOdds: number | null;
  avgOddsWon: number | null;
  avgOddsLost: number | null;
  locale: string;
  /** Compact = masque les cotes moyennes (pour les buteurs) */
  compact?: boolean;
}


export default async function AIStatsBlock({
  title,
  subtitle,
  wins,
  losses,
  winRate,
  avgOdds,
  avgOddsWon,
  avgOddsLost,
  locale,
  compact = false,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const displayWinRate = winRate !== null ? winRate.toFixed(1) : "—";

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 sm:p-8">
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-neutral-100">{title}</h2>
        <p className="mt-1 text-sm text-neutral-400">{subtitle}</p>
      </div>

      {/* TRIPLE INDICATEUR : GAGNÉS / PERDUS / % */}
      <div className="grid grid-cols-3 divide-x divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-950/40 py-5">
        <StatPill
          icon="✅"
          value={wins.toString()}
          label={t("stats_banner_wins")}
          color="text-emerald-400"
        />
        <StatPill
          icon="❌"
          value={losses.toString()}
          label={t("stats_banner_losses")}
          color="text-red-400"
        />
        <StatPill
          icon="📊"
          value={`${displayWinRate}%`}
          label={t("stats_banner_win_rate")}
          color="text-cyan-400"
        />
      </div>

      {/* COTES MOYENNES — uniquement si pas compact */}
      {!compact && avgOdds !== null && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <OddsBox
            label={t("stats_avg_odds")}
            value={avgOdds}
            color="neutral"
          />
          <OddsBox
            label={t("stats_avg_odds_won")}
            value={avgOddsWon}
            color="emerald"
          />
          <OddsBox
            label={t("stats_avg_odds_lost")}
            value={avgOddsLost}
            color="red"
          />
        </div>
      )}
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPOSANT : Un pill de stat
// ═══════════════════════════════════════════════════════════════════

function StatPill({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className={`flex items-center justify-center gap-1.5 text-2xl font-bold ${color}`}>
        <span>{icon}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPOSANT : Case cote moyenne
// ═══════════════════════════════════════════════════════════════════

function OddsBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: "neutral" | "emerald" | "red";
}) {
  const colorMap = {
    neutral: "border-neutral-800 bg-neutral-900/60 text-neutral-200",
    emerald: "border-emerald-500/20 bg-emerald-950/20 text-emerald-200",
    red: "border-red-500/20 bg-red-950/20 text-red-200",
  };

  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color]}`}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">
        {value !== null ? value.toFixed(2) : "—"}
      </div>
    </div>
  );
}