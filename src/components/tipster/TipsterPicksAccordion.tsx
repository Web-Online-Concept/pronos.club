// src/components/tipster/TipsterPicksAccordion.tsx
//
// LOT 21 (11/05/2026)
// Affiche les picks détaillés d'un tipster sur une période, dans un accordéon
// déroulé depuis la table classement.

"use client";

import { useEffect, useState } from "react";

type Period = "week" | "month" | "all";

type Pick = {
  id: string;
  match_date: string;
  sport: string;
  odds: number;
  pick_type: "simple" | "combiné";
  result: "won" | "lost" | "half_won" | "half_lost" | "refunded" | null;
  status: string;
  units_result: number;
  bookmaker: string | null;
  final_odds: number | null;
  image_url: string | null;
};

export default function TipsterPicksAccordion({
  userId,
  pseudo,
  period,
  periodStart,
}: {
  userId: string;
  pseudo: string;
  period: Period;
  periodStart: string | null;
}) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ user_id: userId, period });
    if (periodStart) params.set("period_start", periodStart);

    fetch(`/api/tipster-leaderboard/picks?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPicks(data.picks || []);
        setLoading(false);
      })
      .catch(() => {
        setPicks([]);
        setLoading(false);
      });
  }, [userId, period, periodStart]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (picks.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-neutral-500">Aucun pick résolu sur cette période</p>
      </div>
    );
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function resultBadge(result: string | null, unitsResult: number) {
    if (result === "won") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          ✓ Gagné · +{unitsResult.toFixed(2)}U
        </span>
      );
    }
    if (result === "lost") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
          ✗ Perdu · {unitsResult.toFixed(2)}U
        </span>
      );
    }
    if (result === "half_won") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
          ½ Gagné · +{unitsResult.toFixed(2)}U
        </span>
      );
    }
    if (result === "half_lost") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
          ½ Perdu · {unitsResult.toFixed(2)}U
        </span>
      );
    }
    if (result === "refunded") {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
          ⊘ Remboursé · 0U
        </span>
      );
    }
    return null;
  }

  // Stats résumées
  const totalUnits = picks.reduce((sum, p) => sum + Number(p.units_result || 0), 0);
  const wonCount = picks.filter((p) => p.result === "won").length;
  const lostCount = picks.filter((p) => p.result === "lost").length;

  return (
    <div className="rounded-xl bg-white border border-neutral-200">
      <div className="p-3 border-b border-neutral-100 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-bold text-neutral-700">
          📋 Pronos de {pseudo} sur cette période
        </p>
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          <span>{picks.length} picks</span>
          <span>·</span>
          <span className="text-emerald-600 font-bold">{wonCount} ✓</span>
          <span className="text-red-600 font-bold">{lostCount} ✗</span>
          <span>·</span>
          <span className={`font-extrabold ${totalUnits >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {totalUnits >= 0 ? "+" : ""}{totalUnits.toFixed(2)}U
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 text-[10px] text-neutral-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-2 text-left font-bold">Date</th>
              <th className="px-3 py-2 text-left font-bold">Sport</th>
              <th className="px-3 py-2 text-left font-bold">Type</th>
              <th className="px-3 py-2 text-right font-bold">Cote</th>
              <th className="px-3 py-2 text-left font-bold">Bookmaker</th>
              <th className="px-3 py-2 text-right font-bold">Résultat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {picks.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 text-neutral-700 whitespace-nowrap">
                  {formatDate(p.match_date)}
                </td>
                <td className="px-3 py-2 text-neutral-700">{p.sport}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    p.pick_type === "combiné"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-neutral-100 text-neutral-600"
                  }`}>
                    {p.pick_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-neutral-700">
                  {Number(p.odds).toFixed(2)}
                  {p.final_odds && Number(p.final_odds) !== Number(p.odds) && (
                    <span className="ml-1 text-[10px] text-neutral-400">
                      ({Number(p.final_odds).toFixed(2)})
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-neutral-600">
                  {p.bookmaker || "-"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {resultBadge(p.result, Number(p.units_result || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}