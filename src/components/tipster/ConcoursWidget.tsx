// src/components/tipster/ConcoursWidget.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type MyRanking = {
  rank: number | null;
  total_picks: number;
  total_units: number;
  eligible: boolean;
  leader_pseudo: string | null;
  leader_units: number;
  gap_to_leader?: number;
  total_participants: number;
  min_picks: number;
  prize: number;
};

export default function ConcoursWidget({ userId, locale }: { userId: string; locale: string }) {
  const [data, setData] = useState<{ week: MyRanking; month: MyRanking } | null>(null);

  useEffect(() => {
    fetch(`/api/tipster-concours?action=my_ranking&user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => setData({ week: d.week, month: d.month }));
  }, [userId]);

  if (!data) return null;

  function renderPeriod(ranking: MyRanking, type: "week" | "month") {
    const color = type === "week" ? "emerald" : "amber";
    const icon = type === "week" ? "🏆" : "👑";
    const label = type === "week" ? "Semaine" : "Mois";

    if (!ranking.rank && !ranking.eligible && ranking.total_picks === 0) {
      return (
        <div className={`rounded-xl border-2 border-${color}-200 bg-${color}-50/30 p-4`}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest text-${color}-700`}>
            {icon} {label} — {ranking.prize}€
          </p>
          <p className="mt-2 text-sm font-bold text-neutral-700">
            Poste {ranking.min_picks} pronostic{ranking.min_picks > 1 ? "s" : ""} pour participer
          </p>
        </div>
      );
    }

    if (!ranking.eligible) {
      const remaining = ranking.min_picks - ranking.total_picks;
      return (
        <div className={`rounded-xl border-2 border-${color === "emerald" ? "emerald" : "amber"}-200 bg-gradient-to-br from-${color === "emerald" ? "emerald" : "amber"}-50 to-white p-4`}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${color === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
            {icon} {label} — {ranking.prize}€
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            Tu as <strong>{ranking.total_picks} pick{ranking.total_picks > 1 ? "s" : ""}</strong> pour l&apos;instant
          </p>
          <p className={`mt-1 text-sm font-extrabold ${color === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
            Encore {remaining} pour être éligible
          </p>
          <p className={`mt-2 text-xs ${ranking.total_units >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            Ton score actuel : {ranking.total_units >= 0 ? "+" : ""}{ranking.total_units.toFixed(2)}U
          </p>
        </div>
      );
    }

    if (ranking.rank === 1) {
      return (
        <div className={`rounded-xl border-2 ${color === "emerald" ? "border-emerald-400 bg-emerald-50" : "border-amber-400 bg-amber-50"} p-4`}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${color === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
            {icon} {label} — {ranking.prize}€
          </p>
          <p className="mt-2 text-lg font-black text-neutral-900">
            🥇 Tu es 1er !
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            +{ranking.total_units.toFixed(2)}U · {ranking.total_picks} pick{ranking.total_picks > 1 ? "s" : ""}
          </p>
          <p className={`mt-2 text-[11px] font-bold ${color === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
            Continue comme ça, {ranking.prize}€ en jeu 🎯
          </p>
        </div>
      );
    }

    return (
      <div className={`rounded-xl border-2 border-${color === "emerald" ? "emerald" : "amber"}-200 bg-white p-4`}>
        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${color === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
          {icon} {label} — {ranking.prize}€
        </p>
        <p className="mt-2 text-lg font-black text-neutral-900">
          Tu es {ranking.rank}
          <span className="text-xs font-bold text-neutral-400">e</span>
          <span className="text-xs font-bold text-neutral-400 ml-1">/ {ranking.total_participants}</span>
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          {ranking.total_units >= 0 ? "+" : ""}{ranking.total_units.toFixed(2)}U · {ranking.total_picks} pick{ranking.total_picks > 1 ? "s" : ""}
        </p>
        {ranking.gap_to_leader !== undefined && ranking.gap_to_leader > 0 && (
          <p className={`mt-2 text-[11px] font-bold ${color === "emerald" ? "text-emerald-700" : "text-amber-700"}`}>
            +{ranking.gap_to_leader.toFixed(2)}U pour passer 1er
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-neutral-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
          🏆 Concours en cours
        </p>
        <Link
          href={`/${locale}/pronos-abonnes/concours`}
          className="text-[11px] font-bold text-emerald-600 hover:underline"
        >
          Voir tout →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {renderPeriod(data.week, "week")}
        {renderPeriod(data.month, "month")}
      </div>
    </div>
  );
}