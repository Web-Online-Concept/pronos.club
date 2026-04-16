"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface MarketResult {
  probabilities: {
    implicit: number;   // Probabilité implicite brute (avec marge)
    real: number;       // Probabilité réelle (normalisée sans marge)
  }[];
  trj: number;          // TRJ du marché
  margin: number;       // Marge bookmaker
  isValid: boolean;
  quality: "excellent" | "good" | "average" | "poor";
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcMarket(odds: string[]): MarketResult | null {
  const oddsNum = odds.map((o) => parseFloat(o));
  if (oddsNum.some((v) => !v || v <= 1)) return null;

  const implicitProbs = oddsNum.map((o) => (1 / o) * 100);
  const sumImplicit = implicitProbs.reduce((s, p) => s + p, 0);
  const trj = (100 / sumImplicit) * 100;
  const margin = sumImplicit - 100;

  const realProbs = implicitProbs.map((p) => (p / sumImplicit) * 100);

  let quality: MarketResult["quality"] = "poor";
  if (trj >= 99) quality = "excellent";
  else if (trj >= 97) quality = "good";
  else if (trj >= 94) quality = "average";

  return {
    probabilities: oddsNum.map((_, i) => ({
      implicit: implicitProbs[i],
      real: realProbs[i],
    })),
    trj,
    margin,
    isValid: true,
    quality,
  };
}

// ═══════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

