"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * BilansListClient.tsx (refonte V3.5 — light theme)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composant client : liste des bilans MENSUELS.
 * Lit la table ai_bilans (filtrée pick_type='classic').
 *
 * Refondu en clair pour cohérence avec le reste de la V3.5.
 *
 * Path : src/app/[locale]/(public)/pronos-ia/bilans/BilansListClient.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import Link from "next/link";
import type { AiBilan } from "./page";


interface Props {
  locale: string;
  bilans: AiBilan[];
}

const MONTH_NAMES_FR: Record<string, string> = {
  "01": "Jan",
  "02": "Fév",
  "03": "Mar",
  "04": "Avr",
  "05": "Mai",
  "06": "Juin",
  "07": "Juil",
  "08": "Août",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Déc",
};


export default function BilansListClient({ locale, bilans }: Props) {
  // Filtre déjà fait côté serveur (pick_type='classic'), mais on garde au cas où
  const filteredBilans = bilans.filter((b) => b.pick_type === "classic");

  if (filteredBilans.length === 0) {
    return <EmptyState />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
      <div className="space-y-3">
        {filteredBilans.map((bilan) => (
          <MonthlyBilanCard key={bilan.id} bilan={bilan} locale={locale} />
        ))}
      </div>
    </main>
  );
}


// ─── Card pour 1 bilan mensuel ────────────────────────────────────

function MonthlyBilanCard({
  bilan,
  locale,
}: {
  bilan: AiBilan;
  locale: string;
}) {
  const [year, monthNum] = bilan.month.split("-");
  const monthShort = MONTH_NAMES_FR[monthNum] ?? monthNum;

  const isProfitable = bilan.roi > 0;
  const isLoss = bilan.roi < 0;
  const roiNum = Number(bilan.roi);
  const profitNum = Number(bilan.profit);

  return (
    <Link
      href={`/${locale}/pronos-ia/bilans/${bilan.slug}`}
      className={`group flex items-stretch gap-4 overflow-hidden rounded-2xl border-2 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${
        isProfitable
          ? "border-emerald-200 hover:border-emerald-400"
          : isLoss
            ? "border-red-200 hover:border-red-400"
            : "border-zinc-200 hover:border-zinc-400"
      }`}
    >
      {/* Badge mois à gauche */}
      <div
        className={`flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-xl ${
          isProfitable
            ? "bg-emerald-50"
            : isLoss
              ? "bg-red-50"
              : "bg-zinc-50"
        }`}
      >
        <p
          className={`text-xl font-black ${
            isProfitable
              ? "text-emerald-700"
              : isLoss
                ? "text-red-700"
                : "text-zinc-700"
          }`}
        >
          {monthShort}
        </p>
        <p
          className={`text-[10px] font-bold ${
            isProfitable
              ? "text-emerald-600/70"
              : isLoss
                ? "text-red-600/70"
                : "text-zinc-500"
          }`}
        >
          {year}
        </p>
      </div>

      {/* Contenu central */}
      <div className="flex-1 min-w-0">
        <h2
          className={`text-base font-extrabold text-zinc-900 sm:text-lg mb-3 ${
            isProfitable
              ? "group-hover:text-emerald-700"
              : isLoss
                ? "group-hover:text-red-700"
                : "group-hover:text-violet-700"
          } transition`}
        >
          {bilan.title}
        </h2>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600 font-mono">
            {bilan.total_picks} picks
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600 font-mono">
            WR {Number(bilan.win_rate).toFixed(2)}%
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold font-mono ${
              isProfitable
                ? "bg-emerald-100 text-emerald-700"
                : isLoss
                  ? "bg-red-100 text-red-700"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            ROI {roiNum >= 0 ? "+" : ""}
            {roiNum.toFixed(2)}%
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold font-mono ${
              isProfitable
                ? "bg-emerald-100 text-emerald-700"
                : isLoss
                  ? "bg-red-100 text-red-700"
                  : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {profitNum >= 0 ? "+" : ""}
            {profitNum.toFixed(3)}U
          </span>
        </div>

        {bilan.summary && (
          <p className="text-sm text-zinc-600 line-clamp-2">{bilan.summary}</p>
        )}
      </div>

      {/* Chevron à droite */}
      <div className="flex items-center">
        <svg
          className="h-5 w-5 flex-shrink-0 text-zinc-300 transition group-hover:text-violet-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}


// ─── État vide ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 pb-24">
      <div className="rounded-2xl border-2 border-zinc-200 bg-white p-10 text-center sm:p-14">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-extrabold text-zinc-900 mb-2">
          Aucun bilan mensuel publié pour le moment
        </h3>
        <p className="mx-auto max-w-md text-sm text-zinc-600">
          Les bilans mensuels sont publiés en début de chaque mois après
          consolidation des résultats.
        </p>
      </div>
    </main>
  );
}