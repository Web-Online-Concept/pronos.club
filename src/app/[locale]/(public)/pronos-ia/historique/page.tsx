"use client";

import { useState, useEffect } from "react";
import PickCard from "@/components/picks/PickCard";
import {
  adaptAiPickToPickFormat,
  buildAiPickDetailHref,
  type AIPickRow,
} from "@/lib/ai-picks-v2/adapt-ai-pick";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import { useTranslations, useLocale } from "next-intl";


function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m), 0);
  return `${ym}-${String(d.getDate()).padStart(2, "0")}`;
}


// Liste des sports IA possibles avec icônes (aligné sur ce que stocke ai_picks.sport)
const AI_SPORTS: Array<{ slug: string; icon: string; name: string }> = [
  { slug: "football", icon: "⚽", name: "Football" },
  { slug: "tennis", icon: "🎾", name: "Tennis" },
  { slug: "basketball", icon: "🏀", name: "Basketball" },
  { slug: "hockey", icon: "🏒", name: "Hockey" },
  { slug: "baseball", icon: "⚾", name: "Baseball" },
  { slug: "football-americain", icon: "🏈", name: "Football US" },
  { slug: "rugby", icon: "🏉", name: "Rugby" },
  { slug: "mma", icon: "🥊", name: "MMA" },
];


export default function PronosIAHistoriquePage() {
  const t = useTranslations("ai_picks");
  const locale = useLocale();
  const MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function formatMonth(ym: string) {
    const [y, m] = ym.split("-");
    return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  }

  const [picks, setPicks] = useState<AIPickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [awaitingCount, setAwaitingCount] = useState(0);
  const [finishedCount, setFinishedCount] = useState(0);
  const BATCH = 20;

  const [filterMode, setFilterMode] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sport, setSport] = useState("all");

  // Fetch counts on mount
  useEffect(() => {
    fetch("/api/ai-picks/history?limit=0&offset=0&status=awaiting")
      .then((r) => r.json())
      .then((d) => setAwaitingCount(d.count ?? 0))
      .catch(() => {});

    fetch("/api/ai-picks/history?limit=0&offset=0&exclude_pending=true")
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

    const params = new URLSearchParams({
      limit: String(BATCH),
      offset: String(fromOffset),
    });

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

    const res = await fetch(`/api/ai-picks/history?${params}`);
    const data = await res.json();
    const newPicks: AIPickRow[] = data.data ?? [];

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

  const totalLabel =
    awaitingCount + finishedCount > 0
      ? `${awaitingCount + finishedCount} pronos`
      : "Historique";

  return (
    <>
      <PronosIAHero
        locale={locale}
        currentPage="history"
        title="Historique"
        badgeLabel={totalLabel}
      />

      <main className="mx-auto max-w-2xl px-4 pb-4">
        {/* Badges status counts */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {awaitingCount > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span className="text-xs font-semibold text-amber-400">
                {awaitingCount > 1
                  ? `${awaitingCount} en attente`
                  : `${awaitingCount} en attente`}
              </span>
            </div>
          )}
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5">
            <span className="text-xs font-semibold text-violet-400">
              {finishedCount > 1
                ? `${finishedCount} pronos terminés`
                : `${finishedCount} prono terminé`}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <select
              value={
                filterMode === "custom"
                  ? "custom"
                  : filterMode === "month" && selectedMonth
                    ? `month:${selectedMonth}`
                    : filterMode === "year" && selectedYear
                      ? `year:${selectedYear}`
                      : "all"
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
              className="max-w-[110px] cursor-pointer truncate rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:max-w-none sm:px-4 sm:py-2 sm:text-xs"
            >
              <option value="all">{isMobile ? "Dates" : "Toutes les dates"}</option>
              <option value="custom">Dates personnalisées</option>
            </select>

            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="max-w-[110px] cursor-pointer truncate rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:max-w-none sm:px-4 sm:py-2 sm:text-xs"
            >
              <option value="all">{isMobile ? "Sports" : "Tous les sports"}</option>
              {AI_SPORTS.map((s) => {
                const shortName =
                  isMobile && s.name.length > 10 ? s.name.slice(0, 10) + "." : s.name;
                return (
                  <option key={s.slug} value={s.slug}>
                    {s.icon} {shortName}
                  </option>
                );
              })}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="max-w-[110px] cursor-pointer truncate rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:max-w-none sm:px-4 sm:py-2 sm:text-xs"
            >
              <option value="all">{isMobile ? "Résultats" : "Tous les résultats"}</option>
              <option value="awaiting">En attente</option>
              <option value="won">Gagnés</option>
              <option value="lost">Perdus</option>
              <option value="void">Remboursés</option>
            </select>
          </div>
        </div>

        {/* Custom date range */}
        {filterMode === "custom" && (
          <div className="mt-3 flex flex-wrap items-end justify-center gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">
                Du
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-neutral-400">
                Au
              </label>
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
            <p className="mt-2 text-sm text-neutral-600 font-semibold">
              Aucun résultat
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              {picks.map((aiPick) => {
                const adaptedPick = adaptAiPickToPickFormat(aiPick);
                const detailHref = buildAiPickDetailHref(aiPick, locale);
                return (
                  <PickCard
                    key={aiPick.id}
                    pick={adaptedPick}
                    aiMode
                    aiFooterHref={detailHref}
                  />
                );
              })}
            </div>

            {picks.length < total && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="cursor-pointer rounded-full bg-neutral-900 px-8 py-3 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {loadingMore
                    ? "Chargement..."
                    : `Charger plus (${picks.length}/${total})`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}