// src/app/[locale]/pronos-abonnes/classement/page.tsx
//
// LOT 21 (11/05/2026) — Refonte :
//   - Dropdown période pour week/month : voir les semaines/mois passés
//   - Accordéon au clic sur un tipster : voir ses picks détaillés sur la période
//   - Badge 🏆 sur le gagnant officiel d'une période clôturée

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import PronosAbonnesNav from "@/components/tipster/PronosAbonnesNav";
import TipsterPicksAccordion from "@/components/tipster/TipsterPicksAccordion";

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

type AvailablePeriod = { period_start: string; is_current: boolean };

type OfficialWinner = {
  user_id: string;
  pseudo: string;
  total_units: number;
  picks_count: number;
  prize_amount: number;
  period_start: string;
};

export default function PronosAbonnesClassementPage() {
  const locale = useLocale();
  const t = useTranslations("pronos_abonnes_classement");
  const [period, setPeriod] = useState<Period>("week");
  const [periodStart, setPeriodStart] = useState<string | null>(null); // null = en cours
  const [availablePeriods, setAvailablePeriods] = useState<AvailablePeriod[]>([]);
  const [officialWinner, setOfficialWinner] = useState<OfficialWinner | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("total_units");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Accordéon ouvert
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  // Charger la liste des périodes disponibles quand on change de type (week/month)
  useEffect(() => {
    if (period === "all") {
      setAvailablePeriods([]);
      setPeriodStart(null);
      return;
    }
    fetch(`/api/tipster-leaderboard?action=periods&period_type=${period}`)
      .then((r) => r.json())
      .then((data) => {
        setAvailablePeriods(data.periods || []);
        setPeriodStart(null); // reset au passage week/month
      })
      .catch(() => setAvailablePeriods([]));
  }, [period]);

  // Charger le leaderboard quand on change de période ou de periodStart
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setOpenUserId(null);

    const params = new URLSearchParams({ period });
    if (periodStart) params.set("period_start", periodStart);

    const res = await fetch(`/api/tipster-leaderboard?${params}`);
    const data = await res.json();
    setLeaderboard(data.leaderboard || []);

    // Si c'est une période passée (week ou month), check s'il y a un gagnant officiel
    if ((period === "week" || period === "month") && periodStart) {
      try {
        const winnerRes = await fetch(
          `/api/tipster-concours?action=history`
        );
        const winnerData = await winnerRes.json();
        const winners = winnerData.winners || [];
        const match = winners.find(
          (w: any) => w.period_type === period && w.period_start === periodStart
        );
        if (match) {
          setOfficialWinner({
            user_id: match.user_id,
            pseudo: match.users?.pseudo || "?",
            total_units: Number(match.total_units),
            picks_count: match.picks_count,
            prize_amount: Number(match.prize_amount),
            period_start: match.period_start,
          });
        } else {
          setOfficialWinner(null);
        }
      } catch {
        setOfficialWinner(null);
      }
    } else {
      setOfficialWinner(null);
    }

    setLoading(false);
  }, [period, periodStart]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const sortedLeaderboard = [...leaderboard]
    .sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "desc" ? -diff : diff;
    })
    .map((e, i) => ({ ...e, rank: i + 1 }));

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

  function formatPeriodLabel(periodStartStr: string, type: "week" | "month"): string {
    const d = new Date(periodStartStr + "T12:00:00");
    if (type === "month") {
      return d.toLocaleDateString(
        locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-GB",
        { month: "long", year: "numeric" }
      );
    }
    // Pour week : "Sem. du 4 mai" + numéro de semaine ISO
    const endDate = new Date(d);
    endDate.setDate(d.getDate() + 6);
    const fmt = (date: Date) =>
      date.toLocaleDateString(
        locale === "fr" ? "fr-FR" : locale === "es" ? "es-ES" : "en-GB",
        { day: "numeric", month: "short" }
      );
    return `${fmt(d)} → ${fmt(endDate)}`;
  }

  // Période en cours pour affichage par défaut dans le dropdown
  const currentPeriodStart = availablePeriods.find((p) => p.is_current)?.period_start || null;
  const displayedPeriodStart = periodStart || currentPeriodStart;

  return (
    <main className="min-h-screen bg-white">
      <div
        className="px-4 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            {t("hero_badge")}
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{t("hero_title")}</h1>
          <p className="mt-2 text-sm text-white/60">
            {t("hero_subtitle")}
          </p>
        </div>
      </div>

      <PronosAbonnesNav active="classement" locale={locale} />

      {/* Tabs période + dropdown */}
      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-col items-center gap-3">
            {/* Tabs */}
            <div className="flex justify-center gap-2 flex-wrap">
              {(["week", "month", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    period === p
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {p === "week" ? t("period_week") : p === "month" ? t("period_month") : t("period_all")}
                </button>
              ))}
            </div>

            {/* Dropdown période passée */}
            {(period === "week" || period === "month") && availablePeriods.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  {period === "week" ? "Semaine :" : "Mois :"}
                </span>
                <select
                  value={displayedPeriodStart || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPeriodStart(val === currentPeriodStart ? null : val);
                  }}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-bold text-neutral-900 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {availablePeriods.map((p) => (
                    <option key={p.period_start} value={p.period_start}>
                      {formatPeriodLabel(p.period_start, period)}
                      {p.is_current ? " (en cours)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Badge gagnant officiel */}
        {officialWinner && (
          <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-5 text-center">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-amber-700">
              {period === "week" ? "🏆 Gagnant officiel de la semaine" : "👑 Champion officiel du mois"}
            </p>
            <p className="mt-2 text-2xl font-black text-amber-900">
              {officialWinner.pseudo}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              +{officialWinner.total_units.toFixed(2)}U · {officialWinner.picks_count} picks ·{" "}
              <strong>{officialWinner.prize_amount}€ remportés</strong>
            </p>
          </div>
        )}

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
              {t("empty_title")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider">{t("col_tipster")}</th>
                  <th
                    onClick={() => handleSort("total_picks")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    {t("col_picks")} {sortKey === "total_picks" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("winrate")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    {t("col_winrate")} {sortKey === "winrate" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("avg_odds")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    {t("col_avg_odds")} {sortKey === "avg_odds" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("total_units")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    {t("col_total_units")} {sortKey === "total_units" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th
                    onClick={() => handleSort("roi")}
                    className="cursor-pointer px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider hover:text-neutral-900"
                  >
                    {t("col_roi")} {sortKey === "roi" && (sortDir === "desc" ? "▼" : "▲")}
                  </th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider">{t("col_form")}</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedLeaderboard.map((entry) => {
                  const isOfficialWinner = officialWinner?.user_id === entry.user_id;
                  const isOpen = openUserId === entry.user_id;

                  return (
                    <>
                      <tr
                        key={entry.user_id}
                        onClick={() => setOpenUserId(isOpen ? null : entry.user_id)}
                        className={`transition cursor-pointer ${
                          isOpen ? "bg-emerald-50" : isOfficialWinner ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-neutral-50"
                        }`}
                      >
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
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/${locale}/pronos-abonnes/${encodeURIComponent(entry.pseudo)}`}
                              onClick={(e) => e.stopPropagation()}
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
                            {isOfficialWinner && (
                              <span className="text-xs">🏆</span>
                            )}
                          </div>
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
                        <td className="px-3 py-3 text-center text-neutral-400">
                          <span className={`inline-block transition-transform ${isOpen ? "rotate-180" : ""}`}>
                            ▼
                          </span>
                        </td>
                      </tr>

                      {/* Accordéon : picks détaillés */}
                      {isOpen && (
                        <tr key={`${entry.user_id}-detail`} className="bg-neutral-50">
                          <td colSpan={9} className="px-4 py-4">
                            <TipsterPicksAccordion
                              userId={entry.user_id}
                              pseudo={entry.pseudo}
                              period={period}
                              periodStart={periodStart}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-neutral-400">
          {t("footer_hint")}
        </p>
        <p className="mt-2 text-center text-[11px] text-neutral-400">
          💡 Clique sur un tipster pour voir le détail de ses picks
        </p>
      </div>
    </main>
  );
}