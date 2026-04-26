"use client";

import { useState } from "react";
import Link from "next/link";
import type { AiBilan } from "./page";


const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];


type TabType = "classic" | "scorer";


interface Props {
  locale: string;
  bilans: AiBilan[];
}


export default function BilansListClient({ locale, bilans }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("classic");

  const filteredBilans = bilans.filter((b) => b.pick_type === activeTab);

  return (
    <main className="mx-auto flex-1 w-full max-w-3xl px-4 pb-16">
      {/* Onglets Classiques / Buteurs */}
      <div className="mt-8 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("classic")}
            className={
              "rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition " +
              (activeTab === "classic"
                ? "bg-violet-500 text-white shadow-lg"
                : "text-neutral-500 hover:text-neutral-900")
            }
          >
            🎯 Classiques
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scorer")}
            className={
              "rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition " +
              (activeTab === "scorer"
                ? "bg-amber-500 text-white shadow-lg"
                : "text-neutral-500 hover:text-neutral-900")
            }
          >
            ⚽ Buteurs
          </button>
        </div>
      </div>

      {/* Liste */}
      {filteredBilans.length > 0 ? (
        <div className="mt-8 space-y-4">
          {filteredBilans.map((bilan) => {
            const [y, m] = bilan.month.split("-");
            const accentColor = bilan.pick_type === "scorer" ? "amber" : "violet";

            return (
              <Link
                key={bilan.id}
                href={`/${locale}/pronos-ia/bilans/${bilan.slug}`}
                className="group flex items-start gap-5 overflow-hidden rounded-2xl border border-white/[0.06] p-5 transition hover:-translate-y-0.5 hover:border-white/10 hover:shadow-lg"
                style={{
                  background:
                    bilan.pick_type === "scorer"
                      ? "linear-gradient(135deg, #111111 0%, #3d2a0a 100%)"
                      : "linear-gradient(135deg, #111111 0%, #1e1b4b 100%)",
                }}
              >
                {/* Month badge */}
                <div className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-white/[0.06]">
                  <p className="text-xl font-extrabold text-white">{m}</p>
                  <p className="text-[10px] text-white/30">{y}</p>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2
                      className={
                        "text-lg font-extrabold text-white transition " +
                        (accentColor === "amber"
                          ? "group-hover:text-amber-400"
                          : "group-hover:text-violet-400")
                      }
                    >
                      {bilan.title}
                    </h2>
                    {bilan.pick_type === "scorer" ? (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                        ⚽ Buteurs
                      </span>
                    ) : (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-400">
                        🎯 Classiques
                      </span>
                    )}
                  </div>

                  {/* Stats bar */}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-white/50">
                      {bilan.total_picks} picks
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-white/50">
                      WR {Number(bilan.win_rate).toFixed(2)}%
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        bilan.roi >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      ROI {bilan.roi >= 0 ? "+" : ""}{Number(bilan.roi).toFixed(2)}%
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        bilan.profit >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {bilan.profit >= 0 ? "+" : ""}{Number(bilan.profit).toFixed(3)}U
                    </span>
                  </div>

                  {bilan.summary && (
                    <p className="mt-2 text-sm text-white/40 line-clamp-2">{bilan.summary}</p>
                  )}
                </div>

                <svg
                  className={
                    "mt-2 h-5 w-5 flex-shrink-0 text-white/20 transition " +
                    (accentColor === "amber"
                      ? "group-hover:text-amber-400"
                      : "group-hover:text-violet-400")
                  }
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-4xl">📊</p>
          <p className="mt-2 text-sm font-semibold text-neutral-500">
            Aucun bilan {activeTab === "scorer" ? "Buteurs" : "Classiques"} publié pour le moment
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Les bilans mensuels seront publiés en début de chaque mois
          </p>
        </div>
      )}
    </main>
  );
}