"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Quality = "excellent" | "good" | "decent" | "break_even" | "losing";

interface ROIResult {
  roi: number;                // ROI en %
  profit: number;             // Bénéfice total
  totalStake: number;         // Mise totale
  payoutMultiplier: number;   // Multiplicateur (1 + ROI/100)
  quality: Quality;
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcROI(profit: number, totalStake: number): ROIResult | null {
  if (totalStake <= 0) return null;

  const roi = (profit / totalStake) * 100;
  const payoutMultiplier = 1 + roi / 100;

  let quality: Quality;
  if (roi >= 10) quality = "excellent";
  else if (roi >= 5) quality = "good";
  else if (roi >= 2) quality = "decent";
  else if (roi >= 0) quality = "break_even";
  else quality = "losing";

  return {
    roi,
    profit,
    totalStake,
    payoutMultiplier,
    quality,
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
}: {
  label: string;
  value: number;
  suffix: string;
  color: "green" | "red" | "amber" | "neutral";
  icon: string;
}) {
  const bg = {
    green: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
    red: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
    amber: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
    neutral: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
  };
  return (
    <div className="overflow-hidden rounded-2xl p-4 text-center shadow-lg" style={{ background: bg[color] }}>
      <span className="text-lg">{icon}</span>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black text-white">
        {value.toFixed(2)}
        {suffix}
      </p>
    </div>
  );
}

function ROIHeroCard({ roi, quality }: { roi: number; quality: Quality }) {
  const config = {
    excellent: {
      bg: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)",
      label: "🏆 EXCELLENT",
      sub: "Niveau professionnel — rare et remarquable",
    },
    good: {
      bg: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
      label: "✅ BON",
      sub: "Au-dessus de la moyenne — tu es rentable sur le long terme",
    },
    decent: {
      bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
      label: "👍 RENTABLE",
      sub: "Profit modeste mais réel — tu bats le bookmaker",
    },
    break_even: {
      bg: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
      label: "⚠️ JUSTE RENTABLE",
      sub: "Proche du breakeven — marge très faible",
    },
    losing: {
      bg: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)",
      label: "❌ PERDANT",
      sub: "Tu perds de l'argent sur le long terme — revois ta stratégie",
    },
  };
  const c = config[quality];
  return (
    <div className="rounded-3xl px-6 py-8 text-center shadow-xl" style={{ background: c.bg }}>
      <span className="text-3xl">📈</span>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">
        Retour sur investissement
      </p>
      <p className="mt-2 font-mono text-6xl font-black text-white">
        {roi >= 0 ? "+" : ""}
        {roi.toFixed(2)}%
      </p>
      <div className="mt-4 inline-block rounded-xl bg-white/20 px-4 py-2">
        <p className="text-sm font-black text-white">{c.label}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-white/80">{c.sub}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ROIPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [profit, setProfit] = useState("");
  const [totalStake, setTotalStake] = useState("");

  function resetAll() {
    setProfit("");
    setTotalStake("");
  }

  const result = useMemo((): ROIResult | null => {
    const p = parseFloat(profit);
    const s = parseFloat(totalStake);
    if (isNaN(p) || !s || s <= 0) return null;
    return calcROI(p, s);
  }, [profit, totalStake]);

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
      <EspaceHero title="Calculer ROI %" />

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
              Mesure le rendement de tes paris sur une période donnée
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {/* Bénéfice total */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
              >
                <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                  💰 Bénéfice total (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={profit}
                  onChange={(e) => setProfit(e.target.value)}
                  placeholder="520"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-center font-mono text-xl font-black text-emerald-300 placeholder-emerald-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                />
              </div>

              {/* Mise totale */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1e3d 100%)" }}
              >
                <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                  🎯 Mise totale (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={totalStake}
                  onChange={(e) => setTotalStake(e.target.value)}
                  placeholder="4300"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-center font-mono text-xl font-black text-cyan-300 placeholder-cyan-700 outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {/* Helper */}
            <p className="mt-3 text-center text-[11px] italic text-white/30">
              💡 Bénéfice total = Gains - Pertes sur l&apos;ensemble de tes paris
            </p>

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

                {/* ROI hero */}
                <ROIHeroCard roi={result.roi} quality={result.quality} />

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <ResultCard
                    label="Bénéfice"
                    value={result.profit}
                    suffix="€"
                    color={result.profit >= 0 ? "green" : "red"}
                    icon="💎"
                  />
                  <ResultCard label="Misé au total" value={result.totalStake} suffix="€" color="neutral" icon="🎰" />
                  <ResultCard
                    label="Multiplicateur"
                    value={result.payoutMultiplier}
                    suffix="×"
                    color={result.roi >= 0 ? "green" : "red"}
                    icon="📊"
                  />
                </div>

                {/* Benchmark scale */}
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                    📏 Échelle de référence
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { range: "ROI ≥ 10%", label: "🏆 Excellent", color: "text-emerald-400", active: result.quality === "excellent" },
                      { range: "5% → 10%", label: "✅ Bon", color: "text-emerald-300", active: result.quality === "good" },
                      { range: "2% → 5%", label: "👍 Rentable", color: "text-green-400", active: result.quality === "decent" },
                      { range: "0% → 2%", label: "⚠️ Juste rentable", color: "text-amber-400", active: result.quality === "break_even" },
                      { range: "< 0%", label: "❌ Perdant", color: "text-red-400", active: result.quality === "losing" },
                    ].map((level) => (
                      <div
                        key={level.range}
                        className={`flex items-center justify-between rounded-lg px-3 py-1.5 transition ${
                          level.active ? "bg-white/10 ring-1 ring-white/20" : ""
                        }`}
                      >
                        <span className={`text-[11px] font-mono ${level.active ? "text-white" : "text-white/40"}`}>
                          {level.range}
                        </span>
                        <span className={`text-[11px] font-bold ${level.color}`}>{level.label}</span>
                      </div>
                    ))}
                  </div>
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
            <h2 className="mt-2 text-xl font-black text-white">Comprendre le ROI</h2>
            <p className="mt-1 text-xs text-white/40">
              La vraie mesure de ta performance, au-delà du seul bénéfice
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  📈
                </span>
                <span>C&apos;est quoi le ROI ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Le <strong className="text-emerald-600">ROI (Return On Investment)</strong> est le rendement de tes paris exprimé en pourcentage de ce que tu as misé.
                </p>
                <div className="mt-3 rounded-xl bg-neutral-50 p-4 text-center font-mono">
                  <p className="text-sm font-bold text-neutral-900">
                    ROI = (Bénéfice ÷ Mise totale) × 100
                  </p>
                </div>
                <p className="mt-3">
                  <strong className="text-neutral-900">Exemple :</strong> tu as misé 4300€ au total et gagné 520€ net. Ton ROI = 520/4300 × 100 ={" "}
                  <strong className="text-emerald-600">12.09%</strong>.
                </p>
                <p className="mt-3">
                  Le ROI est <strong>bien plus parlant que le bénéfice brut</strong> : gagner 1000€ en misant 100 000€ (ROI 1%) n&apos;a rien à voir avec gagner 1000€ en misant 10 000€ (ROI 10%).
                </p>
              </div>
            </details>

            {/* Section 2 — Pourquoi c'est essentiel */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  🎯
                </span>
                <span>Pourquoi c&apos;est LA métrique qui compte</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Beaucoup de parieurs se vantent de leurs gains sans parler des mises. Le ROI remet les choses à plat :
                </p>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎯 Comparable entre parieurs</p>
                  <p className="mt-0.5">
                    Un gros parieur qui fait 15% de ROI sur 50 000€ misé est moins performant qu&apos;un petit parieur qui fait 30% sur 5 000€.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">📊 Évaluer une stratégie</p>
                  <p className="mt-0.5">
                    Ton ROI mensuel te dit si ta méthode fonctionne, indépendamment de la taille de ta bankroll.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">💎 Prévoir tes gains</p>
                  <p className="mt-0.5">
                    Avec un ROI stable, tu peux projeter tes gains : &quot;si je mise 1000€/mois à 5% ROI, je gagne 50€/mois&quot;.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 3 — Benchmarks */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  📏
                </span>
                <span>Qu&apos;est-ce qu&apos;un BON ROI ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Beaucoup d&apos;amateurs pensent qu&apos;il faut viser 50%+. En réalité, le paris sportifs professionnel tourne autour de 2-8% :
                </p>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🏆 ROI ≥ 10%</p>
                  <p className="mt-0.5 text-emerald-800">
                    <strong>Niveau pro/elite.</strong> Rare et remarquable, souvent sur des volumes modestes ou sur une période courte.
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">✅ ROI 5-10%</p>
                  <p className="mt-0.5 text-emerald-800">
                    <strong>Très bon niveau.</strong> Typique d&apos;un parieur sérieux qui suit une méthode disciplinée (value betting, pronostiqueurs sélectifs).
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">👍 ROI 2-5%</p>
                  <p className="mt-0.5">
                    <strong>Rentable.</strong> Tu bats les bookmakers mais modestement. C&apos;est déjà un excellent résultat sur le long terme.
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">⚠️ ROI 0-2%</p>
                  <p className="mt-0.5 text-amber-800">
                    <strong>Breakeven.</strong> Une seule mauvaise série peut te faire passer dans le rouge. À surveiller.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">❌ ROI &lt; 0%</p>
                  <p className="mt-0.5 text-red-800">
                    <strong>Perdant.</strong> La majorité des parieurs amateurs. Il faut revoir la stratégie.
                  </p>
                </div>
                <p className="mt-2 text-xs italic">
                  À noter : les bookmakers ont typiquement 3-7% de marge (TRJ 93-97%). Un ROI positif signifie que tu bats cette marge.
                </p>
              </div>
            </details>

            {/* Section 4 — Sur quelle période */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  📅
                </span>
                <span>Sur combien de paris c&apos;est fiable ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Le ROI est une <strong className="text-neutral-900">moyenne</strong> : plus tu as de paris, plus il est fiable. Un ROI calculé sur 10 paris ne veut pas dire grand-chose.
                </p>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">❌ &lt; 100 paris</p>
                  <p className="mt-0.5 text-red-800">Trop peu fiable, beaucoup trop de variance. Ne tire aucune conclusion.</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">⚠️ 100-500 paris</p>
                  <p className="mt-0.5 text-amber-800">Première tendance visible mais encore beaucoup de hasard.</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">✅ 500-1000 paris</p>
                  <p className="mt-0.5 text-emerald-800">ROI fiable. Tu peux évaluer ta stratégie.</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🏆 1000+ paris</p>
                  <p className="mt-0.5 text-emerald-800">ROI très fiable. Représente ton vrai niveau de skill.</p>
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
                    📌 Un ROI <span className="font-bold text-emerald-400">stable 3-5%</span> sur 1000+ paris = tu es un excellent parieur
                  </p>
                  <p>
                    📌 Méfie-toi des <span className="font-bold text-red-400">ROI &gt; 30%</span> sur petit échantillon : probabilité haute de régression
                  </p>
                  <p>
                    📌 Calcule ton ROI <span className="font-bold text-white">par type de pari</span> (1X2, Over/Under, BTTS...) pour identifier tes forces
                  </p>
                  <p>
                    📌 Le ROI baisse mécaniquement avec les <span className="font-bold text-amber-400">combinés</span> (marge multipliée)
                  </p>
                  <p>
                    📌 Un parieur pro vise <span className="font-bold text-emerald-400">5-8% ROI</span> sur du long terme, pas plus
                  </p>
                  <p>
                    📌 Le Yield (= ROI) est la <span className="font-bold text-white">vraie mesure</span> de la skill, pas le bénéfice absolu
                  </p>
                  <p>
                    📌 Suis ton ROI <span className="font-bold text-emerald-400">mois par mois</span> pour détecter les tendances (sport chaud/froid)
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