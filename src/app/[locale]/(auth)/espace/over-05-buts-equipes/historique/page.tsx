"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";

type O05Result = {
  id: string;
  opportunity_id: string;
  played: boolean;
  stake_amount: number;
  odds: number;
  result: "won" | "lost" | "pending";
  profit: number | null;
  target_team_scored: boolean | null;
  user_notes: string | null;
  created_at: string;
  o05_opportunities: {
    id: string;
    target_team_name: string;
    opponent_team_name: string;
    match_date: string;
    badge: "green" | "orange" | "red";
    total_score: number;
    league_id: number;
    o05_leagues: { name: string; country: string } | null;
  } | null;
};

type Stats = {
  total_bets: number;
  won: number;
  lost: number;
  pending: number;
  win_rate_pct: number;
  total_staked: number;
  total_profit: number;
  roi_pct: number;
};


export default function HistoriquePage() {
  const locale = useLocale();
  const [results, setResults] = useState<O05Result[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "won" | "lost">("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, [filter]);

  async function fetchResults() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/over-05-buts-equipes/results?filter=${filter}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResults(data.results ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveResult(resultId: string, scored: boolean) {
    try {
      const res = await fetch("/api/over-05-buts-equipes/results", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          result_id: resultId,
          target_team_scored: scored,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Erreur : " + (err.error || res.status));
        return;
      }
      await fetchResults();
    } catch (err) {
      alert("Erreur réseau");
    }
  }

  return (
    <main className="min-h-screen pb-12 bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Link
            href={`/${locale}/espace/over-05-buts-equipes`}
            className="text-xs text-emerald-600 hover:underline"
          >
            ← Retour aux opportunités
          </Link>
          <h1 className="mt-3 text-2xl font-black text-neutral-900 sm:text-3xl">📊 Mon historique</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Tes paris joués et leurs résultats
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Stats globales */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Paris joués</p>
              <p className="mt-1 text-2xl font-black text-neutral-900">{stats.total_bets}</p>
              <p className="text-[10px] text-neutral-500">
                {stats.won} W · {stats.lost} L · {stats.pending} pending
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Taux réussite</p>
              <p
                className={`mt-1 text-2xl font-black ${
                  stats.win_rate_pct >= 60
                    ? "text-emerald-600"
                    : stats.win_rate_pct >= 40
                      ? "text-amber-600"
                      : "text-red-600"
                }`}
              >
                {stats.win_rate_pct}%
              </p>
              <p className="text-[10px] text-neutral-500">
                {stats.won} gagnés sur {stats.won + stats.lost}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">Profit total</p>
              <p
                className={`mt-1 text-2xl font-black ${
                  stats.total_profit > 0
                    ? "text-emerald-600"
                    : stats.total_profit < 0
                      ? "text-red-600"
                      : "text-neutral-900"
                }`}
              >
                {stats.total_profit > 0 ? "+" : ""}
                {stats.total_profit.toFixed(2)}€
              </p>
              <p className="text-[10px] text-neutral-500">misé : {stats.total_staked.toFixed(2)}€</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">ROI</p>
              <p
                className={`mt-1 text-2xl font-black ${
                  stats.roi_pct > 0
                    ? "text-emerald-600"
                    : stats.roi_pct < 0
                      ? "text-red-600"
                      : "text-neutral-900"
                }`}
              >
                {stats.roi_pct > 0 ? "+" : ""}
                {stats.roi_pct}%
              </p>
              <p className="text-[10px] text-neutral-500">retour sur investissement</p>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "Tous" },
            { value: "pending", label: "En attente" },
            { value: "won", label: "Gagnés" },
            { value: "lost", label: "Perdus" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value as typeof filter)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                filter === opt.value
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            ⚠️ Erreur : {error}
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-neutral-300 bg-white py-20 text-center">
            <p className="text-4xl">🎯</p>
            <p className="mt-4 text-sm text-neutral-600">Aucun pari pour ce filtre</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 text-xs">
                  <th className="px-4 py-3 text-left font-bold">Date</th>
                  <th className="px-4 py-3 text-left font-bold">Match</th>
                  <th className="px-4 py-3 text-center font-bold">Cible</th>
                  <th className="px-4 py-3 text-center font-bold">Mise</th>
                  <th className="px-4 py-3 text-center font-bold">Cote</th>
                  <th className="px-4 py-3 text-center font-bold">Résultat</th>
                  <th className="px-4 py-3 text-right font-bold">Profit</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const opp = r.o05_opportunities;
                  return (
                    <tr key={r.id} className="border-b border-neutral-100 text-neutral-700">
                      <td className="px-4 py-3 text-xs">
                        {opp
                          ? new Date(opp.match_date).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                            })
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {opp ? (
                          <Link
                            href={`/${locale}/espace/over-05-buts-equipes/${opp.id}`}
                            className="font-bold text-neutral-900 hover:text-emerald-600"
                          >
                            {opp.target_team_name} vs {opp.opponent_team_name}
                          </Link>
                        ) : (
                          "?"
                        )}
                        <p className="text-[10px] text-neutral-500">{opp?.o05_leagues?.name}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-600 font-bold">{opp?.target_team_name}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-neutral-900">
                        {Number(r.stake_amount).toFixed(2)}€
                      </td>
                      <td className="px-4 py-3 text-center text-neutral-700">
                        {Number(r.odds).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {r.result === "pending" ? (
                          <div className="flex flex-col gap-1">
                            <p className="text-amber-600 text-xs font-bold">⏳ En attente</p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleResolveResult(r.id, true)}
                                className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500"
                              >
                                ✓ Marqué
                              </button>
                              <button
                                onClick={() => handleResolveResult(r.id, false)}
                                className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-red-500"
                              >
                                ✗ Pas marqué
                              </button>
                            </div>
                          </div>
                        ) : r.result === "won" ? (
                          <span className="text-emerald-600 font-bold">✓ Gagné</span>
                        ) : (
                          <span className="text-red-600 font-bold">✗ Perdu</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.profit !== null ? (
                          <span
                            className={
                              r.profit > 0
                                ? "text-emerald-600 font-bold"
                                : r.profit < 0
                                  ? "text-red-600 font-bold"
                                  : "text-neutral-500"
                            }
                          >
                            {r.profit > 0 ? "+" : ""}
                            {Number(r.profit).toFixed(2)}€
                          </span>
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}