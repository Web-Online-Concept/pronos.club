"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

// ─── Page ────────────────────────────────────────────────────────

export default function HistoriquePage() {
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pour l'instant on charge depuis l'endpoint /api/over-05/analyses (à créer)
  // mais on n'a pas d'endpoint list. On affiche un message d'attente fonctionnel.
  // → À enrichir en Phase 4.1 si besoin avec un vrai endpoint /analyses (list).

  const [analyses, setAnalyses] = useState<HistoryAnalysis[]>([]);
  const [bets, setBets] = useState<HistoryBet[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        // Tentative de chargement via une route à créer plus tard
        // Pour l'instant on simule avec un message vide
        setAnalyses([]);
        setBets([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ─── Bilan paris ────────────────────────────────────────────
  const stats = computeStats(bets);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <Link
        href={`/${locale}/espace/over-05-buts-equipes`}
        className="inline-flex items-center gap-2 text-sm text-neutral-600 transition hover:text-neutral-900"
      >
        ← Nouvelle analyse
      </Link>

      <div className="mt-4 mb-8 text-center">
        <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
          📚 Mon historique
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Toutes mes analyses et mes paris
        </p>
      </div>

      {/* Bilan paris */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Paris totaux" value={stats.total.toString()} />
        <StatCard label="Gagnés" value={stats.won.toString()} color="emerald" />
        <StatCard label="Perdus" value={stats.lost.toString()} color="red" />
        <StatCard
          label="Profit"
          value={`${stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(2)}€`}
          color={stats.profit >= 0 ? "emerald" : "red"}
        />
      </div>

      {/* ROI */}
      {stats.total > 0 && (
        <div
          className="mt-4 overflow-hidden rounded-xl border border-white/[0.06] p-4 text-center"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <p className="text-xs uppercase tracking-wider text-white/40">ROI</p>
          <p className={`text-3xl font-black ${stats.roi >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-white/40">
            Taux de réussite : <span className="font-bold text-white/80">{stats.winRate.toFixed(0)}%</span>
          </p>
        </div>
      )}

      {/* Liste des analyses */}
      <div className="mt-10">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-700">
          📊 Mes analyses
        </h2>

        {loading ? (
          <p className="text-center text-sm text-neutral-500">Chargement...</p>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">❌ {error}</p>
        ) : analyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
            <p className="text-sm text-neutral-500">
              💡 Tes analyses passées apparaîtront ici
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              Lance ta première analyse depuis la page principale.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {analyses.map((a) => (
              <Link
                key={a.id}
                href={`/${locale}/espace/over-05-buts-equipes/${a.id}`}
                className="overflow-hidden rounded-xl border border-white/[0.06] p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">
                      {a.league_name}
                      {a.matchday_label && (
                        <span className="ml-2 text-white/40">— {a.matchday_label}</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      {formatDate(a.created_at)} · {a.matches_analyzed}/{a.total_matches} matchs
                    </p>
                  </div>
                  <span className="text-emerald-400">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}


// ─── Types ───────────────────────────────────────────────────────

type HistoryAnalysis = {
  id: string;
  league_name: string;
  matchday_label: string | null;
  total_matches: number;
  matches_analyzed: number;
  created_at: string;
};

type HistoryBet = {
  id: string;
  played: boolean;
  bet_status: "pending" | "won" | "lost";
  profit: number | null;
};


// ─── Stats ───────────────────────────────────────────────────────

function computeStats(bets: HistoryBet[]) {
  const played = bets.filter((b) => b.played);
  const won = played.filter((b) => b.bet_status === "won").length;
  const lost = played.filter((b) => b.bet_status === "lost").length;
  const resolved = won + lost;
  const profit = played.reduce((sum, b) => sum + (b.profit ?? 0), 0);
  const totalStake = played.reduce((sum) => sum + 1, 0); // placeholder
  return {
    total: played.length,
    won,
    lost,
    profit,
    roi: totalStake > 0 ? (profit / totalStake) * 100 : 0,
    winRate: resolved > 0 ? (won / resolved) * 100 : 0,
  };
}


// ─── UI ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "neutral",
}: {
  label: string;
  value: string;
  color?: "neutral" | "emerald" | "red";
}) {
  const colorClasses: Record<string, string> = {
    neutral: "text-white",
    emerald: "text-emerald-300",
    red: "text-red-300",
  };
  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] p-4 text-center"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colorClasses[color]}`}>{value}</p>
    </div>
  );
}


function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}