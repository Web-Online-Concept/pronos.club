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
  current_gain: number;
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
  match_name: string | null;
  description: string | null;
  result: "pending" | "won" | "lost" | "refunded";
  completed_at: string | null;
  match_date: string | null;
  bet_type: "simple" | "combiné";
  sport: string | null;
  bookmaker: string | null;
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
      const [montantesRes, statsRes] = await Promise.all([
        fetch("/api/montantes").then((r) => r.json()),
        fetch("/api/montantes?action=stats").then((r) => r.json()),
      ]);
      setMontantes(montantesRes.montantes || []);
      setStats(statsRes);
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
        montanteNumber={selectedNumber}
        onBack={() => {
          setSelectedId(null);
          fetchAll();
        }}
      />
    );
  }

  const filtered = montantes.filter((m) => filter === "all" || m.status === filter);

  // Stable numbering: oldest = #1, regardless of filter
  const numberMap = new Map<string, number>();
  [...montantes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).forEach((m, i) => numberMap.set(m.id, i + 1));

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
              {/* Profit cumulé — toujours visible */}
              <div className="flex items-center justify-center sm:justify-start gap-3 rounded-2xl bg-white/5 border border-white/10 px-5 py-3 mx-auto sm:mx-0">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl">
                  📊
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-white">
                    Solde
                  </p>
                  <p className={`text-xl font-extrabold tabular-nums ${!stats || stats.totalProfit === 0 ? "text-white" : stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {stats ? `${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(2)}€` : "0.00€"}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats row inside dark block */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {filtered.map((montante, index) => (
                    <div
                      key={montante.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.06}s` }}
                    >
                      <MontanteListCard
                        montante={montante}
                        number={numberMap.get(montante.id) || index + 1}
                        onClick={() => { setSelectedId(montante.id); setSelectedNumber(numberMap.get(montante.id) || index + 1); }}
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

          {/* Reset all */}
          {montantes.length > 0 && (
            <div className="mt-10 text-center">
              <button
                onClick={async () => {
                  if (!confirm("⚠️ Tout réinitialiser ?\n\nToutes les montantes et leurs paliers seront supprimés.\nAction irréversible.")) return;
                  if (!confirm("Vraiment sûr ?")) return;
                  await fetch("/api/montantes", {
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
        </div>

        {/* ── Tutoriel ── */}
        <div className="mx-auto max-w-5xl px-4 pb-10">
          <div className="mt-12">
            <div
              className="rounded-t-3xl px-6 py-5 text-center"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
                📚 Guide complet
              </p>
              <h2 className="mt-2 text-xl font-black text-white">Comprendre les Montantes</h2>
              <p className="mt-1 text-xs text-white/40">
                Le principe, les modes, et les bonnes pratiques
              </p>
            </div>

            <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
              {/* Section 1 — C'est quoi */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">📈</span>
                  <span>C&apos;est quoi une montante ?</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                  <p>
                    Une <strong className="text-emerald-600">montante</strong> est une stratégie de paris où tu réinvestis tes gains d&apos;un pari dans le suivant pour faire grossir ta mise progressivement.
                  </p>
                  <p className="mt-3">
                    <strong className="text-neutral-900">Exemple simple :</strong> tu mises 10€ à cote 1.50 → tu gagnes 15€. Tu remises ces 15€ à cote 1.40 → tu gagnes 21€. Tu remises 21€... et ainsi de suite.
                  </p>
                  <p className="mt-3">
                    L&apos;objectif est de <strong className="text-emerald-600">transformer une petite mise en un gros gain</strong> en enchaînant les paris gagnants. Mais attention : <strong className="text-red-500">un seul pari perdu et tu perds ta mise initiale</strong>.
                  </p>
                  <p className="mt-3">
                    C&apos;est un outil à haut risque / haute récompense. L&apos;important est de bien choisir ses cotes et de savoir quand encaisser.
                  </p>
                </div>
              </details>

              {/* Section 2 — Comment ça marche */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">🎯</span>
                  <span>Comment ça marche sur PRONOS.CLUB ?</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                  {[
                    { step: "1", title: "Créer une montante", desc: "Donne un nom, choisis ta mise initiale (ex: 10€) et éventuellement un objectif à atteindre (ex: 500€)." },
                    { step: "2", title: "Ajouter un palier", desc: "Entre la cote de ton pari. L'outil calcule automatiquement la mise (= le gain du palier précédent) et le gain potentiel." },
                    { step: "3", title: "Valider le résultat", desc: "Ton pari est gagné ? Clique \"Gagné\" → le gain devient la mise du palier suivant. Perdu ? La montante s'arrête." },
                    { step: "4", title: "Encaisser ou continuer", desc: "En mode libre, tu peux encaisser tes gains à tout moment avec le bouton 💰 Encaisser. En mode objectif, la montante se termine automatiquement quand tu atteins ton objectif." },
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

              {/* Section 3 — Tout réinvestir vs Manuel */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">⚡</span>
                  <span>Tout réinvestir vs Manuel</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="font-extrabold text-emerald-900">⚡ Tout réinvestir (recommandé)</p>
                    <p className="mt-0.5 text-emerald-800">
                      La mise de chaque palier = le gain du palier précédent. Tu réinvestis 100% automatiquement. C&apos;est le mode classique d&apos;une montante.
                    </p>
                    <p className="mt-2 text-xs text-emerald-700">
                      Exemple : 10€ → 15€ → 21€ → 29.40€ → ... croissance rapide mais tout ou rien.
                    </p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="font-extrabold text-neutral-900">✏️ Manuel</p>
                    <p className="mt-0.5">
                      Tu choisis toi-même la mise à chaque palier. Utile si tu veux sécuriser une partie de tes gains en ne remisant qu&apos;une fraction.
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Exemple : tu gagnes 21€ mais tu ne remises que 15€ → tu sécurises 6€ de profit.
                    </p>
                  </div>
                </div>
              </details>

              {/* Section 4 — Objectif vs Libre */}
              <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
                <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">🎯</span>
                  <span>Mode Objectif vs Mode Libre</span>
                  <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="font-extrabold text-amber-900">🎯 Mode Objectif</p>
                    <p className="mt-0.5 text-amber-800">
                      Tu définis un montant cible (ex: 500€ à partir de 10€). La montante se termine automatiquement quand tu l&apos;atteins. Une barre de progression te montre où tu en es.
                    </p>
                    <p className="mt-2 text-xs text-amber-700">
                      L&apos;outil calcule la cote moyenne nécessaire par palier pour atteindre ton objectif.
                    </p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 p-3">
                    <p className="font-extrabold text-neutral-900">🔓 Mode Libre</p>
                    <p className="mt-0.5">
                      Pas d&apos;objectif fixé. Tu joues palier par palier et tu encaisses quand tu le sens. Le bouton &quot;💰 Encaisser&quot; est disponible dès que tu as un gain.
                    </p>
                    <p className="mt-2 text-xs text-neutral-500">
                      Idéal pour les joueurs qui préfèrent encaisser régulièrement plutôt que viser gros.
                    </p>
                  </div>
                </div>
              </details>

              {/* Section 5 — Conseils pro */}
              <div
                className="overflow-hidden rounded-2xl"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
              >
                <div className="px-5 py-5 sm:px-6">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-base">💎</span>
                    <h3 className="text-sm font-extrabold text-white">Conseils de pro</h3>
                  </div>
                  <div className="mt-4 space-y-2.5 text-[13px] text-white/60">
                    <p>
                      📌 Commence avec une <span className="font-bold text-emerald-400">petite mise</span> (5-20€) — tu es là pour tester une stratégie, pas pour risquer gros
                    </p>
                    <p>
                      📌 Vise des <span className="font-bold text-white">cotes entre 1.30 et 1.80</span> — plus la cote est basse, plus tes chances de passer chaque palier sont élevées
                    </p>
                    <p>
                      📌 <span className="font-bold text-red-400">Ne dépasse pas 5-7 paliers</span> — au-delà, la probabilité cumulée de tout perdre devient trop élevée
                    </p>
                    <p>
                      📌 En mode libre, <span className="font-bold text-emerald-400">encaisse régulièrement</span> — la gourmandise est l&apos;ennemi du parieur
                    </p>
                    <p>
                      📌 <span className="font-bold text-white">Accepte la perte</span> — une montante perdue fait partie du jeu, c&apos;est ta mise initiale et rien de plus
                    </p>
                    <p>
                      📌 Lance <span className="font-bold text-emerald-400">plusieurs montantes en parallèle</span> — diversifie tes risques sur différents sports/cotes
                    </p>
                    <p>
                      📌 Utilise le mode <span className="font-bold text-white">Manuel</span> pour sécuriser une partie de tes gains à chaque palier
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        {showCreate && (
          <CreateMontanteModal
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              fetchAll();
            }}
            nextNumber={montantes.length + 1}
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
  const { user } = useAuth();
  const pseudo = (user as any)?.pseudo || (user as any)?.email?.split("@")[0] || "TIPSTER";

  // Theming by status (identique au design paliers)
  const theme = montante.status === "won"
    ? { accent: "#10b981", accentSoft: "rgba(16,185,129,0.08)", accentBorder: "rgba(16,185,129,0.2)", accentRing: "rgba(16,185,129,0.4)", profitText: "#34d399", statusLabel: "Réussie", statusColor: "#34d399", statusBg: "rgba(16,185,129,0.08)", statusBorder: "rgba(16,185,129,0.2)" }
    : montante.status === "lost"
    ? { accent: "#ef4444", accentSoft: "rgba(239,68,68,0.08)", accentBorder: "rgba(239,68,68,0.2)", accentRing: "rgba(239,68,68,0.4)", profitText: "#fca5a5", statusLabel: "Échouée", statusColor: "#fca5a5", statusBg: "rgba(239,68,68,0.08)", statusBorder: "rgba(239,68,68,0.2)" }
    : { accent: "#3b82f6", accentSoft: "rgba(59,130,246,0.08)", accentBorder: "rgba(59,130,246,0.2)", accentRing: "rgba(59,130,246,0.4)", profitText: "#93c5fd", statusLabel: "En cours", statusColor: "#93c5fd", statusBg: "rgba(59,130,246,0.08)", statusBorder: "rgba(59,130,246,0.2)" };

  const progressPct = montante.status === "won" || montante.status === "lost"
    ? 100
    : Math.round((montante.current_step / Math.max(1, montante.total_steps)) * 100);

  async function exportCard() {
    const el = document.getElementById(`montante-card-${montante.id}`);
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
      link.download = `pronos-club-montante-${number}.png`;
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
        id={`montante-card-${montante.id}`}
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

        {/* Header : Montante + Logo + Date */}
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", minWidth: "70px" }}>
            <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.2em" }}>Montante</span>
            <span style={{ fontSize: "22px", fontWeight: 800, color: montante.status === "active" ? "#ffffff" : theme.accent, lineHeight: 1 }}>
              {number}
            </span>
          </div>

          <img
            src="/pronos_club.png"
            alt="PRONOS.CLUB"
            style={{ width: "32px", height: "32px", objectFit: "contain" }}
          />

          <span style={{ fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", minWidth: "70px", textAlign: "right" }}>
            {new Date(montante.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()}
          </span>
        </div>

        {/* Nom + Mode */}
        <div style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "white", wordBreak: "break-word", lineHeight: 1.2 }}>
            {montante.name}
          </div>
          <div style={{ marginTop: "6px" }}>
            <span style={{
              display: "inline-block",
              fontSize: "10px",
              fontWeight: 700,
              color: montante.mode === "objectif" ? "rgba(16,185,129,0.9)" : "rgba(255,255,255,0.6)",
              background: montante.mode === "objectif" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)",
              padding: "2px 10px",
              borderRadius: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase"
            }}>
              {montante.mode === "objectif" ? "Objectif" : "Libre"}
            </span>
            <span style={{
              marginLeft: "4px",
              display: "inline-block",
              fontSize: "10px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.6)",
              background: "rgba(255,255,255,0.06)",
              padding: "2px 10px",
              borderRadius: "10px",
              letterSpacing: "0.1em",
              textTransform: "uppercase"
            }}>
              {montante.stake_mode === "auto" ? "Auto" : "Manuel"}
            </span>
          </div>
        </div>

        {/* Progression */}
        <div style={{ margin: "0 16px", padding: "10px 0", borderTop: "1px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
          <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.2em", margin: 0 }}>Progression</p>
          <p style={{ fontSize: "16px", fontWeight: 800, color: "white", margin: "4px 0 8px", lineHeight: 1.2 }}>
            {montante.status === "won"
              ? `Palier ${montante.current_step} · Terminée`
              : montante.status === "lost"
              ? `Palier ${montante.current_step} · Échouée`
              : montante.current_step === 0
              ? "Non démarrée"
              : `Palier ${montante.current_step} · En cours`}
          </p>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
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
              {parseFloat(String(montante.initial_stake)).toFixed(2)}€
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>
              {montante.target_amount ? "Objectif" : "Gain actuel"}
            </p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {montante.target_amount
                ? `${parseFloat(String(montante.target_amount)).toFixed(2)}€`
                : `${parseFloat(String(montante.current_gain || 0)).toFixed(2)}€`}
            </p>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px", textAlign: "center" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Cote moy.</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "white", margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {montante.avg_odds_needed ? parseFloat(String(montante.avg_odds_needed)).toFixed(2) : "—"}
            </p>
          </div>
          <div style={{
            background: theme.accentSoft,
            borderRadius: "8px",
            padding: "8px",
            textAlign: "center",
            border: `1px solid ${theme.accentBorder}`,
          }}>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Bénéfice</p>
            <p style={{ fontSize: "13px", fontWeight: 700, color: theme.profitText, margin: "2px 0 0", fontVariantNumeric: "tabular-nums" }}>
              {montante.profit >= 0 ? "+" : ""}{parseFloat(String(montante.profit)).toFixed(2)}€
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
            {montante.status === "won" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
            {montante.status === "lost" && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {montante.status === "active" && (
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

function CreateMontanteModal({
  onClose,
  onCreated,
  nextNumber,
}: {
  onClose: () => void;
  onCreated: () => void;
  nextNumber: number;
}) {
  const defaultName = `Montante ${nextNumber}`;
  const [stakeMode, setStakeMode] = useState<"auto" | "manuel">("auto");
  const [name, setName] = useState(defaultName);
  const [initialStake, setInitialStake] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stake = parseFloat(initialStake) || 0;
  const target = parseFloat(targetAmount) || 0;

  async function handleCreate() {
    if (stake <= 0) return setError("Mise initiale requise");
    if (target > 0 && target <= stake) return setError("L'objectif doit dépasser la mise");

    setSaving(true);
    setError("");
    const res = await fetch("/api/montantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        name: name.trim() || defaultName,
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
          placeholder="Nom de la montante"
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
// Montante Detail View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MontanteDetailView({
  montanteId,
  montanteNumber,
  onBack,
}: {
  montanteId: string;
  montanteNumber: number;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const pseudo = (user as any)?.pseudo || (user as any)?.email?.split("@")[0] || "TIPSTER";

  const [montante, setMontante] = useState<Montante | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStep, setShowAddStep] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);

  const fetchDetail = useCallback(async () => {
    const res = await fetch(`/api/montantes?action=detail&id=${montanteId}`);
    const data = await res.json();
    setMontante(data.montante);
    setSteps(data.steps || []);
    setLoading(false);
  }, [montanteId]);

  useEffect(() => {
    window.scrollTo(0, 0);
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

  async function changeResult(stepId: string, newResult: "won" | "lost" | "pending" | "refunded") {
    const labels = { won: "Gagné", lost: "Perdu", pending: "En attente", refunded: "Remboursé" };
    if (!confirm(`Changer le résultat en "${labels[newResult]}" ?`)) return;
    const res = await fetch("/api/montantes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "change_result", step_id: stepId, new_result: newResult }),
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    fetchDetail();
  }

  async function exportStepCard(step: Step) {
    const el = document.getElementById(`step-card-${step.id}`);
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
      link.download = `pronos-club-palier-${step.step_number}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export error:", err);
      alert("Erreur lors de l'export de l'image");
    }
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
                <div className="flex items-center justify-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-extrabold text-white">
                    {montanteNumber}
                  </div>
                  <h1 className="text-xl font-extrabold text-white">{montante.name}</h1>
                </div>
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
                  {montante.target_amount ? "Objectif" : "Paliers"}
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
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-col-reverse sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, index) => {
              const isLastStep = index === steps.length - 1;

              // Theming by status
              const theme = step.result === "won"
                ? { accent: "#10b981", accentSoft: "rgba(16,185,129,0.08)", accentBorder: "rgba(16,185,129,0.2)", accentRing: "rgba(16,185,129,0.4)", gainText: "#34d399", dotColor: "#10b981", statusLabel: "Gagné", statusColor: "#34d399", statusBg: "rgba(16,185,129,0.08)", statusBorder: "rgba(16,185,129,0.2)" }
                : step.result === "lost"
                ? { accent: "#ef4444", accentSoft: "rgba(239,68,68,0.08)", accentBorder: "rgba(239,68,68,0.2)", accentRing: "rgba(239,68,68,0.4)", gainText: "#fca5a5", dotColor: "#ef4444", statusLabel: "Perdu", statusColor: "#fca5a5", statusBg: "rgba(239,68,68,0.08)", statusBorder: "rgba(239,68,68,0.2)" }
                : step.result === "refunded"
                ? { accent: "#3b82f6", accentSoft: "rgba(59,130,246,0.08)", accentBorder: "rgba(59,130,246,0.2)", accentRing: "rgba(59,130,246,0.4)", gainText: "#93c5fd", dotColor: "#3b82f6", statusLabel: "Remboursé", statusColor: "#93c5fd", statusBg: "rgba(59,130,246,0.08)", statusBorder: "rgba(59,130,246,0.2)" }
                : { accent: "#fbbf24", accentSoft: "rgba(251,191,36,0.08)", accentBorder: "rgba(251,191,36,0.2)", accentRing: "rgba(255,255,255,0.06)", gainText: "#ffffff", dotColor: "#fbbf24", statusLabel: "En attente", statusColor: "rgba(251,191,36,0.9)", statusBg: "rgba(251,191,36,0.08)", statusBorder: "rgba(251,191,36,0.2)" };

              return (
              <div
                key={step.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 0.07}s` }}
              >
                {/* CARD PREMIUM (capturable) */}
                <div
                  id={`step-card-${step.id}`}
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

                  {/* Header : Montante + Palier + Logo + Date */}
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px dashed rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "80px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                        <span style={{ fontSize: "8px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.2em" }}>Montante</span>
                        <span style={{ fontSize: "13px", fontWeight: 800, color: "rgba(255,255,255,0.7)", lineHeight: 1 }}>
                          {montanteNumber}
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
                      style={{ width: "48px", height: "48px", objectFit: "contain" }}
                    />

                    <span style={{ fontSize: "10px", fontWeight: 500, color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em", minWidth: "80px", textAlign: "right" }}>
                      {step.match_date
                        ? new Date(step.match_date + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).toUpperCase()
                        : "—"}
                    </span>
                  </div>

                  {/* Sport + Type */}
                  <div style={{ padding: "16px", textAlign: "center" }}>
                    {step.sport && (
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "white" }}>
                        {step.sport}
                      </div>
                    )}
                    <div style={{ marginTop: "6px" }}>
                      <span style={{
                        display: "inline-block",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: step.bet_type === "combiné" ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.6)",
                        background: step.bet_type === "combiné" ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.06)",
                        padding: "2px 10px",
                        borderRadius: "10px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase"
                      }}>
                        {step.bet_type === "combiné" ? "Combiné" : "Simple"}
                      </span>
                    </div>
                  </div>

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
                    className="cursor-pointer flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-white transition hover:brightness-125"
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

        {/* Edit Step Modal */}
        {editingStep && (
          <EditStepModal
            step={editingStep}
            isLastStep={editingStep.step_number >= montante.current_step}
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
  const [matchName, setMatchName] = useState("");
  const [description, setDescription] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [betType, setBetType] = useState<"simple" | "combiné">("simple");
  const [sport, setSport] = useState("");
  const [bookmaker, setBookmaker] = useState("");
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
    if (!matchName.trim()) return setError("Match requis");
    if (!description.trim()) return setError("Pronostic requis");

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
        match_name: matchName.trim(),
        description: description.trim(),
        match_date: matchDate || null,
        bet_type: betType,
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

        {/* Bookmaker */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Bookmaker</label>
          <select
            value={bookmaker}
            onChange={(e) => setBookmaker(e.target.value)}
            className="mt-1 w-full rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50"
          >
            <option value="" className="bg-neutral-800">—</option>
            <option value="Pinnacle" className="bg-neutral-800">Pinnacle</option>
            <option value="PS3838" className="bg-neutral-800">PS3838</option>
            <option value="1xBet" className="bg-neutral-800">1xBet</option>
            <option value="Stake" className="bg-neutral-800">Stake</option>
            <option value="Bet365" className="bg-neutral-800">Bet365</option>
            <option value="OrbitX" className="bg-neutral-800">OrbitX</option>
            <option value="Winamax" className="bg-neutral-800">Winamax</option>
            <option value="Betclic" className="bg-neutral-800">Betclic</option>
            <option value="Unibet" className="bg-neutral-800">Unibet</option>
            <option value="PMU" className="bg-neutral-800">PMU</option>
            <option value="Bwin" className="bg-neutral-800">Bwin</option>
            <option value="FDJ" className="bg-neutral-800">FDJ / Parions Sport</option>
            <option value="NetBet" className="bg-neutral-800">NetBet</option>
            <option value="Betsson" className="bg-neutral-800">Betsson</option>
            <option value="Vbet" className="bg-neutral-800">Vbet</option>
            <option value="Betway" className="bg-neutral-800">Betway</option>
            <option value="PokerStars" className="bg-neutral-800">PokerStars</option>
            <option value="ZEbet" className="bg-neutral-800">ZEbet</option>
            <option value="BarriereBet" className="bg-neutral-800">BarriereBet</option>
            <option value="CircusBet" className="bg-neutral-800">CircusBet</option>
            <option value="Autre" className="bg-neutral-800">Autre</option>
          </select>
        </div>

        {/* Sport + Type */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="mt-1 w-full rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50"
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
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Type</label>
            <div className="mt-1 flex gap-2">
              {(["simple", "combiné"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBetType(t)}
                  className={`cursor-pointer flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                    betType === t
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 bg-white/5 text-neutral-500 hover:border-white/20"
                  }`}
                >
                  {t === "simple" ? "Simple" : "Combiné"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Match + Pronostic + Date */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Match <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="PSG vs Marseille"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Pronostic <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="PSG gagne"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Date du match
          </label>
          <input
            type="date"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 [color-scheme:dark]"
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
  const [sport, setSport] = useState(step.sport || "");
  const [matchName, setMatchName] = useState(step.match_name || "");
  const [description, setDescription] = useState(step.description || "");
  const [matchDate, setMatchDate] = useState(step.match_date || "");
  const [betType, setBetType] = useState<"simple" | "combiné">(step.bet_type || "simple");
  const [bookmaker, setBookmaker] = useState(step.bookmaker || "");
  const [odds, setOdds] = useState(String(step.odds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Cote modifiable UNIQUEMENT si dernier step ET pending
  const canEditOdds = isLastStep && step.result === "pending";

  async function handleSave() {
    setSaving(true);
    setError("");

    const payload: Record<string, unknown> = {
      action: "update_step",
      step_id: step.id,
      sport: sport || null,
      match_name: matchName || null,
      description: description || null,
      match_date: matchDate || null,
      bet_type: betType,
      bookmaker: bookmaker || null,
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

    const res = await fetch("/api/montantes", {
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
      <div
        className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-white">Modifier palier {step.step_number}</h2>
          <button onClick={onClose} className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-neutral-400 hover:bg-white/20">
            ✕
          </button>
        </div>

        {/* Cote (conditional) */}
        {canEditOdds ? (
          <div className="mb-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Cote du pari</label>
            <input
              type="number"
              step="0.001"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              placeholder="1.85"
              className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-bold text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
            />
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-400/80">
              La cote ({parseFloat(String(step.odds)).toFixed(3)}) ne peut être modifiée que sur le dernier palier non résolu.
            </p>
          </div>
        )}

        {/* Bookmaker */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Bookmaker</label>
          <select
            value={bookmaker}
            onChange={(e) => setBookmaker(e.target.value)}
            className="mt-1 w-full rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50"
          >
            <option value="" className="bg-neutral-800">—</option>
            <option value="Pinnacle" className="bg-neutral-800">Pinnacle</option>
            <option value="PS3838" className="bg-neutral-800">PS3838</option>
            <option value="1xBet" className="bg-neutral-800">1xBet</option>
            <option value="Stake" className="bg-neutral-800">Stake</option>
            <option value="Bet365" className="bg-neutral-800">Bet365</option>
            <option value="OrbitX" className="bg-neutral-800">OrbitX</option>
            <option value="Winamax" className="bg-neutral-800">Winamax</option>
            <option value="Betclic" className="bg-neutral-800">Betclic</option>
            <option value="Unibet" className="bg-neutral-800">Unibet</option>
            <option value="PMU" className="bg-neutral-800">PMU</option>
            <option value="Bwin" className="bg-neutral-800">Bwin</option>
            <option value="FDJ" className="bg-neutral-800">FDJ / Parions Sport</option>
            <option value="NetBet" className="bg-neutral-800">NetBet</option>
            <option value="Betsson" className="bg-neutral-800">Betsson</option>
            <option value="Vbet" className="bg-neutral-800">Vbet</option>
            <option value="Betway" className="bg-neutral-800">Betway</option>
            <option value="PokerStars" className="bg-neutral-800">PokerStars</option>
            <option value="ZEbet" className="bg-neutral-800">ZEbet</option>
            <option value="BarriereBet" className="bg-neutral-800">BarriereBet</option>
            <option value="CircusBet" className="bg-neutral-800">CircusBet</option>
            <option value="Autre" className="bg-neutral-800">Autre</option>
          </select>
        </div>

        {/* Sport + Type */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="mt-1 w-full rounded-xl bg-neutral-800 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50"
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
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Type</label>
            <div className="mt-1 flex gap-2">
              {(["simple", "combiné"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBetType(t)}
                  className={`cursor-pointer flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition ${
                    betType === t
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 bg-white/5 text-neutral-500 hover:border-white/20"
                  }`}
                >
                  {t === "simple" ? "Simple" : "Combiné"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Match */}
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Match
          </label>
          <input
            type="text"
            value={matchName}
            onChange={(e) => setMatchName(e.target.value)}
            placeholder="PSG vs Marseille"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
          />
        </div>

        {/* Pronostic */}
        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Pronostic
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="PSG gagne"
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
            Date du match
          </label>
          <input
            type="date"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
            className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 [color-scheme:dark]"
          />
        </div>

        {error && <p className="mb-3 text-center text-xs font-bold text-red-400">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="cursor-pointer w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Sauvegarde..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}