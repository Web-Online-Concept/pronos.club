// src/app/[locale]/(auth)/espace/martingales/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Martingale = {
  id: string;
  name: string;
  initial_stake: number;
  current_step: number;
  status: "active" | "won" | "lost";
  profit: number;
  total_lost: number;
  created_at: string;
};

type Step = {
  id: string;
  martingale_id: string;
  step_number: number;
  odds: number;
  stake: number;
  potential_gain: number;
  actual_gain: number | null;
  result: "pending" | "won" | "lost";
  description: string | null;
  match_date: string | null;
  sport: string | null;
  min_odds: number | null;
  completed_at: string | null;
};

type Stats = {
  total: number;
  active: number;
  won: number;
  lost: number;
  totalProfit: number;
  winRate: number;
  avgSteps: number;
  worstLoss: number;
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
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
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

export default function MartingalesPage() {
  const locale = useLocale();
  const { user } = useAuth();

  const [martingales, setMartingales] = useState<Martingale[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "won" | "lost">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [martingalesRes, statsRes] = await Promise.all([
        fetch("/api/martingales").then((r) => r.json()),
        fetch("/api/martingales?action=stats").then((r) => r.json()),
      ]);
      setMartingales(martingalesRes.martingales || []);
      setStats(statsRes);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mounted) fetchAll();
  }, [mounted, fetchAll]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-white">
        <div className="h-44 bg-neutral-900" />
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (selectedId) {
    return (
      <MartingaleDetailView
        martingaleId={selectedId}
        martingaleNumber={selectedNumber}
        onBack={() => {
          setSelectedId(null);
          fetchAll();
        }}
      />
    );
  }

  const filtered = martingales.filter((m) => filter === "all" || m.status === filter);

  const numberMap = new Map<string, number>();
  [...martingales].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach((m, i) => numberMap.set(m.id, i + 1));

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div className="min-h-screen bg-white">

        {/* ── Dark header block ── */}
        <div className="bg-neutral-900">
          <div className="mx-auto max-w-5xl px-4 pt-8 pb-6 sm:pt-10 sm:pb-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-400">
                  Gestionnaire
                </p>
                <h1 className="mt-1 text-2xl font-extrabold text-white sm:text-3xl">
                  Mes Martingales
                </h1>
              </div>
              {/* Profit cumulé */}
              {stats && stats.total > 0 && (
                <div className="flex items-center justify-center sm:justify-start gap-3 rounded-2xl bg-white/5 border border-white/10 px-5 py-3 mx-auto sm:mx-0">
                  <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center text-xl">
                    🎲
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white">
                      Profit cumulé
                    </p>
                    <p className={`text-xl font-extrabold tabular-nums ${stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {stats.totalProfit >= 0 ? "+" : ""}{stats.totalProfit.toFixed(2)}€
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats row */}
            {stats && stats.total > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <DarkStatCard label="En cours" value={stats.active} accent="text-blue-400" />
                <DarkStatCard label="Réussies" value={stats.won} accent="text-emerald-400" />
                <DarkStatCard label="Taux" value={`${stats.winRate}%`} accent="text-amber-400" />
                <DarkStatCard
                  label="Profit"
                  value={`${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(2)}€`}
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
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
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
                  className="cursor-pointer flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span className="text-lg leading-none">+</span>
                  Nouvelle martingale
                </button>
              </div>

              {/* Empty state */}
              {filtered.length === 0 ? (
                <div className="rounded-3xl bg-neutral-900 py-16 text-center animate-fade-in-up">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                    <span className="text-4xl">🎲</span>
                  </div>
                  <p className="text-white/50 text-sm">Aucune martingale pour le moment</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="cursor-pointer mt-5 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-500"
                  >
                    Créer ma première martingale
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map((mart, index) => (
                    <div
                      key={mart.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.06}s` }}
                    >
                      <MartingaleListCard
                        martingale={mart}
                        number={numberMap.get(mart.id) || index + 1}
                        onClick={() => { setSelectedId(mart.id); setSelectedNumber(numberMap.get(mart.id) || index + 1); }}
                        onDelete={async () => {
                          if (!confirm("Supprimer cette martingale ?")) return;
                          await fetch(`/api/martingales?id=${mart.id}`, { method: "DELETE" });
                          fetchAll();
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Reset all */}
              {martingales.length > 0 && (
                <div className="mt-10 text-center">
                  <button
                    onClick={async () => {
                      if (!confirm("⚠️ Tout réinitialiser ?\n\nToutes les martingales et leurs paliers seront supprimés.\nAction irréversible.")) return;
                      if (!confirm("Vraiment sûr ?")) return;
                      await fetch("/api/martingales", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reset_all" }),
                      });
                      fetchAll();
                    }}
                    className="cursor-pointer rounded-xl border border-red-500/20 px-6 py-2.5 text-xs font-semibold text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    🗑️ Tout réinitialiser
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Tutoriel ── */}
        <div className="mx-auto max-w-5xl px-4 pb-10">
          <div className="mt-12">
            <div
              className="rounded-t-3xl px-6 py-5 text-center"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #2e0a0a 50%, #0a0a0a 100%)" }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-red-400">
                📚 Guide complet
              </p>
              <h2 className="mt-2 text-xl font-black text-white">Comprendre les Martingales</h2>
              <p className="mt-1 text-xs text-white/40">
                Le principe, la formule, et les bonnes pratiques
              </p>
            </div>

            <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
              {/* Section 1 */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-red-300 open:shadow-lg open:shadow-red-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-base">🎲</span>
                  <span>C&apos;est quoi une martingale ?</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                  <p>
                    Une <strong className="text-red-600">martingale</strong> est une stratégie de paris où tu <strong>augmentes ta mise après chaque perte</strong> pour récupérer tes pertes précédentes + dégager un bénéfice quand tu gagnes.
                  </p>
                  <p className="mt-3">
                    <strong className="text-neutral-900">Le principe :</strong> tu mises, tu perds. Tu remises plus gros. Tu perds encore. Tu remises encore plus gros. Quand tu finis par gagner, le gain couvre toutes les pertes précédentes + un bénéfice.
                  </p>
                  <p className="mt-3">
                    <strong className="text-red-500">Attention :</strong> les mises augmentent vite. C&apos;est un outil à utiliser avec discipline et en connaissance de cause.
                  </p>
                </div>
              </details>

              {/* Section 2 */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">🎯</span>
                  <span>Comment ça marche sur PRONOS.CLUB ?</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                  {[
                    { step: "1", title: "Créer une martingale", desc: "Donne un nom et ta mise initiale (ex: 10€). C'est aussi ton bénéfice cible (x2 la mise)." },
                    { step: "2", title: "Palier 1 — Tu joues librement", desc: "Entre ta cote et ta mise. C'est ton premier pari, tu fais ce que tu veux. Si tu gagnes, martingale terminée !" },
                    { step: "3", title: "Palier 2+ — L'outil prend le relais", desc: "Tu donnes la cote de ton prochain pari. L'outil calcule automatiquement la mise exacte pour récupérer toutes tes pertes + ton bénéfice cible." },
                    { step: "4", title: "Victoire ou abandon", desc: "Dès que tu gagnes, la martingale est terminée avec bénéfice. Tu peux aussi clôturer à tout moment si tu veux limiter tes pertes." },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">{s.step}</span>
                      <div>
                        <p className="font-bold text-neutral-900">{s.title}</p>
                        <p className="mt-0.5 text-xs">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              {/* Section 3 — La formule */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">🧮</span>
                  <span>La formule expliquée</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                  <p>À partir du palier 2, l&apos;outil calcule la mise avec cette formule :</p>
                  <div className="mt-3 rounded-xl bg-neutral-900 px-5 py-4 text-center">
                    <p className="text-base font-mono font-bold text-white">mise = (pertes cumulées + bénéfice cible) / (cote - 1)</p>
                  </div>
                  <p className="mt-3">
                    <strong className="text-neutral-900">Exemple :</strong> tu as perdu 10€ au palier 1 (mise initiale). Ton bénéfice cible = 20€ (x2 la mise initiale). Au palier 2 tu prends une cote de 1.50 :
                  </p>
                  <div className="mt-2 rounded-xl bg-purple-50 px-4 py-3">
                    <p className="font-mono text-sm text-purple-900">mise = (10 + 20) / (1.50 - 1) = 30 / 0.50 = <strong>60€</strong></p>
                    <p className="mt-1 text-xs text-purple-700">Si tu gagnes : 60 × 1.50 = 90€ → 90 - 60 - 10 = <strong>+20€ net</strong> ✅</p>
                  </div>
                </div>
              </details>

              {/* Section 4 — Pourquoi les cotes basses coûtent cher */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">⚠️</span>
                  <span>Pourquoi les cotes basses coûtent cher</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                  <p>Plus la cote est basse, plus la mise calculée sera élevée. C&apos;est mathématique :</p>
                  <div className="mt-3 space-y-1.5">
                    {[
                      { cote: "1.30", mise: "100.00€", comment: "Très cher" },
                      { cote: "1.50", mise: "60.00€", comment: "Élevé" },
                      { cote: "1.80", mise: "37.50€", comment: "Raisonnable" },
                      { cote: "2.00", mise: "30.00€", comment: "Classique" },
                      { cote: "2.50", mise: "20.00€", comment: "Agressif mais abordable" },
                    ].map((r) => (
                      <div key={r.cote} className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2">
                        <span className="font-bold text-neutral-900">Cote {r.cote}</span>
                        <span className="font-mono font-bold text-red-600">{r.mise}</span>
                        <span className="text-[10px] text-neutral-400">{r.comment}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-neutral-500">
                    * Basé sur : mise initiale 10€, bénéfice cible 20€, pertes cumulées 10€ (1 palier perdu)
                  </p>
                </div>
              </details>

              {/* Section 5 — Conseils pro */}
              <div
                className="overflow-hidden rounded-2xl"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #2e0a0a 50%, #0a0a0a 100%)" }}
              >
                <div className="px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-base">💎</span>
                    <h3 className="text-sm font-extrabold text-white">Conseils de pro</h3>
                  </div>
                  <div className="mt-4 space-y-2.5 text-[13px] text-white/60">
                    <p>📌 La martingale est une stratégie de <span className="font-bold text-red-400">récupération</span>, pas d&apos;enrichissement — l&apos;objectif est de rattraper une perte</p>
                    <p>📌 <span className="font-bold text-white">Privilégie les cotes entre 1.50 et 2.00</span> — en dessous de 1.50, les mises explosent trop vite</p>
                    <p>📌 <span className="font-bold text-red-400">Fixe-toi une limite de paliers</span> (3-4 max) — au-delà, les mises deviennent déraisonnables</p>
                    <p>📌 N&apos;hésite pas à <span className="font-bold text-white">clôturer avec une perte</span> plutôt que de continuer à doubler — limiter les dégâts c&apos;est aussi gagner</p>
                    <p>📌 <span className="font-bold text-emerald-400">Ne lance qu&apos;une seule martingale à la fois</span> — ça demande du capital et de la concentration</p>
                    <p>📌 Utilise l&apos;outil pour <span className="font-bold text-white">simuler avant de jouer</span> — regarde combien tu devrais miser au palier 3 ou 4 pour savoir si c&apos;est tenable</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showCreate && (
          <CreateMartingaleModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              fetchAll();
            }}
            nextNumber={martingales.length + 1}
          />
        )}
      </div>
    </>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Dark Stat Card
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
// List Card
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MartingaleListCard({
  martingale,
  number,
  onClick,
  onDelete,
}: {
  martingale: Martingale;
  number: number;
  onClick: () => void;
  onDelete: () => void;
}) {
  const statusMap = {
    active: { label: "En cours", dotColor: "bg-blue-500", badgeBg: "bg-blue-500/10 text-blue-500 border-blue-500/20", barColor: "bg-blue-500" },
    won: { label: "Réussie ✓", dotColor: "bg-emerald-500", badgeBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", barColor: "bg-emerald-500" },
    lost: { label: "Clôturée ✗", dotColor: "bg-red-500", badgeBg: "bg-red-500/10 text-red-500 border-red-500/20", barColor: "bg-red-500" },
  };
  const config = statusMap[martingale.status];
  const totalLost = parseFloat(String(martingale.total_lost)) || 0;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer group relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 transition-all hover:border-neutral-700 hover:shadow-xl hover:shadow-black/20"
    >
      {martingale.status === "active" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{ background: "linear-gradient(90deg, transparent, rgba(239,68,68,0.4), transparent)", animation: "shimmerSlide 3s linear infinite" }}
          />
        </div>
      )}

      <div className="relative flex items-center gap-4 px-5 py-4">
        <div className="relative">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${
            martingale.status === "active" ? "bg-blue-500" : martingale.status === "won" ? "bg-emerald-500" : "bg-red-500"
          } ${martingale.status === "active" ? "animate-pulse-ring" : ""}`}>
            {number}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white truncate">{martingale.name}</h3>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${config.badgeBg}`}>{config.label}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-500">
            <span>Mise <span className="font-semibold text-neutral-300">{parseFloat(String(martingale.initial_stake))}€</span></span>
            <span>Paliers <span className="font-semibold text-neutral-300">{martingale.current_step}</span></span>
            {totalLost > 0 && martingale.status === "active" && (
              <span>Pertes <span className="font-semibold text-red-400">{totalLost.toFixed(2)}€</span></span>
            )}
          </div>
        </div>

        {martingale.status !== "active" && (
          <div className="shrink-0 text-right">
            <p className="text-[9px] font-bold uppercase tracking-wider text-white">Résultat</p>
            <p className={`text-lg font-extrabold tabular-nums ${parseFloat(String(martingale.profit)) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {parseFloat(String(martingale.profit)) >= 0 ? "+" : ""}{parseFloat(String(martingale.profit)).toFixed(2)}€
            </p>
          </div>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="cursor-pointer shrink-0 rounded-lg p-2 text-neutral-500 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="h-1 bg-neutral-800">
        <div className={`h-full ${config.barColor} transition-all duration-700`} style={{ width: martingale.status === "won" || martingale.status === "lost" ? "100%" : `${Math.max(5, Math.min(90, martingale.current_step * 25))}%` }} />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Create Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CreateMartingaleModal({
  onClose,
  onCreated,
  nextNumber,
}: {
  onClose: () => void;
  onCreated: () => void;
  nextNumber: number;
}) {
  const defaultName = `Martingale ${nextNumber}`;
  const [name, setName] = useState(defaultName);
  const [initialStake, setInitialStake] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stake = parseFloat(initialStake) || 0;

  async function handleCreate() {
    if (stake <= 0) return setError("Mise initiale requise");

    setSaving(true);
    setError("");
    const res = await fetch("/api/martingales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: name.trim() || defaultName,
        initial_stake: stake,
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
      <div className="w-full max-w-md rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-white">Nouvelle martingale</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-400 transition hover:bg-white/20">✕</button>
        </div>

        <input
          type="text"
          placeholder="Nom de la martingale"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-medium text-white placeholder-neutral-500 outline-none transition focus:border-red-500/50 focus:bg-white/10"
        />

        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-white">Mise initiale (= bénéfice cible x2)</label>
          <div className="mt-1 relative">
            <input
              type="number"
              value={initialStake}
              onChange={(e) => setInitialStake(e.target.value)}
              placeholder="10"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-8 text-sm font-bold text-white placeholder-neutral-600 outline-none transition focus:border-red-500/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-600">€</span>
          </div>
        </div>

        {stake > 0 && (
          <div className="mb-5 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">Bénéfice cible si victoire</p>
            <p className="mt-1 text-xl font-extrabold text-emerald-400">{(stake * 2).toFixed(2)}€</p>
          </div>
        )}

        {error && <p className="mb-3 text-center text-xs font-bold text-red-400">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={saving}
          className="cursor-pointer w-full rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer la martingale"}
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Detail View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MartingaleDetailView({
  martingaleId,
  martingaleNumber,
  onBack,
}: {
  martingaleId: string;
  martingaleNumber: number;
  onBack: () => void;
}) {
  const [martingale, setMartingale] = useState<Martingale | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStep, setShowAddStep] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/martingales?action=detail&id=${martingaleId}`);
    const data = await res.json();
    setMartingale(data.martingale);
    setSteps(data.steps || []);
    setLoading(false);
  }, [martingaleId]);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchDetail();
  }, [fetchDetail]);

  async function resolveStep(stepId: string, result: "won" | "lost") {
    const res = await fetch("/api/martingales", {
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

  if (loading || !martingale) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
        </div>
      </>
    );
  }

  const initialStake = parseFloat(String(martingale.initial_stake));
  const totalLost = parseFloat(String(martingale.total_lost)) || 0;
  const beneficeTarget = initialStake * 2;
  const pendingStep = steps.find((s) => s.result === "pending");
  const canAddStep = martingale.status === "active" && !pendingStep;

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      {/* Celebration */}
      {celebrating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="text-center animate-fade-in-up">
            <p className="text-7xl">🎉</p>
            <p className="mt-3 text-3xl font-extrabold text-emerald-500">MARTINGALE RÉUSSIE !</p>
            <p className="mt-1 text-xl text-neutral-400">+{parseFloat(String(martingale.profit)).toFixed(2)}€ de bénéfice</p>
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
                  backgroundColor: ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899"][Math.floor(Math.random() * 6)],
                  animationDelay: `${Math.random() * 1.5}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="min-h-screen bg-white">
        {/* Dark header */}
        <div className="bg-neutral-900">
          <div className="mx-auto max-w-5xl px-4 pt-6 pb-6">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={onBack} className="cursor-pointer flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex-1 text-center pr-9">
                <div className="flex items-center justify-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 text-sm font-extrabold text-white">{martingaleNumber}</div>
                  <h1 className="text-xl font-extrabold text-white">{martingale.name}</h1>
                </div>
                <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${
                  martingale.status === "active" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                  martingale.status === "won" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                  "bg-red-500/10 text-red-400 border-red-500/20"
                }`}>
                  {martingale.status === "active" ? "En cours" : martingale.status === "won" ? "Réussie ✓" : "Clôturée ✗"}
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Mise initiale</p>
                <p className="mt-1 text-xl font-extrabold text-white tabular-nums">{initialStake}€</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Bénéfice cible</p>
                <p className="mt-1 text-xl font-extrabold text-emerald-400 tabular-nums">{beneficeTarget.toFixed(2)}€</p>
              </div>
              <div className={`rounded-xl border px-4 py-3 text-center ${totalLost > 0 ? "bg-red-500/10 border-red-500/20" : "bg-white/5 border-white/5"}`}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Pertes cumulées</p>
                <p className={`mt-1 text-xl font-extrabold tabular-nums ${totalLost > 0 ? "text-red-400" : "text-neutral-600"}`}>
                  {totalLost > 0 ? `${totalLost.toFixed(2)}€` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white">Paliers</p>
                <p className="mt-1 text-xl font-extrabold text-white tabular-nums">{martingale.current_step}</p>
              </div>
            </div>

          </div>
        </div>

        {/* Steps */}
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="space-y-2.5">
            {steps.map((step, index) => (
              <div key={step.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.07}s` }}>
                <div className={`rounded-2xl overflow-hidden transition ${
                  step.result === "won" ? "bg-neutral-900 ring-2 ring-emerald-500/40" :
                  step.result === "lost" ? "bg-neutral-900 ring-2 ring-red-500/40" :
                  "bg-neutral-900 ring-1 ring-neutral-800"
                } ${step.result === "pending" ? "animate-pulse-ring" : ""}`}>

                  {/* Info bar */}
                  {(step.sport || step.description || step.match_date) && (
                    <div className="border-b border-white/5 px-5 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs">
                        {step.sport && <span className="text-neutral-300">{step.sport}</span>}
                        {step.description && <span className="text-neutral-500">·</span>}
                        {step.description && <span className="text-neutral-300">{step.description}</span>}
                      </div>
                      {step.match_date && (
                        <span className="text-[10px] text-neutral-500 shrink-0 ml-3">
                          {new Date(step.match_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="px-5 py-4">
                    <div className="flex items-center">
                      {/* Step circle */}
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white ${
                        step.result === "won" ? "bg-emerald-500" : step.result === "lost" ? "bg-red-500" : "bg-neutral-700"
                      }`}>
                        {step.step_number}
                      </div>

                      {/* Data */}
                      <div className="flex-1 grid grid-cols-3 ml-4 sm:ml-5">
                        <div className="text-center">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Cote</p>
                          <p className="mt-1 text-base sm:text-xl font-extrabold text-white tabular-nums">{parseFloat(String(step.odds)).toFixed(3)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Mise</p>
                          <p className="mt-1 text-base sm:text-xl font-extrabold text-white tabular-nums">{parseFloat(String(step.stake)).toFixed(2)}€</p>
                          {step.step_number > 1 && (
                            <p className="text-[8px] text-red-400 font-semibold">calculée</p>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Gain</p>
                          <p className={`mt-1 text-base sm:text-xl font-extrabold tabular-nums ${
                            step.result === "won" ? "text-emerald-400" : step.result === "lost" ? "text-red-400" : "text-white"
                          }`}>
                            {step.result === "won" ? parseFloat(String(step.actual_gain)).toFixed(2) : parseFloat(String(step.potential_gain)).toFixed(2)}€
                          </p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="shrink-0 ml-3 sm:ml-4">
                        {step.result === "won" && (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </div>
                        )}
                        {step.result === "lost" && (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                            <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </div>
                        )}
                        {step.result === "pending" && (
                          <div className="hidden sm:flex gap-2">
                            <button onClick={() => resolveStep(step.id, "won")} className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 hover:-translate-y-0.5">Gagné ✓</button>
                            <button onClick={() => resolveStep(step.id, "lost")} className="cursor-pointer rounded-xl bg-red-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-400 hover:-translate-y-0.5">Perdu ✗</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile buttons */}
                    {step.result === "pending" && (
                      <div className="flex gap-2 mt-3 sm:hidden">
                        <button onClick={() => resolveStep(step.id, "won")} className="cursor-pointer flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition active:scale-95">Gagné ✓</button>
                        <button onClick={() => resolveStep(step.id, "lost")} className="cursor-pointer flex-1 rounded-xl bg-red-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition active:scale-95">Perdu ✗</button>
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
                className="cursor-pointer flex-1 rounded-2xl border-2 border-dashed border-neutral-300 bg-white py-5 text-sm font-bold text-neutral-500 transition hover:border-red-500 hover:text-red-600 hover:bg-red-50"
              >
                + Ajouter le palier {martingale.current_step + 1}
              </button>
              {totalLost > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm(`Clôturer la martingale avec une perte de ${totalLost.toFixed(2)}€ ?`)) return;
                    await fetch("/api/martingales", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "close", martingale_id: martingale.id }),
                    });
                    fetchDetail();
                  }}
                  className="cursor-pointer rounded-2xl bg-neutral-200 px-8 py-5 text-sm font-extrabold text-neutral-600 transition hover:bg-neutral-300 hover:-translate-y-0.5"
                >
                  ✋ Clôturer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add Step Modal */}
        {showAddStep && (
          <AddStepModal
            martingale={martingale}
            steps={steps}
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
  martingale,
  steps,
  onClose,
  onAdded,
}: {
  martingale: Martingale;
  steps: Step[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [odds, setOdds] = useState("");
  const [description, setDescription] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [sport, setSport] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isFirstStep = martingale.current_step === 0;
  const oddsVal = parseFloat(odds) || 0;
  const initialStake = parseFloat(String(martingale.initial_stake));
  const totalLost = parseFloat(String(martingale.total_lost)) || 0;
  const beneficeTarget = initialStake * 2;

  // Palier 1: mise = mise initiale / Palier 2+: mise calculée
  let calculatedStake = 0;
  if (!isFirstStep && oddsVal > 1) {
    calculatedStake = Math.ceil(((totalLost + beneficeTarget) / (oddsVal - 1)) * 100) / 100;
  }

  const stake = isFirstStep ? initialStake : calculatedStake;
  const potentialGain = oddsVal > 1 && stake > 0 ? Math.round(stake * oddsVal * 100) / 100 : 0;
  const netProfit = potentialGain > 0 ? potentialGain - stake - totalLost : 0;

  const potentialGain = oddsVal > 1 && stake > 0 ? Math.round(stake * oddsVal * 100) / 100 : 0;

  async function handleAdd() {
    if (oddsVal <= 1) return setError("Cote invalide (> 1.00)");

    setSaving(true);
    setError("");
    const res = await fetch("/api/martingales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_step",
        martingale_id: martingale.id,
        odds: oddsVal,
        stake: isFirstStep ? initialStake : undefined,
        description: description || null,
        match_date: matchDate || null,
        sport: sport || null,
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
      <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-white">Palier {martingale.current_step + 1}</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-400 hover:bg-white/20">✕</button>
        </div>

        {/* Info pertes */}
        {!isFirstStep && totalLost > 0 && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">Pertes à récupérer</p>
            <p className="mt-1 text-lg font-extrabold text-red-400 tabular-nums">{totalLost.toFixed(2)}€</p>
          </div>
        )}

        {/* Cote */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Cote du pari</label>
          <input
            type="number"
            step="0.01"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            autoFocus
            placeholder="1.85"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder-neutral-600 outline-none focus:border-red-500/50"
          />
        </div>

        {/* Sport */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sport</label>
          <select
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="mt-1 w-full rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
          >
            <option value="" className="bg-neutral-800">—</option>
            <option value="⚽ Football" className="bg-neutral-800">⚽ Football</option>
            <option value="🏀 Basketball" className="bg-neutral-800">🏀 Basketball</option>
            <option value="🎾 Tennis" className="bg-neutral-800">🎾 Tennis</option>
            <option value="🏒 Hockey" className="bg-neutral-800">🏒 Hockey</option>
            <option value="🏈 Football US" className="bg-neutral-800">🏈 Football US</option>
            <option value="⚾ Baseball" className="bg-neutral-800">⚾ Baseball</option>
            <option value="🥊 MMA/Boxe" className="bg-neutral-800">🥊 MMA/Boxe</option>
            <option value="🏉 Rugby" className="bg-neutral-800">🏉 Rugby</option>
            <option value="🎯 Autre" className="bg-neutral-800">🎯 Autre</option>
          </select>
        </div>

        {/* Match + Date */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Match <span className="text-neutral-600 font-normal lowercase">(opt.)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="PSG vs OM"
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Date</label>
            <input
              type="date"
              value={matchDate}
              onChange={(e) => setMatchDate(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Preview */}
        {oddsVal > 1 && stake > 0 && (
          <div className="mb-5 rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">Mise</p>
                <p className="text-sm font-extrabold text-white tabular-nums">{stake.toFixed(2)}€</p>
                {!isFirstStep && <p className="text-[8px] text-red-400 font-semibold">calculée</p>}
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">Cote</p>
                <p className="text-sm font-extrabold text-white tabular-nums">{oddsVal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">Gain brut</p>
                <p className="text-sm font-extrabold text-emerald-400 tabular-nums">{potentialGain.toFixed(2)}€</p>
              </div>
            </div>
            {!isFirstStep && netProfit > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 text-center">
                <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">Bénéfice net si gagné</p>
                <p className="text-lg font-extrabold text-emerald-400 tabular-nums">+{netProfit.toFixed(2)}€</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="mb-3 text-center text-xs font-bold text-red-400">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={saving}
          className="cursor-pointer w-full rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:opacity-50"
        >
          {saving ? "Ajout..." : "Ajouter le palier"}
        </button>
      </div>
    </div>
  );
}