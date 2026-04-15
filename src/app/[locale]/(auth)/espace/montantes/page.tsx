// src/app/[locale]/(auth)/espace/montantes/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Montante = {
  id: string;
  name: string;
  mode: "objectif" | "libre";
  stake_mode: "auto" | "manuel";
  initial_stake: number;
  target_amount: number | null;
  total_steps: number;
  current_step: number;
  status: "active" | "won" | "lost";
  profit: number;
  avg_odds_needed: number | null;
  created_at: string;
};

type Step = {
  id: string;
  montante_id: string;
  step_number: number;
  odds: number;
  stake: number;
  potential_gain: number;
  actual_gain: number | null;
  description: string | null;
  result: "pending" | "won" | "lost";
  completed_at: string | null;
};

type Stats = {
  total: number;
  active: number;
  won: number;
  lost: number;
  totalProfit: number;
  winRate: number;
  avgFailStep: number;
  bestProfit: number;
};

type BankrollLog = {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  note: string;
  created_at: string;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Global Styles
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const GLOBAL_STYLES = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes confettiFall {
    0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }
  @keyframes pulseRing {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
  }
  @keyframes shimmerSlide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.5s ease-out forwards;
    opacity: 0;
  }
  .animate-confetti {
    animation: confettiFall 3s ease-out forwards;
  }
  .animate-pulse-ring {
    animation: pulseRing 2s ease-in-out infinite;
  }
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function MontantesPage() {
  const locale = useLocale();
  const { user } = useAuth();

  const [montantes, setMontantes] = useState<Montante[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [bankroll, setBankroll] = useState<{ balance: number } | null>(null);
  const [bankrollLogs, setBankrollLogs] = useState<BankrollLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "won" | "lost">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showBankroll, setShowBankroll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [montantesRes, statsRes, bankrollRes] = await Promise.all([
        fetch("/api/montantes").then((r) => r.json()),
        fetch("/api/montantes?action=stats").then((r) => r.json()),
        fetch("/api/montantes?action=bankroll").then((r) => r.json()),
      ]);
      setMontantes(montantesRes.montantes || []);
      setStats(statsRes);
      setBankroll(bankrollRes.bankroll);
      setBankrollLogs(bankrollRes.logs || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mounted) fetchAll();
  }, [mounted, fetchAll]);

  // SSR shell
  if (!mounted) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-44 bg-neutral-900" />
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedId) {
    return (
      <MontanteDetailView
        montanteId={selectedId}
        onBack={() => {
          setSelectedId(null);
          fetchAll();
        }}
      />
    );
  }

  const filtered = montantes.filter((m) => filter === "all" || m.status === filter);
  const balance = bankroll ? parseFloat(String(bankroll.balance)) : 0;

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div className="min-h-screen bg-white">

        {/* ── Dark header block ── */}
        <div className="bg-neutral-900">
          <div className="mx-auto max-w-5xl px-4 pt-8 pb-6 sm:pt-10 sm:pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-400">
                  Gestionnaire
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                  Mes Montantes
                </h1>
              </div>
              {/* Bankroll button */}
              <button
                onClick={() => setShowBankroll(true)}
                className="cursor-pointer flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 px-5 py-3 transition hover:bg-white/10 hover:border-emerald-500/30"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">
                  💰
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white">
                    Bankroll
                  </p>
                  <p className="text-xl font-extrabold text-white tabular-nums">
                    {balance.toFixed(2)}€
                  </p>
                </div>
                <svg className="h-4 w-4 text-white/20 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Stats row inside dark block */}
            {stats && stats.total > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <DarkStatCard label="En cours" value={stats.active} accent="text-blue-400" />
                <DarkStatCard label="Réussies" value={stats.won} accent="text-emerald-400" />
                <DarkStatCard label="Taux" value={`${stats.winRate}%`} accent="text-amber-400" />
                <DarkStatCard
                  label="Profit"
                  value={`${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(0)}€`}
                  accent={stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Content on white ── */}
        <div className="mx-auto max-w-5xl px-4 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
                  {(["all", "active", "won", "lost"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                        filter === f
                          ? "bg-neutral-900 text-white shadow-md"
                          : "text-neutral-400 hover:text-neutral-600"
                      }`}
                    >
                      {f === "all" ? "Toutes" : f === "active" ? "En cours" : f === "won" ? "Réussies" : "Échouées"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCreate(true)}
                  className="cursor-pointer flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="text-lg leading-none">+</span>
                  Nouvelle montante
                </button>
              </div>

              {/* Empty state */}
              {filtered.length === 0 ? (
                <div className="rounded-3xl bg-neutral-900 py-16 text-center animate-fade-in-up">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                    <span className="text-4xl">📊</span>
                  </div>
                  <p className="text-white/50 text-sm">Aucune montante pour le moment</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="cursor-pointer mt-5 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
                  >
                    Créer ma première montante
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((montante, index) => (
                    <div
                      key={montante.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.06}s` }}
                    >
                      <MontanteListCard
                        montante={montante}
                        number={index + 1}
                        onClick={() => setSelectedId(montante.id)}
                        onDelete={async () => {
                          if (!confirm("Supprimer cette montante ?")) return;
                          await fetch(`/api/montantes?id=${montante.id}`, { method: "DELETE" });
                          fetchAll();
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modals */}
        {showCreate && (
          <CreateMontanteModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              fetchAll();
            }}
            bankrollBalance={balance}
          />
        )}
        {showBankroll && (
          <BankrollModal
            bankroll={bankroll}
            logs={bankrollLogs}
            onClose={() => setShowBankroll(false)}
            onUpdate={fetchAll}
          />
        )}
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dark Stat Card (inside dark header)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function DarkStatCard({ label, value, accent }: { label: string; value: any; accent: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider text-white">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Montante List Card
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MontanteListCard({
  montante,
  number,
  onClick,
  onDelete,
}: {
  montante: Montante;
  number: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const statusMap = {
    active: {
      label: "En cours",
      dotColor: "bg-blue-500",
      badgeBg: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      barColor: "bg-blue-500",
    },
    won: {
      label: "Réussie ✓",
      dotColor: "bg-emerald-500",
      badgeBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      barColor: "bg-emerald-500",
    },
    lost: {
      label: "Échouée ✗",
      dotColor: "bg-red-500",
      badgeBg: "bg-red-500/10 text-red-500 border-red-500/20",
      barColor: "bg-red-500",
    },
  };
  const config = statusMap[montante.status];

  return (
    <div
      onClick={onClick}
      className="cursor-pointer group relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 transition-all hover:border-neutral-700 hover:shadow-xl hover:shadow-black/20"
    >
      {/* Shimmer on active */}
      {montante.status === "active" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.4), transparent)",
              animation: "shimmerSlide 3s linear infinite",
            }}
          />
        </div>
      )}

      <div className="relative flex items-center gap-4 px-5 py-4">
        {/* Number */}
        <div className="relative">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${
            montante.status === "active" ? "bg-blue-500" : montante.status === "won" ? "bg-emerald-500" : "bg-red-500"
          } ${montante.status === "active" ? "animate-pulse-ring" : ""}`}>
            {number}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <h3 className="text-sm font-bold text-white truncate">{montante.name}</h3>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${config.badgeBg}`}>
              {config.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-500">
            <span>
              Mise <span className="font-semibold text-neutral-300">{montante.initial_stake}€</span>
            </span>
            {montante.target_amount && (
              <span>
                Obj. <span className="font-semibold text-neutral-300">{montante.target_amount}€</span>
              </span>
            )}
            <span>
              Paliers <span className="font-semibold text-neutral-300">{montante.current_step}</span>
            </span>
          </div>
        </div>

        {/* Profit / Benefit */}
        {montante.status !== "active" && (
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white">Bénéfice</p>
            <p className={`text-lg font-extrabold tabular-nums ${montante.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {montante.profit >= 0 ? "+" : ""}{montante.profit.toFixed(2)}€
            </p>
          </div>
        )}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer shrink-0 rounded-lg p-2 text-neutral-600 opacity-0 group-hover:opacity-100 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Bottom progress bar */}
      <div className="h-1 bg-neutral-800">
        <div
          className={`h-full ${config.barColor} transition-all duration-700`}
          style={{
            width:
              montante.status === "won" || montante.status === "lost"
                ? "100%"
                : `${Math.max(5, Math.min(90, montante.current_step * 18))}%`,
          }}
        />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Create Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CreateMontanteModal({
  onClose,
  onCreated,
  bankrollBalance,
}: {
  onClose: () => void;
  onCreated: () => void;
  bankrollBalance: number;
}) {
  const [stakeMode, setStakeMode] = useState<"auto" | "manuel">("auto");
  const [name, setName] = useState("");
  const [initialStake, setInitialStake] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stake = parseFloat(initialStake) || 0;
  const target = parseFloat(targetAmount) || 0;

  async function handleCreate() {
    if (stake <= 0) return setError("Mise initiale requise");
    if (stake > bankrollBalance) return setError("Bankroll insuffisante");
    if (target > 0 && target <= stake) return setError("L'objectif doit dépasser la mise");

    setSaving(true);
    setError("");
    const res = await fetch("/api/montantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: name || "Ma montante",
        mode: target > 0 ? "objectif" : "libre",
        stake_mode: stakeMode,
        initial_stake: stake,
        target_amount: target > 0 ? target : null,
        total_steps: 50,
      }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSaving(false);
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-white">Nouvelle montante</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-400 transition hover:bg-white/20">
            ✕
          </button>
        </div>

        {/* Name */}
        <input
          type="text"
          placeholder="Nom (ex: Montante Ligue 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-white placeholder-neutral-500 outline-none transition focus:border-emerald-500/50 focus:bg-white/10"
        />

        {/* Stake mode */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">Calcul des mises</p>
        <div className="mb-4 flex gap-2">
          {(["auto", "manuel"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setStakeMode(mode)}
              className={`cursor-pointer flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                stakeMode === mode
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 bg-white/5 text-neutral-500 hover:border-white/20"
              }`}
            >
              {mode === "auto" ? "⚡ Tout réinvestir" : "✏️ Manuel"}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-white">Mise initiale</label>
            <div className="mt-1 relative">
              <input
                type="number"
                value={initialStake}
                onChange={(e) => setInitialStake(e.target.value)}
                placeholder="100"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-8 text-sm font-bold text-white placeholder-neutral-600 outline-none transition focus:border-emerald-500/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-600">€</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Objectif <span className="text-neutral-600 font-normal lowercase">(optionnel)</span>
            </label>
            <div className="mt-1 relative">
              <input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="800"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-8 text-sm font-bold text-white placeholder-neutral-600 outline-none transition focus:border-emerald-500/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-600">€</span>
            </div>
          </div>
        </div>

        <p className="mb-5 text-center text-[10px] text-neutral-500">
          Bankroll disponible : <span className="font-bold text-neutral-300">{bankrollBalance.toFixed(2)}€</span>
        </p>

        {error && <p className="mb-3 text-center text-xs font-bold text-red-400">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={saving}
          className="cursor-pointer w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer la montante"}
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Bankroll Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BankrollModal({
  bankroll,
  logs,
  onClose,
  onUpdate,
}: {
  bankroll: any;
  logs: BankrollLog[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"deposit" | "withdrawal">("deposit");
  const [saving, setSaving] = useState(false);
  const balance = bankroll ? parseFloat(String(bankroll.balance)) : 0;

  async function handleSubmit() {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setSaving(true);
    try {
      const isInit = balance === 0 && action === "deposit";
      const res = await fetch("/api/montantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isInit ? "bankroll_init" : `bankroll_${action}`,
          amount: val,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Erreur");
      }
    } catch {
      alert("Erreur réseau");
    }
    setAmount("");
    setSaving(false);
    onUpdate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-white">💰 Bankroll</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-400 hover:bg-white/20">
            ✕
          </button>
        </div>

        {/* Balance display */}
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-900/30 to-neutral-800 border border-emerald-500/10 p-6 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/60">Solde actuel</p>
          <p className="mt-2 text-4xl font-extrabold text-white tabular-nums">{balance.toFixed(2)}€</p>
        </div>

        {/* Deposit / Withdrawal */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setAction("deposit")}
            className={`cursor-pointer flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
              action === "deposit"
                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 text-neutral-500"
            }`}
          >
            ➕ Dépôt
          </button>
          <button
            onClick={() => setAction("withdrawal")}
            className={`cursor-pointer flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
              action === "withdrawal"
                ? "border-red-500/50 bg-red-500/10 text-red-400"
                : "border-white/10 text-neutral-500"
            }`}
          >
            ➖ Retrait
          </button>
        </div>

        <div className="mb-5 flex gap-2">
          <div className="flex-1 relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Montant"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-8 text-sm font-bold text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-600">€</span>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? "..." : "OK"}
          </button>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">Historique</p>
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-extrabold tabular-nums ${parseFloat(String(log.amount)) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {parseFloat(String(log.amount)) >= 0 ? "+" : ""}
                      {parseFloat(String(log.amount)).toFixed(2)}€
                    </span>
                    <span className="text-[10px] text-neutral-500 truncate max-w-[150px]">{log.note}</span>
                  </div>
                  <span className="text-[9px] text-neutral-600">
                    {new Date(log.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reset */}
        <button
          onClick={async () => {
            if (!confirm("⚠️ Tout réinitialiser ?\n\nAction irréversible.")) return;
            if (!confirm("Vraiment sûr ?")) return;
            await fetch("/api/montantes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "reset_all" }),
            });
            onUpdate();
            onClose();
          }}
          className="cursor-pointer w-full rounded-xl border border-red-500/20 py-2.5 text-xs font-semibold text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400"
        >
          🗑️ Tout réinitialiser
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Montante Detail View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MontanteDetailView({
  montanteId,
  onBack,
}: {
  montanteId: string;
  onBack: () => void;
}) {
  const [montante, setMontante] = useState<Montante | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStep, setShowAddStep] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/montantes?action=detail&id=${montanteId}`);
    const data = await res.json();
    setMontante(data.montante);
    setSteps(data.steps || []);
    setLoading(false);
  }, [montanteId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function resolveStep(stepId: string, result: "won" | "lost") {
    const res = await fetch("/api/montantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_step", step_id: stepId, result }),
    });
    const data = await res.json();
    if (data.status === "won") {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 3500);
    }
    fetchDetail();
  }

  if (loading || !montante) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      </>
    );
  }

  // Calculations
  const lastWonStep = [...steps].reverse().find((s) => s.result === "won");
  const currentGain = lastWonStep?.actual_gain ? parseFloat(String(lastWonStep.actual_gain)) : 0;
  const benefit = currentGain > 0
    ? currentGain - parseFloat(String(montante.initial_stake))
    : montante.status === "lost"
    ? -parseFloat(String(montante.initial_stake))
    : 0;
  const pendingStep = steps.find((s) => s.result === "pending");
  const canAddStep = montante.status === "active" && !pendingStep;
  const targetProgress = montante.target_amount
    ? Math.min(100, (currentGain / parseFloat(String(montante.target_amount))) * 100)
    : 0;

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {/* Celebration overlay */}
      {celebrating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="text-center animate-fade-in-up">
            <p className="text-7xl">🎉</p>
            <p className="mt-3 text-3xl font-extrabold text-emerald-500">MONTANTE RÉUSSIE !</p>
            <p className="mt-1 text-xl text-neutral-400">+{benefit.toFixed(2)}€ de bénéfice</p>
          </div>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: "-5%",
                  width: `${6 + Math.random() * 10}px`,
                  height: `${6 + Math.random() * 10}px`,
                  backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899"][
                    Math.floor(Math.random() * 6)
                  ],
                  animationDelay: `${Math.random() * 1.5}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-white">

        {/* ── Dark header with metrics ── */}
        <div className="bg-neutral-900">
          <div className="mx-auto max-w-5xl px-4 pt-6 pb-6">
            {/* Back + Title */}
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={onBack}
                className="cursor-pointer flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 text-center pr-9">
                <h1 className="text-xl font-extrabold text-white">{montante.name}</h1>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${
                      montante.status === "active"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : montante.status === "won"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}
                  >
                  {montante.status === "active" ? "En cours" : montante.status === "won" ? "Réussie ✓" : "Échouée ✗"}
                </span>
                <span className="text-[10px] text-neutral-400">
                  {montante.stake_mode === "auto" ? "Mises auto" : "Mises manuelles"}
                </span>
              </div>
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Mise initiale</p>
                <p className="mt-1 text-xl font-extrabold text-white tabular-nums">{montante.initial_stake}€</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Gain actuel</p>
                <p className={`mt-1 text-xl font-extrabold tabular-nums ${currentGain > 0 ? "text-emerald-400" : "text-neutral-600"}`}>
                  {currentGain > 0 ? `${currentGain.toFixed(2)}€` : "—"}
                </p>
              </div>
              <div
                className={`rounded-xl border px-4 py-3 text-center ${
                  benefit > 0
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : benefit < 0
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-white/5 border-white/5"
                }`}
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Bénéfice</p>
                <p
                  className={`mt-1 text-xl font-extrabold tabular-nums ${
                    benefit > 0 ? "text-emerald-400" : benefit < 0 ? "text-red-400" : "text-neutral-600"
                  }`}
                >
                  {benefit !== 0 ? `${benefit > 0 ? "+" : ""}${benefit.toFixed(2)}€` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">
                  {montante.target_amount ? "Objectif" : "Étapes"}
                </p>
                <p className="mt-1 text-xl font-extrabold text-white tabular-nums">
                  {montante.target_amount ? `${montante.target_amount}€` : montante.current_step}
                </p>
              </div>
            </div>

            {/* Progress bar (objectif mode) */}
            {montante.target_amount && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">Progression</span>
                  <span className="text-xs font-extrabold text-white tabular-nums">
                    {currentGain > 0 ? currentGain.toFixed(0) : 0}€ / {montante.target_amount}€
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      montante.status === "won"
                        ? "bg-emerald-500"
                        : montante.status === "lost"
                        ? "bg-red-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${targetProgress}%` }}
                  />
                </div>
                {/* Segmented dots */}
                <div className="mt-2 flex gap-1 justify-center">
                  {steps.map((step, idx) => (
                    <div
                      key={idx}
                      className={`h-2 w-2 rounded-full transition-all ${
                        step.result === "won"
                          ? "bg-emerald-400"
                          : step.result === "lost"
                          ? "bg-red-400"
                          : "bg-blue-400 animate-pulse"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Steps ── */}
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="space-y-2.5">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 0.07}s` }}
              >
                <div
                  className={`rounded-2xl overflow-hidden transition ${
                    step.result === "won"
                      ? "bg-neutral-900 ring-2 ring-emerald-500/40"
                      : step.result === "lost"
                      ? "bg-neutral-900 ring-2 ring-red-500/40"
                      : "bg-neutral-900 ring-1 ring-neutral-800"
                  } ${step.result === "pending" ? "animate-pulse-ring" : ""}`}
                >
                  {/* Description on top */}
                  {step.description && (
                    <div className="border-b border-white/5 px-5 py-2">
                      <p className="text-xs text-neutral-300 text-center">{step.description}</p>
                    </div>
                  )}

                  <div className="px-5 py-4">
                    {/* Main row: circle + data + status */}
                    <div className="flex items-center">
                      {/* Step number circle */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white ${
                          step.result === "won"
                            ? "bg-emerald-500"
                            : step.result === "lost"
                            ? "bg-red-500"
                            : "bg-neutral-700"
                        }`}
                      >
                        {step.step_number}
                      </div>

                      {/* Data columns */}
                      <div className="flex-1 grid grid-cols-3 ml-4 sm:ml-5">
                        <div className="text-center">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Cote</p>
                          <p className="mt-1 text-base sm:text-xl font-extrabold text-white tabular-nums">{step.odds}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Mise</p>
                          <p className="mt-1 text-base sm:text-xl font-extrabold text-white tabular-nums">
                            {parseFloat(String(step.stake)).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Gain</p>
                          <p
                            className={`mt-1 text-base sm:text-xl font-extrabold tabular-nums ${
                              step.result === "won"
                                ? "text-emerald-400"
                                : step.result === "lost"
                                ? "text-red-400"
                                : "text-white"
                            }`}
                          >
                            {step.result === "won"
                              ? parseFloat(String(step.actual_gain)).toFixed(2)
                              : parseFloat(String(step.potential_gain)).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Status icon (won/lost) — desktop only for pending */}
                      <div className="shrink-0 ml-3 sm:ml-4">
                        {step.result === "won" && (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                        {step.result === "lost" && (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                        )}
                        {/* Desktop buttons for pending */}
                        {step.result === "pending" && (
                          <div className="hidden sm:flex gap-2">
                            <button
                              onClick={() => resolveStep(step.id, "won")}
                              className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 hover:-translate-y-0.5"
                            >
                              Gagné ✓
                            </button>
                            <button
                              onClick={() => resolveStep(step.id, "lost")}
                              className="cursor-pointer rounded-xl bg-red-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-400 hover:-translate-y-0.5"
                            >
                              Perdu ✗
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile buttons for pending — full width below */}
                    {step.result === "pending" && (
                      <div className="flex gap-2 mt-3 sm:hidden">
                        <button
                          onClick={() => resolveStep(step.id, "won")}
                          className="cursor-pointer flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition active:scale-95"
                        >
                          Gagné ✓
                        </button>
                        <button
                          onClick={() => resolveStep(step.id, "lost")}
                          className="cursor-pointer flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition active:scale-95"
                        >
                          Perdu ✗
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          {canAddStep && (
            <div className="mt-4 flex gap-3 animate-fade-in-up" style={{ animationDelay: `${steps.length * 0.07 + 0.1}s` }}>
              <button
                onClick={() => setShowAddStep(true)}
                className="cursor-pointer flex-1 rounded-2xl border-2 border-dashed border-neutral-300 bg-white py-5 text-sm font-bold text-neutral-500 transition hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
              >
                + Ajouter le palier {montante.current_step + 1}
              </button>
              {currentGain > 0 && !pendingStep && (
                <button
                  onClick={async () => {
                    if (!confirm(`Encaisser ${currentGain.toFixed(2)}€ ?\nBénéfice : ${benefit >= 0 ? "+" : ""}${benefit.toFixed(2)}€`)) return;
                    const res = await fetch("/api/montantes", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "cash_out", montante_id: montante.id }),
                    });
                    if (res.ok) {
                      setCelebrating(true);
                      setTimeout(() => setCelebrating(false), 3500);
                    }
                    fetchDetail();
                  }}
                  className="cursor-pointer rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-8 py-5 text-sm font-extrabold text-white shadow-lg shadow-amber-500/25 transition hover:shadow-amber-500/40 hover:-translate-y-0.5"
                >
                  💰 Encaisser
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add Step Modal */}
        {showAddStep && (
          <AddStepModal
            montante={montante}
            lastStep={steps[steps.length - 1]}
            onClose={() => setShowAddStep(false)}
            onAdded={() => {
              setShowAddStep(false);
              fetchDetail();
            }}
          />
        )}
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Add Step Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AddStepModal({
  montante,
  lastStep,
  onClose,
  onAdded,
}: {
  montante: Montante;
  lastStep?: Step;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [odds, setOdds] = useState("");
  const [manualStake, setManualStake] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const oddsVal = parseFloat(odds) || 0;
  const isFirstStep = montante.current_step === 0;
  const autoStake = isFirstStep ? montante.initial_stake : (lastStep?.actual_gain || montante.initial_stake);
  const stake = montante.stake_mode === "auto" ? autoStake : (parseFloat(manualStake) || 0);
  const potentialGain = oddsVal > 0 ? Math.round(stake * oddsVal * 100) / 100 : 0;

  async function handleAdd() {
    if (oddsVal <= 1) return setError("Cote invalide (> 1.00)");
    if (montante.stake_mode === "manuel" && stake <= 0) return setError("Mise requise");

    setSaving(true);
    setError("");
    const res = await fetch("/api/montantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_step",
        montante_id: montante.id,
        odds: oddsVal,
        stake: montante.stake_mode === "manuel" ? stake : undefined,
        description: description || null,
      }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSaving(false);
      return;
    }
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-white">Palier {montante.current_step + 1}</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-400 hover:bg-white/20">
            ✕
          </button>
        </div>

        {/* Odds */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Cote du pari</label>
          <input
            type="number"
            step="0.01"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            autoFocus
            placeholder="1.85"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Manual stake */}
        {montante.stake_mode === "manuel" && (
          <div className="mb-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Mise (€)</label>
            <input
              type="number"
              value={manualStake}
              onChange={(e) => setManualStake(e.target.value)}
              placeholder={String(autoStake)}
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
            />
          </div>
        )}

        {/* Description */}
        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Match <span className="text-neutral-600 font-normal lowercase">(optionnel)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="PSG vs Marseille"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Preview */}
        {oddsVal > 1 && (
          <div className="mb-5 rounded-2xl bg-white/5 border border-white/10 p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">Mise</p>
              <p className="text-sm font-extrabold text-white tabular-nums">{stake.toFixed(2)}€</p>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">Cote</p>
              <p className="text-sm font-extrabold text-white tabular-nums">{oddsVal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">Gain</p>
              <p className="text-sm font-extrabold text-emerald-400 tabular-nums">{potentialGain.toFixed(2)}€</p>
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-center text-xs font-bold text-red-400">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={saving}
          className="cursor-pointer w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Ajout..." : "Ajouter le palier"}
        </button>
      </div>
    </div>
  );
}