function OddBlock({
  label,
  value,
  onChange,
  prob,
  accentColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prob: { implicit: number; real: number } | null;
  accentColor: string;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-4"
      style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${accentColor}25 100%)` }}
    >
      <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/60">
        {label}
      </p>
      <input
        type="number"
        step="0.001"
        min="1.001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="1.500"
        inputMode="decimal"
        className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-center font-mono text-base font-extrabold text-white placeholder-white/20 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20"
      />

      {/* Results */}
      {prob && (
        <div className="mt-3 space-y-1.5">
          <div className="rounded-lg bg-white/5 px-2 py-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-wider text-white/40">Implicite</p>
            <p className="font-mono text-sm font-black text-white">{prob.implicit.toFixed(2)}%</p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-400/70">Réelle</p>
            <p className="font-mono text-sm font-black text-emerald-300">{prob.real.toFixed(2)}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketSummary({ result }: { result: MarketResult }) {
  const qualityConfig = {
    excellent: {
      bg: "linear-gradient(135deg, #047857 0%, #10b981 100%)",
      label: "✅ Excellent TRJ",
      sub: "Marge bookmaker très faible",
    },
    good: {
      bg: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
      label: "👍 Bon TRJ",
      sub: "Marge bookmaker raisonnable",
    },
    average: {
      bg: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
      label: "⚠️ TRJ moyen",
      sub: "Marge bookmaker élevée",
    },
    poor: {
      bg: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)",
      label: "❌ Mauvais TRJ",
      sub: "Marge bookmaker très élevée — cherche ailleurs",
    },
  };

  const c = qualityConfig[result.quality];

  return (
    <div className="mt-4 rounded-2xl px-5 py-4 text-center shadow-lg" style={{ background: c.bg }}>
      <p className="text-sm font-black text-white">{c.label}</p>
      <p className="mt-1 text-[11px] font-semibold text-white/70">{c.sub}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/15 px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/70">TRJ</p>
          <p className="font-mono text-base font-black text-white">{result.trj.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg bg-white/15 px-3 py-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/70">Marge</p>
          <p className="font-mono text-base font-black text-white">{result.margin.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ProbabilitesCotesPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [odds3, setOdds3] = useState<string[]>(["", "", ""]);
  const [odds2, setOdds2] = useState<string[]>(["", ""]);

  function update3(i: number, v: string) {
    const next = [...odds3];
    next[i] = v;
    setOdds3(next);
  }

  function update2(i: number, v: string) {
    const next = [...odds2];
    next[i] = v;
    setOdds2(next);
  }

  function resetAll() {
    setOdds3(["", "", ""]);
    setOdds2(["", ""]);
  }

  const result3 = useMemo(() => calcMarket(odds3), [odds3]);
  const result2 = useMemo(() => calcMarket(odds2), [odds2]);

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
      <EspaceHero title="Probabilités des cotes" />

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
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* BLOC 3 OPTIONS */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-base">
                  ⚽
                </span>
                <div>
                  <p className="text-sm font-black text-white">3 Options (1X2)</p>
                  <p className="text-[10px] text-white/40">Football — Match Nul possible</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <OddBlock
                  label="Équipe 1"
                  value={odds3[0]}
                  onChange={(v) => update3(0, v)}
                  prob={result3?.probabilities[0] ?? null}
                  accentColor="#059669"
                />
                <OddBlock
                  label="Nul"
                  value={odds3[1]}
                  onChange={(v) => update3(1, v)}
                  prob={result3?.probabilities[1] ?? null}
                  accentColor="#737373"
                />
                <OddBlock
                  label="Équipe 2"
                  value={odds3[2]}
                  onChange={(v) => update3(2, v)}
                  prob={result3?.probabilities[2] ?? null}
                  accentColor="#0891b2"
                />
              </div>

              {result3 && <MarketSummary result={result3} />}
            </div>

            {/* Divider */}
            <div className="my-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* BLOC 2 OPTIONS */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-base">
                  🎾
                </span>
                <div>
                  <p className="text-sm font-black text-white">2 Options</p>
                  <p className="text-[10px] text-white/40">
                    Tennis, Basket, BTTS, Over/Under, Handicap...
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <OddBlock
                  label="Équipe 1"
                  value={odds2[0]}
                  onChange={(v) => update2(0, v)}
                  prob={result2?.probabilities[0] ?? null}
                  accentColor="#059669"
                />
                <OddBlock
                  label="Équipe 2"
                  value={odds2[1]}
                  onChange={(v) => update2(1, v)}
                  prob={result2?.probabilities[1] ?? null}
                  accentColor="#0891b2"
                />
              </div>

              {result2 && <MarketSummary result={result2} />}
            </div>

            {/* Reset button */}
            <div className="mt-6 text-center">
              <button
                onClick={resetAll}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:bg-white/10 hover:text-white/70"
              >
                🔄 Réinitialiser tout
              </button>
            </div>
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
            <h2 className="mt-2 text-xl font-black text-white">Cotes et probabilités</h2>
            <p className="mt-1 text-xs text-white/40">
              Comprendre ce qui se cache vraiment derrière une cote
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — Qu'est-ce qu'une cote ? */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  🎲
                </span>
                <span>Qu&apos;est-ce qu&apos;une cote ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Une cote est simplement l&apos;<strong className="text-neutral-900">inverse d&apos;une probabilité</strong>, multipliée par 1 pour retrouver ta mise.
                </p>
                <p className="mt-3">
                  <strong className="text-emerald-600">Formule :</strong> probabilité implicite = 1 / cote
                </p>
                <div className="mt-3 rounded-xl bg-neutral-50 p-3 font-mono text-xs">
                  <p>Cote 1.50 → proba = 1/1.50 = 66.67%</p>
                  <p>Cote 2.00 → proba = 1/2.00 = 50.00%</p>
                  <p>Cote 3.00 → proba = 1/3.00 = 33.33%</p>
                  <p>Cote 5.00 → proba = 1/5.00 = 20.00%</p>
                </div>
                <p className="mt-3">
                  Plus la cote est haute, plus le bookmaker considère que l&apos;événement est <strong>improbable</strong>.
                </p>
              </div>
            </details>

            {/* Section 2 — Implicite vs Réelle */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  🎯
                </span>
                <span>Probabilité implicite vs réelle — la clé</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">📊 Probabilité implicite (brute)</p>
                  <p className="mt-0.5">
                    Le calcul direct <strong>1/cote</strong>. Mais attention : la somme de toutes les issues dépasse toujours 100% à cause de la <strong className="text-red-600">marge du bookmaker</strong>.
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🎯 Probabilité réelle (normalisée)</p>
                  <p className="mt-0.5 text-emerald-800">
                    On retire la marge pour ramener la somme à 100%. C&apos;est la <strong>vraie estimation</strong> de probabilité du bookmaker (sans sa commission).
                  </p>
                </div>
                <p className="mt-2 text-xs italic">
                  Pour comparer avec ton propre pronostic, utilise toujours la probabilité réelle (celle en emerald dans le calculateur).
                </p>
              </div>
            </details>

            {/* Section 3 — Exemple concret */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  💡
                </span>
                <span>Un exemple concret</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  <strong className="text-neutral-900">Match de foot</strong> : PSG vs Marseille, cotes 1.80 / 3.50 / 4.50.
                </p>
                <div className="rounded-xl bg-neutral-50 p-3 font-mono text-xs">
                  <p className="font-bold">Probabilités implicites (brutes) :</p>
                  <p>→ PSG : 1/1.80 = 55.56%</p>
                  <p>→ Nul : 1/3.50 = 28.57%</p>
                  <p>→ Marseille : 1/4.50 = 22.22%</p>
                  <p className="mt-1 text-red-600">Somme = 106.35% (&gt; 100%)</p>
                </div>
                <p className="mt-2">
                  La différence <strong className="text-red-600">+6.35%</strong> est la{" "}
                  <strong>marge du bookmaker</strong> — sa commission pour se rémunérer.
                </p>
                <div className="rounded-xl bg-emerald-50 p-3 font-mono text-xs text-emerald-800">
                  <p className="font-bold">Probabilités réelles (normalisées) :</p>
                  <p>→ PSG : 55.56 / 106.35 = 52.24%</p>
                  <p>→ Nul : 28.57 / 106.35 = 26.87%</p>
                  <p>→ Marseille : 22.22 / 106.35 = 20.89%</p>
                  <p className="mt-1">Somme = 100% ✅</p>
                </div>
                <p className="mt-2 text-xs italic">
                  Le bookmaker estime donc que PSG a <strong>52.24% de chance</strong> de gagner — c&apos;est sa vraie estimation.
                </p>
              </div>
            </details>

            {/* Section 4 — TRJ et Marge */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  ⚖️
                </span>
                <span>TRJ et marge bookmaker</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Le <strong className="text-neutral-900">TRJ (Taux de Retour Joueur)</strong> indique le pourcentage redistribué par le bookmaker. 100% = pas de marge, 95% = 5% de marge.
                </p>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">✅ Excellent (TRJ ≥ 99%)</p>
                  <p className="mt-0.5 text-emerald-800">
                    Cotes très généreuses. Typique de PS3838/Pinnacle sur les marchés majeurs.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">👍 Bon (97-99%)</p>
                  <p className="mt-0.5">Marge normale d&apos;un bookmaker compétitif sur les gros marchés.</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">⚠️ Moyen (94-97%)</p>
                  <p className="mt-0.5 text-amber-800">
                    Marge élevée, typique des marchés secondaires (scorer, corners, cartons).
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">❌ Mauvais (&lt; 94%)</p>
                  <p className="mt-0.5 text-red-800">
                    Marge très élevée. Évite ce marché ou cherche ailleurs.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 5 — Comment utiliser */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-cyan-300 open:shadow-lg open:shadow-cyan-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-base">
                  🔢
                </span>
                <span>Comment utiliser ce calculateur</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  "Choisis la section selon ton marché : 3 options pour foot 1X2, 2 options pour tennis/basket/BTTS",
                  "Entre les cotes proposées par ton bookmaker",
                  "Lis les probabilités : implicite (brute) et réelle (sans marge)",
                  "Regarde le TRJ et la marge pour évaluer la qualité du bookmaker",
                  "Compare la probabilité réelle avec ton propre pronostic : si la tienne est plus haute, tu as potentiellement une value",
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500 text-xs font-black text-white">
                      {i + 1}
                    </span>
                    <p className="text-sm text-neutral-600">{step}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 6 — Cas d'usage */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-rose-300 open:shadow-lg open:shadow-rose-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-base">
                  🎬
                </span>
                <span>Quand utiliser cet outil ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎯 Détecter une value</p>
                  <p className="mt-0.5">
                    Si tu estimes qu&apos;une équipe a 60% de chance de gagner mais que la proba réelle du book est 50%, tu as une value.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">⚖️ Comparer deux bookmakers</p>
                  <p className="mt-0.5">
                    Le book avec le TRJ le plus élevé est le plus généreux. Change de book pour les cotes trop faibles.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">📚 Apprendre les probas</p>
                  <p className="mt-0.5">
                    Comprendre ce qu&apos;une cote représente vraiment, au-delà du simple multiplicateur.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🧮 Préparer un combiné</p>
                  <p className="mt-0.5">
                    Multiplier les probabilités réelles pour estimer la vraie probabilité d&apos;un combiné.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 7 — Conseils pro */}
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
                    📌 La probabilité <span className="font-bold text-emerald-400">réelle</span> est toujours plus juste que l&apos;implicite
                  </p>
                  <p>
                    📌 <span className="font-bold text-white">Pinnacle/PS3838</span> a les marges les plus faibles → proba réelle très précise
                  </p>
                  <p>
                    📌 Méfie-toi des TRJ <span className="font-bold text-red-400">&lt; 95%</span> : marge excessive
                  </p>
                  <p>
                    📌 Les <span className="font-bold text-amber-400">marchés secondaires</span> (corners, cartons) ont toujours des TRJ plus bas que 1X2
                  </p>
                  <p>
                    📌 Pour trouver une <span className="font-bold text-emerald-400">value</span>, compare TA proba estimée à la proba RÉELLE du book
                  </p>
                  <p>
                    📌 En combiné, multiplie les <span className="font-bold text-white">probas réelles</span> pour estimer la vraie probabilité
                  </p>
                  <p>
                    📌 Plus le marché est <span className="font-bold text-emerald-400">liquide</span> (matchs majeurs), plus les probas sont précises
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