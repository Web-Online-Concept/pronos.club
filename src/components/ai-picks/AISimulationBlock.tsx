/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AISimulationBlock
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bloc simulation "1 unité par prono" pour les classiques.
 * Affiche mise, retour, résultat, ROI + phrase de contexte juridique.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";


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
  const displayRoi = roiPct !== null ? `${roiPct >= 0 ? "+" : ""}${roiPct.toFixed(2)}%` : "—";

  const roiColor = isProfit ? "text-emerald-400" : "text-red-400";
  const profitColor = isProfit ? "text-emerald-400" : "text-red-400";
  const borderColor = isProfit ? "border-emerald-500/30" : "border-red-500/30";
  const bgColor = isProfit ? "bg-emerald-950/10" : "bg-red-950/10";

  return (
    <section className={`rounded-2xl border p-6 sm:p-8 ${borderColor} ${bgColor}`}>
      {/* HEADER */}
      <div className="mb-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-cyan-300">
          <span>💡</span>
          <span>{t("stats_simulation_badge")}</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-100">
          {t("stats_simulation_title")}
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          {t("stats_simulation_subtitle")}
        </p>
      </div>

      {/* GRILLE DES 4 INDICATEURS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SimBox
          label={t("stats_simulation_stake")}
          value={formatUnits(stake)}
          color="text-neutral-200"
        />
        <SimBox
          label={t("stats_simulation_return")}
          value={formatUnits(returnAmount)}
          color="text-neutral-200"
        />
        <SimBox
          label={t("stats_simulation_profit")}
          value={`${profitPrefix}${formatUnits(profit)}`}
          color={profitColor}
          highlight
        />
        <SimBox
          label={t("stats_simulation_roi")}
          value={displayRoi}
          color={roiColor}
          highlight
        />
      </div>

      {/* DISCLAIMER SOUS LA SIMULATION */}
      <div className="mt-6 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-950/10 p-3 text-xs text-amber-200/70">
        <span className="flex-shrink-0 text-amber-400">ⓘ</span>
        <p>{t("stats_simulation_disclaimer")}</p>
      </div>
    </section>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPOSANT : case d'indicateur
// ═══════════════════════════════════════════════════════════════════

function SimBox({
  label,
  value,
  color,
  highlight = false,
}: {
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-center ${
        highlight
          ? "border-neutral-700 bg-neutral-950/60"
          : "border-neutral-800 bg-neutral-900/40"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1.5 font-mono text-xl font-bold ${color}`}>
        {value}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// HELPER : formatage des unités (ex: 243 → "243 U", 277.68 → "277.68 U")
// ═══════════════════════════════════════════════════════════════════

function formatUnits(value: number): string {
  // Pas de décimales si c'est un entier, sinon 2 décimales
  const isInteger = value % 1 === 0;
  const formatted = isInteger ? value.toString() : value.toFixed(2);
  return `${formatted} U`;
}