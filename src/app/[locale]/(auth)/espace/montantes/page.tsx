// src/app/[locale]/(auth)/espace/montantes/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

// Types
type Montante = { id: string; name: string; mode: "objectif" | "libre"; stake_mode: "auto" | "manuel"; initial_stake: number; target_amount: number | null; total_steps: number; current_step: number; status: "active" | "won" | "lost"; profit: number; avg_odds_needed: number | null; created_at: string; };
type Step = { id: string; montante_id: string; step_number: number; odds: number; stake: number; potential_gain: number; actual_gain: number | null; description: string | null; result: "pending" | "won" | "lost"; completed_at: string | null; };
type Stats = { total: number; active: number; won: number; lost: number; totalProfit: number; winRate: number; avgFailStep: number; bestProfit: number; };
type BankrollLog = { id: string; type: string; amount: number; balance_after: number; note: string; created_at: string; };

// Animations
const STYLES = `
@keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes slideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
@keyframes pulseGlow { 0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,.3); } 50% { box-shadow:0 0 20px 4px rgba(16,185,129,.15); } }
@keyframes confettiFall { 0% { transform:translateY(0) rotate(0); opacity:1; } 100% { transform:translateY(100vh) rotate(720deg); opacity:0; } }
@keyframes countUp { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
@keyframes shimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
.af { animation:fadeUp .5s ease-out forwards; }
.as { animation:slideIn .4s ease-out forwards; }
.ag { animation:pulseGlow 2s ease-in-out infinite; }
.ac { animation:confettiFall 3s ease-out forwards; }
.au { animation:countUp .6s cubic-bezier(.34,1.56,.64,1) forwards; }
.sh { background:linear-gradient(90deg,transparent 0%,rgba(16,185,129,.05) 50%,transparent 100%); background-size:200% 100%; animation:shimmer 3s linear infinite; }
`;

