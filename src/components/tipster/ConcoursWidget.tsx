// src/components/tipster/ConcoursWidget.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

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

// Parser simple pour <strong>
function renderWithStrong(text: string) {
  const parts = text.split(/(<strong>.*?<\/strong>)/);
  return parts.map((part, i) => {
    const m = part.match(/^<strong>(.*?)<\/strong>$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <span key={i}>{part}</span>;
  });
}

export default function ConcoursWidget({ userId, locale }: { userId: string; locale: string }) {
  const t = useTranslations("pronos_abonnes_concours_widget");
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

  function formatUnits(value: number): string {
    return (value >= 0 ? "+" : "") + value.toFixed(2);
  }

  function renderPeriod(ranking: MyRanking | null | undefined, type: "week" | "month") {
    if (!ranking) return null;

    const isWeek = type === "week";
    const label = isWeek ? t("period_week") : t("period_month");
    const prizeTitleKey = isWeek ? "prize_title_week" : "prize_title_month";

    const totalPicks = n(ranking.total_picks);
    const totalUnits = n(ranking.total_units);
    const minPicks = n(ranking.min_picks) || (isWeek ? 3 : 10);
    const prize = n(ranking.prize) || (isWeek ? 10 : 40);
    const gap = n(ranking.gap_to_leader);
    const rank = ranking.rank;
    const totalParticipants = n(ranking.total_participants);

    const title = t(prizeTitleKey, { label, prize });

    // Cas 1 : Pas encore de picks
    if (totalPicks === 0) {
      return (
        <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-300" : "border-amber-300"} p-4 shadow-sm`} style={{
          background: isWeek
            ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
            : "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
        }}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-800" : "text-amber-800"}`}>
            {title}
          </p>
          <p className="mt-2 text-sm font-bold text-neutral-800">
            {minPicks === 1
              ? t("no_picks_singular", { count: minPicks })
              : t("no_picks_plural", { count: minPicks })}
          </p>
        </div>
      );
    }

    // Cas 2 : Pas encore éligible
    if (!ranking.eligible) {
      const remaining = Math.max(0, minPicks - totalPicks);
      return (
        <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-300" : "border-amber-300"} p-4 shadow-sm`} style={{
          background: isWeek
            ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
            : "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
        }}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-800" : "text-amber-800"}`}>
            {title}
          </p>
          <p className="mt-2 text-xs text-neutral-700">
            {renderWithStrong(
              totalPicks === 1
                ? t("ineligible_current_singular", { count: totalPicks })
                : t("ineligible_current_plural", { count: totalPicks })
            )}
          </p>
          <p className={`mt-1 text-sm font-extrabold ${isWeek ? "text-emerald-800" : "text-amber-800"}`}>
            {t("ineligible_remaining", { count: remaining })}
          </p>
          <p className={`mt-2 text-xs font-bold ${totalUnits >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {t("ineligible_score", { units: formatUnits(totalUnits) })}
          </p>
        </div>
      );
    }

    // Cas 3 : 1er du classement
    if (rank === 1) {
      return (
        <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-500" : "border-amber-500"} p-4 shadow-md`} style={{
          background: isWeek
            ? "linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)"
            : "linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)"
        }}>
          <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-900" : "text-amber-900"}`}>
            {title}
          </p>
          <p className="mt-2 text-lg font-black text-neutral-900">
            {t("first_place")}
          </p>
          <p className="mt-1 text-xs text-neutral-800">
            {totalPicks === 1
              ? t("first_detail_singular", { units: totalUnits.toFixed(2), count: totalPicks })
              : t("first_detail_plural", { units: totalUnits.toFixed(2), count: totalPicks })}
          </p>
          <p className={`mt-2 text-[11px] font-bold ${isWeek ? "text-emerald-900" : "text-amber-900"}`}>
            {t("first_encourage", { prize })}
          </p>
        </div>
      );
    }

    // Cas 4 : Classé mais pas 1er
    return (
      <div className={`rounded-xl border-2 ${isWeek ? "border-emerald-300" : "border-amber-300"} p-4 shadow-sm`} style={{
        background: isWeek
          ? "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)"
          : "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
      }}>
        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${isWeek ? "text-emerald-800" : "text-amber-800"}`}>
          {title}
        </p>
        <p className="mt-2 text-lg font-black text-neutral-900">
          {t("ranked_position", { rank: rank ?? 0 })}
          <span className="text-xs font-bold text-neutral-500">{t("ranked_suffix")}</span>
          <span className="text-xs font-bold text-neutral-500 ml-1">{t("ranked_total", { total: totalParticipants })}</span>
        </p>
        <p className="mt-1 text-xs text-neutral-700">
          {totalPicks === 1
            ? t("ranked_detail_singular", { units: formatUnits(totalUnits), count: totalPicks })
            : t("ranked_detail_plural", { units: formatUnits(totalUnits), count: totalPicks })}
        </p>
        {gap > 0 && (
          <p className={`mt-2 text-[11px] font-bold ${isWeek ? "text-emerald-800" : "text-amber-800"}`}>
            {t("ranked_gap", { gap: gap.toFixed(2) })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-neutral-200 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-neutral-500">
          {t("header_title")}
        </p>
        <Link
          href={`/${locale}/pronos-abonnes/concours`}
          className="text-[11px] font-bold text-emerald-600 hover:underline"
        >
          {t("header_link")}
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {renderPeriod(data.week, "week")}
        {renderPeriod(data.month, "month")}
      </div>
    </div>
  );
}