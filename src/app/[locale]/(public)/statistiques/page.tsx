"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { useTranslations } from "next-intl";

const RED = "#ef4444";
const GREEN = "#059669";

function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m), 0);
  return `${ym}-${String(d.getDate()).padStart(2, "0")}`;
}

interface StatsData {
  overview: {
    totalPicks: number; wonPicks: number; lostPicks: number; voidPicks: number;
    totalProfit: number; totalStaked: number; roi: number; winRate: number;
    avgOdds: number; avgOddsWon: number; avgOddsLost: number;
    maxWinStreak: number; maxLoseStreak: number; currentStreak: string;
    maxDrawdown: number;
    bestPick: { event: string; profit: number; odds: number } | null;
    worstPick: { event: string; profit: number; odds: number } | null;
  };
  profitTimeline: { date: string; profit: number; event: string }[];
  roiTimeline: { date: string; roi: number }[];
  drawdownTimeline: { date: string; drawdown: number }[];
  allSports: { name: string; icon: string; slug: string }[];
  availableMonths: string[];
  bySport: { name: string; icon: string; slug: string; won: number; lost: number; total: number; profit: number; roi: number; winRate: number }[];
  byMonth: { month: string; won: number; lost: number; total: number; profit: number; roi: number }[];
  byBookmaker: { name: string; slug: string; won: number; lost: number; total: number; profit: number; roi: number; winRate: number }[];
  oddsDist: { label: string; total: number; won: number; winRate: number; profit: number }[];
  tipsterBankroll: { mode: string; initial_bankroll: number; current_bankroll: number; unit_value: number; unit_percent: number; auto_recalc: string; show_on_site: boolean } | null;
}

