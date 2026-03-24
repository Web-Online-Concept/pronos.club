"use client";

import { useState, useEffect } from "react";
import PickCard from "@/components/picks/PickCard";
import type { Pick } from "@/lib/supabase/types";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
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

export default function HistoriquePage() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const BATCH = 20;

  // Time filters
  const [filterMode, setFilterMode] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sport filter
  const [sport, setSport] = useState("all");
  const [sports, setSports] = useState<SportOption[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Fetch sports + months + counts on mount
  useEffect(() => {
    fetch("/api/stats?meta_only=true")
      .then((r) => r.json())
      .then((d) => {
        setSports(d.allSports ?? []);
        setAvailableMonths(d.availableMonths ?? []);
      })
      .catch(() => {});

    // Fetch awaiting + finished counts
    fetch("/api/picks/history?limit=0&offset=0&status=awaiting")
      .then((r) => r.json())
      .then((d) => setAwaitingCount(d.count ?? 0))
      .catch(() => {});

    fetch("/api/picks/history?limit=0&offset=0&exclude_pending=true")
      .then((r) => r.json())
      .then((d) => setFinishedCount(d.count ?? 0))
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

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    } else {
      params.set("exclude_pending", "true");
    }

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

    const res = await fetch(`/api/picks/history?${params}`);
    const data = await res.json();
    const newPicks = data.data ?? [];

    if (reset) {
      setPicks(newPicks);
    } else {
      setPicks((prev) => [...prev, ...newPicks]);
    }

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
      {/* Hero full-width */}
      <div
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Pronos Club</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white">
              Historique
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              {awaitingCount > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-xs font-semibold text-amber-400">
                    {awaitingCount} en attente de résultat{awaitingCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
                <span className="text-xs font-semibold text-emerald-400">
                  {finishedCount} prono{finishedCount > 1 ? "s" : ""} terminé{finishedCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    <main className="mx-auto max-w-2xl px-4 pb-4">

      {/* Filters — 3 dropdowns */}
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
          <option value="all">Toutes les dates</option>
          <option value="custom">Personnalisé</option>
          {years.length > 0 && (
            <optgroup label="Par année">
              {years.map((y) => (
                <option key={y} value={`year:${y}`}>{y}</option>
              ))}
            </optgroup>
          )}
          {availableMonths.length > 0 && (
            <optgroup label="Par mois">
              {availableMonths.map((m) => (
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
            <option value="all">Tous les sports</option>
            {sports.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
        )}

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="cursor-pointer rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold"
        >
          <option value="all">Tous les résultats</option>
          <option value="awaiting">En attente MAJ</option>
          <option value="won">Gagnés</option>
          <option value="lost">Perdus</option>
          <option value="void">Remboursés</option>
        </select>
      </div>

      {/* Custom date range */}
      {filterMode === "custom" && (
        <div className="mt-3 flex flex-wrap items-end justify-center gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Picks */}
      {loading ? (
        <p className="mt-8 text-center opacity-50">Chargement...</p>
      ) : picks.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-4xl">📭</p>
          <p className="mt-2 text-sm text-neutral-600 font-semibold">Aucun résultat</p>
        </div>
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {picks.map((pick) => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>

          {picks.length < total && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="cursor-pointer rounded-full bg-neutral-900 px-8 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
              >
                {loadingMore ? "Chargement..." : `Charger plus (${picks.length}/${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </main>
    </>
  );
}