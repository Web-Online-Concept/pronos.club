"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * HistoriqueClient.tsx (V3.5)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Composant client de la page /pronos-ia/historique.
 *
 * V3.5 (09/05/2026) :
 *   - Fix bug critique : suppression du `exclude_pending` quand statusFilter="all"
 *     → la page Historique affiche maintenant TOUS les picks (résolus + pending)
 *   - Ajout sports V3.5 manquants : Rugby, Handball, Formule 1
 *   - Ajout filtre Tier (Lock / Strong / Value / Coup de cœur)
 *   - Vérif slugs cohérents avec inferSportSlug() côté persist
 *
 * Path : src/app/[locale]/(public)/pronos-ia/historique/HistoriqueClient.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import AiPickCard from "@/components/ai-picks/AiPickCard";
import {
  adaptAiPickToCardData,
  type AIPickRow,
} from "@/lib/ai-picks-v2/adapt-ai-pick";


function lastDayOfMonth(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(parseInt(y), parseInt(m), 0);
  return `${ym}-${String(d.getDate()).padStart(2, "0")}`;
}


// Liste des sports IA possibles avec icônes (alignée sur inferSportSlug() V3.5)
// Slugs cohérents avec ce que stocke ai_picks.sport en BDD.
const AI_SPORTS: Array<{ slug: string; icon: string; name: string }> = [
  { slug: "football", icon: "⚽", name: "Football" },
  { slug: "tennis", icon: "🎾", name: "Tennis" },
  { slug: "basketball", icon: "🏀", name: "Basketball" },
  { slug: "hockey", icon: "🏒", name: "Hockey" },
  { slug: "baseball", icon: "⚾", name: "Baseball" },
  { slug: "football-americain", icon: "🏈", name: "Football US" },
  { slug: "mma", icon: "🥊", name: "MMA" },
  // V3.5 — nouveaux sports
  { slug: "rugby", icon: "🏉", name: "Rugby" },
  { slug: "handball", icon: "🤾", name: "Handball" },
  { slug: "formula-1", icon: "🏎️", name: "Formule 1" },
];


// Filtres tier V3.5
const AI_TIERS: Array<{ slug: string; icon: string; name: string }> = [
  { slug: "lock", icon: "🔒", name: "Lock" },
  { slug: "strong", icon: "💪", name: "Strong" },
  { slug: "value", icon: "💎", name: "Value" },
  { slug: "coup_de_coeur", icon: "❤️", name: "Coup de cœur" },
];


interface Props {
  locale: string;
}


export default function HistoriqueClient({ locale }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const [picks, setPicks] = useState<AIPickRow[]>([]);
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
  // V3.5 : filtre tier
  const [tier, setTier] = useState("all");
  // Module Buteurs supprime : on filtre toujours sur classic.
  const pickType = "classic";

  useEffect(() => {
    setOffset(0);
    fetchPicks(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    statusFilter,
    filterMode,
    selectedMonth,
    selectedYear,
    dateFrom,
    dateTo,
    sport,
    tier,
  ]);

  async function fetchPicks(fromOffset = 0, reset = false) {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const params = new URLSearchParams({
      limit: String(BATCH),
      offset: String(fromOffset),
    });

    if (statusFilter !== "all") {
      params.set("status", statusFilter);
    }
    // ─────────────────────────────────────────────────────────────────
    // V3.5 BUG FIX :
    // Avant V3.5, quand statusFilter === "all", on envoyait
    // `exclude_pending=true` qui cachait TOUS les picks pending.
    // → Bug : les picks futurs (pending) n'apparaissaient JAMAIS dans
    //   l'historique alors qu'ils sont visibles sur la page live.
    // → Fix : on n'envoie plus exclude_pending. La page Historique
    //   affiche maintenant TOUS les picks (résolus + pending).
    // ─────────────────────────────────────────────────────────────────

    if (sport !== "all") params.set("sport", sport);
    if (tier !== "all") params.set("tier", tier);
    params.set("type", pickType);

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

  const selectClassName =
    "max-w-[110px] cursor-pointer truncate rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:max-w-none sm:px-4 sm:py-2 sm:text-xs";

  return (
    <main className="mx-auto max-w-2xl px-4 pb-4">
      {/* Filters */}
      <div className="mt-4 text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {/* Filtre dates */}
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
            className={selectClassName}
          >
            <option value="all">{isMobile ? "Dates" : "Toutes les dates"}</option>
            <option value="custom">Dates personnalisées</option>
          </select>

          {/* Filtre sport */}
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className={selectClassName}
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

          {/* V3.5 : Filtre tier */}
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className={selectClassName}
          >
            <option value="all">{isMobile ? "Tier" : "Tous les tiers"}</option>
            {AI_TIERS.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>

          {/* Filtre résultats */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClassName}
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
          <p className="mt-1 text-xs text-neutral-400">
            Essayez de réduire vos filtres pour élargir la recherche
          </p>
        </div>
      ) : (
        <>
          {/* Compteur "X / Y picks" */}
          <div className="mt-4 text-center text-xs text-neutral-500">
            {picks.length} / {total}{" "}
            {total > 1 ? "pronostics" : "pronostic"}
          </div>

          <div className="mt-3 space-y-3">
            {picks.map((aiPick) => (
              <AiPickCard
                key={aiPick.id}
                pick={adaptAiPickToCardData(aiPick, locale)}
              />
            ))}
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
  );
}