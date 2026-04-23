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
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/tipster-concours?action=my_ranking&user_id=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.week && d?.month) {
          setData({ week: d.week, month: d.month });
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [userId]);

  if (error || !data) return null;

  function n(v: any): number {
    const x = typeof v === "number" ? v : parseFloat(v);
    return isNaN(x) ? 0 : x;
  }

  function renderPeriod(ranking: MyRanking | null | undefined, type: "week" | "month") {
    if (!ranking) return null;

    const isWeek = type === "week";
    const icon = isWeek ? "🏆" : "👑";
    const label = isWeek ? "Semaine" : "Mois";

    const totalPicks = n(ranking.total_picks);
    const totalUnits = n(ranking.total_units);
    const minPicks = n(ranking.min_picks) || (isWeek ? 3 : 10);
    const prize = n(ranking.prize) || (isWeek ? 10 : 40);
    const gap = n(ranking.gap_to_leader);
    const rank = ranking.rank;
    const totalParticipants = n(ranking.total_participants);

    // Cas 1 : Pas encore de picks
    if (totalPicks === 0) {
      return (
        <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-200 bg-emerald-50/30" : "border-amber-200 bg-amber-50/30"} p-4`}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-700" : "text-amber-700"}`}>
            {icon} {label} — {prize}€
          </p>
          <p className="mt-2 text-sm font-bold text-neutral-700">
            Poste {minPicks} pronostic{minPicks > 1 ? "s" : ""} pour participer
          </p>
        </div>
      );
    }

    // Cas 2 : Pas encore éligible (picks insuffisants)
    if (!ranking.eligible) {
      const remaining = Math.max(0, minPicks - totalPicks);
      return (
        <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-200" : "border-amber-200"} bg-gradient-to-br ${isWeek ? "from-emerald-50" : "from-amber-50"} to-white p-4`}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-700" : "text-amber-700"}`}>
            {icon} {label} — {prize}€
          </p>
          <p className="mt-2 text-xs text-neutral-600">
            Tu as <strong>{totalPicks} pick{totalPicks > 1 ? "s" : ""}</strong> pour l&apos;instant
          </p>
          <p className={`mt-1 text-sm font-extrabold ${isWeek ? "text-emerald-700" : "text-amber-700"}`}>
            Encore {remaining} pour être éligible
          </p>
          <p className={`mt-2 text-xs ${totalUnits >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            Ton score actuel : {totalUnits >= 0 ? "+" : ""}{totalUnits.toFixed(2)}U
          </p>
        </div>
      );
    }

    // Cas 3 : 1er du classement
    if (rank === 1) {
      return (
        <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-400 bg-emerald-50" : "border-amber-400 bg-amber-50"} p-4`}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-700" : "text-amber-700"}`}>
            {icon} {label} — {prize}€
          </p>
          <p className="mt-2 text-lg font-black text-neutral-900">
            🥇 Tu es 1er !
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            +{totalUnits.toFixed(2)}U · {totalPicks} pick{totalPicks > 1 ? "s" : ""}
          </p>
          <p className={`mt-2 text-[11px] font-bold ${isWeek ? "text-emerald-700" : "text-amber-700"}`}>
            Continue comme ça, {prize}€ en jeu 🎯
          </p>
        </div>
      );
    }

    // Cas 4 : Classé mais pas 1er
    return (
      <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-200" : "border-amber-200"} bg-white p-4`}>
        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-700" : "text-amber-700"}`}>
          {icon} {label} — {prize}€
        </p>
        <p className="mt-2 text-lg font-black text-neutral-900">
          Tu es {rank}
          <span className="text-xs font-bold text-neutral-400">e</span>
          <span className="text-xs font-bold text-neutral-400 ml-1">/ {totalParticipants}</span>
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          {totalUnits >= 0 ? "+" : ""}{totalUnits.toFixed(2)}U · {totalPicks} pick{totalPicks > 1 ? "s" : ""}
        </p>
        {gap > 0 && (
          <p className={`mt-2 text-[11px] font-bold ${isWeek ? "text-emerald-700" : "text-amber-700"}`}>
            +{gap.toFixed(2)}U pour passer 1er
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