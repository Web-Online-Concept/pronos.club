"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Quality = "excellent" | "good" | "decent" | "high_margin" | "unacceptable";

interface TRJResult {
  trj: number;      // TRJ en %
  margin: number;   // Marge bookmaker en %
  quality: Quality;
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcTRJ(odds: string[]): TRJResult | null {
  const oddsNum = odds.map((o) => parseFloat(o));
  if (oddsNum.some((v) => !v || v <= 1)) return null;

  const invSum = oddsNum.reduce((s, o) => s + 1 / o, 0);
  const trj = (100 / invSum) * 100;
  const margin = ((invSum - 1) * 100) / invSum;

  let quality: Quality;
  if (trj >= 99) quality = "excellent";
  else if (trj >= 97) quality = "good";
  else if (trj >= 94) quality = "decent";
  else if (trj >= 90) quality = "high_margin";
  else quality = "unacceptable";

  return { trj, margin, quality };
}

// ═══════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

function OddInput({
  label,
  value,
  onChange,
  accentColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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
    </div>
  );
}

function TRJHeroCard({ result, label }: { result: TRJResult; label: string }) {
  const config = {
    excellent: {
      bg: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)",
      label: "🏆 EXCELLENT",
      sub: "Niveau Pinnacle/PS3838 — marge ultra faible",
    },
    good: {
      bg: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
      label: "✅ BON",
      sub: "Bookmaker compétitif — marge raisonnable",
    },
    decent: {
      bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
      label: "👍 CORRECT",
      sub: "Marge standard — acceptable pour du récréatif",
    },
    high_margin: {
      bg: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
      label: "⚠️ MARGE ÉLEVÉE",
      sub: "Typique des marchés secondaires — cherche mieux",
    },
    unacceptable: {
      bg: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)",
      label: "❌ INACCEPTABLE",
      sub: "Marge excessive — évite ce bookmaker/marché",
    },
  };
  const c = config[result.quality];
  return (
    <div className="mt-4 rounded-2xl px-5 py-5 text-center shadow-xl" style={{ background: c.bg }}>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">{label}</p>
      <p className="mt-2 font-mono text-4xl font-black text-white">{result.trj.toFixed(2)}%</p>
      <div className="mt-3 inline-block rounded-xl bg-white/20 px-4 py-1.5">
        <p className="text-xs font-black text-white">{c.label}</p>
      </div>
      <p className="mt-2 text-[10px] font-semibold text-white/70">{c.sub}</p>
      <div className="mt-3 inline-block rounded-lg bg-white/10 px-3 py-1">
        <p className="text-[10px] font-bold text-white/80">
          Marge bookmaker : <span className="font-mono">{result.margin.toFixed(2)}%</span>
        </p>
      </div>
    </div>
  );
}

