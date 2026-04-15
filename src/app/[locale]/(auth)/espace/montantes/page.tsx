// src/app/[locale]/(auth)/espace/montantes/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

// ============================================================
// Types
// ============================================================

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

// ============================================================
// Main Page
// ============================================================

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
  const [selectedMontante, setSelectedMontante] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [mRes, sRes, bRes] = await Promise.all([
      fetch("/api/montantes").then((r) => r.json()),
      fetch("/api/montantes?action=stats").then((r) => r.json()),
      fetch("/api/montantes?action=bankroll").then((r) => r.json()),
    ]);
    setMontantes(mRes.montantes || []);
    setStats(sRes);
    setBankroll(bRes.bankroll);
    setBankrollLogs(bRes.logs || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = montantes.filter((m) => filter === "all" || m.status === filter);

  if (selectedMontante) {
    return (
      <MontanteDetail
        montanteId={selectedMontante}
        onBack={() => { setSelectedMontante(null); fetchAll(); }}
        locale={locale}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">📈 GESTIONNAIRE DE MONTANTES</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Mes Montantes</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/40">
            Créez, suivez et analysez vos stratégies de progression de mises
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-neutral-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <span className="text-sm">Chargement...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Bankroll bar */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-500">💰 Bankroll :</span>
                <span className="text-lg font-extrabold text-neutral-900">
                  {bankroll ? `${parseFloat(String(bankroll.balance)).toFixed(2)}€` : "—"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBankroll(true)}
                  className="cursor-pointer rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-300"
                >
                  Gérer
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                >
                  + Nouvelle montante
                </button>
              </div>
            </div>

            {/* Stats cards */}
            {stats && stats.total > 0 && (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="En cours" value={stats.active} color="text-blue-600" bg="bg-blue-50" />
                <StatCard label="Réussies" value={stats.won} color="text-emerald-600" bg="bg-emerald-50" />
                <StatCard label="Échouées" value={stats.lost} color="text-red-500" bg="bg-red-50" />
                <StatCard label="Taux réussite" value={`${stats.winRate}%`} color="text-amber-600" bg="bg-amber-50" />
                <StatCard label="Profit total" value={`${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(2)}€`} color={stats.totalProfit >= 0 ? "text-emerald-600" : "text-red-500"} bg="bg-neutral-50" />
                <StatCard label="Meilleur gain" value={`+${stats.bestProfit.toFixed(2)}€`} color="text-emerald-600" bg="bg-neutral-50" />
                <StatCard label="Étape moy. échec" value={stats.avgFailStep || "—"} color="text-neutral-600" bg="bg-neutral-50" />
                <StatCard label="Total créées" value={stats.total} color="text-neutral-600" bg="bg-neutral-50" />
              </div>
            )}

            {/* Filter */}
            <div className="mb-4 flex gap-1">
              {(["all", "active", "won", "lost"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    filter === f ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  }`}
                >
                  {f === "all" ? "Toutes" : f === "active" ? "En cours" : f === "won" ? "Réussies" : "Échouées"}
                </button>
              ))}
            </div>

            {/* Montantes list */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-neutral-500 text-sm">Aucune montante pour le moment</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="cursor-pointer mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Créer ma première montante
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((m) => (
                  <MontanteCard
                    key={m.id}
                    montante={m}
                    onClick={() => setSelectedMontante(m.id)}
                    onDelete={async () => {
                      if (!confirm("Supprimer cette montante ?")) return;
                      await fetch(`/api/montantes?id=${m.id}`, { method: "DELETE" });
                      fetchAll();
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchAll(); }}
          bankrollBalance={bankroll ? parseFloat(String(bankroll.balance)) : 0}
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
  );
}

// ============================================================
// Stat Card
// ============================================================

function StatCard({ label, value, color, bg }: { label: string; value: any; color: string; bg: string }) {
  return (
    <div className={`rounded-xl border border-neutral-200 ${bg} px-3 py-3 text-center`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-lg font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

// ============================================================
// Montante Card (list item)
// ============================================================

function MontanteCard({ montante: m, onClick, onDelete }: { montante: Montante; onClick: () => void; onDelete: () => void }) {
  const progress = m.total_steps > 0 ? (m.current_step / m.total_steps) * 100 : 0;
  const statusStyles = {
    active: { badge: "bg-blue-100 text-blue-700", bar: "bg-blue-500" },
    won: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
    lost: { badge: "bg-red-100 text-red-700", bar: "bg-red-500" },
  };
  const style = statusStyles[m.status];

  return (
    <div
      onClick={onClick}
      className="cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-neutral-300 hover:shadow-sm"
    >
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-neutral-900 truncate">{m.name}</h3>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${style.badge}`}>
              {m.status === "active" ? "En cours" : m.status === "won" ? "Réussie ✓" : "Échouée ✗"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-400">
            <span>Mise: {m.initial_stake}€</span>
            {m.target_amount && <span>Objectif: {m.target_amount}€</span>}
            <span>Étapes: {m.current_step}</span>
            {m.status !== "active" && (
              <span className={m.profit >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {m.profit >= 0 ? "+" : ""}{m.profit.toFixed(2)}€
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="cursor-pointer shrink-0 rounded-lg p-2 text-neutral-400 transition hover:bg-red-50 hover:text-red-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-neutral-100">
        <div
          className={`h-full transition-all duration-700 ease-out ${style.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Create Modal
// ============================================================

function CreateModal({ onClose, onCreated, bankrollBalance }: { onClose: () => void; onCreated: () => void; bankrollBalance: number }) {
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
    if (target > 0 && target <= stake) return setError("L'objectif doit être supérieur à la mise");

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
    if (data.error) { setError(data.error); setSaving(false); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-neutral-900">Nouvelle montante</h2>
          <button onClick={onClose} className="cursor-pointer text-neutral-400 hover:text-neutral-600">✕</button>
        </div>

        {/* Name */}
        <input
          type="text"
          placeholder="Nom (ex: Montante Ligue 1)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
        />

        {/* Stake mode */}
        <p className="mb-1.5 text-xs font-semibold text-neutral-500">Calcul des mises</p>
        <div className="mb-3 flex gap-2">
          {(["auto", "manuel"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setStakeMode(m)}
              className={`cursor-pointer flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                stakeMode === m ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-200 text-neutral-500"
              }`}
            >
              {m === "auto" ? "⚡ Auto (tout réinvestir)" : "✏️ Manuel"}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-neutral-500">Mise initiale (€)</label>
            <input
              type="number"
              value={initialStake}
              onChange={(e) => setInitialStake(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="100"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-neutral-500">Objectif (€) <span className="text-neutral-400 font-normal">optionnel</span></label>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder="800"
            />
          </div>
        </div>

        <p className="mb-3 text-[10px] text-neutral-400 text-center">
          Bankroll disponible : {bankrollBalance.toFixed(2)}€
          {target > 0 && <span className="ml-1">· Objectif : {target}€</span>}
        </p>

        {error && <p className="mb-3 text-center text-xs text-red-500">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={saving}
          className="cursor-pointer w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer la montante"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Bankroll Modal
// ============================================================

function BankrollModal({ bankroll, logs, onClose, onUpdate }: { bankroll: any; logs: BankrollLog[]; onClose: () => void; onUpdate: () => void }) {
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"deposit" | "withdrawal">("deposit");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    setSaving(true);
    const isInit = !bankroll || parseFloat(String(bankroll.balance)) === 0;
    await fetch("/api/montantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: isInit && action === "deposit" ? "bankroll_init" : `bankroll_${action}`,
        amount: val,
      }),
    });
    setAmount("");
    setSaving(false);
    onUpdate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-neutral-900">💰 Bankroll Montantes</h2>
          <button onClick={onClose} className="cursor-pointer text-neutral-400 hover:text-neutral-600">✕</button>
        </div>

        <div className="mb-4 text-center">
          <p className="text-3xl font-extrabold text-neutral-900">
            {bankroll ? parseFloat(String(bankroll.balance)).toFixed(2) : "0.00"}€
          </p>
          <p className="text-xs text-neutral-400 mt-1">Solde actuel</p>
        </div>

        {/* Deposit/Withdrawal */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setAction("deposit")}
            className={`cursor-pointer flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              action === "deposit" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-200 text-neutral-500"
            }`}
          >
            ➕ Dépôt
          </button>
          <button
            onClick={() => setAction("withdrawal")}
            className={`cursor-pointer flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              action === "withdrawal" ? "border-red-400 bg-red-50 text-red-600" : "border-neutral-200 text-neutral-500"
            }`}
          >
            ➖ Retrait
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Montant (€)"
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "..." : "OK"}
          </button>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-neutral-500 mb-2">Historique</p>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                  <div>
                    <span className={log.amount >= 0 ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                      {log.amount >= 0 ? "+" : ""}{parseFloat(String(log.amount)).toFixed(2)}€
                    </span>
                    <span className="ml-2 text-neutral-400">{log.note}</span>
                  </div>
                  <span className="text-neutral-400 text-[10px]">
                    {new Date(log.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reset all */}
        <div className="mt-4 pt-4 border-t border-neutral-200">
          <button
            onClick={async () => {
              if (!confirm("⚠️ Tout réinitialiser ?\n\nCela supprimera TOUTES vos montantes, l'historique et remettra la bankroll à 0€.\n\nCette action est irréversible.")) return;
              if (!confirm("Êtes-vous vraiment sûr ? Toutes les données seront perdues.")) return;
              await fetch("/api/montantes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reset_all" }),
              });
              onUpdate();
              onClose();
            }}
            className="cursor-pointer w-full rounded-lg border border-red-200 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-50"
          >
            🗑️ Tout réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}
// ============================================================

function MontanteDetail({ montanteId, onBack, locale }: { montanteId: string; onBack: () => void; locale: string }) {
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

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function resolveStep(stepId: string, result: "won" | "lost") {
    const res = await fetch("/api/montantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_step", step_id: stepId, result }),
    });
    const data = await res.json();
    if (data.status === "won") {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 3000);
    }
    fetchDetail();
  }

  if (loading || !montante) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const currentGain = steps.filter((s) => s.result === "won").reduce((sum, s) => sum + (s.actual_gain || 0), 0);
  const pendingStep = steps.find((s) => s.result === "pending");
  const canAddStep = montante.status === "active" && !pendingStep;

  return (
    <div className="min-h-screen bg-white">
      {/* Celebration overlay */}
      {celebrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-bounce">
            <p className="text-6xl">🎉</p>
            <p className="mt-2 text-2xl font-extrabold text-emerald-600">MONTANTE RÉUSSIE !</p>
            <p className="text-lg text-neutral-500">+{montante.profit?.toFixed(2)}€</p>
          </div>
          {/* Confetti particles */}
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-10%`,
                  width: `${6 + Math.random() * 8}px`,
                  height: `${6 + Math.random() * 8}px`,
                  backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"][Math.floor(Math.random() * 5)],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti { animation: confetti 3s ease-out forwards; }
      `}</style>

      {/* Header */}
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <button onClick={onBack} className="cursor-pointer rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-neutral-900 truncate">{montante.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                montante.status === "active" ? "bg-blue-100 text-blue-700" :
                montante.status === "won" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              }`}>
                {montante.status === "active" ? "En cours" : montante.status === "won" ? "Réussie ✓" : "Échouée ✗"}
              </span>
              <span className="text-[10px] text-neutral-400">
                {montante.mode === "objectif" ? "Mode objectif" : "Mode libre"} · {montante.stake_mode === "auto" ? "Mises auto" : "Mises manuelles"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-center">
            <p className="text-[10px] font-semibold text-neutral-500">MISE INITIALE</p>
            <p className="mt-1 text-lg font-extrabold text-neutral-900">{montante.initial_stake}€</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-center">
            <p className="text-[10px] font-semibold text-neutral-500">GAIN ACTUEL</p>
            <p className={`mt-1 text-lg font-extrabold ${currentGain > 0 ? "text-emerald-600" : "text-neutral-400"}`}>
              {currentGain > 0 ? currentGain.toFixed(2) : "0.00"}€
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 text-center">
            <p className="text-[10px] font-semibold text-neutral-500">
              {montante.target_amount ? "OBJECTIF" : "ÉTAPES"}
            </p>
            <p className="mt-1 text-lg font-extrabold text-neutral-900">
              {montante.target_amount ? `${montante.target_amount}€` : montante.current_step}
            </p>
          </div>
        </div>

        {/* Progress bar — only show for objectif mode with target */}
        {montante.target_amount && montante.target_amount > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-neutral-500">Progression vers l'objectif</span>
              <span className="text-xs font-bold text-neutral-900">
                {currentGain > 0 ? currentGain.toFixed(0) : 0}€ / {montante.target_amount}€
              </span>
            </div>
            <div className="h-3 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  montante.status === "won" ? "bg-emerald-500" : montante.status === "lost" ? "bg-red-500" : "bg-blue-500"
                }`}
                style={{ width: `${Math.min(100, (currentGain / parseFloat(String(montante.target_amount))) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Step dots — based on actual steps played */}
        {steps.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-1.5 justify-center">
            {steps.map((step, i) => {
              const color = step.result === "won" ? "bg-emerald-500" : step.result === "lost" ? "bg-red-500" : "bg-blue-500 animate-pulse";
              return <div key={i} className={`h-3 w-3 rounded-full ${color} transition-all duration-300`} />;
            })}
          </div>
        )}

        {/* Steps list */}
        <div className="space-y-2 mb-6">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`rounded-xl border px-4 py-3 transition ${
                step.result === "won" ? "border-emerald-200 bg-emerald-50/50" :
                step.result === "lost" ? "border-red-200 bg-red-50/50" :
                step.result === "pending" ? "border-blue-200 bg-blue-50/30" : "border-neutral-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  step.result === "won" ? "bg-emerald-500" : step.result === "lost" ? "bg-red-500" : "bg-blue-500"
                }`}>
                  {step.step_number}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] font-semibold text-neutral-400 uppercase">Cote</p>
                    <p className="text-sm font-bold text-neutral-900">{step.odds}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-neutral-400 uppercase">Mise</p>
                    <p className="text-sm font-bold text-neutral-900">{parseFloat(String(step.stake)).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-neutral-400 uppercase">Gain</p>
                    <p className={`text-sm font-bold ${step.result === "won" ? "text-emerald-600" : step.result === "lost" ? "text-red-500" : "text-neutral-900"}`}>
                      {step.result === "won" ? parseFloat(String(step.actual_gain)).toFixed(2) : parseFloat(String(step.potential_gain)).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  {step.result === "won" && <span className="text-emerald-500 text-lg">✓</span>}
                  {step.result === "lost" && <span className="text-red-500 text-lg">✗</span>}
                  {step.result === "pending" && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => resolveStep(step.id, "won")}
                        className="cursor-pointer rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-emerald-600"
                      >
                        Gagné
                      </button>
                      <button
                        onClick={() => resolveStep(step.id, "lost")}
                        className="cursor-pointer rounded-lg bg-red-500 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-red-600"
                      >
                        Perdu
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {step.description && (
                <p className="mt-1.5 text-[11px] text-neutral-400 pl-11">{step.description}</p>
              )}
            </div>
          ))}
        </div>

        {/* Add step button */}
        {canAddStep && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddStep(true)}
              className="cursor-pointer flex-1 rounded-xl border-2 border-dashed border-neutral-300 py-4 text-sm font-semibold text-neutral-500 transition hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50"
            >
              + Ajouter l'étape {montante.current_step + 1}
            </button>
            {currentGain > 0 && !pendingStep && (
              <button
                onClick={async () => {
                  if (!confirm(`Encaisser ${currentGain.toFixed(2)}€ et terminer la montante ?`)) return;
                  await fetch("/api/montantes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "cash_out", montante_id: montante.id }),
                  });
                  setCelebrating(true);
                  setTimeout(() => setCelebrating(false), 3000);
                  fetchDetail();
                }}
                className="cursor-pointer rounded-xl bg-amber-500 px-6 py-4 text-sm font-bold text-white transition hover:bg-amber-600"
              >
                💰 Encaisser
              </button>
            )}
          </div>
        )}

        {/* Add step modal */}
        {showAddStep && (
          <AddStepModal
            montante={montante}
            lastStep={steps[steps.length - 1]}
            onClose={() => setShowAddStep(false)}
            onAdded={() => { setShowAddStep(false); fetchDetail(); }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Add Step Modal
// ============================================================

function AddStepModal({ montante, lastStep, onClose, onAdded }: {
  montante: Montante; lastStep?: Step; onClose: () => void; onAdded: () => void;
}) {
  const [odds, setOdds] = useState("");
  const [manualStake, setManualStake] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const oddsVal = parseFloat(odds) || 0;
  const isFirstStep = montante.current_step === 0;
  const autoStake = isFirstStep
    ? montante.initial_stake
    : lastStep?.actual_gain || montante.initial_stake;
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
    if (data.error) { setError(data.error); setSaving(false); return; }
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-neutral-900">Étape {montante.current_step + 1}</h2>
          <button onClick={onClose} className="cursor-pointer text-neutral-400 hover:text-neutral-600">✕</button>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-neutral-500">Cote du pari</label>
          <input
            type="number"
            step="0.01"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            className="mt-1 mb-3 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            placeholder="1.52"
            autoFocus
          />
        </div>

        {montante.stake_mode === "manuel" && (
          <div>
            <label className="text-[10px] font-semibold text-neutral-500">Mise (€)</label>
            <input
              type="number"
              value={manualStake}
              onChange={(e) => setManualStake(e.target.value)}
              className="mt-1 mb-3 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
              placeholder={String(autoStake)}
            />
          </div>
        )}

        <div>
          <label className="text-[10px] font-semibold text-neutral-500">Match / Description (optionnel)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 mb-4 w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500"
            placeholder="PSG vs Marseille"
          />
        </div>

        {/* Preview */}
        {oddsVal > 1 && (
          <div className="mb-4 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <p className="text-neutral-400">Mise</p>
              <p className="font-bold text-neutral-900">{stake.toFixed(2)}€</p>
            </div>
            <div>
              <p className="text-neutral-400">Cote</p>
              <p className="font-bold text-neutral-900">{oddsVal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-neutral-400">Gain potentiel</p>
              <p className="font-bold text-emerald-600">{potentialGain.toFixed(2)}€</p>
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-center text-xs text-red-500">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={saving}
          className="cursor-pointer w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Ajout..." : "Ajouter l'étape"}
        </button>
      </div>
    </div>
  );
}