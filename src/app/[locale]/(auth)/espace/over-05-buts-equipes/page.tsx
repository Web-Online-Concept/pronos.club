"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import OpportunityCard from "./OpportunityCard";

type Opportunity = {
  id: string;
  match_date: string;
  home_team_name: string;
  away_team_name: string;
  target_team_name: string;
  target_role: "home" | "away";
  opponent_team_name: string;
  stake_score: number;
  stake_situations: Array<{ type: string; detail: string; gap_points: number }>;
  target_intrinsic: number;
  opponent_intrinsic: number;
  target_form_score: number;
  opponent_fragility_score: number;
  total_score: number;
  badge: "green" | "orange" | "red";
  bertrand_decision: "play" | "skip" | "pending" | null;
  o05_leagues: { name: string; country: string } | null;
};

type ApiResponse = {
  date: string;
  total: number;
  opportunities: Opportunity[];
};

const BADGE_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: "green", label: "🟢 Vertes uniquement", color: "bg-emerald-600" },
  { value: "orange", label: "🟠 + Oranges", color: "bg-amber-600" },
  { value: "red", label: "🔴 + Rouges", color: "bg-red-600" },
  { value: "all", label: "📊 Toutes", color: "bg-neutral-700" },
];


export default function Over05ButsEquipesPage() {
  const locale = useLocale();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBadge, setFilterBadge] = useState<string>("green");
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchOpportunities();
  }, [filterBadge, filterDate]);

  async function fetchOpportunities() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        badge: filterBadge,
        date: filterDate,
      });
      const res = await fetch(`/api/over-05-buts-equipes/opportunities?${params}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const filteredOpportunities = (() => {
    if (!data?.opportunities) return [];
    if (filterBadge === "green") return data.opportunities.filter((o) => o.badge === "green");
    if (filterBadge === "orange")
      return data.opportunities.filter((o) => o.badge === "green" || o.badge === "orange");
    return data.opportunities;
  })();

  return (
    <main className="min-h-screen bg-neutral-50">
      {/* Hero */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-600">
                🔐 Outil privé · Détection live
              </p>
              <h1 className="mt-2 text-2xl font-black text-neutral-900 sm:text-3xl">
                Over 0.5 buts Equipes
              </h1>
              <p className="mt-2 text-sm text-neutral-600 max-w-2xl">
                Détection automatique d'opportunités de paris &quot;+0.5 but équipe&quot; à jouer en live à
                cote 1.50. Méthode Bertrand : enjeu sportif + niveau intrinsèque + 5 derniers matchs.
              </p>
            </div>
            <Link
              href={`/${locale}/espace/over-05-buts-equipes/historique`}
              className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
            >
              📊 Mon historique
            </Link>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 outline-none focus:border-emerald-500"
          />

          <div className="flex flex-wrap gap-2">
            {BADGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilterBadge(opt.value)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  filterBadge === opt.value
                    ? `${opt.color} text-white shadow-md`
                    : "border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {data && (
            <span className="ml-auto text-xs text-neutral-500">
              {filteredOpportunities.length} opportunité{filteredOpportunities.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Liste */}
        <div className="mt-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              ⚠️ Erreur : {error}
            </div>
          )}

          {!loading && !error && filteredOpportunities.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-neutral-300 bg-white py-20 text-center">
              <p className="text-4xl">🎯</p>
              <p className="mt-4 text-sm text-neutral-600">
                Aucune opportunité {filterBadge === "green" ? "verte" : ""} pour cette date.
              </p>
              <p className="mt-2 text-xs text-neutral-400">
                Le cron quotidien tourne à 6h Paris. Reviens demain matin.
              </p>
            </div>
          )}

          {!loading && !error && filteredOpportunities.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredOpportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}