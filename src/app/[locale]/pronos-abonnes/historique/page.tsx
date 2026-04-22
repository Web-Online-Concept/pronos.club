// src/app/[locale]/pronos-abonnes/historique/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import TipsterPickCard from "@/components/tipster/TipsterPickCard";

type Pick = any;

const SPORTS = [
  "⚽ Football",
  "🏀 Basketball",
  "🎾 Tennis",
  "🏒 Hockey",
  "🏈 Football US",
  "⚾ Baseball",
  "🥊 MMA/Boxe",
  "🏉 Rugby",
  "🎯 Autre",
];

const RESULTS_FILTER = [
  { value: "", label: "Tous" },
  { value: "won", label: "✓ Gagnés" },
  { value: "half_won", label: "½ Gagnés" },
  { value: "refunded", label: "↻ Remboursés" },
  { value: "half_lost", label: "½ Perdus" },
  { value: "lost", label: "✗ Perdus" },
];

export default function PronosAbonnesHistoriquePage() {
  const locale = useLocale();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<string>("");
  const [resultFilter, setResultFilter] = useState<string>("");

  async function fetchPicks() {
    setLoading(true);
    const params = new URLSearchParams({ filter: "resolved", limit: "100" });
    if (sportFilter) params.append("sport", sportFilter);
    const res = await fetch(`/api/tipster-picks?${params}`);
    const data = await res.json();
    let results = data.picks || [];
    if (resultFilter) {
      results = results.filter((p: Pick) => p.result === resultFilter);
    }
    setPicks(results);
    setLoading(false);
  }

  useEffect(() => {
    fetchPicks();
  }, [sportFilter, resultFilter]);

  return (
    <main className="min-h-screen bg-white">
      <div
        className="px-4 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            📋 Pronos Abonnés
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Historique</h1>
          <p className="mt-2 text-sm text-white/60">
            Tous les pronostics résolus par la communauté
          </p>
        </div>
      </div>

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex gap-1 overflow-x-auto">
            <Link
              href={`/${locale}/pronos-abonnes/en-cours`}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-bold text-neutral-500 transition hover:text-neutral-900"
            >
              En cours
            </Link>
            <Link
              href={`/${locale}/pronos-abonnes/historique`}
              className="whitespace-nowrap border-b-2 border-emerald-500 px-4 py-3 text-sm font-bold text-emerald-600"
            >
              Historique
            </Link>
            <Link
              href={`/${locale}/pronos-abonnes/classement`}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-bold text-neutral-500 transition hover:text-neutral-900"
            >
              Classement
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-3 space-y-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setResultFilter("")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                resultFilter === "" ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
              }`}
            >
              Tous
            </button>
            {RESULTS_FILTER.slice(1).map((r) => (
              <button
                key={r.value}
                onClick={() => setResultFilter(r.value)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  resultFilter === r.value ? "bg-neutral-900 text-white" : "bg-white text-neutral-600 border border-neutral-200"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSportFilter("")}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                sportFilter === "" ? "bg-emerald-600 text-white" : "bg-white text-neutral-600 border border-neutral-200"
              }`}
            >
              Tous sports
            </button>
            {SPORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSportFilter(s)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  sportFilter === s ? "bg-emerald-600 text-white" : "bg-white text-neutral-600 border border-neutral-200"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : picks.length === 0 ? (
          <div className="rounded-3xl bg-neutral-50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
              <span className="text-4xl">📋</span>
            </div>
            <p className="text-neutral-500 text-sm">
              Aucun pronostic résolu avec ces filtres
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {picks.map((pick) => (
              <TipsterPickCard key={pick.id} pick={pick} locale={locale} showPseudo showResult />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}