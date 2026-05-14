"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

// ─── Types ───────────────────────────────────────────────────────

type League = {
  id: number;
  name: string;
  country: string;
  country_code: string;
};

type BetSummary = {
  bets_count: number;
  bets_played: number;
  bets_pending: number;
  bets_won: number;
  bets_lost: number;
  total_staked: number;
  total_profit: number;
  has_won: boolean;
  has_lost: boolean;
};

type AnalysisItem = {
  id: string;
  league_id: number;
  matchday_label: string | null;
  date_from: string;
  date_to: string;
  total_matches: number;
  matches_analyzed: number;
  matches_failed: number;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  league: League | null;
  bets: BetSummary;
};

type GlobalStats = {
  total_analyses: number;
  total_matches_analyzed: number;
  total_bets: number;
  total_bets_won: number;
  total_bets_lost: number;
  total_bets_pending: number;
  total_staked: number;
  total_profit: number;
  roi_percent: number;
  win_rate_percent: number;
};

type Filter = {
  league_id: number | null;
  period: "all" | "7d" | "30d" | "90d";
  bet_status: "all" | "with_bets" | "won_only" | "lost_only";
};


// ─── Page ────────────────────────────────────────────────────────

export default function HistoriquePage() {
  const locale = useLocale();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>({
    league_id: null,
    period: "all",
    bet_status: "all",
  });

  // Suppression : état du modal
  const [deleteModal, setDeleteModal] = useState<AnalysisItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Charger les championnats (pour le filtre dropdown) ───────
  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const res = await fetch("/api/over-05/leagues");
        if (res.ok) {
          const json = await res.json();
          setLeagues(json.leagues ?? []);
        }
      } catch {
        // ignore
      }
    };
    loadLeagues();
  }, []);

  // ─── Charger les analyses (avec filtres) ──────────────────────
  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter.league_id !== null) params.set("league_id", String(filter.league_id));
      if (filter.period !== "all") params.set("period", filter.period);
      if (filter.bet_status !== "all") params.set("bet_status", filter.bet_status);

      const res = await fetch(`/api/over-05/analyses?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setAnalyses(json.analyses ?? []);
      setStats(json.stats ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // ─── Suppression ──────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/over-05/analyses/${deleteModal.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      // Retirer localement et recharger les stats
      setDeleteModal(null);
      await reload();
    } catch (err) {
      alert(
        "Erreur de suppression : " +
          (err instanceof Error ? err.message : "Inconnue")
      );
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────
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

      {stats && <GlobalStatsSection stats={stats} />}

      <FilterSection filter={filter} setFilter={setFilter} leagues={leagues} />

      {/* Liste analyses */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-700">
          📊 Mes analyses
          {stats && stats.total_analyses > 0 && (
            <span className="ml-2 text-neutral-400">({stats.total_analyses})</span>
          )}
        </h2>

        {loading ? (
          <div className="rounded-xl border border-neutral-200 p-8 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">❌ {error}</p>
        ) : analyses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center">
            <p className="text-sm text-neutral-500">
              💡 {hasActiveFilter(filter)
                ? "Aucune analyse ne correspond à ces filtres"
                : "Tes analyses passées apparaîtront ici"}
            </p>
            {!hasActiveFilter(filter) && (
              <p className="mt-2 text-xs text-neutral-400">
                Lance ta première analyse depuis la page principale.
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {analyses.map((a) => (
              <AnalysisCard
                key={a.id}
                analysis={a}
                locale={locale}
                onDeleteClick={() => setDeleteModal(a)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmation suppression */}
      {deleteModal && (
        <DeleteConfirmModal
          analysis={deleteModal}
          deleting={deleting}
          onCancel={() => setDeleteModal(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </main>
  );
}


// ─── Modal de confirmation suppression ───────────────────────────

function DeleteConfirmModal({
  analysis,
  deleting,
  onCancel,
  onConfirm,
}: {
  analysis: AnalysisItem;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const hasBets = analysis.bets.bets_played > 0;
  const hasResolvedBets = analysis.bets.bets_won + analysis.bets.bets_lost > 0;

  // Si paris joués : on demande une confirmation supplémentaire (saisie "SUPPRIMER")
  const [extraConfirmText, setExtraConfirmText] = useState("");
  const canConfirm = !hasBets || extraConfirmText.trim().toUpperCase() === "SUPPRIMER";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-white/[0.06]"
        style={{ background: "linear-gradient(135deg, #1a1a1a 0%, #0a3d2a 100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-black text-white">
            🗑️ Supprimer cette analyse ?
          </h3>
          <p className="mt-2 text-sm text-white/70">
            <span className="font-bold text-white">
              {analysis.league?.name ?? "—"}
              {analysis.matchday_label && ` — ${analysis.matchday_label}`}
            </span>
            <br />
            <span className="text-xs text-white/40">
              {formatDate(analysis.created_at)} · {analysis.matches_analyzed}/{analysis.total_matches} matchs
            </span>
          </p>

          {/* Cas paris : avertissement */}
          {hasBets && (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
              <p className="font-bold text-yellow-300">⚠️ Cette analyse contient des paris</p>
              <p className="mt-1 text-xs text-yellow-200/80">
                {analysis.bets.bets_played} pari{analysis.bets.bets_played > 1 ? "s" : ""} joué{analysis.bets.bets_played > 1 ? "s" : ""}
                {hasResolvedBets && (
                  <>
                    {" "}({analysis.bets.bets_won} gagné{analysis.bets.bets_won > 1 ? "s" : ""}, {analysis.bets.bets_lost} perdu{analysis.bets.bets_lost > 1 ? "s" : ""})
                    {", "}
                    profit : <strong>{analysis.bets.total_profit >= 0 ? "+" : ""}{analysis.bets.total_profit.toFixed(2)}€</strong>
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-yellow-200/80">
                Supprimer cette analyse va aussi supprimer ces paris.
                Ton ROI global sera recalculé.
              </p>

              <div className="mt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-yellow-300/60">
                  Tape <span className="font-mono">SUPPRIMER</span> pour confirmer
                </label>
                <input
                  type="text"
                  value={extraConfirmText}
                  onChange={(e) => setExtraConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="mt-1 w-full rounded-lg border border-yellow-500/30 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500"
                  autoFocus
                />
              </div>
            </div>
          )}

          {!hasBets && (
            <p className="mt-4 text-xs text-white/40">
              La suppression est définitive. L&apos;analyse et ses {analysis.matches_analyzed} matchs analysés seront retirés de ton historique.
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting || !canConfirm}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? "Suppression..." : "🗑️ Supprimer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Stats globales ──────────────────────────────────────────────

function GlobalStatsSection({ stats }: { stats: GlobalStats }) {
  const profitClass = stats.total_profit >= 0 ? "text-emerald-300" : "text-red-300";
  const roiClass = stats.roi_percent >= 0 ? "text-emerald-300" : "text-red-300";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Analyses"
          value={stats.total_analyses.toString()}
          sub={`${stats.total_matches_analyzed} matchs`}
        />
        <StatCard
          label="Paris joués"
          value={stats.total_bets.toString()}
          sub={`${stats.total_bets_pending} en attente`}
        />
        <StatCard
          label="Gagnés / Perdus"
          value={`${stats.total_bets_won} / ${stats.total_bets_lost}`}
          color={stats.total_bets_won > stats.total_bets_lost ? "emerald" : "red"}
        />
        <StatCard
          label="Mises totales"
          value={`${stats.total_staked.toFixed(2)}€`}
          sub={stats.total_bets > 0 ? `${(stats.total_staked / stats.total_bets).toFixed(2)}€ / pari` : ""}
        />
      </div>

      {stats.total_bets > 0 && (
        <div
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Profit total</p>
              <p className={`mt-1 text-3xl font-black ${profitClass}`}>
                {stats.total_profit >= 0 ? "+" : ""}{stats.total_profit.toFixed(2)}€
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">ROI</p>
              <p className={`mt-1 text-3xl font-black ${roiClass}`}>
                {stats.roi_percent >= 0 ? "+" : ""}{stats.roi_percent.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">Taux de réussite</p>
              <p className="mt-1 text-3xl font-black text-white">
                {stats.win_rate_percent.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Filtres ─────────────────────────────────────────────────────

function FilterSection({
  filter,
  setFilter,
  leagues,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  leagues: League[];
}) {
  return (
    <div
      className="mt-6 overflow-hidden rounded-xl border border-white/[0.06] p-4"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/60">
        🔍 Filtres
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
            Championnat
          </label>
          <select
            value={filter.league_id ?? ""}
            onChange={(e) =>
              setFilter({
                ...filter,
                league_id: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          >
            <option value="" className="bg-neutral-900 text-white">— Tous —</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id} className="bg-neutral-900 text-white">
                {l.name} ({l.country})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
            Période
          </label>
          <select
            value={filter.period}
            onChange={(e) =>
              setFilter({ ...filter, period: e.target.value as Filter["period"] })
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          >
            <option value="all" className="bg-neutral-900 text-white">Tout</option>
            <option value="7d" className="bg-neutral-900 text-white">7 derniers jours</option>
            <option value="30d" className="bg-neutral-900 text-white">30 derniers jours</option>
            <option value="90d" className="bg-neutral-900 text-white">90 derniers jours</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-white/40">
            Statut paris
          </label>
          <select
            value={filter.bet_status}
            onChange={(e) =>
              setFilter({ ...filter, bet_status: e.target.value as Filter["bet_status"] })
            }
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          >
            <option value="all" className="bg-neutral-900 text-white">Toutes</option>
            <option value="with_bets" className="bg-neutral-900 text-white">Avec paris joués</option>
            <option value="won_only" className="bg-neutral-900 text-white">Au moins un pari gagné</option>
            <option value="lost_only" className="bg-neutral-900 text-white">Au moins un pari perdu</option>
          </select>
        </div>
      </div>

      {hasActiveFilter(filter) && (
        <button
          onClick={() => setFilter({ league_id: null, period: "all", bet_status: "all" })}
          className="mt-3 text-xs text-emerald-400 hover:text-emerald-300"
        >
          ✕ Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}


// ─── Card analyse (avec bouton supprimer) ────────────────────────

function AnalysisCard({
  analysis,
  locale,
  onDeleteClick,
}: {
  analysis: AnalysisItem;
  locale: string;
  onDeleteClick: () => void;
}) {
  const a = analysis;
  const hasBets = a.bets.bets_played > 0;
  const profitClass = a.bets.total_profit >= 0 ? "text-emerald-300" : "text-red-300";

  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] transition hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Lien cliquable principal (toute la zone sauf bouton) */}
        <Link
          href={`/${locale}/espace/over-05-buts-equipes/${a.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-white">
              {a.league?.name ?? "—"}
              {a.matchday_label && (
                <span className="ml-2 text-white/40">— {a.matchday_label}</span>
              )}
            </p>
            <StatusBadge status={a.status} />
          </div>
          <p className="mt-1 text-xs text-white/40">
            {formatDate(a.created_at)} · {a.matches_analyzed}/{a.total_matches} matchs
            {a.matches_failed > 0 && (
              <span className="ml-1 text-yellow-300">({a.matches_failed} en erreur)</span>
            )}
          </p>
        </Link>

        {/* Droite : bilan paris + bouton supprimer */}
        <div className="flex items-center gap-3 sm:items-start">
          {hasBets && (
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-2 sm:justify-end flex-wrap">
                <span className="text-xs text-white/60">
                  {a.bets.bets_played} paris
                </span>
                {a.bets.bets_won > 0 && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                    ✓ {a.bets.bets_won}
                  </span>
                )}
                {a.bets.bets_lost > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300">
                    ✗ {a.bets.bets_lost}
                  </span>
                )}
                {a.bets.bets_pending > 0 && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-300">
                    ⏳ {a.bets.bets_pending}
                  </span>
                )}
              </div>
              {(a.bets.bets_won > 0 || a.bets.bets_lost > 0) && (
                <p className={`mt-1 text-sm font-bold ${profitClass}`}>
                  {a.bets.total_profit >= 0 ? "+" : ""}{a.bets.total_profit.toFixed(2)}€
                </p>
              )}
            </div>
          )}

          {/* Bouton supprimer */}
          <button
            onClick={onDeleteClick}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            aria-label="Supprimer cette analyse"
            title="Supprimer cette analyse"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── UI helpers ──────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "✓ Terminée" },
    running:   { bg: "bg-yellow-500/20", text: "text-yellow-300", label: "⚙️ En cours" },
    pending:   { bg: "bg-white/10", text: "text-white/60", label: "⏳ En attente" },
    failed:    { bg: "bg-red-500/20", text: "text-red-300", label: "✗ Échec" },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "neutral" | "emerald" | "red";
}) {
  const colorClasses: Record<string, string> = {
    neutral: "text-white",
    emerald: "text-emerald-300",
    red: "text-red-300",
  };
  return (
    <div
      className="overflow-hidden rounded-xl border border-white/[0.06] p-3 text-center"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
    >
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 text-xl font-black ${colorClasses[color]}`}>{value}</p>
      {sub && <p className="mt-1 text-[10px] text-white/40">{sub}</p>}
    </div>
  );
}


// ─── Helpers ─────────────────────────────────────────────────────

function hasActiveFilter(filter: Filter): boolean {
  return (
    filter.league_id !== null ||
    filter.period !== "all" ||
    filter.bet_status !== "all"
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