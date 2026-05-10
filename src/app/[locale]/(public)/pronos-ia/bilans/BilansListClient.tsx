"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * BilansListClient.tsx (V3.5 Lot 11 — refonte monthly_bilans)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composant client : liste des bilans MENSUELS automatiques.
 * Lit la table monthly_bilans (générée par cron mensuel).
 *
 * Réplique du pattern WeeklyBilansListClient (même design, mêmes pills).
 * Lien vers /pronos-ia/bilan-mensuel/[mois].
 *
 * Path : src/app/[locale]/(public)/pronos-ia/bilans/BilansListClient.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import Link from "next/link";
import type { MonthlyBilanRow } from "./page";


interface Props {
  locale: string;
  bilans: MonthlyBilanRow[];
}

const MONTH_NAMES_FR: Record<number, string> = {
  1: "Jan",
  2: "Fév",
  3: "Mar",
  4: "Avr",
  5: "Mai",
  6: "Juin",
  7: "Juil",
  8: "Août",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Déc",
};

const MONTH_NAMES_FULL_FR: Record<number, string> = {
  1: "Janvier",
  2: "Février",
  3: "Mars",
  4: "Avril",
  5: "Mai",
  6: "Juin",
  7: "Juillet",
  8: "Août",
  9: "Septembre",
  10: "Octobre",
  11: "Novembre",
  12: "Décembre",
};


export default function BilansListClient({ locale, bilans }: Props) {
  if (bilans.length === 0) {
    return <EmptyState />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
      <div className="space-y-3">
        {bilans.map((bilan) => (
          <MonthlyBilanCard
            key={bilan.month_slug}
            bilan={bilan}
            locale={locale}
          />
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
  bilan: MonthlyBilanRow;
  locale: string;
}) {
  const monthShort = MONTH_NAMES_FR[bilan.month_number] ?? String(bilan.month_number);
  const monthFull = MONTH_NAMES_FULL_FR[bilan.month_number] ?? String(bilan.month_number);
  const monthLabel = `${monthFull} ${bilan.month_year}`;

  const isProfitable = bilan.roi_pct > 0;
  const isLoss = bilan.roi_pct < 0;

  // Détecter si le bilan est récent (créé < 35 jours)
  const isRecent = isWithinDays(bilan.created_at, 35);

  return (
    <Link
      href={`/${locale}/pronos-ia/bilan-mensuel/${bilan.month_slug}`}
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
          className={`text-2xl font-black ${
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
          {bilan.month_year}
        </p>
      </div>

      {/* Contenu central */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h2
            className={`text-base font-extrabold sm:text-lg ${
              isProfitable
                ? "text-zinc-900 group-hover:text-emerald-700"
                : isLoss
                  ? "text-zinc-900 group-hover:text-red-700"
                  : "text-zinc-900 group-hover:text-violet-700"
            } transition`}
          >
            {monthLabel}
          </h2>
          {isRecent && (
            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Récent
            </span>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600 font-mono">
            {bilan.total_picks} picks
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600 font-mono">
            {bilan.picks_won}V/{bilan.picks_lost}D
            {bilan.picks_void > 0 ? `/${bilan.picks_void}N` : ""}
          </span>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-600 font-mono">
            WR {Number(bilan.winrate_pct).toFixed(1)}%
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
            ROI {Number(bilan.roi_pct) >= 0 ? "+" : ""}
            {Number(bilan.roi_pct).toFixed(2)}%
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
            {Number(bilan.total_profit_units) >= 0 ? "+" : ""}
            {Number(bilan.total_profit_units).toFixed(2)}U
          </span>
          {bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0 && (
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold font-mono ${
                Number(bilan.clv_avg_pct) > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-zinc-100 text-zinc-600"
              }`}
              title={`CLV calculé sur ${bilan.clv_picks_count} pick(s) avec closing capturé`}
            >
              CLV {Number(bilan.clv_avg_pct) >= 0 ? "+" : ""}
              {Number(bilan.clv_avg_pct).toFixed(2)}%
            </span>
          )}
        </div>
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
          Aucun bilan mensuel pour le moment
        </h3>
        <p className="mx-auto max-w-md text-sm text-zinc-600 mb-4">
          Les bilans mensuels sont générés automatiquement le 1er de chaque
          mois à 22h Paris pour le mois écoulé.
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700">
          <span>⏰</span>
          <span>Premier bilan disponible le 1er du mois prochain à 22h</span>
        </div>
      </div>
    </main>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

function isWithinDays(isoDate: string, days: number): boolean {
  try {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= days;
  } catch {
    return false;
  }
}