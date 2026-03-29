"use client";

import { useState, useEffect } from "react";
import PickCard from "@/components/picks/PickCard";
import EspaceHero from "@/components/layout/EspaceHero";
import type { Pick } from "@/lib/supabase/types";
import { useTranslations } from "next-intl";

interface EnrichedPick extends Pick {
  user_odds?: number | null;
  user_profit?: number | null;
  user_bookmaker_id?: string | null;
  user_bookmaker_other?: string | null;
}

function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m), 0);
  return `${ym}-${String(d.getDate()).padStart(2, "0")}`;
}

interface SportOption {
  name: string;
  icon: string;
  slug: string;
}

export default function MonHistoriquePage() {
  const t = useTranslations("history");
  const MONTH_NAMES = t("months").split(",");

  function formatMonth(ym: string) {
    const [y, m] = ym.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  }

  const [picks, setPicks] = useState<EnrichedPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const BATCH = 20;

  const [filterMode, setFilterMode] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sport, setSport] = useState("all");
  const [sports, setSports] = useState<SportOption[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/stats?meta_only=true")
      .then((r) => r.json())
      .then((d) => {
        setSports(d.allSports ?? []);
        setAvailableMonths(d.availableMonths ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setOffset(0);
    fetchPicks(0, true);
  }, [statusFilter, filterMode, selectedMonth, selectedYear, dateFrom, dateTo, sport]);

  async function fetchPicks(fromOffset = 0, reset = false) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const params = new URLSearchParams({ limit: String(BATCH), offset: String(fromOffset) });
    if (statusFilter !== "all") params.set("status", statusFilter);
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

    const res = await fetch(`/api/user-picks/history?${params}`);
    const data = await res.json();
    const newPicks = data.data ?? [];

    if (reset) setPicks(newPicks);
    else setPicks((prev) => [...prev, ...newPicks]);

    setTotal(data.count ?? 0);
    setLoading(false);
    setLoadingMore(false);
  }

  function loadMore() {
    const newOffset = offset + BATCH;
    setOffset(newOffset);
    fetchPicks(newOffset, false);
  }

  const years = [...new Set(availableMonths.map((m) => m.slice(0, 4)))].sort();

  return (
    <>
      <EspaceHero title={t("my_title")} />

    <main className="mx-auto max-w-2xl px-4 pb-8 pt-4">

      <div className="flex flex-wrap items-center justify-center gap-2">
        <select
          value={filterMode === "custom" ? "custom" : filterMode === "month" && selectedMonth ? `month:${selectedMonth}` : filterMode === "year" && selectedYear ? `year:${selectedYear}` : "all"}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "all") { setFilterMode("all"); setSelectedMonth(""); setSelectedYear(""); setDateFrom(""); setDateTo(""); }
            else if (val === "custom") { setFilterMode("custom"); setSelectedMonth(""); setSelectedYear(""); }
            else if (val.startsWith("month:")) { setFilterMode("month"); setSelectedMonth(val.replace("month:", "")); setSelectedYear(""); }
            else if (val.startsWith("year:")) { setFilterMode("year"); setSelectedYear(val.replace("year:", "")); setSelectedMonth(""); }
          }}
          className="cursor-pointer rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold"
        >
          <option value="all">{t("filter_all_dates")}</option>
          <option value="custom">{t("filter_custom")}</option>
          {years.length > 0 && (<optgroup label={t("filter_by_year")}>{years.map((y) => (<option key={y} value={`year:${y}`}>{y}</option>))}</optgroup>)}
          {availableMonths.length > 0 && (<optgroup label={t("filter_by_month")}>{availableMonths.map((m) => (<option key={m} value={`month:${m}`}>{formatMonth(m)}</option>))}</optgroup>)}
        </select>

        {sports.length > 1 && (
          <select value={sport} onChange={(e) => setSport(e.target.value)} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold">
            <option value="all">{t("filter_all_sports")}</option>
            {sports.map((s) => (<option key={s.slug} value={s.slug}>{s.icon} {s.name}</option>))}
          </select>
        )}

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold">
          <option value="all">{t("filter_all_results")}</option>
          <option value="pending">{t("filter_pending")}</option>
          <option value="awaiting">{t("filter_awaiting_result")}</option>
          <option value="won">{t("filter_won_emoji")}</option>
          <option value="lost">{t("filter_lost_emoji")}</option>
          <option value="void">{t("filter_void_emoji")}</option>
        </select>
      </div>

      {filterMode === "custom" && (
        <div className="mt-3 flex flex-wrap items-end justify-center gap-3">
          <div><label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">{t("date_from")}</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm" /></div>
          <div><label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">{t("date_to")}</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm" /></div>
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-center text-sm text-neutral-400">{t("loading")}</p>
      ) : picks.length === 0 ? (
        <div className="mt-8 rounded-xl border border-neutral-300 bg-neutral-100 px-6 py-12 text-center">
          <span className="text-4xl">📋</span>
          <p className="mt-4 text-sm font-semibold text-neutral-700">{t("empty_followed")}</p>
          <p className="mt-1 text-xs text-neutral-500">{t("empty_followed_desc")}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {picks.map((pick) => (
              <PickCard key={pick.id} pick={pick} userProfit={pick.user_profit} />
            ))}
          </div>

          {picks.length < total && (
            <div className="mt-6 text-center">
              <button onClick={loadMore} disabled={loadingMore} className="cursor-pointer rounded-full bg-neutral-900 px-8 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50">
                {loadingMore ? t("loading") : t("load_more", { current: picks.length, total })}
              </button>
            </div>
          )}
        </>
      )}
    </main>
    </>
  );
}