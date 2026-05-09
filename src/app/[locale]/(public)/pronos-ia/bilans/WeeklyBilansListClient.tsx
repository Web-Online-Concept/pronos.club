"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * WeeklyBilansListClient.tsx
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composant client : liste des bilans hebdomadaires.
 * Affiche une card par semaine avec ROI / Profit / Picks / V-D-N / CLV.
 *
 * Lien vers /pronos-ia/bilan-hebdo/[semaine].
 *
 * Style clair cohérent V3.5.
 *
 * Path : src/app/[locale]/(public)/pronos-ia/bilans/WeeklyBilansListClient.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import Link from "next/link";
import type { WeeklyBilanRow } from "./page";


interface Props {
  locale: string;
  bilans: WeeklyBilanRow[];
}


export default function WeeklyBilansListClient({ locale, bilans }: Props) {
  if (bilans.length === 0) {
    return <EmptyState />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
      <div className="space-y-3">
        {bilans.map((bilan) => (
          <WeeklyBilanCard
            key={bilan.week_slug}
            bilan={bilan}
            locale={locale}
          />
        ))}
      </div>
    </main>
  );
}


// ─── Card pour 1 bilan hebdo ──────────────────────────────────────

function WeeklyBilanCard({
  bilan,
  locale,
}: {
  bilan: WeeklyBilanRow;
  locale: string;
}) {
  const roiSign = bilan.roi_pct >= 0 ? "+" : "";
  const profitSign = bilan.total_profit_units >= 0 ? "+" : "";
  const isProfitable = bilan.roi_pct > 0;
  const isLoss = bilan.roi_pct < 0;

  // Mise en forme du label de semaine (ex: "Sem 19 — 2026")
  const weekLabelShort = `Sem ${bilan.week_number}`;

  // Détecter si la semaine est encore en cours / si c'est très récent
  const isRecent = isWithinDays(bilan.generated_at, 8);

  return (
    <Link
      href={`/${locale}/pronos-ia/bilan-hebdo/${bilan.week_slug}`}
      className={`group flex items-stretch gap-4 overflow-hidden rounded-2xl border-2 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${
        isProfitable
          ? "border-emerald-200 hover:border-emerald-400"
          : isLoss
            ? "border-red-200 hover:border-red-400"
            : "border-zinc-200 hover:border-zinc-400"
      }`}
    >
      {/* Badge semaine à gauche */}
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
          S{bilan.week_number}
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
          {bilan.week_year}
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
            {weekLabelShort}
          </h2>
          {isRecent && (
            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
              Récent
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 capitalize mb-3">
          {bilan.week_label}
        </p>

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
            WR {bilan.winrate_pct.toFixed(1)}%
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
            ROI {roiSign}
            {bilan.roi_pct.toFixed(2)}%
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
            {profitSign}
            {bilan.total_profit_units.toFixed(2)}U
          </span>
          {bilan.clv_avg_pct !== null && bilan.clv_picks_count > 0 && (
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold font-mono ${
                bilan.clv_avg_pct > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-zinc-100 text-zinc-600"
              }`}
              title={`CLV calculé sur ${bilan.clv_picks_count} pick(s) avec closing capturé`}
            >
              CLV {bilan.clv_avg_pct >= 0 ? "+" : ""}
              {bilan.clv_avg_pct.toFixed(2)}%
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
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-xl font-extrabold text-zinc-900 mb-2">
          Aucun bilan hebdomadaire pour le moment
        </h3>
        <p className="mx-auto max-w-md text-sm text-zinc-600 mb-4">
          Les bilans hebdomadaires sont générés automatiquement chaque dimanche
          à 22h Paris pour la semaine ISO écoulée (lundi → dimanche).
        </p>
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-700">
          <span>⏰</span>
          <span>Premier bilan disponible dimanche prochain à 22h</span>
        </div>
      </div>
    </main>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Vérifie si une date ISO est dans les N derniers jours.
 */
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