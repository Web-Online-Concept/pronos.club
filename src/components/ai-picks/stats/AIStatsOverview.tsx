/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIStatsOverview
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bloc vue d'ensemble stats (classiques ou buteurs).
 * Card sombre avec wins/losses/%/cotes.
 *
 * Mode compact : sans les cotes moyennes (pour les buteurs).
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import { CircleCheck, CircleX, TrendingUp } from "lucide-react";
import PronosIACard, {
  type PronosIAAccent,
} from "../ui/PronosIACard";


interface Props {
  title: string;
  subtitle: string;
  accent: PronosIAAccent;
  wins: number;
  losses: number;
  winRate: number | null;
  avgOdds: number | null;
  avgOddsWon: number | null;
  avgOddsLost: number | null;
  locale: string;
  compact?: boolean;
}


export default async function AIStatsOverview({
  title,
  subtitle,
  accent,
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
    <PronosIACard accent={accent}>
      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-extrabold text-white sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>

      {/* TRIPLE INDICATEUR */}
      <div className="grid grid-cols-3 divide-x divide-white/10 rounded-xl border border-white/10 bg-white/5 py-5 backdrop-blur">
        <StatPill
          Icon={CircleCheck}
          value={wins.toString()}
          label={t("stats_banner_wins")}
          color="text-emerald-300"
        />
        <StatPill
          Icon={CircleX}
          value={losses.toString()}
          label={t("stats_banner_losses")}
          color="text-red-300"
        />
        <StatPill
          Icon={TrendingUp}
          value={`${displayWinRate}%`}
          label={t("stats_banner_win_rate")}
          color="text-violet-200"
          gradient
        />
      </div>

      {/* COTES MOYENNES (si pas compact) */}
      {!compact && avgOdds !== null && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <OddsBox label={t("stats_avg_odds")} value={avgOdds} color="neutral" />
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
    </PronosIACard>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════

function StatPill({
  Icon,
  value,
  label,
  color,
  gradient = false,
}: {
  Icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  value: string;
  label: string;
  color: string;
  gradient?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2">
        <Icon size={20} strokeWidth={2.5} className={color} />
        {gradient ? (
          <span
            className="font-mono text-2xl font-black tabular-nums sm:text-3xl"
            style={{
              background:
                "linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {value}
          </span>
        ) : (
          <span className={`font-mono text-2xl font-black tabular-nums sm:text-3xl ${color}`}>
            {value}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
        {label}
      </div>
    </div>
  );
}


function OddsBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: "neutral" | "emerald" | "red";
}) {
  const styles = {
    neutral: "border-white/10 bg-white/5 text-white",
    emerald: "border-emerald-400/20 bg-emerald-500/5 text-emerald-200",
    red: "border-red-400/20 bg-red-500/5 text-red-200",
  }[color];

  return (
    <div className={`rounded-xl border p-4 text-center backdrop-blur ${styles}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
        {label}
      </div>
      <div className="mt-1 font-mono text-xl font-black tabular-nums">
        {value !== null ? value.toFixed(2) : "—"}
      </div>
    </div>
  );
}