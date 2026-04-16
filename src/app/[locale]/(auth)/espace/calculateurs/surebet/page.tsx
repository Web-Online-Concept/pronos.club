"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Mode = "stake" | "target";

interface Leg {
  odd: string;
  bookmaker: string;
  label: string;
}

interface LegResult {
  stake: number;   // Mise à placer chez ce bookmaker
  payout: number;  // Gain brut si cette issue gagne
  profit: number;  // Profit net
}

interface SurebetResult {
  legs: LegResult[];
  totalStake: number;        // Mise totale
  guaranteedPayout: number;  // Gain garanti (identique toutes issues)
  guaranteedProfit: number;  // Profit net garanti
  roi: number;               // ROI %
  trj: number;               // TRJ % (>100 = surebet)
  arbPercent: number;        // % d'arbitrage = TRJ - 100
  isSurebet: boolean;
  isSuspicious: boolean;     // Warning si ROI > 10%
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcSurebet(odds: number[], amount: number, mode: Mode): SurebetResult | null {
  if (odds.some((o) => o <= 1) || amount <= 0) return null;

  const invSum = odds.reduce((s, o) => s + 1 / o, 0);
  const trj = (1 / invSum) * 100;
  const arbPercent = trj - 100;
  const isSurebet = trj > 100;

  let totalStake: number;
  let guaranteedPayout: number;

  if (mode === "stake") {
    totalStake = amount;
    guaranteedPayout = amount / invSum;
  } else {
    guaranteedPayout = amount;
    totalStake = amount * invSum;
  }

  const legs: LegResult[] = odds.map((odd) => {
    const stake = guaranteedPayout / odd;
    const payout = stake * odd;
    return {
      stake,
      payout,
      profit: payout - totalStake,
    };
  });

  const guaranteedProfit = guaranteedPayout - totalStake;
  const roi = (guaranteedProfit / totalStake) * 100;
  const isSuspicious = isSurebet && roi > 10;

  return {
    legs,
    totalStake,
    guaranteedPayout,
    guaranteedProfit,
    roi,
    trj,
    arbPercent,
    isSurebet,
    isSuspicious,
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

function VerdictBanner({ result }: { result: SurebetResult }) {
  if (result.isSurebet) {
    return (
      <div
        className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={{
          background: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)",
        }}
      >
        <p className="text-2xl font-black text-white sm:text-3xl">🎯 SUREBET DÉTECTÉ</p>
        <p className="mt-2 text-xs font-semibold text-white/80">
          Arbitrage mathématique garanti — profit assuré peu importe le résultat
        </p>
        <div className="mt-3 inline-block rounded-xl bg-white/20 px-4 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
            Marge d&apos;arbitrage
          </p>
          <p className="font-mono text-xl font-black text-white">+{result.arbPercent.toFixed(2)}%</p>
        </div>
        {result.isSuspicious && (
          <div className="mt-4 rounded-xl bg-amber-500/30 px-4 py-3 text-left">
            <p className="text-xs font-black text-white">⚠️ ROI anormalement élevé ({result.roi.toFixed(2)}%)</p>
            <p className="mt-1 text-[11px] text-white/80">
              Vérifie tes cotes : erreur de saisie probable, ou cote qui vient de bouger. Les vrais surebets tournent entre 1% et 5%.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
      style={{
        background: "linear-gradient(135deg, #991b1b 0%, #ef4444 50%, #f87171 100%)",
      }}
    >
      <p className="text-2xl font-black text-white sm:text-3xl">❌ PAS D&apos;ARBITRAGE</p>
      <p className="mt-2 text-xs font-semibold text-white/80">
        TRJ {result.trj.toFixed(2)}% &lt; 100% — tu perdrais {Math.abs(result.arbPercent).toFixed(2)}% en moyenne
      </p>
      <p className="mt-3 text-[11px] text-white/70">
        Cherche des cotes plus hautes chez d&apos;autres bookmakers, ou abandonne cette combinaison.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SurebetCalculatorPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [mode, setMode] = useState<Mode>("stake");
  const [amount, setAmount] = useState("100");
  const [nLegs, setNLegs] = useState<2 | 3>(2);
  const [legs, setLegs] = useState<Leg[]>([
    { odd: "", bookmaker: "", label: "Issue 1" },
    { odd: "", bookmaker: "", label: "Issue 2" },
    { odd: "", bookmaker: "", label: "Issue 3" },
  ]);

  function updateLeg(index: number, field: keyof Leg, value: string) {
    const next = [...legs];
    next[index] = { ...next[index], [field]: value };
    setLegs(next);
  }

  function resetAll() {
    setLegs([
      { odd: "", bookmaker: "", label: "Issue 1" },
      { odd: "", bookmaker: "", label: "Issue 2" },
      { odd: "", bookmaker: "", label: "Issue 3" },
    ]);
    setAmount("100");
  }

  const result = useMemo((): SurebetResult | null => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return null;
    const oddsValues = legs.slice(0, nLegs).map((l) => parseFloat(l.odd));
    if (oddsValues.some((v) => !v || v <= 1)) return null;
    return calcSurebet(oddsValues, amt, mode);
  }, [legs, amount, nLegs, mode]);

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
      <EspaceHero title="Surebet (Arbitrage)" />

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
            {/* Mode toggle */}
            <div className="mb-4 flex justify-center gap-2">
              <button
                onClick={() => setMode("stake")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all ${
                  mode === "stake"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                💰 Mise totale
              </button>
              <button
                onClick={() => setMode("target")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all ${
                  mode === "target"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                🎯 Gain cible
              </button>
            </div>

            <p className="text-center text-[11px] font-medium text-white/30">
              {mode === "stake"
                ? "Fixe ta mise totale, calcule le gain garanti"
                : "Fixe le gain cible, calcule la mise nécessaire"}
            </p>

            {/* Amount input */}
            <div className="mt-4 rounded-xl bg-white/5 px-4 py-3">
              <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                {mode === "stake" ? "💰 Mise totale (€)" : "🎯 Gain cible (€)"}
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                inputMode="decimal"
                className="mx-auto block w-full max-w-[200px] rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-center font-mono text-xl font-black text-emerald-300 placeholder-emerald-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
              />
            </div>

            {/* Number of legs selector */}
            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30">
                ⚙️ Type de marché
              </span>
              <button
                onClick={() => setNLegs(2)}
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-black transition-all ${
                  nLegs === 2
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                2 issues
              </button>
              <button
                onClick={() => setNLegs(3)}
                className={`cursor-pointer rounded-lg px-4 py-1.5 text-xs font-black transition-all ${
                  nLegs === 3
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                3 issues
              </button>
            </div>

            <p className="mt-2 text-center text-[10px] italic text-white/30">
              {nLegs === 2 ? "Tennis, Basket, BTTS, Over/Under..." : "Football 1X2, matchs à 3 résultats possibles"}
            </p>

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* Legs inputs */}
            <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              📊 Cotes par bookmaker
            </p>

            <div className="space-y-3">
              {legs.slice(0, nLegs).map((leg, i) => {
                const legResult = result?.legs[i];
                const accentColor = ["#059669", "#0891b2", "#7c3aed"][i];

                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/10 p-4"
                    style={{
                      background: `linear-gradient(135deg, #0a0a0a 0%, ${accentColor}20 100%)`,
                    }}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-white"
                        style={{ background: accentColor }}
                      >
                        {i + 1}
                      </span>
                      <input
                        type="text"
                        value={leg.label}
                        onChange={(e) => updateLeg(i, "label", e.target.value)}
                        placeholder={`Issue ${i + 1}`}
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-white outline-none placeholder:text-white/20 focus:border-white/30"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Cote */}
                      <div>
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-white/40">
                          Cote
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="1.001"
                          value={leg.odd}
                          onChange={(e) => updateLeg(i, "odd", e.target.value)}
                          placeholder="2.100"
                          inputMode="decimal"
                          className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-center font-mono text-base font-extrabold text-white outline-none placeholder:text-white/20 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20"
                        />
                      </div>

                      {/* Bookmaker */}
                      <div>
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-white/40">
                          Bookmaker
                        </label>
                        <input
                          type="text"
                          value={leg.bookmaker}
                          onChange={(e) => updateLeg(i, "bookmaker", e.target.value)}
                          placeholder="Betclic"
                          className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-center font-mono text-sm font-bold text-white outline-none placeholder:text-white/20 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    {/* Mise calculée + gain */}
                    {legResult && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">
                            Mise à placer
                          </p>
                          <p className="font-mono text-sm font-black text-emerald-300">
                            {legResult.stake.toFixed(2)}€
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">Si gagne</p>
                          <p className="font-mono text-sm font-black text-white">+{legResult.payout.toFixed(2)}€</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                  📈 Résultats
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ResultCard label="Mise totale" value={result.totalStake} suffix="€" color="neutral" icon="💰" />
                  <ResultCard
                    label="Gain garanti"
                    value={result.guaranteedPayout}
                    suffix="€"
                    color="neutral"
                    icon="🎯"
                  />
                  <ResultCard
                    label="Profit net"
                    value={result.guaranteedProfit}
                    suffix="€"
                    color={result.isSurebet ? "green" : "red"}
                    icon="💎"
                  />
                  <ResultCard
                    label="ROI"
                    value={result.roi}
                    suffix="%"
                    color={result.isSurebet ? "green" : "red"}
                    icon="📈"
                  />
                </div>
                <VerdictBanner result={result} />
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
            <h2 className="mt-2 text-xl font-black text-white">Comprendre le Surebet</h2>
            <p className="mt-1 text-xs text-white/40">
              Le graal : gagner à coup sûr en exploitant les divergences entre bookmakers
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi un surebet */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  🎯
                </span>
                <span>C&apos;est quoi un Surebet ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Un <strong className="text-emerald-600">Surebet</strong> (aussi appelé arbitrage ou arb) est une combinaison de paris où tu{" "}
                  <strong className="text-neutral-900">gagnes de l&apos;argent peu importe le résultat</strong> de l&apos;événement.
                </p>
                <p className="mt-3">
                  C&apos;est possible quand deux bookmakers ont des cotes qui divergent : si tu prends la cote la plus haute pour chaque issue chez des bookmakers différents, la somme des probabilités implicites peut descendre sous 100%.
                </p>
                <p className="mt-3">
                  <strong className="text-neutral-900">Règle d&apos;or :</strong> si TRJ &gt; 100%, tu as un profit mathématique garanti. C&apos;est le graal des paris sportifs — mais ça demande rapidité et plusieurs comptes.
                </p>
              </div>
            </details>

            {/* Section 2 — Exemple concret */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  💡
                </span>
                <span>Un exemple concret</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  <strong className="text-neutral-900">Match de tennis</strong> : Nadal vs Djokovic. Les bookmakers ne sont pas d&apos;accord sur le favori.
                </p>
                <div className="rounded-xl bg-neutral-50 p-4">
                  <p className="font-bold text-neutral-900">Cotes relevées :</p>
                  <div className="mt-2 space-y-1 font-mono text-xs">
                    <p>🎾 <strong>Nadal chez Betclic</strong> → cote <span className="font-bold text-emerald-600">2.10</span></p>
                    <p>🎾 <strong>Djokovic chez Unibet</strong> → cote <span className="font-bold text-emerald-600">2.20</span></p>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    TRJ = 1/2.10 + 1/2.20 = 93.7% + 90.9% = <strong className="text-emerald-600">102%</strong>
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-900">Mise totale : 100€</p>
                  <div className="mt-2 space-y-1 font-mono text-xs text-emerald-800">
                    <p>→ Mise 49€ sur Nadal (Betclic)</p>
                    <p>→ Mise 51€ sur Djokovic (Unibet)</p>
                  </div>
                  <p className="mt-2 text-xs font-bold text-emerald-700">
                    Gain garanti ≈ 102€ (peu importe qui gagne) → profit +2€ (2%)
                  </p>
                </div>
                <p className="text-xs italic text-neutral-500">
                  Les vrais surebets tournent entre 1% et 5%. Au-dessus, c&apos;est suspect (erreur de saisie ou cote périmée).
                </p>
              </div>
            </details>

            {/* Section 3 — Dutching vs Surebet */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  🔀
                </span>
                <span>Dutching vs Surebet — quelle différence ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">♻️ Dutching</p>
                  <p className="mt-0.5">
                    <strong>Même bookmaker</strong>, plusieurs issues d&apos;un même marché. On couvre plusieurs favoris. Le TRJ est généralement &lt; 100% (marge du book).
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🔒 Surebet</p>
                  <p className="mt-0.5">
                    <strong>Plusieurs bookmakers</strong>, on exploite leurs divergences de cotes. Le TRJ passe au-dessus de 100% → profit garanti.
                  </p>
                </div>
                <p className="mt-2 text-xs italic">
                  La différence clé : le Dutching gère le <strong>choix</strong> entre favoris, le Surebet exploite l&apos;<strong>inefficacité</strong> du marché.
                </p>
              </div>
            </details>

            {/* Section 4 — Les termes */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  📖
                </span>
                <span>Les termes à connaître</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  {
                    term: "TRJ (Taux de Retour Joueur)",
                    desc: "1 / Σ(1/cotes) × 100. Si > 100%, c'est un surebet.",
                  },
                  {
                    term: "Marge d'arbitrage",
                    desc: "TRJ - 100. Représente le profit garanti en % de la mise totale.",
                  },
                  {
                    term: "ROI % (Return On Investment)",
                    desc: "Profit / mise totale × 100. Équivalent à la marge d'arbitrage.",
                  },
                  {
                    term: "Gain garanti",
                    desc: "Le montant récupéré peu importe quelle issue gagne (identique partout).",
                  },
                  {
                    term: "Arbing",
                    desc: "Pratique qui consiste à chercher et placer des surebets de manière récurrente.",
                  },
                ].map((item) => (
                  <div key={item.term} className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-sm font-extrabold text-neutral-900">{item.term}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 5 — Mode d'emploi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-cyan-300 open:shadow-lg open:shadow-cyan-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-base">
                  🔢
                </span>
                <span>Mode d&apos;emploi pas à pas</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  "Choisis le type de marché : 2 issues (tennis, BTTS, Over/Under...) ou 3 issues (foot 1X2)",
                  "Choisis ton mode : Mise totale (ce que tu engages) ou Gain cible (ce que tu veux gagner)",
                  "Pour chaque issue, saisis la cote la plus haute trouvée + le nom du bookmaker",
                  "Vérifie le TRJ : s'il est > 100%, c'est un surebet → tu auras un profit garanti",
                  "Place les mises recommandées sur chaque bookmaker correspondant, dans l'ordre rapidement (les cotes bougent vite !)",
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

            {/* Section 6 — Limitations */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-rose-300 open:shadow-lg open:shadow-rose-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-base">
                  ⚠️
                </span>
                <span>Les limites du Surebet</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🚨 Limitation des comptes</p>
                  <p className="mt-0.5 text-red-700">
                    Les bookmakers détectent vite les arbitreurs et limitent tes mises (parfois à 1€ !). C&apos;est LE principal risque.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">⚡ Cotes qui bougent</p>
                  <p className="mt-0.5 text-red-700">
                    Les cotes changent en continu. Si tu places la 1ère mise et que la 2ème cote baisse avant que tu aies pu miser, le surebet devient perdant.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">💸 Multi-comptes nécessaire</p>
                  <p className="mt-0.5 text-red-700">
                    Il faut avoir des comptes ouverts et alimentés chez plusieurs bookmakers, ce qui immobilise du capital.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🎰 Match annulé / remboursé</p>
                  <p className="mt-0.5 text-red-700">
                    Si un match est annulé chez un bookmaker (mise remboursée) mais pas chez l&apos;autre, le surebet casse.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">📊 Marges souvent faibles</p>
                  <p className="mt-0.5 text-red-700">
                    Les vrais surebets tournent à 1-3%. Pour gagner 100€/mois il faut miser des gros volumes.
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
                    📌 Un surebet <span className="font-bold text-emerald-400">1-5%</span> est normal — au-delà, vérifie tes cotes
                  </p>
                  <p>
                    📌 Place les paris{" "}
                    <span className="font-bold text-red-400">le plus vite possible</span>, les cotes bougent
                  </p>
                  <p>
                    📌 Commence par miser sur la cote{" "}
                    <span className="font-bold text-white">la plus volatile</span> (celle qui risque de baisser)
                  </p>
                  <p>
                    📌 Varie les mises pour ne pas te faire{" "}
                    <span className="font-bold text-red-400">limiter</span> (éviter les montants ronds)
                  </p>
                  <p>
                    📌 Privilégie les <span className="font-bold text-emerald-400">événements majeurs</span> (liquidité)
                    et évite les championnats obscurs
                  </p>
                  <p>
                    📌 Garde toujours de la marge sur chaque compte pour absorber les{" "}
                    <span className="font-bold text-white">variations</span>
                  </p>
                  <p>
                    📌 Value bet <span className="font-bold text-emerald-400">&gt;</span> Surebet sur le long terme si tu
                    ne te fais pas limiter
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