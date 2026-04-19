/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AISimulationBlock
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bloc simulation "1 unité par prono".
 * Card sombre avec accent cyan (distinct des autres stats).
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";


interface Props {
  stake: number;
  returnAmount: number;
  profit: number;
  roiPct: number | null;
  locale: string;
}


export default async function AISimulationBlock({
  stake,
  returnAmount,
  profit,
  roiPct,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const isProfit = profit >= 0;
  const profitPrefix = isProfit ? "+" : "";
  const displayRoi =
    roiPct !== null
      ? `${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(2)}%`
      : "—";

  // Couleurs dynamiques selon profit/perte
  const accentBorder = isProfit
    ? "rgba(16, 185, 129, 0.3)"
    : "rgba(239, 68, 68, 0.3)";
  const bgGradient = isProfit
    ? "linear-gradient(135deg, #042f2e 0%, #064e3b 35%, #065f46 70%, #047857 100%)"
    : "linear-gradient(135deg, #1a0505 0%, #450a0a 35%, #7f1d1d 70%, #991b1b 100%)";
  const glowTop = isProfit
    ? "radial-gradient(circle at 100% 0%, rgba(52, 211, 153, 0.4) 0%, transparent 50%)"
    : "radial-gradient(circle at 100% 0%, rgba(248, 113, 113, 0.35) 0%, transparent 50%)";
  const topBar = isProfit
    ? "linear-gradient(90deg, transparent 0%, #34d399 30%, #10b981 70%, transparent 100%)"
    : "linear-gradient(90deg, transparent 0%, #f87171 30%, #ef4444 70%, transparent 100%)";

  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-5 shadow-2xl sm:p-6"
      style={{
        background: bgGradient,
        borderColor: accentBorder,
      }}
    >
      {/* Halos lumineux */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: glowTop }}
      />
      <div
        aria-hidden
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{ background: topBar }}
      />

      <div className="relative z-10">
        {/* HEADER */}
        <div className="mb-6">
          <div
            className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90 backdrop-blur"
            style={{
              background: isProfit
                ? "rgba(52, 211, 153, 0.2)"
                : "rgba(248, 113, 113, 0.2)",
              border: `1px solid ${accentBorder}`,
            }}
          >
            <span>💡</span>
            <span>{t("stats_simulation_badge")}</span>
          </div>
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">
            {t("stats_simulation_title")}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {t("stats_simulation_subtitle")}
          </p>
        </div>

        {/* 4 INDICATEURS */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SimBox
            label={t("stats_simulation_stake")}
            value={formatUnits(stake)}
            color="text-white"
          />
          <SimBox
            label={t("stats_simulation_return")}
            value={formatUnits(returnAmount)}
            color="text-white"
          />
          <SimBox
            label={t("stats_simulation_profit")}
            value={`${profitPrefix}${formatUnits(profit)}`}
            color={isProfit ? "text-emerald-200" : "text-red-200"}
            highlight
          />
          <SimBox
            label={t("stats_simulation_roi")}
            value={displayRoi}
            color={isProfit ? "text-emerald-200" : "text-red-200"}
            highlight
            gradient
          />
        </div>

        {/* Disclaimer */}
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/70 backdrop-blur">
          <Info
            size={14}
            strokeWidth={2.5}
            className="mt-0.5 flex-shrink-0 text-white/50"
          />
          <p>{t("stats_simulation_disclaimer")}</p>
        </div>
      </div>
    </section>
  );
}


function SimBox({
  label,
  value,
  color,
  highlight = false,
  gradient = false,
}: {
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
  gradient?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center backdrop-blur ${
        highlight
          ? "border-white/20 bg-black/30"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
        {label}
      </div>
      {gradient ? (
        <div
          className="mt-1.5 font-mono text-xl font-black tabular-nums sm:text-2xl"
          style={{
            background:
              "linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {value}
        </div>
      ) : (
        <div
          className={`mt-1.5 font-mono text-xl font-black tabular-nums sm:text-2xl ${color}`}
        >
          {value}
        </div>
      )}
    </div>
  );
}


function formatUnits(value: number): string {
  const isInteger = value % 1 === 0;
  const formatted = isInteger ? value.toString() : value.toFixed(2);
  return `${formatted} U`;
}