export default function StatistiquesPage() {
  const t = useTranslations("statistics");
  const MONTH_NAMES = t("months").split(",");

  function formatMonth(ym: string) {
    const [y, m] = ym.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  }

  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sport, setSport] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [displayMode, setDisplayMode] = useState<"units" | "euros">("units");

  useEffect(() => {
    fetchStats();
  }, [sport, filterMode, selectedMonth, selectedYear, dateFrom, dateTo]);

  async function fetchStats() {
    setLoading(true);
    const params = new URLSearchParams();
    if (sport !== "all") params.set("sport", sport);
    if (filterMode === "month" && selectedMonth) {
      params.set("from", `${selectedMonth}-01`);
      params.set("to", lastDayOfMonth(selectedMonth));
    } else if (filterMode === "year" && selectedYear) {
      params.set("from", `${selectedYear}-01-01`);
      params.set("to", `${selectedYear}-12-31`);
    } else if (filterMode === "custom") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    }
    const res = await fetch(`/api/stats?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  if (loading || !data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-center opacity-50">{t("loading")}</p>
      </main>
    );
  }

  const o = data.overview;
  const sports = data.allSports ?? [];
  const months = data.availableMonths ?? [];
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort();

  // Tipster bankroll — for euro display
  const bk = data.tipsterBankroll;
  const showEuro = bk && bk.show_on_site && bk.mode !== "units_only";
  const uv = bk
    ? bk.mode === "fixed_unit"
      ? bk.unit_value ?? 0
      : bk.mode === "percent_bankroll"
      ? ((bk.current_bankroll ?? 0) * (bk.unit_percent ?? 0)) / 100
      : 0
    : 0;
  function toEuro(units: number) {
    return (units * uv).toFixed(2);
  }
  const isEuroMode = showEuro && displayMode === "euros";
  function displayVal(units: number, suffix = true) {
    if (isEuroMode) return `${suffix ? "" : ""}${toEuro(units)}${suffix ? "€" : ""}`;
    return `${suffix ? "" : ""}${Math.round(units * 100) / 100}${suffix ? "U" : ""}`;
  }

  return (
    <>
      <div className="flex min-h-[calc(100vh-100px)] flex-col">
      {/* Hero full-width */}
      <div
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("tag")}</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white">{t("title")}</h1>
            <p className="mt-2 text-sm text-white/40">{t("subtitle")}</p>
            {showEuro && bk && uv > 0 && (
              <div className="mt-3 inline-flex items-center gap-4 rounded-full bg-white/5 px-5 py-2">
                <span className="text-xs text-white/40">{t("bankroll_label")} : <span className="font-bold text-white">{bk.current_bankroll.toLocaleString("fr-FR")}€</span></span>
                <span className="text-xs text-white/40">{t("unit_label")} = <span className="font-bold text-emerald-400">{uv.toFixed(2)}€</span></span>
              </div>
            )}
          </div>
        </div>
      </div>

    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">

      {/* Filters — 2 dropdowns centered */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {/* Date filter */}
        <select
          value={
            filterMode === "custom" ? "custom" :
            filterMode === "month" && selectedMonth ? `month:${selectedMonth}` :
            filterMode === "year" && selectedYear ? `year:${selectedYear}` :
            "all"
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === "all") {
              setFilterMode("all");
              setSelectedMonth("");
              setSelectedYear("");
              setDateFrom("");
              setDateTo("");
            } else if (val === "custom") {
              setFilterMode("custom");
              setSelectedMonth("");
              setSelectedYear("");
            } else if (val.startsWith("month:")) {
              setFilterMode("month");
              setSelectedMonth(val.replace("month:", ""));
              setSelectedYear("");
            } else if (val.startsWith("year:")) {
              setFilterMode("year");
              setSelectedYear(val.replace("year:", ""));
              setSelectedMonth("");
            }
          }}
          className="cursor-pointer rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold"
        >
          <option value="all">{t("filter_all_dates")}</option>
          <option value="custom">{t("filter_custom")}</option>
          {years.length > 0 && (
            <optgroup label={t("filter_by_year")}>
              {years.map((y) => (
                <option key={y} value={`year:${y}`}>{y}</option>
              ))}
            </optgroup>
          )}
          {months.length > 0 && (
            <optgroup label={t("filter_by_month")}>
              {months.map((m) => (
                <option key={m} value={`month:${m}`}>{formatMonth(m)}</option>
              ))}
            </optgroup>
          )}
        </select>

        {/* Sport filter */}
        {sports.length > 1 && (
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="cursor-pointer rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold"
          >
            <option value="all">{t("filter_all_sports")}</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
        )}

        {/* U/€ toggle */}
        {showEuro && (
          <div className="flex items-center rounded-full border border-neutral-200 bg-white p-0.5">
            <button
              onClick={() => setDisplayMode("units")}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                displayMode === "units"
                  ? "bg-emerald-600 text-white"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {t("toggle_units")}
            </button>
            <button
              onClick={() => setDisplayMode("euros")}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                displayMode === "euros"
                  ? "bg-emerald-600 text-white"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {t("toggle_euros")}
            </button>
          </div>
        )}
      </div>

      {/* Custom date range */}
      {filterMode === "custom" && (
        <div className="mt-3 flex flex-wrap items-end justify-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">{t("date_from")}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">{t("date_to")}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm"
            />
          </div>
        </div>
      )}

      {o.totalPicks === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <div>
            <p className="text-4xl">📊</p>
            <p className="mt-2 text-sm opacity-50">{t("no_data")}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Hero stats — 4 main KPIs */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="relative overflow-hidden rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
              <p className="text-3xl font-extrabold text-white">{o.totalPicks}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">{t("kpi_picks")}</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
              <p className={`text-3xl font-extrabold ${o.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{o.winRate}%</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">{t("kpi_winrate")}</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
              <p className={`text-3xl font-extrabold ${o.roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{o.roi >= 0 ? "+" : ""}{o.roi}%</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">{t("kpi_roi")}</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
              <p className={`text-3xl font-extrabold ${o.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{o.totalProfit >= 0 ? "+" : ""}{displayVal(o.totalProfit)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">{t("kpi_profit")}</p>
            </div>
          </div>

          {/* Secondary stats */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
              <p className="mt-1 text-2xl font-extrabold text-emerald-600">{o.wonPicks}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_won")}</p>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
              <p className="mt-1 text-2xl font-extrabold text-red-500">{o.lostPicks}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_lost")}</p>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-neutral-300 to-neutral-400" />
              <p className="mt-1 text-2xl font-extrabold text-neutral-500">{o.voidPicks}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_void")}</p>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 to-blue-500" />
              <p className="mt-1 text-2xl font-extrabold text-neutral-900">{o.avgOdds}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_avg_odds")}</p>
            </div>
          </div>

          {/* Streaks row */}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className={`absolute inset-x-0 top-0 h-1 ${(o.currentStreak ?? "").startsWith("W") ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-red-400 to-red-500"}`} />
              <p className={`mt-1 text-2xl font-extrabold ${(o.currentStreak ?? "").startsWith("W") ? "text-emerald-600" : "text-red-500"}`}>{o.currentStreak ?? "-"}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_current_streak")}</p>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
              <p className="mt-1 text-2xl font-extrabold text-emerald-600">{o.maxWinStreak}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_max_win_streak")}</p>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-400 to-red-500" />
              <p className="mt-1 text-2xl font-extrabold text-red-500">{o.maxLoseStreak}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_max_lose_streak")}</p>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-neutral-100 bg-white p-4 text-center shadow-sm transition hover:shadow-md">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
              <p className="mt-1 text-2xl font-extrabold text-neutral-900">{displayVal(o.totalStaked)}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t("kpi_total_staked")}</p>
            </div>
          </div>

          {/* Best / Worst pick */}
          {(o.bestPick || o.worstPick) && (
            <div className="mb-8 mt-4 grid gap-3 sm:grid-cols-2">
              {o.bestPick && (
                <div className="overflow-hidden rounded-2xl border-l-4 border-emerald-500 p-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{t("best_pick")}</p>
                  <p className="mt-1 font-bold text-white">{o.bestPick.event}</p>
                  <p className="mt-1 text-sm text-white/50">{t("odds_label")} {o.bestPick.odds} → <span className="font-bold text-emerald-400">+{displayVal(o.bestPick.profit)}</span></p>
                </div>
              )}
              {o.worstPick && (
                <div className="overflow-hidden rounded-2xl border-l-4 border-red-500 p-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #2e0606 100%)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">{t("worst_pick")}</p>
                  <p className="mt-1 font-bold text-white">{o.worstPick.event}</p>
                  <p className="mt-1 text-sm text-white/50">{t("odds_label")} {o.worstPick.odds} → <span className="font-bold text-red-400">{displayVal(o.worstPick.profit)}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Profit header — bottom of viewport */}
        </>
      )}
    </div>

    {o.totalPicks > 0 && (
      <div
        className="border-y border-emerald-900/50 px-4 py-6"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">{t("chart_profit_tag")}</p>
          <h2 className="mt-1 text-xl font-extrabold text-white">{t("chart_profit_title")}</h2>
        </div>
      </div>
    )}
    </div>

    <main className="mx-auto max-w-5xl px-4 pb-8">
      {o.totalPicks > 0 && (
        <>
          {/* Profit Evolution chart */}
          <section>
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={isEuroMode ? data.profitTimeline.map((p) => ({ ...p, profit: Math.round(p.profit * uv * 100) / 100 })) : data.profitTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => isEuroMode ? `${v}€` : `${v}U`} />
                  <Tooltip formatter={(value) => [isEuroMode ? `${value}€` : `${value}U`, t("chart_profit_tooltip")]} />
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GREEN} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="profit" stroke={GREEN} strokeWidth={2} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ROI Evolution */}
          <section className="mt-10">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-64rem)/2+1rem)] sm:px-[calc((100vw-64rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">{t("chart_roi_tag")}</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">{t("chart_roi_title")}</h2>
              </div>
            </div>
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.roiTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value) => [`${value}%`, "ROI"]} />
                  <Line type="monotone" dataKey="roi" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* By Month */}
          {data.byMonth.length > 1 && (
            <section className="mt-10">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-64rem)/2+1rem)] sm:px-[calc((100vw-64rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">{t("by_month_tag")}</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">{t("by_month_title")}</h2>
              </div>
            </div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={isEuroMode ? data.byMonth.map((m) => ({ ...m, profit: Math.round(m.profit * uv * 100) / 100 })) : data.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => isEuroMode ? `${v}€` : `${v}U`} />
                    <Tooltip formatter={(value) => [isEuroMode ? `${value}€` : `${value}U`, t("kpi_profit")]} />
                    <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                      {data.byMonth.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? GREEN : RED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs uppercase opacity-40">
                      <th className="pb-2 text-left">{t("th_month")}</th>
                      <th className="pb-2 text-center">{t("th_picks")}</th>
                      <th className="pb-2 text-center">{t("th_wl")}</th>
                      <th className="pb-2 text-center">{t("th_roi")}</th>
                      <th className="pb-2 text-right">{t("th_profit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMonth.map((m) => (
                      <tr key={m.month} className="border-b border-neutral-100">
                        <td className="py-2 font-medium">{formatMonth(m.month)}</td>
                        <td className="py-2 text-center">{m.total}</td>
                        <td className="py-2 text-center">{m.won}W {m.lost}L</td>
                        <td className="py-2 text-center">{m.roi}%</td>
                        <td className={`py-2 text-right font-bold ${m.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {m.profit >= 0 ? "+" : ""}{displayVal(m.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* By Sport */}
          {data.bySport.length > 0 && (
            <section className="mt-10">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-64rem)/2+1rem)] sm:px-[calc((100vw-64rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">{t("by_sport_tag")}</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">{t("by_sport_title")}</h2>
              </div>
            </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {data.bySport.map((s) => (
                  <div
                    key={s.slug}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.06] p-5 transition hover:-translate-y-0.5 hover:shadow-xl"
                    style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
                  >
                    {/* Accent bar top */}
                    <div className={`absolute inset-x-0 top-0 h-1 ${s.profit >= 0 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-red-400 to-red-500"}`} />

                    {/* Header: icon + name + profit */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">{s.icon}</span>
                        <span className="text-base font-bold text-white">{s.name}</span>
                      </div>
                      <span className={`text-lg font-extrabold ${s.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {s.profit >= 0 ? "+" : ""}{displayVal(s.profit)}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-white">{s.total}</p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">{t("sport_picks")}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-extrabold text-white">{s.won}W {s.lost}L</p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">{t("sport_record")}</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-extrabold ${s.winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>{s.winRate}%</p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">{t("sport_winrate")}</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-sm font-extrabold ${s.roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>{s.roi}%</p>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">{t("sport_roi")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* By Bookmaker */}
          {data.byBookmaker.length > 0 && (
            <section className="mt-10">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-64rem)/2+1rem)] sm:px-[calc((100vw-64rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">{t("by_bookie_tag")}</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">{t("by_bookie_title")}</h2>
              </div>
            </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-xs uppercase opacity-40">
                      <th className="pb-2 text-left">{t("th_bookmaker")}</th>
                      <th className="pb-2 text-center">{t("th_picks")}</th>
                      <th className="pb-2 text-center">{t("th_wl")}</th>
                      <th className="pb-2 text-center">{t("th_winrate")}</th>
                      <th className="pb-2 text-center">{t("th_roi")}</th>
                      <th className="pb-2 text-right">{t("th_profit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byBookmaker.map((b) => (
                      <tr key={b.slug} className="border-b border-neutral-100">
                        <td className="py-2 font-medium">{b.name}</td>
                        <td className="py-2 text-center">{b.total}</td>
                        <td className="py-2 text-center">{b.won}W {b.lost}L</td>
                        <td className="py-2 text-center">{b.winRate}%</td>
                        <td className="py-2 text-center">{b.roi}%</td>
                        <td className={`py-2 text-right font-bold ${b.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {b.profit >= 0 ? "+" : ""}{displayVal(b.profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Odds Distribution */}
          <section className="mt-10">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-64rem)/2+1rem)] sm:px-[calc((100vw-64rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">{t("odds_dist_tag")}</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">{t("odds_dist_title")}</h2>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.oddsDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#d1d5db" name={t("chart_total")} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="won" fill={GREEN} name={t("chart_won")} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.oddsDist.map((d) => (
                  <div key={d.label} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                    <span className="text-sm font-medium">{d.label}</span>
                    <div className="flex gap-4 text-xs">
                      <span className="opacity-50">{d.total} picks</span>
                      <span className="opacity-50">WR {d.winRate}%</span>
                      <span className={`font-bold ${d.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {d.profit >= 0 ? "+" : ""}{displayVal(d.profit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Win/Loss Pie */}
          <section className="mt-10 mb-10">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-64rem)/2+1rem)] sm:px-[calc((100vw-64rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">{t("pie_tag")}</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">{t("pie_title")}</h2>
              </div>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: t("pie_won"), value: o.wonPicks },
                      { name: t("pie_lost"), value: o.lostPicks },
                      { name: t("pie_void"), value: o.voidPicks },
                    ].filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill={GREEN} />
                    <Cell fill={RED} />
                    <Cell fill="#9ca3af" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </main>
    </>
  );
}