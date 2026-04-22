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
  current_gain: number;
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
  result: "pending" | "won" | "lost" | "refunded";
  match_name: string | null;
  description: string | null;
  match_date: string | null;
  sport: string | null;
  bookmaker: string | null;
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
              {/* Profit cumulé — toujours visible */}
              <div className="flex items-center justify-center sm:justify-start gap-3 rounded-2xl bg-white/5 border border-white/10 px-5 py-3 mx-auto sm:mx-0">
                <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center text-xl">
                  🎲
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white">
                    Solde
                  </p>
                  <p className={`text-xl font-extrabold tabular-nums ${(stats?.totalProfit ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(stats?.totalProfit ?? 0) >= 0 ? "+" : ""}{(stats?.totalProfit ?? 0).toFixed(2)}€
                  </p>
                </div>
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    { step: "1", title: "Créer une martingale", desc: "Donne un nom et ta mise initiale (ex: 10€). Le bénéfice cible = ta mise initiale." },
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
                    <strong className="text-neutral-900">Exemple :</strong> tu as perdu 10€ au palier 1 (mise initiale). Ton bénéfice cible = 10€ (= ta mise initiale). Au palier 2 tu prends une cote de 1.50 :
                  </p>
                  <div className="mt-2 rounded-xl bg-purple-50 px-4 py-3">
                    <p className="font-mono text-sm text-purple-900">mise = (10 + 10) / (1.50 - 1) = 20 / 0.50 = <strong>40€</strong></p>
                    <p className="mt-1 text-xs text-purple-700">Si tu gagnes : 40 × 1.50 = 60€ → 60 - 40 - 10 = <strong>+10€ net</strong> ✅</p>
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
                      { cote: "1.30", mise: "66.67€", comment: "Très cher" },
                      { cote: "1.50", mise: "40.00€", comment: "Élevé" },
                      { cote: "1.80", mise: "25.00€", comment: "Raisonnable" },
                      { cote: "2.00", mise: "20.00€", comment: "Classique" },
                      { cote: "2.50", mise: "13.33€", comment: "Abordable" },
                    ].map((r) => (
                      <div key={r.cote} className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2">
                        <span className="font-bold text-neutral-900">Cote {r.cote}</span>
                        <span className="font-mono font-bold text-red-600">{r.mise}</span>
                        <span className="text-[10px] text-neutral-400">{r.comment}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-neutral-500">
                    * Basé sur : mise initiale 10€, bénéfice cible 10€, pertes cumulées 10€ (1 palier perdu)
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
  const { user } = useAuth();
  const pseudo = (user as any)?.pseudo || (user as any)?.email?.split("@")[0] || "TIPSTER";

  // Theming par statut (identique montantes)
  const theme = martingale.status === "won"
    ? { accent: "#10b981", accentSoft: "rgba(16,185,129,0.08)", accentBorder: "rgba(16,185,129,0.2)", accentRing: "rgba(16,185,129,0.4)", profitText: "#34d399", statusLabel: "Réussie", statusColor: "#34d399", statusBg: "rgba(16,185,129,0.08)", statusBorder: "rgba(16,185,129,0.2)" }
    : martingale.status === "lost"
    ? { accent: "#ef4444", accentSoft: "rgba(239,68,68,0.08)", accentBorder: "rgba(239,68,68,0.2)", accentRing: "rgba(239,68,68,0.4)", profitText: "#fca5a5", statusLabel: "Clôturée", statusColor: "#fca5a5", statusBg: "rgba(239,68,68,0.08)", statusBorder: "rgba(239,68,68,0.2)" }
    : { accent: "#3b82f6", accentSoft: "rgba(59,130,246,0.08)", accentBorder: "rgba(59,130,246,0.2)", accentRing: "rgba(59,130,246,0.4)", profitText: "#93c5fd", statusLabel: "En cours", statusColor: "#93c5fd", statusBg: "rgba(59,130,246,0.08)", statusBorder: "rgba(59,130,246,0.2)" };

  const totalLost = parseFloat(String(martingale.total_lost)) || 0;

  async function exportCard() {
    const el = document.getElementById(`mart-card-${martingale.id}`);
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a1410",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `pronos-club-martingale-${number}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erreur lors de l'export de l'image");
    }
  }

  return (
    <div>
      {/* CARD PREMIUM (capturable) */}
      <div
        id={`mart-card-${martingale.id}`}
        onClick={onClick}
        style={{
          position: "relative",
          background: "linear-gradient(180deg, #0f1a17 0%, #0a1410 100%)",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 0 0 1px ${theme.accentRing}`,
          cursor: "pointer",
        }}
      >
        {/* Accent bar top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: `linear-gradient(90deg, transparent 0%, ${theme.accent} 30%, ${theme.accent} 70%, transparent 100%)`,
          }}
        />

        {/* Header : Martingale N + Logo + Date */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "80px" }}>
            <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.2em" }}>Martingale</span>
            <span style={{ fontSize: "22px", fontWeight: 800, color: martingale.status === "active" ? "#ffffff" : theme.accent, lineHeight: 1 }}>
              {number}
            </span>
          </div>

          <img
            src="/pronos_club.png"
            alt="PRONOS.CLUB"
            style={{ width: "32px", height: "32px", objectFit: "contain" }}
          />

          <span style={{ fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", minWidth: "80px", textAlign: "right" }}>
            {new Date(martingale.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()}
          </span>
        </div>

        {/* Nom */}
        <div style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "white", wordBreak: "break-word", lineHeight: 1.2 }}>
            {martingale.name}
          </div>
        </div>

        {/* Progression */}
        <div style={{ margin: "0 16px", padding: "10px 0", borderTop: "1px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
          <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0 }}>Progression</p>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "white", margin: "4px 0 8px", lineHeight: 1.2 }}>
            {martingale.status === "won"
              ? `Palier ${martingale.current_step} · Réussie`
              : martingale.status === "lost"
              ? `Palier ${martingale.current_step} · Clôturée`
              : martingale.current_step === 0
              ? "Non démarrée"
              : `Palier ${martingale.current_step} · En cours`}
          </p>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: martingale.status === "active"
                  ? `${Math.max(5, Math.min(90, martingale.current_step * 20))}%`
                  : "100%",
                background: theme.accent,
                transition: "width 0.7s ease",
                borderRadius: "3px",
              }}
            />
          </div>
        </div>

        {/* Data grid 2x2 */}
        <div style={{ padding: "12px 16px 16px", borderTop: "1px dashed rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Mise init.</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {parseFloat(String(martingale.initial_stake)).toFixed(2)}€
            </p>
          </div>
          <div style={{ background: totalLost > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center", border: totalLost > 0 ? "1px solid rgba(239,68,68,0.2)" : "none" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: totalLost > 0 ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Pertes cumul.</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: totalLost > 0 ? "#fca5a5" : "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {totalLost > 0 ? `${totalLost.toFixed(2)}€` : "—"}
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Gain actuel</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {parseFloat(String(martingale.current_gain || 0)).toFixed(2)}€
            </p>
          </div>
          <div style={{
            background: theme.accentSoft,
            borderRadius: "8px",
            padding: "8px",
            textAlign: "center",
            border: `1px solid ${theme.accentBorder}`,
          }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Résultat</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: theme.profitText, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {parseFloat(String(martingale.profit)) >= 0 ? "+" : ""}{parseFloat(String(martingale.profit)).toFixed(2)}€
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          padding: "10px 16px",
          background: theme.statusBg,
          borderTop: `1px solid ${theme.statusBorder}`,
          textAlign: "center",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: theme.statusColor }}>
            {martingale.status === "won" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
            {martingale.status === "lost" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {martingale.status === "active" && (
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3b82f6", display: "inline-block" }} />
            )}
            {theme.statusLabel}
          </span>
        </div>

        {/* Footer : pseudo centré */}
        <div style={{
          padding: "8px 14px",
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderTop: "1px solid rgba(255,255,255,0.04)",
        }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            {pseudo}
          </span>
        </div>
      </div>

      {/* EN-DEHORS de la card : boutons d'action */}
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={onClick}
          className="cursor-pointer flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:brightness-125"
          style={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          Ouvrir
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); exportCard(); }}
          className="cursor-pointer rounded-lg px-3 py-2 text-xs text-white transition hover:brightness-125"
          style={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)" }}
          title="Capturer en image"
        >
          📸
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="cursor-pointer rounded-lg px-3 py-2 text-xs text-white transition hover:bg-red-500/20 hover:border-red-500/30"
          style={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)" }}
          title="Supprimer"
        >
          🗑
        </button>
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
          <label className="text-[10px] font-bold uppercase tracking-wider text-white">Mise initiale</label>
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
            <p className="mt-1 text-xl font-extrabold text-emerald-400">{stake.toFixed(2)}€</p>
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
  const { user } = useAuth();
  const pseudo = (user as any)?.pseudo || (user as any)?.email?.split("@")[0] || "TIPSTER";

  const [martingale, setMartingale] = useState<Martingale | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
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

  async function changeResult(stepId: string, newResult: "won" | "lost" | "pending" | "refunded") {
    const labels = { won: "Gagné", lost: "Perdu", pending: "En attente", refunded: "Remboursé" };
    if (!confirm(`Changer le résultat en "${labels[newResult]}" ?`)) return;
    const res = await fetch("/api/martingales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_result", step_id: stepId, new_result: newResult }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    if (data.new_status === "won") {
      setCelebrating(true);
      setTimeout(() => setCelebrating(false), 3500);
    }
    fetchDetail();
  }

  async function exportStepCard(step: Step) {
    const el = document.getElementById(`mart-step-card-${step.id}`);
    if (!el) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a1410",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `pronos-club-martingale-palier-${step.step_number}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erreur lors de l'export de l'image");
    }
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
  const beneficeTarget = initialStake;
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
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, index) => {
              const isLastStep = index === steps.length - 1;

              // Theming par statut
              const theme = step.result === "won"
                ? { accent: "#10b981", accentSoft: "rgba(16,185,129,0.08)", accentBorder: "rgba(16,185,129,0.2)", accentRing: "rgba(16,185,129,0.4)", gainText: "#34d399", statusLabel: "Gagné", statusColor: "#34d399", statusBg: "rgba(16,185,129,0.08)", statusBorder: "rgba(16,185,129,0.2)" }
                : step.result === "lost"
                ? { accent: "#ef4444", accentSoft: "rgba(239,68,68,0.08)", accentBorder: "rgba(239,68,68,0.2)", accentRing: "rgba(239,68,68,0.4)", gainText: "#fca5a5", statusLabel: "Perdu", statusColor: "#fca5a5", statusBg: "rgba(239,68,68,0.08)", statusBorder: "rgba(239,68,68,0.2)" }
                : step.result === "refunded"
                ? { accent: "#3b82f6", accentSoft: "rgba(59,130,246,0.08)", accentBorder: "rgba(59,130,246,0.2)", accentRing: "rgba(59,130,246,0.4)", gainText: "#93c5fd", statusLabel: "Remboursé", statusColor: "#93c5fd", statusBg: "rgba(59,130,246,0.08)", statusBorder: "rgba(59,130,246,0.2)" }
                : { accent: "#fbbf24", accentSoft: "rgba(251,191,36,0.08)", accentBorder: "rgba(251,191,36,0.2)", accentRing: "rgba(255,255,255,0.06)", gainText: "#ffffff", statusLabel: "En attente", statusColor: "rgba(251,191,36,0.9)", statusBg: "rgba(251,191,36,0.08)", statusBorder: "rgba(251,191,36,0.2)" };

              return (
              <div
                key={step.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 0.07}s` }}
              >
                {/* CARD PREMIUM (capturable) */}
                <div
                  id={`mart-step-card-${step.id}`}
                  style={{
                    position: "relative",
                    background: "linear-gradient(180deg, #0f1a17 0%, #0a1410 100%)",
                    borderRadius: "16px",
                    overflow: "hidden",
                    boxShadow: `0 4px 24px rgba(0,0,0,0.3), inset 0 0 0 1px ${theme.accentRing}`,
                  }}
                >
                  {/* Accent bar top */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "3px",
                      background: `linear-gradient(90deg, transparent 0%, ${theme.accent} 30%, ${theme.accent} 70%, transparent 100%)`,
                    }}
                  />

                  {/* Header : Martingale + Palier + Logo + Date */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "85px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                        <span style={{ fontSize: "8px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.2em" }}>Martingale</span>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "rgba(255,255,255,0.7)", lineHeight: 1 }}>
                          {martingaleNumber}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                        <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.2em" }}>Palier</span>
                        <span style={{ fontSize: "22px", fontWeight: 800, color: step.result === "pending" ? "#ffffff" : theme.accent, lineHeight: 1 }}>
                          {step.step_number}
                        </span>
                      </div>
                    </div>

                    <img
                      src="/pronos_club.png"
                      alt="PRONOS.CLUB"
                      style={{ width: "32px", height: "32px", objectFit: "contain" }}
                    />

                    <span style={{ fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", minWidth: "85px", textAlign: "right" }}>
                      {step.match_date
                        ? new Date(step.match_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()
                        : "—"}
                    </span>
                  </div>

                  {/* Sport */}
                  {step.sport && (
                    <div style={{ padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "white" }}>
                        {step.sport}
                      </div>
                    </div>
                  )}

                  {/* Match */}
                  {step.match_name && (
                    <div style={{ margin: "0 16px", padding: "10px 0", borderTop: "1px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0 }}>Match</p>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.9)", margin: "3px 0 0", lineHeight: 1.3, wordBreak: "break-word" }}>
                        {step.match_name}
                      </p>
                    </div>
                  )}

                  {/* Pronostic */}
                  {step.description && (
                    <div style={{ margin: "0 16px", padding: "12px 0", borderTop: "1px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0 }}>Pronostic</p>
                      <p style={{ fontSize: "18px", fontWeight: 800, color: "#34d399", margin: "4px 0 0", lineHeight: 1.2, wordBreak: "break-word" }}>
                        {step.description}
                      </p>
                    </div>
                  )}

                  {/* Data grid 2x2 */}
                  <div style={{ padding: "12px 16px 16px", borderTop: "1px dashed rgba(255,255,255,0.08)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Book</p>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0" }}>
                        {step.bookmaker || "—"}
                      </p>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Cote</p>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                        {parseFloat(String(step.odds)).toFixed(3)}
                      </p>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Mise</p>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                        {parseFloat(String(step.stake)).toFixed(2)}
                      </p>
                      {step.step_number > 1 && (
                        <p style={{ fontSize: "8px", color: "#fca5a5", fontWeight: 600, margin: "1px 0 0" }}>calculée</p>
                      )}
                    </div>
                    <div style={{
                      background: theme.accentSoft,
                      borderRadius: "8px",
                      padding: "8px",
                      textAlign: "center",
                      border: `1px solid ${theme.accentBorder}`,
                    }}>
                      <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Gain</p>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: theme.gainText, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
                        {(step.result === "won" || step.result === "refunded")
                          ? parseFloat(String(step.actual_gain)).toFixed(2)
                          : parseFloat(String(step.potential_gain)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div style={{
                    padding: "10px 16px",
                    background: theme.statusBg,
                    borderTop: `1px solid ${theme.statusBorder}`,
                    textAlign: "center",
                  }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: theme.statusColor }}>
                      {step.result === "won" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {step.result === "lost" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      {step.result === "refunded" && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.65-4.65M20 15a9 9 0 01-14.65 4.65" />
                        </svg>
                      )}
                      {step.result === "pending" && (
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(251,191,36,0.9)", display: "inline-block" }} />
                      )}
                      {theme.statusLabel}
                    </span>
                  </div>

                  {/* Footer : pseudo centré */}
                  <div style={{
                    padding: "8px 14px",
                    background: "rgba(0,0,0,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.2em", textTransform: "uppercase" }}>
                      {pseudo}
                    </span>
                  </div>
                </div>

                {/* EN-DEHORS de la card : boutons d'action */}
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => setEditingStep(step)}
                    className="cursor-pointer flex-1 flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:brightness-125"
                    style={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)" }}
                    title="Modifier"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Modifier
                  </button>
                  <button
                    onClick={() => exportStepCard(step)}
                    className="cursor-pointer rounded-lg px-3 py-2 text-xs text-white transition hover:brightness-125"
                    style={{ background: "#1a2a3a", border: "1px solid rgba(255,255,255,0.1)" }}
                    title="Capturer en image"
                  >
                    📸
                  </button>
                  {isLastStep && (
                    <select
                      value={step.result}
                      onChange={(e) => {
                        const val = e.target.value as "pending" | "won" | "lost" | "refunded";
                        if (val === step.result) return;
                        if (step.result === "pending") {
                          if (val === "won" || val === "lost") {
                            resolveStep(step.id, val);
                          } else if (val === "refunded") {
                            changeResult(step.id, "refunded");
                          }
                        } else {
                          changeResult(step.id, val);
                        }
                      }}
                      className={`cursor-pointer flex-1 rounded-lg px-2 py-2 text-[11px] font-bold outline-none border transition ${
                        step.result === "won"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                          : step.result === "lost"
                          ? "bg-red-500/15 border-red-500/40 text-red-400"
                          : step.result === "refunded"
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                          : "bg-neutral-800 border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <option value="pending" className="bg-neutral-800 text-neutral-300">⏳ En attente</option>
                      <option value="won" className="bg-neutral-800 text-emerald-400">✓ Gagné</option>
                      <option value="lost" className="bg-neutral-800 text-red-400">✗ Perdu</option>
                      <option value="refunded" className="bg-neutral-800 text-blue-400">↻ Remboursé</option>
                    </select>
                  )}
                </div>
              </div>
              );
            })}
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

        {/* Edit Step Modal */}
        {editingStep && (
          <EditStepModal
            step={editingStep}
            isLastStep={steps.length > 0 && editingStep.id === steps[steps.length - 1].id}
            onClose={() => setEditingStep(null)}
            onSaved={() => {
              setEditingStep(null);
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
  const [matchName, setMatchName] = useState("");
  const [description, setDescription] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [sport, setSport] = useState("");
  const [bookmaker, setBookmaker] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isFirstStep = martingale.current_step === 0;
  const oddsVal = parseFloat(odds) || 0;
  const initialStake = parseFloat(String(martingale.initial_stake));
  const totalLost = parseFloat(String(martingale.total_lost)) || 0;
  const beneficeTarget = initialStake;

  // Palier 1: mise = mise initiale / Palier 2+: mise calculée
  let calculatedStake = 0;
  if (!isFirstStep && oddsVal > 1) {
    calculatedStake = Math.ceil(((totalLost + beneficeTarget) / (oddsVal - 1)) * 100) / 100;
  }

  const stake = isFirstStep ? initialStake : calculatedStake;
  const potentialGain = oddsVal > 1 && stake > 0 ? Math.round(stake * oddsVal * 100) / 100 : 0;
  const netProfit = potentialGain > 0 ? potentialGain - stake - totalLost : 0;

  async function handleAdd() {
    if (oddsVal <= 1) return setError("Cote invalide (> 1.00)");
    if (!matchName.trim()) return setError("Match requis");
    if (!description.trim()) return setError("Pronostic requis");

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
        match_name: matchName.trim(),
        description: description.trim(),
        match_date: matchDate || null,
        sport: sport || null,
        bookmaker: bookmaker || null,
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

        {/* Match */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Match <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="PSG vs OM"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50"
          />
        </div>

        {/* Pronostic */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Pronostic <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="PSG gagne · Over 2.5 buts..."
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50"
          />
        </div>

        {/* Bookmaker + Date */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Bookmaker</label>
            <select
              value={bookmaker}
              onChange={(e) => setBookmaker(e.target.value)}
              className="mt-1 w-full rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
            >
              <option value="" className="bg-neutral-800">—</option>
              <option value="Betclic" className="bg-neutral-800">Betclic</option>
              <option value="Winamax" className="bg-neutral-800">Winamax</option>
              <option value="Unibet" className="bg-neutral-800">Unibet</option>
              <option value="Bwin" className="bg-neutral-800">Bwin</option>
              <option value="PMU" className="bg-neutral-800">PMU</option>
              <option value="Parions Sport" className="bg-neutral-800">Parions Sport</option>
              <option value="ZEbet" className="bg-neutral-800">ZEbet</option>
              <option value="NetBet" className="bg-neutral-800">NetBet</option>
              <option value="Betsson" className="bg-neutral-800">Betsson</option>
              <option value="Vbet" className="bg-neutral-800">Vbet</option>
              <option value="Genybet" className="bg-neutral-800">Genybet</option>
              <option value="Partouche Sport" className="bg-neutral-800">Partouche Sport</option>
              <option value="Betway" className="bg-neutral-800">Betway</option>
              <option value="Pinnacle" className="bg-neutral-800">Pinnacle</option>
              <option value="PS3838" className="bg-neutral-800">PS3838</option>
              <option value="Bet365" className="bg-neutral-800">Bet365</option>
              <option value="1xBet" className="bg-neutral-800">1xBet</option>
              <option value="Stake" className="bg-neutral-800">Stake</option>
              <option value="Betfair" className="bg-neutral-800">Betfair</option>
              <option value="Autre" className="bg-neutral-800">Autre</option>
            </select>
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
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Edit Step Modal
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function EditStepModal({
  step,
  isLastStep,
  onClose,
  onSaved,
}: {
  step: Step;
  isLastStep: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [matchName, setMatchName] = useState(step.match_name || "");
  const [description, setDescription] = useState(step.description || "");
  const [matchDate, setMatchDate] = useState(step.match_date || "");
  const [sport, setSport] = useState(step.sport || "");
  const [bookmaker, setBookmaker] = useState(step.bookmaker || "");
  const [odds, setOdds] = useState(String(step.odds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canEditOdds = isLastStep && step.result === "pending";

  async function handleSave() {
    setSaving(true);
    setError("");

    const payload: any = {
      action: "update_step",
      step_id: step.id,
      sport: sport || "",
      match_name: matchName.trim(),
      description: description.trim(),
      match_date: matchDate || "",
      bookmaker: bookmaker || "",
    };

    if (canEditOdds) {
      const oddsVal = parseFloat(odds);
      if (!oddsVal || oddsVal <= 1) {
        setError("Cote invalide (> 1.00)");
        setSaving(false);
        return;
      }
      payload.new_odds = oddsVal;
    }

    const res = await fetch("/api/martingales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-white">Modifier palier {step.step_number}</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-400 hover:bg-white/20">✕</button>
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

        {/* Match */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Match</label>
          <input
            type="text"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="PSG vs OM"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50"
          />
        </div>

        {/* Pronostic */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Pronostic</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="PSG gagne"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50"
          />
        </div>

        {/* Bookmaker + Date */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Bookmaker</label>
            <select
              value={bookmaker}
              onChange={(e) => setBookmaker(e.target.value)}
              className="mt-1 w-full rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
            >
              <option value="" className="bg-neutral-800">—</option>
              <option value="Betclic" className="bg-neutral-800">Betclic</option>
              <option value="Winamax" className="bg-neutral-800">Winamax</option>
              <option value="Unibet" className="bg-neutral-800">Unibet</option>
              <option value="Bwin" className="bg-neutral-800">Bwin</option>
              <option value="PMU" className="bg-neutral-800">PMU</option>
              <option value="Parions Sport" className="bg-neutral-800">Parions Sport</option>
              <option value="ZEbet" className="bg-neutral-800">ZEbet</option>
              <option value="NetBet" className="bg-neutral-800">NetBet</option>
              <option value="Betsson" className="bg-neutral-800">Betsson</option>
              <option value="Vbet" className="bg-neutral-800">Vbet</option>
              <option value="Genybet" className="bg-neutral-800">Genybet</option>
              <option value="Partouche Sport" className="bg-neutral-800">Partouche Sport</option>
              <option value="Betway" className="bg-neutral-800">Betway</option>
              <option value="Pinnacle" className="bg-neutral-800">Pinnacle</option>
              <option value="PS3838" className="bg-neutral-800">PS3838</option>
              <option value="Bet365" className="bg-neutral-800">Bet365</option>
              <option value="1xBet" className="bg-neutral-800">1xBet</option>
              <option value="Stake" className="bg-neutral-800">Stake</option>
              <option value="Betfair" className="bg-neutral-800">Betfair</option>
              <option value="Autre" className="bg-neutral-800">Autre</option>
            </select>
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

        {/* Cote (uniquement si dernier palier pending) */}
        {canEditOdds ? (
          <div className="mb-4">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Cote</label>
            <input
              type="number"
              step="0.001"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500/50"
            />
            <p className="mt-1 text-[10px] text-neutral-500">
              La mise sera recalculée automatiquement.
            </p>
          </div>
        ) : (
          <div className="mb-4 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Cote (lecture seule)</p>
            <p className="mt-1 text-sm font-bold text-white tabular-nums">{parseFloat(String(step.odds)).toFixed(3)}</p>
            <p className="mt-1 text-[10px] text-neutral-500">
              La cote n&apos;est modifiable que sur le dernier palier non résolu.
            </p>
          </div>
        )}

        {error && <p className="mb-3 text-center text-xs font-bold text-red-400">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="cursor-pointer w-full rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}