function MarketComparator({ r3, r2 }: { r3: TRJResult; r2: TRJResult }) {
  const diff = r3.trj - r2.trj;
  const better = Math.abs(diff) < 0.1 ? null : diff > 0 ? "3 options" : "2 options";

  if (!better) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">
          ⚖️ Comparaison
        </p>
        <p className="mt-2 text-sm font-bold text-white">Les 2 marchés ont des TRJ équivalents</p>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-emerald-500/30 px-5 py-4 text-center"
      style={{
        background: "linear-gradient(135deg, #064e3b 0%, #047857 50%, #064e3b 100%)",
      }}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
        🎯 Marché le plus avantageux
      </p>
      <p className="mt-2 text-lg font-black text-white">Section {better}</p>
      <p className="mt-1 text-xs text-white/70">
        Écart de TRJ : <span className="font-mono font-bold text-emerald-300">+{Math.abs(diff).toFixed(2)}%</span>
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function TRJPage() {
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

  const result3 = useMemo(() => calcTRJ(odds3), [odds3]);
  const result2 = useMemo(() => calcTRJ(odds2), [odds2]);

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
      <EspaceHero title="Calculer TRJ" />

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
              Taux de Retour au Joueur — la qualité du bookmaker sur un marché
            </p>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* BLOC 3 OPTIONS */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="mt-6">
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
                <OddInput
                  label="Équipe 1"
                  value={odds3[0]}
                  onChange={(v) => update3(0, v)}
                  accentColor="#059669"
                />
                <OddInput
                  label="Nul"
                  value={odds3[1]}
                  onChange={(v) => update3(1, v)}
                  accentColor="#737373"
                />
                <OddInput
                  label="Équipe 2"
                  value={odds3[2]}
                  onChange={(v) => update3(2, v)}
                  accentColor="#0891b2"
                />
              </div>

              {result3 && <TRJHeroCard result={result3} label="TRJ 3 Options" />}
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
                <OddInput
                  label="Équipe 1"
                  value={odds2[0]}
                  onChange={(v) => update2(0, v)}
                  accentColor="#059669"
                />
                <OddInput
                  label="Équipe 2"
                  value={odds2[1]}
                  onChange={(v) => update2(1, v)}
                  accentColor="#0891b2"
                />
              </div>

              {result2 && <TRJHeroCard result={result2} label="TRJ 2 Options" />}
            </div>

            {/* Comparateur */}
            {result3 && result2 && (
              <>
                <div className="my-8 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <MarketComparator r3={result3} r2={result2} />
              </>
            )}

            {/* Échelle de référence (toujours visible) */}
            {(result3 || result2) && (
              <>
                <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                    📏 Échelle de référence
                  </p>
                  <div className="space-y-1.5">
                    {[
                      {
                        range: "TRJ ≥ 99%",
                        label: "🏆 Excellent",
                        color: "text-emerald-400",
                        activeFor: "excellent" as Quality,
                      },
                      {
                        range: "97% → 99%",
                        label: "✅ Bon",
                        color: "text-emerald-300",
                        activeFor: "good" as Quality,
                      },
                      {
                        range: "94% → 97%",
                        label: "👍 Correct",
                        color: "text-green-400",
                        activeFor: "decent" as Quality,
                      },
                      {
                        range: "90% → 94%",
                        label: "⚠️ Marge élevée",
                        color: "text-amber-400",
                        activeFor: "high_margin" as Quality,
                      },
                      {
                        range: "< 90%",
                        label: "❌ Inacceptable",
                        color: "text-red-400",
                        activeFor: "unacceptable" as Quality,
                      },
                    ].map((level) => {
                      const active =
                        result3?.quality === level.activeFor || result2?.quality === level.activeFor;
                      return (
                        <div
                          key={level.range}
                          className={`flex items-center justify-between rounded-lg px-3 py-1.5 transition ${
                            active ? "bg-white/10 ring-1 ring-white/20" : ""
                          }`}
                        >
                          <span className={`text-[11px] font-mono ${active ? "text-white" : "text-white/40"}`}>
                            {level.range}
                          </span>
                          <span className={`text-[11px] font-bold ${level.color}`}>{level.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

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
            <h2 className="mt-2 text-xl font-black text-white">Tout comprendre sur le TRJ</h2>
            <p className="mt-1 text-xs text-white/40">
              La vraie mesure de la qualité d&apos;un bookmaker
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi le TRJ */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  ⚖️
                </span>
                <span>C&apos;est quoi le TRJ ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Le <strong className="text-emerald-600">TRJ (Taux de Retour au Joueur)</strong> est le pourcentage moyen que le bookmaker redistribue aux parieurs sur un marché donné.
                </p>
                <p className="mt-3">
                  <strong className="text-neutral-900">Exemple :</strong> un TRJ de 95% signifie que sur 100€ misés par l&apos;ensemble des parieurs, le bookmaker en reverse 95€ et garde 5€ comme marge.
                </p>
                <div className="mt-3 rounded-xl bg-neutral-50 p-4 text-center font-mono">
                  <p className="text-sm font-bold text-neutral-900">
                    TRJ = 100 / Σ(1/cotes) × 100
                  </p>
                </div>
                <p className="mt-3">
                  Plus le TRJ est élevé, plus le bookmaker est <strong className="text-emerald-600">généreux</strong>. Un TRJ à 100% = pas de marge (théorique, n&apos;existe pas en pratique). Un TRJ à 90% = 10% de marge.
                </p>
              </div>
            </details>

            {/* Section 2 — Pourquoi c'est crucial */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  🎯
                </span>
                <span>Pourquoi c&apos;est crucial pour ton ROI</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Le TRJ est la <strong className="text-neutral-900">première marche</strong> vers la rentabilité. Même avec une excellente stratégie, si tu joues sur un marché à 90% de TRJ, tu dois battre 10% de handicap à chaque pari.
                </p>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                  <p className="font-bold">💡 Règle d&apos;or</p>
                  <p className="mt-0.5 text-xs">
                    Pour un joueur parfaitement neutre (50/50 sur des paris équilibrés), ton ROI long terme ≈ TRJ - 100. Un TRJ à 95% = ROI à -5%.
                  </p>
                </div>
                <p>
                  <strong className="text-neutral-900">Pour être rentable</strong>, il faut battre cette marge grâce à son skill (analyse, value betting, etc.). Plus le TRJ est haut, plus c&apos;est facile.
                </p>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">📊 Impact réel</p>
                  <p className="mt-0.5 text-xs">
                    Un parieur qui fait <strong>+3% ROI</strong> sur un book à 95% de TRJ serait à <strong>+7% ROI</strong> sur un book à 99% — pour la même stratégie !
                  </p>
                </div>
              </div>
            </details>

            {/* Section 3 — Benchmarks par marché */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  📏
                </span>
                <span>Qu&apos;est-ce qu&apos;un BON TRJ ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🏆 TRJ ≥ 99%</p>
                  <p className="mt-0.5 text-emerald-800">
                    <strong>Niveau Pinnacle/PS3838.</strong> La référence mondiale sur les sports majeurs. Leur business model est basé sur le volume, pas la marge.
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">✅ TRJ 97-99%</p>
                  <p className="mt-0.5 text-emerald-800">
                    <strong>Bookmakers compétitifs.</strong> Typique de Betfair, Matchbook (exchanges), ou des books sharp asiatiques.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">👍 TRJ 94-97%</p>
                  <p className="mt-0.5">
                    <strong>Bookmakers français standards.</strong> Betclic, Unibet, Winamax tournent dans cette fourchette sur les marchés 1X2 majeurs.
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">⚠️ TRJ 90-94%</p>
                  <p className="mt-0.5 text-amber-800">
                    <strong>Marchés secondaires.</strong> Buteurs, corners, cartons, scores exacts... La marge y est toujours plus élevée car moins de liquidité.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">❌ TRJ &lt; 90%</p>
                  <p className="mt-0.5 text-red-800">
                    <strong>Inacceptable.</strong> Loto foot, paris exotiques, championnats obscurs, paris live sur actions à chaud. À éviter.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 4 — TRJ par type de marché */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  📊
                </span>
                <span>TRJ typiques par type de marché</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Les bookmakers n&apos;appliquent pas la même marge partout. Voici les TRJ moyens :
                </p>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">⚽ 1X2 Football (ligues majeures)</p>
                  <p className="mt-0.5">TRJ ~95-97% — le marché le plus compétitif</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎾 Tennis ML</p>
                  <p className="mt-0.5">TRJ ~95-97% — marché très liquide</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🏀 Basket ML/Handicap</p>
                  <p className="mt-0.5">TRJ ~95-97%</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">⚽ Over/Under Goals</p>
                  <p className="mt-0.5 text-amber-800">TRJ ~94-96% — un cran en dessous du 1X2</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">🥅 BTTS (Both Teams To Score)</p>
                  <p className="mt-0.5 text-amber-800">TRJ ~92-95% — marge élevée</p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">⚽ Buteurs, corners, cartons</p>
                  <p className="mt-0.5 text-red-800">TRJ ~85-92% — à éviter sauf value confirmée</p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🎯 Score exact, combinés multiples</p>
                  <p className="mt-0.5 text-red-800">TRJ ~80-90% — très défavorable au parieur</p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🔴 Paris live fréquents</p>
                  <p className="mt-0.5 text-red-800">TRJ dégradé de 2-5% vs pré-match</p>
                </div>
              </div>
            </details>

            {/* Section 5 — Comment choisir un bookmaker */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-cyan-300 open:shadow-lg open:shadow-cyan-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-base">
                  🎯
                </span>
                <span>Comment utiliser le TRJ au quotidien</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  "Avant de placer un pari, calcule le TRJ du marché chez ton bookmaker — tu sais combien tu 'payes' de marge",
                  "Compare le même marché chez 2-3 bookmakers : prends toujours le meilleur TRJ (sauf value/surebet spécifique)",
                  "Si tu hésites entre 2 types de paris (ex: 1X2 vs BTTS), prends celui avec le meilleur TRJ",
                  "Fuis les marchés à TRJ < 94% sauf si tu as une value confirmée via PS3838",
                  "En live, le TRJ baisse : sois plus sélectif sur tes paris en direct",
                  "Évalue ton bookmaker principal avec le TRJ : s'il est systématiquement < 95%, change",
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

            {/* Section 6 — Conseils pro */}
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
                    📌 <span className="font-bold text-emerald-400">Pinnacle/PS3838</span> est la référence mondiale du TRJ (98-99%)
                  </p>
                  <p>
                    📌 Un TRJ <span className="font-bold text-red-400">&lt; 93%</span> signifie que le book prend plus de 7% de marge
                  </p>
                  <p>
                    📌 Les <span className="font-bold text-white">combinés</span> multiplient les marges : 2 paris à 95% = TRJ 90.25%
                  </p>
                  <p>
                    📌 Les <span className="font-bold text-amber-400">freebets</span> et promos compensent parfois un TRJ bas
                  </p>
                  <p>
                    📌 Plus un championnat est <span className="font-bold text-emerald-400">populaire</span>, meilleur est le TRJ
                  </p>
                  <p>
                    📌 Certains exchanges (<span className="font-bold text-white">Betfair, Matchbook</span>) offrent des TRJ proches de 100%
                  </p>
                  <p>
                    📌 Le TRJ d&apos;un pari n&apos;a de sens que pour des <span className="font-bold text-red-400">marchés équilibrés</span> — pas pour des outsiders extrêmes
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