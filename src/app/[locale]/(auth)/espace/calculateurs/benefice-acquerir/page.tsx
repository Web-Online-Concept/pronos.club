"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface BenefitResult {
  stake: number;          // Mise à placer
  payout: number;         // Gain brut total (mise × cote)
  profit: number;         // Profit net (= bénéfice souhaité, confirmation)
  ratio: number;          // Ratio mise/profit
  isLowOdd: boolean;      // Warning si cote < 1.20
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcBenefit(profit: number, odd: number): BenefitResult | null {
  if (profit <= 0 || odd <= 1) return null;

  const stake = profit / (odd - 1);
  const payout = stake * odd;
  const ratio = stake / profit;
  const isLowOdd = odd < 1.2;

  return {
    stake,
    payout,
    profit,
    ratio,
    isLowOdd,
  };
}

// ═══════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ResultCard({
  label,
  value,
  suffix,
  color,
  icon,
  big = false,
}: {
  label: string;
  value: number;
  suffix: string;
  color: "green" | "red" | "amber" | "neutral" | "emerald_hero";
  icon: string;
  big?: boolean;
}) {
  const bg = {
    green: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
    red: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
    amber: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
    neutral: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    emerald_hero: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)",
  };
  return (
    <div
      className={`overflow-hidden rounded-2xl text-center shadow-lg ${big ? "p-6" : "p-4"}`}
      style={{ background: bg[color] }}
    >
      <span className={big ? "text-2xl" : "text-lg"}>{icon}</span>
      <p className={`mt-1 font-bold uppercase tracking-[0.2em] text-white/70 ${big ? "text-[10px]" : "text-[9px]"}`}>
        {label}
      </p>
      <p className={`mt-1 font-mono font-black text-white ${big ? "text-4xl" : "text-2xl"}`}>
        {value.toFixed(2)}
        {suffix}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function BeneficeAcquerirPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [profit, setProfit] = useState("100");
  const [odd, setOdd] = useState("");

  function resetAll() {
    setProfit("100");
    setOdd("");
  }

  const result = useMemo((): BenefitResult | null => {
    const p = parseFloat(profit);
    const o = parseFloat(odd);
    if (!p || !o || p <= 0 || o <= 1) return null;
    return calcBenefit(p, o);
  }, [profit, odd]);

  if (!isPremium) {
    return (
      <>
        <EspaceHero title="Accès réservé" />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-4 text-sm font-bold text-neutral-500">
            Cette page est réservée aux abonnés Premium.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <EspaceHero title="Bénéfice à acquérir" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {/* ╔══════════════════════════════════════════════════════╗ */}
        {/* ║              CALCULATEUR                            ║ */}
        {/* ╚══════════════════════════════════════════════════════╝ */}

        <div
          className="overflow-hidden rounded-3xl border border-white/[0.06] shadow-2xl"
          style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d1f17 40%, #0a0a0a 100%)" }}
        >
          {/* Header accent */}
          <div
            className="h-1"
            style={{ background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)" }}
          />

          <div className="px-5 pb-6 pt-5 sm:px-8">
            <p className="text-center text-[11px] font-medium text-white/40">
              Tu veux gagner un montant précis ? Calcule la mise à placer selon la cote.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {/* Bénéfice souhaité */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
              >
                <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                  💰 Bénéfice souhaité (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={profit}
                  onChange={(e) => setProfit(e.target.value)}
                  placeholder="100"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-center font-mono text-xl font-black text-emerald-300 placeholder-emerald-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                />
              </div>

              {/* Cote */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1e3d 100%)" }}
              >
                <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                  🎯 Cote
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="1.001"
                  value={odd}
                  onChange={(e) => setOdd(e.target.value)}
                  placeholder="1.500"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-center font-mono text-xl font-black text-cyan-300 placeholder-cyan-700 outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {/* Reset button */}
            <div className="mt-4 text-center">
              <button
                onClick={resetAll}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:bg-white/10 hover:text-white/70"
              >
                🔄 Réinitialiser
              </button>
            </div>

            {/* Results */}
            {result && (
              <>
                <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                {/* Mise principale (hero) */}
                <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                  💎 Mise à placer
                </p>
                <ResultCard
                  label="Mise nécessaire"
                  value={result.stake}
                  suffix="€"
                  color="emerald_hero"
                  icon="🎯"
                  big
                />

                {/* Warning cote faible */}
                {result.isLowOdd && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
                    <p className="text-xs font-bold text-amber-400">⚠️ Cote très faible détectée</p>
                    <p className="mt-1 text-[11px] text-amber-400/80">
                      À cette cote, tu dois miser <strong>{result.ratio.toFixed(1)}×</strong> ton bénéfice souhaité. Risque disproportionné en cas de perte.
                    </p>
                  </div>
                )}

                {/* Résultats secondaires */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <ResultCard label="Gain brut total" value={result.payout} suffix="€" color="neutral" icon="💵" />
                  <ResultCard label="Profit net" value={result.profit} suffix="€" color="green" icon="✅" />
                </div>

                {/* Ratio info */}
                <div className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Rapport mise / profit
                  </p>
                  <p className="mt-1 font-mono text-sm font-black text-white">
                    {result.ratio.toFixed(2)}×
                  </p>
                  <p className="mt-1 text-[10px] italic text-white/30">
                    Tu risques {result.ratio.toFixed(2)}€ pour en gagner 1€
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ╔══════════════════════════════════════════════════════╗ */}
        {/* ║              TUTORIEL                               ║ */}
        {/* ╚══════════════════════════════════════════════════════╝ */}

        <div className="mt-12">
          {/* Tutorial header */}
          <div
            className="rounded-t-3xl px-6 py-5 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
              📚 Guide complet
            </p>
            <h2 className="mt-2 text-xl font-black text-white">Comment ça marche ?</h2>
            <p className="mt-1 text-xs text-white/40">
              L&apos;inverse du calcul classique : partir du gain pour trouver la mise
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  💰
                </span>
                <span>À quoi ça sert ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Habituellement, tu fixes ta mise et tu regardes combien tu peux gagner. Ici, c&apos;est l&apos;<strong className="text-neutral-900">inverse</strong> :
                </p>
                <p className="mt-3">
                  Tu fixes un <strong className="text-emerald-600">objectif de gain</strong> (ex: gagner 100€), et le calculateur te dit exactement{" "}
                  <strong className="text-emerald-600">combien miser</strong> selon la cote disponible.
                </p>
                <p className="mt-3">
                  Utile pour <strong>atteindre un objectif précis</strong> : débloquer un bonus, financer un achat, ou respecter un plan de bankroll.
                </p>
              </div>
            </details>

            {/* Section 2 — La formule */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  🧮
                </span>
                <span>La formule</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-4 text-center font-mono">
                  <p className="text-sm font-bold text-neutral-900">
                    Mise = Bénéfice ÷ (Cote - 1)
                  </p>
                </div>
                <p>
                  Logique : quand tu gagnes un pari à cote C avec une mise M, ton gain brut est M×C, et ton{" "}
                  <strong className="text-neutral-900">profit net</strong> est M×C - M = M×(C-1).
                </p>
                <p>
                  Donc pour viser un profit P : <strong className="text-emerald-600">M = P / (C-1)</strong>
                </p>
                <div className="rounded-xl bg-emerald-50 p-3 font-mono text-xs text-emerald-800">
                  <p className="font-bold">Exemples :</p>
                  <p>→ Viser 100€ à cote 2.00 → mise = 100 / 1.00 = 100€</p>
                  <p>→ Viser 100€ à cote 1.50 → mise = 100 / 0.50 = 200€</p>
                  <p>→ Viser 100€ à cote 3.00 → mise = 100 / 2.00 = 50€</p>
                </div>
              </div>
            </details>

            {/* Section 3 — Cas d'usage */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  🎬
                </span>
                <span>Quand l&apos;utiliser ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎁 Débloquer un bonus</p>
                  <p className="mt-0.5">
                    &quot;Il me faut 30€ de mise à cote 2.00 min pour valider le bonus&quot; → calcul direct.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎯 Objectif mensuel</p>
                  <p className="mt-0.5">
                    &quot;Je veux faire +500€ ce mois-ci&quot; → calcule la mise par pari selon les cotes disponibles.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">💎 Achat ciblé</p>
                  <p className="mt-0.5">
                    &quot;Il me manque 200€ pour un achat précis&quot; → une seule prise de position bien pensée.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">📊 Gestion de bankroll</p>
                  <p className="mt-0.5">
                    Pour respecter un plan &quot;+1% de BK par jour&quot; → calcul de la mise exacte.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 4 — Les pièges */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-rose-300 open:shadow-lg open:shadow-rose-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-base">
                  ⚠️
                </span>
                <span>Les pièges à éviter</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🚨 Cote trop faible</p>
                  <p className="mt-0.5 text-red-700">
                    À cote 1.10, pour gagner 100€ il faut miser 1000€. Le risque devient disproportionné : une seule perte et tu effaces 10 gains.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">💭 L&apos;illusion du &quot;gain sûr&quot;</p>
                  <p className="mt-0.5 text-red-700">
                    Une cote faible n&apos;est pas un gain garanti. 1.10 = 90.9% de proba selon le book, donc ~1 perte sur 10 paris en moyenne.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🎯 Chasser une perte</p>
                  <p className="mt-0.5 text-red-700">
                    &quot;J&apos;ai perdu 200€, je dois les récupérer&quot; = le piège classique. La proba ne change pas, seul ton niveau de risque augmente.
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
                    📌 Évite les cotes <span className="font-bold text-red-400">&lt; 1.30</span> sauf stratégie spécifique (surebet, bonus)
                  </p>
                  <p>
                    📌 Ne risque jamais plus de <span className="font-bold text-white">1-3% de ta bankroll</span> sur un seul pari
                  </p>
                  <p>
                    📌 Un gain fixé ne garantit pas un gain <span className="font-bold text-amber-400">obtenu</span> — tu dois quand même gagner le pari
                  </p>
                  <p>
                    📌 Cote idéale pour viser un gain : entre <span className="font-bold text-emerald-400">1.50 et 2.50</span> (équilibre risque/gain)
                  </p>
                  <p>
                    📌 Combine avec le calculateur <span className="font-bold text-white">Kelly</span> pour ajuster ta mise à ta confiance
                  </p>
                  <p>
                    📌 Attention aux <span className="font-bold text-red-400">mises max</span> des bookmakers sur cotes très faibles
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}