"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type HedgeMode = "balanced" | "guaranteed";

interface HedgeResult {
  liveStake: number;         // Mise live à placer
  payoutPreLive: number;     // Gain brut si pari pré-live gagne
  payoutLive: number;        // Gain brut si couverture live gagne
  profitPreLive: number;     // Profit net si pari pré-live gagne
  profitLive: number;        // Profit net si couverture live gagne
  totalInvested: number;     // Total investi (mise pré-live + mise live)
  minProfit: number;         // Profit minimum garanti
  maxProfit: number;         // Profit maximum possible
  verdict: "profit" | "reduced_loss" | "no_hedge";
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Mode ÉQUILIBRÉ : on calcule la mise live pour que le gain/perte soit
 * identique peu importe l'issue finale.
 *
 * Équation : profit_preLive = profit_live
 * stake_p * odd_p - stake_p - stake_l = stake_l * odd_l - stake_p - stake_l
 * stake_p * odd_p - stake_p = stake_l * odd_l - stake_l
 * stake_p * (odd_p - 1) = stake_l * (odd_l - 1)
 * stake_l = stake_p * (odd_p - 1) / (odd_l - 1)
 */
function calcBalanced(
  oddPreLive: number,
  stakePreLive: number,
  oddLive: number
): HedgeResult | null {
  if (oddPreLive <= 1 || stakePreLive <= 0 || oddLive <= 1) return null;

  const liveStake = (stakePreLive * (oddPreLive - 1)) / (oddLive - 1);
  const totalInvested = stakePreLive + liveStake;

  // Scénario 1 : pari pré-live gagne
  const payoutPreLive = stakePreLive * oddPreLive;
  const profitPreLive = payoutPreLive - totalInvested;

  // Scénario 2 : couverture live gagne
  const payoutLive = liveStake * oddLive;
  const profitLive = payoutLive - totalInvested;

  const minProfit = Math.min(profitPreLive, profitLive);
  const maxProfit = Math.max(profitPreLive, profitLive);

  let verdict: HedgeResult["verdict"] = "no_hedge";
  if (minProfit >= 0) verdict = "profit";
  else if (minProfit > -stakePreLive * 0.5) verdict = "reduced_loss";

  return {
    liveStake,
    payoutPreLive,
    payoutLive,
    profitPreLive,
    profitLive,
    totalInvested,
    minProfit,
    maxProfit,
    verdict,
  };
}

/**
 * Mode PROFIT GARANTI : on calcule la mise live MAXIMUM qui laisse
 * un profit si le pari pré-live gagne (breakeven sur la couverture).
 *
 * On veut que profit_live >= 0 :
 * stake_l * odd_l - stake_p - stake_l >= 0
 * stake_l * (odd_l - 1) >= stake_p
 * stake_l >= stake_p / (odd_l - 1)
 *
 * Mise minimum pour garantir breakeven côté live :
 * stake_l = stake_p / (odd_l - 1)
 *
 * Cette formule garantit :
 * - Si live gagne : profit = 0 (breakeven)
 * - Si pré-live gagne : profit = stake_p * odd_p - total_invested (max)
 *
 * Note : ce mode n'est rentable que si stake_p * odd_p > total_invested,
 * soit si odd_p > 1 + 1/(odd_l - 1) = odd_l / (odd_l - 1)
 */
function calcGuaranteed(
  oddPreLive: number,
  stakePreLive: number,
  oddLive: number
): HedgeResult | null {
  if (oddPreLive <= 1 || stakePreLive <= 0 || oddLive <= 1) return null;

  const liveStake = stakePreLive / (oddLive - 1);
  const totalInvested = stakePreLive + liveStake;

  const payoutPreLive = stakePreLive * oddPreLive;
  const profitPreLive = payoutPreLive - totalInvested;

  const payoutLive = liveStake * oddLive;
  const profitLive = payoutLive - totalInvested;

  const minProfit = Math.min(profitPreLive, profitLive);
  const maxProfit = Math.max(profitPreLive, profitLive);

  let verdict: HedgeResult["verdict"] = "no_hedge";
  if (minProfit >= 0) verdict = "profit";
  else if (minProfit > -stakePreLive * 0.5) verdict = "reduced_loss";

  return {
    liveStake,
    payoutPreLive,
    payoutLive,
    profitPreLive,
    profitLive,
    totalInvested,
    minProfit,
    maxProfit,
    verdict,
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

function VerdictBanner({ result, mode }: { result: HedgeResult; mode: HedgeMode }) {
  if (result.verdict === "profit") {
    return (
      <div
        className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={{ background: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)" }}
      >
        <p className="text-xl font-black text-white sm:text-2xl">
          ✅ {mode === "balanced" ? "PROFIT ÉQUILIBRÉ" : "PROFIT GARANTI"}
        </p>
        <p className="mt-2 text-xs font-semibold text-white/80">
          {mode === "balanced"
            ? "Gain identique peu importe la suite du match"
            : "Pire cas = breakeven. Profit maximum si pré-live gagne."}
        </p>
        <div className="mt-3 inline-block rounded-xl bg-white/20 px-4 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Profit minimum</p>
          <p className="font-mono text-xl font-black text-white">+{result.minProfit.toFixed(2)}€</p>
        </div>
      </div>
    );
  }

  if (result.verdict === "reduced_loss") {
    return (
      <div
        className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={{ background: "linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fbbf24 100%)" }}
      >
        <p className="text-xl font-black text-white sm:text-2xl">⚠️ PERTE RÉDUITE</p>
        <p className="mt-2 text-xs font-semibold text-white/80">
          La couverture limite les dégâts sans garantir un profit
        </p>
        <div className="mt-3 inline-block rounded-xl bg-white/20 px-4 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Pire cas</p>
          <p className="font-mono text-xl font-black text-white">{result.minProfit.toFixed(2)}€</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
      style={{ background: "linear-gradient(135deg, #991b1b 0%, #ef4444 50%, #f87171 100%)" }}
    >
      <p className="text-xl font-black text-white sm:text-2xl">❌ COUVERTURE INUTILE</p>
      <p className="mt-2 text-xs font-semibold text-white/80">
        La cote live ne permet pas une couverture rentable. Garde ton pari pré-live tel quel ou accepte la perte.
      </p>
      <div className="mt-3 inline-block rounded-xl bg-white/20 px-4 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Pire cas</p>
        <p className="font-mono text-xl font-black text-white">{result.minProfit.toFixed(2)}€</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CoteLiveCouvrirPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [mode, setMode] = useState<HedgeMode>("balanced");
  const [oddPreLive, setOddPreLive] = useState("");
  const [stakePreLive, setStakePreLive] = useState("");
  const [oddLive, setOddLive] = useState("");

  function resetAll() {
    setOddPreLive("");
    setStakePreLive("");
    setOddLive("");
  }

  const result = useMemo((): HedgeResult | null => {
    const op = parseFloat(oddPreLive);
    const sp = parseFloat(stakePreLive);
    const ol = parseFloat(oddLive);
    if (!op || !sp || !ol || op <= 1 || sp <= 0 || ol <= 1) return null;
    if (mode === "balanced") return calcBalanced(op, sp, ol);
    return calcGuaranteed(op, sp, ol);
  }, [oddPreLive, stakePreLive, oddLive, mode]);

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
      <EspaceHero title="Cote live pour couvrir" />

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
            {/* Mode selector */}
            <p className="mb-3 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              🛡️ Stratégie de couverture
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("balanced")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-3 text-xs font-bold transition-all ${
                  mode === "balanced"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                ⚖️ Équilibrée
              </button>
              <button
                onClick={() => setMode("guaranteed")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-3 text-xs font-bold transition-all ${
                  mode === "guaranteed"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                🎯 Profit garanti
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] font-medium text-white/30">
              {mode === "balanced"
                ? "Gain identique peu importe l'issue finale"
                : "Breakeven côté live, profit maximisé côté pré-live"}
            </p>

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* Pré-live block */}
            <div
              className="rounded-2xl border border-white/10 p-4"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white">
                  1
                </span>
                <p className="text-xs font-extrabold uppercase tracking-wider text-white/70">
                  Pari pré-live (déjà placé)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                    Cote pré-live
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="1.001"
                    value={oddPreLive}
                    onChange={(e) => setOddPreLive(e.target.value)}
                    placeholder="2.500"
                    inputMode="decimal"
                    className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-center font-mono text-base font-extrabold text-emerald-300 placeholder-emerald-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                    Mise pré-live (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={stakePreLive}
                    onChange={(e) => setStakePreLive(e.target.value)}
                    placeholder="100"
                    inputMode="decimal"
                    className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-center font-mono text-base font-extrabold text-emerald-300 placeholder-emerald-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Live block */}
            <div
              className="mt-3 rounded-2xl border border-white/10 p-4"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1e3d 100%)" }}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-xs font-black text-white">
                  2
                </span>
                <p className="text-xs font-extrabold uppercase tracking-wider text-white/70">
                  Couverture live (issue opposée)
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                    Cote live
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="1.001"
                    value={oddLive}
                    onChange={(e) => setOddLive(e.target.value)}
                    placeholder="3.000"
                    inputMode="decimal"
                    className="w-full rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-center font-mono text-base font-extrabold text-cyan-300 placeholder-cyan-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                    Mise live (€)
                  </label>
                  <div className="w-full rounded-xl border-2 border-cyan-500/50 bg-cyan-500/20 px-3 py-2.5 text-center font-mono text-base font-extrabold text-cyan-300">
                    {result ? result.liveStake.toFixed(2) : "—"}
                  </div>
                </div>
              </div>
              {result && (
                <p className="mt-2 text-center text-[10px] italic text-white/40">
                  💡 Mise calculée automatiquement pour {mode === "balanced" ? "équilibrer" : "garantir"} le résultat
                </p>
              )}
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

                {/* Scénarios */}
                <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                  📊 Scénarios possibles
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">
                      Pari pré-live gagne
                    </p>
                    <p className="mt-1 font-mono text-xs text-white/50">Gain brut : +{result.payoutPreLive.toFixed(2)}€</p>
                    <p
                      className={`mt-1 font-mono text-base font-black ${
                        result.profitPreLive >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      Net : {result.profitPreLive >= 0 ? "+" : ""}
                      {result.profitPreLive.toFixed(2)}€
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-400/70">
                      Couverture gagne
                    </p>
                    <p className="mt-1 font-mono text-xs text-white/50">Gain brut : +{result.payoutLive.toFixed(2)}€</p>
                    <p
                      className={`mt-1 font-mono text-base font-black ${
                        result.profitLive >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      Net : {result.profitLive >= 0 ? "+" : ""}
                      {result.profitLive.toFixed(2)}€
                    </p>
                  </div>
                </div>

                {/* Result cards */}
                <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ResultCard label="Total investi" value={result.totalInvested} suffix="€" color="neutral" icon="💰" />
                  <ResultCard
                    label="Profit min"
                    value={result.minProfit}
                    suffix="€"
                    color={result.minProfit >= 0 ? "green" : "red"}
                    icon="🛡️"
                  />
                  <ResultCard
                    label="Profit max"
                    value={result.maxProfit}
                    suffix="€"
                    color={result.maxProfit >= 0 ? "green" : "red"}
                    icon="💎"
                  />
                  <ResultCard
                    label="Écart"
                    value={Math.abs(result.maxProfit - result.minProfit)}
                    suffix="€"
                    color="neutral"
                    icon="📏"
                  />
                </div>

                <VerdictBanner result={result} mode={mode} />
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
            <h2 className="mt-2 text-xl font-black text-white">Comprendre le hedging live</h2>
            <p className="mt-1 text-xs text-white/40">
              L&apos;art de sécuriser un pari pré-match pendant qu&apos;il se joue
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  🛡️
                </span>
                <span>C&apos;est quoi le hedging live ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Le <strong className="text-emerald-600">hedging live</strong> (couverture en direct) consiste à{" "}
                  <strong className="text-neutral-900">miser sur l&apos;issue opposée</strong> de ton pari pré-match pendant que le match est en cours, pour sécuriser un gain ou réduire une perte.
                </p>
                <p className="mt-3">
                  Ça marche parce que les cotes <strong className="text-neutral-900">bougent en direct</strong> en fonction de ce qui se passe sur le terrain. Un but, un carton rouge, une blessure — et les cotes changent instantanément.
                </p>
                <p className="mt-3">
                  Si tu as parié pré-match et que le scénario est favorable au début du match, tu peux{" "}
                  <strong className="text-emerald-600">verrouiller un profit</strong> avant même la fin.
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
                  <strong className="text-neutral-900">Scénario :</strong> PSG vs Marseille. Tu as parié il y a 2 jours.
                </p>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-bold text-emerald-900">Ton pari pré-live</p>
                  <div className="mt-1 space-y-0.5 font-mono text-xs text-emerald-800">
                    <p>→ 100€ sur PSG Win à cote 2.50</p>
                    <p>→ Gain potentiel : 250€ (profit +150€)</p>
                  </div>
                </div>
                <p className="mt-2">À la 70ème minute, PSG mène 2-0. Les cotes live ont évolué :</p>
                <div className="rounded-xl bg-cyan-50 p-3">
                  <p className="font-bold text-cyan-900">Cotes live</p>
                  <div className="mt-1 space-y-0.5 font-mono text-xs text-cyan-800">
                    <p>→ PSG Win : 1.10 (quasi sûr)</p>
                    <p>→ Marseille ou Nul : 8.00</p>
                  </div>
                </div>
                <p className="mt-2">
                  Tu décides de couvrir avec <strong className="text-neutral-900">30€ sur Marseille ou Nul à 8.00</strong>. Résultat :
                </p>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <div className="space-y-1 font-mono text-xs">
                    <p>
                      → Si PSG gagne : 250€ - 100€ - 30€ ={" "}
                      <span className="font-bold text-emerald-600">+120€</span>
                    </p>
                    <p>
                      → Si retournement : 240€ - 100€ - 30€ ={" "}
                      <span className="font-bold text-emerald-600">+110€</span>
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs font-bold text-emerald-700">
                  Tu verrouilles un profit ~+115€ peu importe la suite !
                </p>
              </div>
            </details>

            {/* Section 3 — Les 2 modes */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  🎛️
                </span>
                <span>Les 2 modes de couverture</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">⚖️ Équilibrée (recommandé)</p>
                  <p className="mt-0.5">
                    Mise live calculée pour que le{" "}
                    <strong>gain soit identique peu importe l&apos;issue</strong> finale. Sécurité maximale, profit moyen.
                  </p>
                  <p className="mt-1 text-xs italic">
                    Idéal quand tu veux juste verrouiller un gain sans prendre de risque supplémentaire.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎯 Profit garanti</p>
                  <p className="mt-0.5">
                    Mise live minimum pour que le pire cas soit{" "}
                    <strong>breakeven (0€)</strong>. Profit plus élevé si ton pari pré-live gagne, zéro si la couverture gagne.
                  </p>
                  <p className="mt-1 text-xs italic">
                    Idéal quand tu crois encore en ton pari pré-live mais veux supprimer le risque de perte.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 4 — Quand utiliser */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  🎬
                </span>
                <span>Quand utiliser le hedging live ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">⚽ Foot — équipe qui mène tôt</p>
                  <p className="mt-0.5">
                    Tu as parié sur PSG, ils mènent 2-0 à la 30ème. La cote live de PSG Win a chuté → tu peux couvrir avec Marseille ou Nul pour verrouiller.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎾 Tennis — set pris en avance</p>
                  <p className="mt-0.5">
                    Tu as parié Djokovic, il gagne le 1er set 6-2. La cote live de Djokovic Win est tombée → couvre avec Nadal en 3 sets.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🏀 Basket — écart creusé</p>
                  <p className="mt-0.5">
                    Équipe favorite +20 à la mi-temps alors qu&apos;elle était donnée à +5. Couvre pour sécuriser.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🚨 Changement imprévu</p>
                  <p className="mt-0.5">
                    Carton rouge, blessure d&apos;un joueur clé, pénalty manqué → les cotes explosent. Profite-en pour entrer/sortir.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">💡 Paris long-terme</p>
                  <p className="mt-0.5">
                    Paris sur vainqueur de ligue/tournoi : au fil des mois, tu peux couvrir plusieurs fois pour lock un profit final.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 5 — Les termes */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-cyan-300 open:shadow-lg open:shadow-cyan-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-base">
                  📖
                </span>
                <span>Les termes à connaître</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  {
                    term: "Hedging (couverture)",
                    desc: "Miser sur l'issue opposée de ton pari initial pour réduire le risque ou verrouiller un profit.",
                  },
                  {
                    term: "Cash out",
                    desc: "Fonction intégrée des bookmakers qui propose de 'retirer' tes gains en direct. Souvent moins avantageux qu'un hedging manuel calculé.",
                  },
                  {
                    term: "Pré-live (pré-match)",
                    desc: "Paris placés AVANT le début de l'événement.",
                  },
                  {
                    term: "Live (en direct)",
                    desc: "Paris placés PENDANT l'événement, avec des cotes qui évoluent en temps réel.",
                  },
                  {
                    term: "Verrouiller / Lock",
                    desc: "Sécuriser un profit en couvrant son pari, peu importe la suite du match.",
                  },
                ].map((item) => (
                  <div key={item.term} className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-sm font-extrabold text-neutral-900">{item.term}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 6 — Mode d'emploi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-rose-300 open:shadow-lg open:shadow-rose-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-base">
                  🔢
                </span>
                <span>Mode d&apos;emploi pas à pas</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  "Choisis ta stratégie : Équilibrée (sécurité max) ou Profit garanti (risque zéro côté live)",
                  "Entre la cote pré-live et la mise de ton pari initial (déjà placé)",
                  "Pendant le match, repère la cote live de l'issue opposée",
                  "Entre cette cote live — la mise à placer se calcule automatiquement",
                  "Regarde les scénarios : Profit min > 0 = tu es gagnant à coup sûr",
                  "Place rapidement la mise live chez ton bookmaker — les cotes bougent vite !",
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-rose-500 text-xs font-black text-white">
                      {i + 1}
                    </span>
                    <p className="text-sm text-neutral-600">{step}</p>
                  </div>
                ))}
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
                    📌 Le hedging calculé est{" "}
                    <span className="font-bold text-emerald-400">plus rentable</span> que le cash out intégré des bookmakers
                  </p>
                  <p>
                    📌 Agis <span className="font-bold text-red-400">vite</span> quand la cote bouge — elle peut revenir en quelques secondes
                  </p>
                  <p>
                    📌 Plus la <span className="font-bold text-white">cote live est haute</span>, moins tu dois miser pour couvrir
                  </p>
                  <p>
                    📌 Un bon <span className="font-bold text-emerald-400">exchange</span> (Betfair, Matchbook) offre de meilleures cotes qu&apos;un book classique
                  </p>
                  <p>
                    📌 N&apos;utilise le hedging que si tu as un{" "}
                    <span className="font-bold text-amber-400">avantage temporel</span> significatif (match déjà bien orienté)
                  </p>
                  <p>
                    📌 Attention aux <span className="font-bold text-red-400">retards de streaming</span> — la cote que tu vois peut être périmée
                  </p>
                  <p>
                    📌 Certains bookmakers <span className="font-bold text-white">limitent les paris live</span> sur les comptes suspectés de hedging
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