"use client";

import Link from "next/link";
import type { AiBilan } from "./page";


interface Props {
  locale: string;
  bilans: AiBilan[];
}


export default function BilansListClient({ locale, bilans }: Props) {
  // Module Buteurs supprime : on liste uniquement les bilans classics
  const filteredBilans = bilans.filter((b) => b.pick_type === "classic");

  return (
    <main className="mx-auto flex-1 w-full max-w-3xl px-4 pb-16">
      {/* Liste */}
      {filteredBilans.length > 0 ? (
        <div className="mt-8 space-y-4">
          {filteredBilans.map((bilan) => {
            const [y, m] = bilan.month.split("-");

            return (
              <Link
                key={bilan.id}
                href={`/${locale}/pronos-ia/bilans/${bilan.slug}`}
                className="group flex items-start gap-5 overflow-hidden rounded-2xl border border-white/[0.06] p-5 transition hover:-translate-y-0.5 hover:border-white/10 hover:shadow-lg"
                style={{
                  background:
                    "linear-gradient(135deg, #111111 0%, #1e1b4b 100%)",
                }}
              >
                {/* Month badge */}
                <div className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-white/[0.06]">
                  <p className="text-xl font-extrabold text-white">{m}</p>
                  <p className="text-[10px] text-white/30">{y}</p>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h2 className="text-lg font-extrabold text-white transition group-hover:text-violet-400">
                    {bilan.title}
                  </h2>

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
                  className="mt-2 h-5 w-5 flex-shrink-0 text-white/20 transition group-hover:text-violet-400"
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
            Aucun bilan publié pour le moment
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            Les bilans mensuels seront publiés en début de chaque mois
          </p>
        </div>
      )}
    </main>
  );
}