export default function MontantesPage() {
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
      const [a, b, c] = await Promise.all([
        fetch("/api/montantes").then(r => r.json()),
        fetch("/api/montantes?action=stats").then(r => r.json()),
        fetch("/api/montantes?action=bankroll").then(r => r.json()),
      ]);
      setMontantes(a.montantes || []);
      setStats(b);
      setBankroll(c.bankroll);
      setBankrollLogs(c.logs || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (mounted) fetchAll(); }, [mounted, fetchAll]);

  if (!mounted) return <Shell />;
  if (selectedId) return <Detail id={selectedId} onBack={() => { setSelectedId(null); fetchAll(); }} />;

  const filtered = montantes.filter(m => filter === "all" || m.status === filter);
  const bal = bankroll ? parseFloat(String(bankroll.balance)) : 0;

  return (
    <>
      <style>{STYLES}</style>
      <div className="min-h-screen bg-neutral-50">
        {/* Header */}
        <section className="border-b border-emerald-900/50" style={{ background: "linear-gradient(135deg,#0a0a0a 0%,#062e1f 50%,#0a0a0a 100%)" }}>
          <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.3em] text-emerald-400/80">Gestionnaire</p>
                <h1 className="text-2xl font-extrabold text-white sm:text-3xl tracking-tight">Mes Montantes</h1>
              </div>
              <button onClick={() => setShowBankroll(true)} className="cursor-pointer group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-3 transition hover:border-emerald-500/30 hover:bg-white/10">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20"><span className="text-lg">💰</span></div>
                <div className="text-left">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">Bankroll</p>
                  <p className="text-lg font-extrabold text-white tabular-nums">{bal.toFixed(2)}€</p>
                </div>
                <svg className="h-4 w-4 text-white/30 group-hover:text-emerald-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-6">
          {loading ? <Spinner /> : (
            <>
              {stats && stats.total > 0 && (
                <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 af">
                  <GC label="En cours" value={stats.active} icon="🔄" accent="text-blue-600" />
                  <GC label="Réussies" value={stats.won} icon="✅" accent="text-emerald-600" />
                  <GC label="Taux" value={`${stats.winRate}%`} icon="🎯" accent="text-amber-600" />
                  <GC label="Profit" value={`${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(0)}€`} icon={stats.totalProfit >= 0 ? "📈" : "📉"} accent={stats.totalProfit >= 0 ? "text-emerald-600" : "text-red-500"} />
                </div>
              )}

              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 af" style={{ animationDelay: ".1s", opacity: 0 }}>
                <div className="flex gap-1 rounded-xl bg-white border border-neutral-200 p-1">
                  {(["all", "active", "won", "lost"] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${filter === f ? "bg-neutral-900 text-white shadow-sm" : "text-neutral-400 hover:text-neutral-600"}`}>
                      {f === "all" ? "Toutes" : f === "active" ? "En cours" : f === "won" ? "Réussies" : "Échouées"}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCreate(true)} className="cursor-pointer flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 hover:-translate-y-0.5">
                  <span className="text-base">+</span> Nouvelle montante
                </button>
              </div>

              {filtered.length === 0 ? (
                <div className="py-20 text-center af" style={{ animationDelay: ".2s", opacity: 0 }}>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100"><span className="text-3xl">📊</span></div>
                  <p className="text-neutral-500 text-sm">Aucune montante</p>
                  <button onClick={() => setShowCreate(true)} className="cursor-pointer mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">Créer ma première montante</button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filtered.map((m, i) => (
                    <div key={m.id} className="af" style={{ animationDelay: `${i * .05}s`, opacity: 0 }}>
                      <Card m={m} onClick={() => setSelectedId(m.id)} onDelete={async () => { if (!confirm("Supprimer ?")) return; await fetch(`/api/montantes?id=${m.id}`, { method: "DELETE" }); fetchAll(); }} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchAll(); }} bal={bal} />}
        {showBankroll && <BankrollModal bankroll={bankroll} logs={bankrollLogs} onClose={() => setShowBankroll(false)} onUpdate={fetchAll} />}
      </div>
    </>
  );
}

function Shell() {
  return <div className="min-h-screen bg-neutral-50"><div className="h-40" style={{ background: "linear-gradient(135deg,#0a0a0a 0%,#062e1f 50%,#0a0a0a 100%)" }} /><Spinner /></div>;
}
function Spinner() {
  return <div className="flex items-center justify-center py-20"><div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" /></div>;
}
function GC({ label, value, icon, accent }: { label: string; value: any; icon: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 transition hover:shadow-md hover:-translate-y-0.5">
      <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{label}</p><span className="text-sm">{icon}</span></div>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

// ── Card ──
function Card({ m, onClick, onDelete }: { m: Montante; onClick: () => void; onDelete: () => void }) {
  const cfg = { active: { label: "En cours", dot: "bg-blue-500", bg: "bg-blue-50 text-blue-700 border-blue-200", bar: "from-blue-500 to-blue-400" }, won: { label: "Réussie", dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "from-emerald-500 to-emerald-400" }, lost: { label: "Échouée", dot: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200", bar: "from-red-500 to-red-400" } }[m.status];
  return (
    <div onClick={onClick} className="cursor-pointer group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-neutral-300">
      {m.status === "active" && <div className="absolute inset-0 sh pointer-events-none" />}
      <div className="relative flex items-center gap-4 px-5 py-4">
        <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.status === "active" ? "bg-blue-100" : m.status === "won" ? "bg-emerald-100" : "bg-red-100"}`}>
          <div className={`h-3 w-3 rounded-full ${cfg.dot} ${m.status === "active" ? "animate-pulse" : ""}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5"><h3 className="text-sm font-bold text-neutral-900 truncate">{m.name}</h3><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${cfg.bg}`}>{cfg.label}</span></div>
          <div className="mt-1 flex items-center gap-4 text-[11px] text-neutral-400">
            <span>Mise <span className="font-semibold text-neutral-600">{m.initial_stake}€</span></span>
            {m.target_amount && <span>Objectif <span className="font-semibold text-neutral-600">{m.target_amount}€</span></span>}
            <span>Étapes <span className="font-semibold text-neutral-600">{m.current_step}</span></span>
          </div>
        </div>
        {m.status !== "active" && (
          <div className={`shrink-0 text-right ${m.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            <p className="text-[9px] font-semibold uppercase text-neutral-400">Bénéfice</p>
            <p className="text-base font-extrabold tabular-nums">{m.profit >= 0 ? "+" : ""}{m.profit.toFixed(2)}€</p>
          </div>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="cursor-pointer shrink-0 rounded-lg p-2 text-neutral-300 opacity-0 group-hover:opacity-100 transition hover:bg-red-50 hover:text-red-500">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
      <div className="h-1 bg-neutral-100"><div className={`h-full bg-gradient-to-r ${cfg.bar} transition-all duration-700`} style={{ width: m.status === "won" ? "100%" : m.status === "lost" ? "100%" : `${Math.min(90, m.current_step * 15)}%` }} /></div>
    </div>
  );
}

// ── Create Modal ──
function CreateModal({ onClose, onCreated, bal }: { onClose: () => void; onCreated: () => void; bal: number }) {
  const [sm, setSm] = useState<"auto" | "manuel">("auto");
  const [name, setName] = useState("");
  const [is, setIs] = useState("");
  const [ta, setTa] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stake = parseFloat(is) || 0;
  const target = parseFloat(ta) || 0;

  async function go() {
    if (stake <= 0) return setError("Mise initiale requise");
    if (stake > bal) return setError("Bankroll insuffisante");
    if (target > 0 && target <= stake) return setError("L'objectif doit dépasser la mise");
    setSaving(true); setError("");
    const r = await fetch("/api/montantes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name: name || "Ma montante", mode: target > 0 ? "objectif" : "libre", stake_mode: sm, initial_stake: stake, target_amount: target > 0 ? target : null, total_steps: 50 }) });
    const d = await r.json();
    if (d.error) { setError(d.error); setSaving(false); return; }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl af" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-neutral-900">Nouvelle montante</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 hover:bg-neutral-200">✕</button>
        </div>
        <input type="text" placeholder="Nom (ex: Montante Ligue 1)" value={name} onChange={e => setName(e.target.value)} className="mb-4 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10" />
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Calcul des mises</p>
        <div className="mb-4 flex gap-2">
          {(["auto", "manuel"] as const).map(m => (
            <button key={m} onClick={() => setSm(m)} className={`cursor-pointer flex-1 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition ${sm === m ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-100 bg-neutral-50 text-neutral-400"}`}>
              {m === "auto" ? "⚡ Tout réinvestir" : "✏️ Manuel"}
            </button>
          ))}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Mise initiale</label><div className="mt-1 relative"><input type="number" value={is} onChange={e => setIs(e.target.value)} placeholder="100" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 pr-8 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">€</span></div></div>
          <div><label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Objectif <span className="text-neutral-300 font-normal lowercase">(optionnel)</span></label><div className="mt-1 relative"><input type="number" value={ta} onChange={e => setTa(e.target.value)} placeholder="800" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 pr-8 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">€</span></div></div>
        </div>
        <p className="mb-5 text-center text-[10px] text-neutral-400">Bankroll : <span className="font-bold text-neutral-600">{bal.toFixed(2)}€</span></p>
        {error && <p className="mb-3 text-center text-xs font-semibold text-red-500">{error}</p>}
        <button onClick={go} disabled={saving} className="cursor-pointer w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50">{saving ? "Création..." : "Créer la montante"}</button>
      </div>
    </div>
  );
}

// ── Bankroll Modal ──
function BankrollModal({ bankroll, logs, onClose, onUpdate }: { bankroll: any; logs: BankrollLog[]; onClose: () => void; onUpdate: () => void }) {
  const [amt, setAmt] = useState("");
  const [act, setAct] = useState<"deposit" | "withdrawal">("deposit");
  const [saving, setSaving] = useState(false);
  const b = bankroll ? parseFloat(String(bankroll.balance)) : 0;

  async function go() {
    const v = parseFloat(amt); if (!v || v <= 0) return;
    setSaving(true);
    try {
      const init = b === 0 && act === "deposit";
      const r = await fetch("/api/montantes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: init ? "bankroll_init" : `bankroll_${act}`, amount: v }) });
      if (!r.ok) { const e = await r.json(); alert(e.error || "Erreur"); }
    } catch { alert("Erreur réseau"); }
    setAmt(""); setSaving(false); onUpdate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl af" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-neutral-900">💰 Bankroll</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 hover:bg-neutral-200">✕</button>
        </div>
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 p-5 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Solde actuel</p>
          <p className="mt-1 text-3xl font-extrabold text-white tabular-nums au">{b.toFixed(2)}€</p>
        </div>
        <div className="mb-3 flex gap-2">
          <button onClick={() => setAct("deposit")} className={`cursor-pointer flex-1 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition ${act === "deposit" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-neutral-100 text-neutral-400"}`}>➕ Dépôt</button>
          <button onClick={() => setAct("withdrawal")} className={`cursor-pointer flex-1 rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition ${act === "withdrawal" ? "border-red-400 bg-red-50 text-red-600" : "border-neutral-100 text-neutral-400"}`}>➖ Retrait</button>
        </div>
        <div className="mb-5 flex gap-2">
          <div className="flex-1 relative"><input type="number" value={amt} onChange={e => setAmt(e.target.value)} placeholder="Montant" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 pr-8 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">€</span></div>
          <button onClick={go} disabled={saving} className="cursor-pointer rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">{saving ? "..." : "OK"}</button>
        </div>
        {logs.length > 0 && (
          <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-2">Historique</p>
            <div className="space-y-1 max-h-[180px] overflow-y-auto">
              {logs.map(l => (
                <div key={l.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2">
                  <div className="flex items-center gap-2"><span className={`text-xs font-extrabold tabular-nums ${parseFloat(String(l.amount)) >= 0 ? "text-emerald-600" : "text-red-500"}`}>{parseFloat(String(l.amount)) >= 0 ? "+" : ""}{parseFloat(String(l.amount)).toFixed(2)}€</span><span className="text-[10px] text-neutral-400 truncate max-w-[160px]">{l.note}</span></div>
                  <span className="text-[9px] text-neutral-300">{new Date(l.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button onClick={async () => { if (!confirm("⚠️ Tout réinitialiser ?\n\nAction irréversible.")) return; if (!confirm("Vraiment sûr ?")) return; await fetch("/api/montantes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset_all" }) }); onUpdate(); onClose(); }}
          className="cursor-pointer w-full rounded-xl border border-red-200 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-50 hover:text-red-600">🗑️ Tout réinitialiser</button>
      </div>
    </div>
  );
}

// ── Detail View ──
function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const [m, setM] = useState<Montante | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [party, setParty] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/montantes?action=detail&id=${id}`);
    const d = await r.json();
    setM(d.montante); setSteps(d.steps || []); setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function resolve(stepId: string, result: "won" | "lost") {
    const r = await fetch("/api/montantes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve_step", step_id: stepId, result }) });
    const d = await r.json();
    if (d.status === "won") { setParty(true); setTimeout(() => setParty(false), 3500); }
    load();
  }

  if (loading || !m) return <><style>{STYLES}</style><Spinner /></>;

  const lastWon = [...steps].reverse().find(s => s.result === "won");
  const gain = lastWon?.actual_gain ? parseFloat(String(lastWon.actual_gain)) : 0;
  const benefit = gain > 0 ? gain - parseFloat(String(m.initial_stake)) : (m.status === "lost" ? -parseFloat(String(m.initial_stake)) : 0);
  const pending = steps.find(s => s.result === "pending");
  const canAdd = m.status === "active" && !pending;
  const tProg = m.target_amount ? Math.min(100, (gain / parseFloat(String(m.target_amount))) * 100) : 0;

  return (
    <>
      <style>{STYLES}</style>
      {party && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="text-center au"><p className="text-7xl">🎉</p><p className="mt-3 text-3xl font-extrabold text-emerald-600">MONTANTE RÉUSSIE !</p><p className="mt-1 text-xl text-neutral-500">+{benefit.toFixed(2)}€ de bénéfice</p></div>
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="absolute rounded-full ac" style={{ left: `${Math.random() * 100}%`, top: "-5%", width: `${6 + Math.random() * 10}px`, height: `${6 + Math.random() * 10}px`, backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899"][Math.floor(Math.random() * 6)], animationDelay: `${Math.random() * 1.5}s`, animationDuration: `${2 + Math.random() * 2}s` }} />
            ))}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-neutral-50">
        <div className="border-b border-neutral-200 bg-white px-4 py-4">
          <div className="mx-auto max-w-5xl flex items-center gap-3">
            <button onClick={onBack} className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 transition hover:bg-neutral-200"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg></button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-extrabold text-neutral-900 truncate">{m.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${m.status === "active" ? "bg-blue-50 text-blue-700 border-blue-200" : m.status === "won" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                  {m.status === "active" ? "En cours" : m.status === "won" ? "Réussie ✓" : "Échouée ✗"}
                </span>
                <span className="text-[10px] text-neutral-400">{m.stake_mode === "auto" ? "Mises auto" : "Mises manuelles"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-6">
          {/* Metrics */}
          <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 af">
            <MetricCard label="Mise initiale" value={`${m.initial_stake}€`} />
            <MetricCard label="Gain actuel" value={gain > 0 ? `${gain.toFixed(2)}€` : "—"} accent={gain > 0 ? "text-emerald-600" : undefined} />
            <MetricCard label="Bénéfice" value={benefit !== 0 ? `${benefit > 0 ? "+" : ""}${benefit.toFixed(2)}€` : "—"} accent={benefit > 0 ? "text-emerald-600" : benefit < 0 ? "text-red-500" : undefined} highlight={benefit > 0 ? "border-emerald-200 bg-emerald-50" : benefit < 0 ? "border-red-200 bg-red-50" : undefined} />
            <MetricCard label={m.target_amount ? "Objectif" : "Étapes"} value={m.target_amount ? `${m.target_amount}€` : String(m.current_step)} />
          </div>

          {/* Target bar */}
          {m.target_amount && (
            <div className="mb-6 af" style={{ animationDelay: ".1s", opacity: 0 }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Progression</span>
                <span className="text-xs font-extrabold text-neutral-900 tabular-nums">{gain > 0 ? gain.toFixed(0) : 0}€ / {m.target_amount}€</span>
              </div>
              <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${m.status === "won" ? "from-emerald-500 to-emerald-400" : m.status === "lost" ? "from-red-500 to-red-400" : "from-blue-500 to-blue-400"}`} style={{ width: `${tProg}%` }} />
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="mb-6 space-y-2">
            {steps.map((s, i) => (
              <div key={s.id} className={`as rounded-2xl border px-5 py-4 transition ${s.result === "won" ? "border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-white" : s.result === "lost" ? "border-red-200 bg-gradient-to-r from-red-50/80 to-white" : "border-blue-200 bg-gradient-to-r from-blue-50/50 to-white ag"}`} style={{ animationDelay: `${i * .08}s` }}>
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white ${s.result === "won" ? "bg-emerald-500" : s.result === "lost" ? "bg-red-500" : "bg-blue-500"}`}>{s.step_number}</div>
                  <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Cote</p><p className="text-base font-extrabold text-neutral-900 tabular-nums">{s.odds}</p></div>
                    <div><p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Mise</p><p className="text-base font-extrabold text-neutral-900 tabular-nums">{parseFloat(String(s.stake)).toFixed(2)}€</p></div>
                    <div><p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Gain</p><p className={`text-base font-extrabold tabular-nums ${s.result === "won" ? "text-emerald-600" : s.result === "lost" ? "text-red-500" : "text-neutral-900"}`}>{s.result === "won" ? parseFloat(String(s.actual_gain)).toFixed(2) : parseFloat(String(s.potential_gain)).toFixed(2)}€</p></div>
                  </div>
                  <div className="shrink-0">
                    {s.result === "won" && <span className="text-2xl">✅</span>}
                    {s.result === "lost" && <span className="text-2xl">❌</span>}
                    {s.result === "pending" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => resolve(s.id, "won")} className="cursor-pointer rounded-xl bg-emerald-500 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-emerald-600 hover:-translate-y-0.5 shadow-sm">Gagné ✓</button>
                        <button onClick={() => resolve(s.id, "lost")} className="cursor-pointer rounded-xl bg-red-500 px-3 py-2 text-[11px] font-bold text-white transition hover:bg-red-600 hover:-translate-y-0.5 shadow-sm">Perdu ✗</button>
                      </div>
                    )}
                  </div>
                </div>
                {s.description && <p className="mt-2 text-[11px] text-neutral-400 pl-14">{s.description}</p>}
              </div>
            ))}
          </div>

          {/* Actions */}
          {canAdd && (
            <div className="flex gap-3 af" style={{ animationDelay: ".3s", opacity: 0 }}>
              <button onClick={() => setShowAdd(true)} className="cursor-pointer flex-1 rounded-2xl border-2 border-dashed border-neutral-300 py-5 text-sm font-bold text-neutral-400 transition hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50">
                + Ajouter l'étape {m.current_step + 1}
              </button>
              {gain > 0 && !pending && (
                <button onClick={async () => {
                  if (!confirm(`Encaisser ${gain.toFixed(2)}€ ?\nBénéfice : ${benefit >= 0 ? "+" : ""}${benefit.toFixed(2)}€`)) return;
                  const r = await fetch("/api/montantes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cash_out", montante_id: m.id }) });
                  if (r.ok) { setParty(true); setTimeout(() => setParty(false), 3500); }
                  load();
                }} className="cursor-pointer rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-8 py-5 text-sm font-extrabold text-white shadow-lg shadow-amber-500/20 transition hover:shadow-amber-500/30 hover:-translate-y-0.5">
                  💰 Encaisser
                </button>
              )}
            </div>
          )}
        </div>

        {showAdd && <AddStep m={m} lastStep={steps[steps.length - 1]} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />}
      </div>
    </>
  );
}

function MetricCard({ label, value, accent, highlight }: { label: string; value: string; accent?: string; highlight?: string }) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 text-center ${highlight || "border-neutral-200 bg-white"}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums ${accent || "text-neutral-900"}`}>{value}</p>
    </div>
  );
}

// ── Add Step Modal ──
function AddStep({ m, lastStep, onClose, onAdded }: { m: Montante; lastStep?: Step; onClose: () => void; onAdded: () => void }) {
  const [odds, setOdds] = useState("");
  const [ms, setMs] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const o = parseFloat(odds) || 0;
  const first = m.current_step === 0;
  const autoS = first ? m.initial_stake : (lastStep?.actual_gain || m.initial_stake);
  const stake = m.stake_mode === "auto" ? autoS : (parseFloat(ms) || 0);
  const pg = o > 0 ? Math.round(stake * o * 100) / 100 : 0;

  async function go() {
    if (o <= 1) return setError("Cote invalide (> 1.00)");
    if (m.stake_mode === "manuel" && stake <= 0) return setError("Mise requise");
    setSaving(true); setError("");
    const r = await fetch("/api/montantes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_step", montante_id: m.id, odds: o, stake: m.stake_mode === "manuel" ? stake : undefined, description: desc || null }) });
    const d = await r.json();
    if (d.error) { setError(d.error); setSaving(false); return; }
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl af" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-neutral-900">Étape {m.current_step + 1}</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 hover:bg-neutral-200">✕</button>
        </div>
        <div className="mb-3"><label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Cote du pari</label><input type="number" step="0.01" value={odds} onChange={e => setOdds(e.target.value)} autoFocus placeholder="1.85" className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10" /></div>
        {m.stake_mode === "manuel" && <div className="mb-3"><label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Mise (€)</label><input type="number" value={ms} onChange={e => setMs(e.target.value)} placeholder={String(autoS)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 focus:bg-white" /></div>}
        <div className="mb-4"><label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Match <span className="text-neutral-300 font-normal lowercase">(optionnel)</span></label><input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="PSG vs Marseille" className="mt-1 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:bg-white" /></div>
        {o > 1 && (
          <div className="mb-5 rounded-2xl bg-neutral-50 border border-neutral-200 p-4 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Mise</p><p className="text-sm font-extrabold text-neutral-900 tabular-nums">{stake.toFixed(2)}€</p></div>
            <div><p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Cote</p><p className="text-sm font-extrabold text-neutral-900 tabular-nums">{o.toFixed(2)}</p></div>
            <div><p className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">Gain</p><p className="text-sm font-extrabold text-emerald-600 tabular-nums">{pg.toFixed(2)}€</p></div>
          </div>
        )}
        {error && <p className="mb-3 text-center text-xs font-semibold text-red-500">{error}</p>}
        <button onClick={go} disabled={saving} className="cursor-pointer w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-50">{saving ? "Ajout..." : "Ajouter l'étape"}</button>
      </div>
    </div>
  );
}