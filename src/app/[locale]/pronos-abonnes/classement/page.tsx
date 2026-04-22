// src/app/[locale]/pronos-abonnes/classement/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

type LeaderboardEntry = {
  rank: number;
  user_id: string;
  pseudo: string;
  avatar_url: string | null;
  total_picks: number;
  won: number;
  half_won: number;
  refunded: number;
  half_lost: number;
  lost: number;
  winrate: number;
  avg_odds: number;
  total_units: number;
  roi: number;
  recent_form: string[];
};

type Period = "week" | "month" | "all";
type SortKey = "total_units" | "roi" | "winrate" | "total_picks" | "avg_odds";

export default function PronosAbonnesClassementPage() {
  const locale = useLocale();
  const [period, setPeriod] = useState<Period>("all");
  const [sortKey, setSortKey] = useState<SortKey>("total_units");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLeaderboard() {
    setLoading(true);
    const res = await fetch(`/api/tipster-leaderboard?period=${period}`);
    const data = await res.json();
    setLeaderboard(data.leaderboard || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchLeaderboard();
  }, [period]);

  // Client-side sort
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === "desc" ? -diff : diff;
  }).map((e, i) => ({ ...e, rank: i + 1 }));

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function formDot(result: string) {
    if (result === "won") return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />;
    if (result === "half_won") return <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/50" />;
    if (result === "refunded") return <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />;
    if (result === "half_lost") return <span className="inline-block h-2 w-2 rounded-full bg-red-500/50" />;
    if (result === "lost") return <span className="inline-block h-2 w-2 rounded-full bg-red-500" />;
    return <span className="inline-block h-2 w-2 rounded-full bg-neutral-300" />;
  }

  return (
    <main className="min-h-screen bg-white">
      <div
        className="px-4 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            🏆 Pronos Abonnés
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Classement</h1>
          <p className="mt-2 text-sm text-white/60">
            Les meilleurs tipsters de la communauté
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
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-bold text-neutral-500 transition hover:text-neutral-900"
            >
              Historique
            </Link>
            <Link
              href={`/${locale}/pronos-abonnes/classement`}
              className="whitespace-nowrap border-b-2 border-emerald-500 px-4 py-3 text-sm font-bold text-emerald-600"
            >
              Classement
            </Link>
          </div>
        </div>
      </div>

      {/* Période tabs */}
      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex gap-2">
            {(["week", "month", "all"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition sm:flex-none ${
                  period === p
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400"
                }`}
              >
                {p === "week" ? "Cette semaine" : p === "month" ? "Ce mois" : "All-time"}
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
        ) : sortedLeaderboard.length === 0 ? (
          <div className="rounded-3xl bg-neutral-50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
              <span className="text-4xl">🏆</span>
            </div>
            <p className="text-neutral-500 text-sm">
              Aucun tipster classé pour cette période
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">Tipster</th>
                  <th
                    onClick={() => handleSort("total_picks")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    Picks {sortKey === "total_picks" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("winrate")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    Winrate {sortKey === "winrate" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("avg_odds")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    Cote moy {sortKey === "avg_odds" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("total_units")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    Total U {sortKey === "total_units" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("roi")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    ROI {sortKey === "roi" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider">Forme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedLeaderboard.map((entry) => (
                  <tr key={entry.user_id} className="transition hover:bg-neutral-50">
                    <td className="px-4 py-3 text-left">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold ${
                        entry.rank === 1 ? "bg-yellow-100 text-yellow-700"
                        : entry.rank === 2 ? "bg-neutral-200 text-neutral-700"
                        : entry.rank === 3 ? "bg-orange-100 text-orange-700"
                        : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${locale}/pronos-abonnes/${encodeURIComponent(entry.pseudo)}`}
                        className="flex items-center gap-2 font-bold text-neutral-900 hover:text-emerald-600"
                      >
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600">
                            {entry.pseudo.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate max-w-[140px]">{entry.pseudo}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-700">
                      {entry.total_picks}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-700">
                      {entry.winrate}%
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-700">
                      {entry.avg_odds.toFixed(2)}
                    </td>
                    <td className={`px-3 py-3 text-right font-extrabold tabular-nums ${
                      entry.total_units > 0 ? "text-emerald-600" : entry.total_units < 0 ? "text-red-600" : "text-neutral-500"
                    }`}>
                      {entry.total_units >= 0 ? "+" : ""}{entry.total_units.toFixed(2)}U
                    </td>
                    <td className={`px-3 py-3 text-right font-semibold tabular-nums ${
                      entry.roi > 0 ? "text-emerald-600" : entry.roi < 0 ? "text-red-600" : "text-neutral-500"
                    }`}>
                      {entry.roi >= 0 ? "+" : ""}{entry.roi.toFixed(1)}%
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {entry.recent_form.length === 0 ? (
                          <span className="text-xs text-neutral-400">—</span>
                        ) : (
                          entry.recent_form.slice().reverse().map((r, i) => (
                            <span key={i}>{formDot(r)}</span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-neutral-400">
          Clique sur une colonne pour trier. 1 U = 1 unité de mise (convention universelle).
        </p>
      </div>
    </main>
  );
}