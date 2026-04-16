"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Technique = "refund" | "double_chance";
type RefundType = "cash" | "freebet";

interface CoverageResult {
  stakeVictory: number;      // Mise sur le pari principal
  stakeCoverage: number;     // Mise de couverture
  payoutVictory: number;     // Gain brut si victoire
  payoutCoverage: number;    // Gain brut si couverture gagne
  profitVictory: number;     // Profit net si victoire
  profitCoverage: number;    // Profit net si couverture gagne
  minProfit: number;         // Profit minimum garanti
  maxProfit: number;         // Profit maximum possible
  isGuaranteedProfit: boolean;
  verdict: "profit" | "controlled_loss" | "losing";
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Technique 1 — Pari remboursé (freebet / bonus)
 * Tu as un pari remboursé si perdu. Tu le joues sur la victoire à cote V.
 * Tu couvres chez un autre book sur l'issue opposée à cote C.
 *
 * Si victoire : gain = stake_v * V - stake_c
 * Si défaite : gain = stake_c * C + refund - stake_v - stake_c
 *   où refund = stake_v (si cash 100%) ou stake_v * 0.7 (si freebet)
 *
 * On fixe la mise totale (stake_v + stake_c) et on optimise pour équilibrer.
 * Formule optimale : on veut que les deux scénarios donnent le même profit
 * => stake_v * V - stake_c = stake_c * C + refund_value - stake_v
 *    avec refund_value = stake_v (cash) ou stake_v * refundRatio (freebet)
 */
function calcRefund(
  oddVictory: number,
  oddCoverage: number,
  totalStake: number,
  refundType: RefundType
): CoverageResult | null {
  if (oddVictory <= 1 || oddCoverage <= 1 || totalStake <= 0) return null;

  const refundRatio = refundType === "cash" ? 1 : 0.7;

  // On cherche stake_v et stake_c tels que :
  // stake_v + stake_c = totalStake
  // stake_v * oddVictory - stake_c = stake_c * oddCoverage + stake_v * refundRatio - stake_v
  //
  // Réarrangé : stake_v * (oddVictory - refundRatio + 1) = stake_c * (oddCoverage + 1)
  //            stake_v / stake_c = (oddCoverage + 1) / (oddVictory - refundRatio + 1)
  //
  // Soit r = ratio ci-dessus, alors stake_v = r * stake_c
  // stake_v + stake_c = totalStake => stake_c * (r + 1) = totalStake

  const numerator = oddCoverage + 1;
  const denominator = oddVictory - refundRatio + 1;

  if (denominator <= 0) return null;

  const ratio = numerator / denominator;
  const stakeCoverage = totalStake / (ratio + 1);
  const stakeVictory = totalStake - stakeCoverage;

  // Scénario 1 : Victoire gagne
  const payoutVictory = stakeVictory * oddVictory;
  const profitVictory = payoutVictory - totalStake;

  // Scénario 2 : Défaite (on récupère le remboursement)
  const payoutCoverage = stakeCoverage * oddCoverage;
  const refundValue = stakeVictory * refundRatio;
  const profitCoverage = payoutCoverage + refundValue - totalStake;

  const minProfit = Math.min(profitVictory, profitCoverage);
  const maxProfit = Math.max(profitVictory, profitCoverage);
  const isGuaranteedProfit = minProfit > 0;

  let verdict: CoverageResult["verdict"] = "losing";
  if (minProfit >= 0) verdict = "profit";
  else if (minProfit > -totalStake * 0.05) verdict = "controlled_loss";

  return {
    stakeVictory,
    stakeCoverage,
    payoutVictory,
    payoutCoverage,
    profitVictory,
    profitCoverage,
    minProfit,
    maxProfit,
    isGuaranteedProfit,
    verdict,
  };
}

/**
 * Technique 2 — Double Chance
 * Tu paries sur une équipe (ex: PSG Win à 1.80) et tu couvres avec une
 * Double Chance sur l'autre issue (ex: Nul ou Marseille à 2.20).
 *
 * Si victoire principale : gain = stake_v * V - stake_c
 * Si la DC gagne (nul OU opposé) : gain = stake_c * C - stake_v
 *
 * On répartit pour équilibrer : stake_v * V - stake_c = stake_c * C - stake_v
 * => stake_v * (V + 1) = stake_c * (C + 1)
 * => stake_v / stake_c = (C + 1) / (V + 1)
 */
function calcDoubleChance(
  oddVictory: number,
  oddCoverage: number,
  totalStake: number
): CoverageResult | null {
  if (oddVictory <= 1 || oddCoverage <= 1 || totalStake <= 0) return null;

  const numerator = oddCoverage + 1;
  const denominator = oddVictory + 1;
  const ratio = numerator / denominator;

  const stakeCoverage = totalStake / (ratio + 1);
  const stakeVictory = totalStake - stakeCoverage;

  // Scénario 1 : Victoire principale gagne
  const payoutVictory = stakeVictory * oddVictory;
  const profitVictory = payoutVictory - totalStake;

  // Scénario 2 : Double Chance gagne (nul ou équipe adverse)
  const payoutCoverage = stakeCoverage * oddCoverage;
  const profitCoverage = payoutCoverage - totalStake;

  const minProfit = Math.min(profitVictory, profitCoverage);
  const maxProfit = Math.max(profitVictory, profitCoverage);
  const isGuaranteedProfit = minProfit > 0;

  let verdict: CoverageResult["verdict"] = "losing";
  if (minProfit >= 0) verdict = "profit";
  else if (minProfit > -totalStake * 0.05) verdict = "controlled_loss";

  return {
    stakeVictory,
    stakeCoverage,
    payoutVictory,
    payoutCoverage,
    profitVictory,
    profitCoverage,
    minProfit,
    maxProfit,
    isGuaranteedProfit,
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

function VerdictBanner({ result }: { result: CoverageResult }) {
  if (result.verdict === "profit") {
    return (
      <div
        className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={{ background: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)" }}
      >
        <p className="text-xl font-black text-white sm:text-2xl">✅ PROFIT GARANTI</p>
        <p className="mt-2 text-xs font-semibold text-white/80">
          Quelle que soit l&apos;issue, tu es gagnant
        </p>
        <div className="mt-3 inline-block rounded-xl bg-white/20 px-4 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Profit minimum</p>
          <p className="font-mono text-xl font-black text-white">+{result.minProfit.toFixed(2)}€</p>
        </div>
      </div>
    );
  }

  if (result.verdict === "controlled_loss") {
    return (
      <div
        className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={{ background: "linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fbbf24 100%)" }}
      >
        <p className="text-xl font-black text-white sm:text-2xl">⚠️ PERTE CONTRÔLÉE</p>
        <p className="mt-2 text-xs font-semibold text-white/80">
          Risque limité — acceptable pour exploiter un bonus ou sécuriser une position
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
      <p className="text-xl font-black text-white sm:text-2xl">❌ STRATÉGIE PERDANTE</p>
      <p className="mt-2 text-xs font-semibold text-white/80">
        Perte potentielle trop importante — cherche de meilleures cotes
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

export default function RepartiteurMisesPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [technique, setTechnique] = useState<Technique>("refund");
  const [refundType, setRefundType] = useState<RefundType>("cash");
  const [oddVictory, setOddVictory] = useState("");
  const [oddCoverage, setOddCoverage] = useState("");
  const [totalStake, setTotalStake] = useState("100");

  function resetAll() {
    setOddVictory("");
    setOddCoverage("");
    setTotalStake("100");
  }

  const result = useMemo((): CoverageResult | null => {
    const v = parseFloat(oddVictory);
    const c = parseFloat(oddCoverage);
    const s = parseFloat(totalStake);
    if (!v || !c || !s || v <= 1 || c <= 1 || s <= 0) return null;
    if (technique === "refund") return calcRefund(v, c, s, refundType);
    return calcDoubleChance(v, c, s);
  }, [oddVictory, oddCoverage, totalStake, technique, refundType]);

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
      <EspaceHero title="Répartiteur de mises" />

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
            {/* Technique selector */}
            <p className="mb-3 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              🛡️ Technique de couverture
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setTechnique("refund")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-3 text-xs font-bold transition-all ${
                  technique === "refund"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                🎁 Pari remboursé
              </button>
              <button
                onClick={() => setTechnique("double_chance")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-3 text-xs font-bold transition-all ${
                  technique === "double_chance"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                ⚖️ Double Chance
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] font-medium text-white/30">
              {technique === "refund"
                ? "Exploiter un bonus / pari remboursé en le couvrant chez un autre book"
                : "Sécuriser un pari simple avec une Double Chance sur l'issue opposée"}
            </p>

            {/* Refund type toggle (uniquement en mode refund) */}
            {technique === "refund" && (
              <div className="mt-4 rounded-xl bg-white/5 px-4 py-3">
                <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                  Type de remboursement
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRefundType("cash")}
                    className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-[11px] font-bold transition-all ${
                      refundType === "cash"
                        ? "bg-emerald-500/30 text-emerald-300 ring-2 ring-emerald-500"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    💵 Cash 100%
                  </button>
                  <button
                    onClick={() => setRefundType("freebet")}
                    className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-[11px] font-bold transition-all ${
                      refundType === "freebet"
                        ? "bg-emerald-500/30 text-emerald-300 ring-2 ring-emerald-500"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    🎟️ Freebet 70%
                  </button>
                </div>
                <p className="mt-2 text-center text-[10px] italic text-white/30">
                  {refundType === "cash"
                    ? "Remboursement en cash réel (100% de la valeur)"
                    : "Remboursement en freebet (la mise n'est pas rendue, ~70% de valeur réelle)"}
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* Inputs cotes */}
            <div className="space-y-3">
              {/* Cote victoire */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white">
                    1
                  </span>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-white/70">
                    {technique === "refund" ? "Pari principal (avec bonus)" : "Pari principal (victoire)"}
                  </p>
                </div>
                <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                  Cote de la victoire
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="1.001"
                  value={oddVictory}
                  onChange={(e) => setOddVictory(e.target.value)}
                  placeholder="1.500"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-center font-mono text-base font-extrabold text-emerald-300 placeholder-emerald-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                />
              </div>

              {/* Cote couverture */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1e3d 100%)" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-xs font-black text-white">
                    2
                  </span>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-white/70">
                    {technique === "refund" ? "Couverture (autre book)" : "Couverture (Double Chance)"}
                  </p>
                </div>
                <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                  Cote de couverture
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="1.001"
                  value={oddCoverage}
                  onChange={(e) => setOddCoverage(e.target.value)}
                  placeholder="1.500"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-center font-mono text-base font-extrabold text-cyan-300 placeholder-cyan-700 outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {/* Mise totale */}
            <div className="mt-4 rounded-xl bg-white/5 px-4 py-3">
              <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
                💰 Mise totale (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={totalStake}
                onChange={(e) => setTotalStake(e.target.value)}
                placeholder="100"
                inputMode="decimal"
                className="mx-auto block w-full max-w-[200px] rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-4 py-3 text-center font-mono text-xl font-black text-amber-300 placeholder-amber-700 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20"
              />
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

                {/* Mises à placer */}
                <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                  🎯 Mises à placer
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">
                      Sur la victoire
                    </p>
                    <p className="mt-1 font-mono text-xl font-black text-emerald-300">
                      {result.stakeVictory.toFixed(2)}€
                    </p>
                  </div>
                  <div className="rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-4 py-4 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-400/70">
                      Sur la couverture
                    </p>
                    <p className="mt-1 font-mono text-xl font-black text-cyan-300">
                      {result.stakeCoverage.toFixed(2)}€
                    </p>
                  </div>
                </div>

                {/* Scénarios */}
                <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                  📊 Scénarios
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                      Si victoire gagne
                    </p>
                    <p
                      className={`mt-1 font-mono text-sm font-black ${
                        result.profitVictory >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {result.profitVictory >= 0 ? "+" : ""}
                      {result.profitVictory.toFixed(2)}€
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                      Si couverture gagne
                    </p>
                    <p
                      className={`mt-1 font-mono text-sm font-black ${
                        result.profitCoverage >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {result.profitCoverage >= 0 ? "+" : ""}
                      {result.profitCoverage.toFixed(2)}€
                    </p>
                  </div>
                </div>

                {/* Result cards */}
                <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            <h2 className="mt-2 text-xl font-black text-white">Comprendre la couverture de pari</h2>
            <p className="mt-1 text-xs text-white/40">
              La technique la plus low-risk des paris sportifs
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  🛡️
                </span>
                <span>C&apos;est quoi la couverture de pari ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  La couverture consiste à{" "}
                  <strong className="text-neutral-900">parier sur une issue chez un bookmaker</strong>, puis à{" "}
                  <strong className="text-emerald-600">parier sur l&apos;issue inverse</strong> ailleurs pour sécuriser ta position.
                </p>
                <p className="mt-3">Deux cas d&apos;usage principaux :</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-neutral-900">Exploiter un bonus</strong> (pari remboursé, freebet) en le transformant en cash
                  </li>
                  <li>
                    <strong className="text-neutral-900">Sécuriser un pari simple</strong> avec une Double Chance opposée quand le match tourne mal
                  </li>
                </ul>
                <p className="mt-3">
                  Le répartiteur calcule la <strong className="text-emerald-600">répartition optimale</strong> de ta mise pour équilibrer les deux scénarios.
                </p>
              </div>
            </details>

            {/* Section 2 — Pari remboursé */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  🎁
                </span>
                <span>Technique 1 — Pari remboursé</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  <strong className="text-neutral-900">Le principe :</strong> ton bookmaker A t&apos;offre un bonus (&quot;pari remboursé 100€ si perdu&quot;). Tu joues ce bonus sur un pari, puis tu couvres l&apos;issue inverse chez le bookmaker B.
                </p>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-bold text-neutral-900">Exemple concret :</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p>→ Book A : pari remboursé 100€ → tu joues PSG Win à cote 2.00</p>
                    <p>→ Book B : tu couvres avec Marseille ou Nul à cote 2.00</p>
                    <p>→ Le calculateur répartit ta mise pour minimiser la perte si PSG gagne, et maximiser le gain si tu récupères le remboursement</p>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                  <p className="font-bold">💵 Cash 100%</p>
                  <p className="mt-0.5 text-xs">
                    Le remboursement est en cash réel, valeur faciale 100%. Technique la plus rentable.
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3 text-amber-800">
                  <p className="font-bold">🎟️ Freebet (~70%)</p>
                  <p className="mt-0.5 text-xs">
                    Le remboursement est en freebet (pari gratuit). Mais un freebet vaut seulement ~70% de sa valeur nominale car la mise n&apos;est pas rendue en cas de victoire. Couverture plus compliquée.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 3 — Double Chance */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  ⚖️
                </span>
                <span>Technique 2 — Double Chance</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  <strong className="text-neutral-900">Le principe :</strong> tu as déjà parié sur une victoire simple (ex: PSG Win à 1.80). Le match approche, le doute s&apos;installe. Tu couvres avec la Double Chance opposée (Nul ou Marseille).
                </p>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-bold text-neutral-900">Exemple concret :</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p>→ Pari initial : PSG Win à cote 1.80</p>
                    <p>→ Couverture : Double Chance &quot;Nul ou Marseille&quot; à cote 2.20</p>
                    <p>→ Le calculateur répartit pour que tu gagnes (ou perdes le minimum) peu importe le résultat</p>
                  </div>
                </div>
                <p className="mt-2 text-xs italic">
                  Utile pour <strong>sécuriser une position</strong> avant un match important, surtout si ta conviction initiale s&apos;est affaiblie.
                </p>
              </div>
            </details>

            {/* Section 4 — Pari remboursé vs Double Chance */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  🔀
                </span>
                <span>Quelle technique choisir ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎁 Pari remboursé — objectif PROFIT</p>
                  <p className="mt-0.5">
                    Tu veux transformer un bonus en cash. Technique très rentable, peu de risque. C&apos;est le cœur du <strong>matched betting</strong>.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">⚖️ Double Chance — objectif SÉCURITÉ</p>
                  <p className="mt-0.5">
                    Tu veux protéger un pari déjà placé contre un retournement. Tu sacrifies une partie du gain potentiel pour limiter la perte.
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
                    term: "Freebet (pari gratuit)",
                    desc: "Pari offert par un bookmaker. Si tu gagnes, seul le gain net est reversé (la mise n'est pas rendue). Vaut ~70% de sa valeur cash.",
                  },
                  {
                    term: "Pari remboursé",
                    desc: "Bonus classique : si tu perds, le bookmaker te rembourse ta mise (en cash ou en freebet selon l'offre).",
                  },
                  {
                    term: "Double Chance (DC)",
                    desc: "Pari qui couvre 2 issues sur 3 (ex: 1X = victoire domicile OU nul). Cote plus faible, probabilité plus haute.",
                  },
                  {
                    term: "Matched betting",
                    desc: "Pratique consistant à exploiter systématiquement les bonus bookmakers en les couvrant. Faible risque, rentable sur le long terme.",
                  },
                  {
                    term: "Profit minimum garanti",
                    desc: "Le gain que tu auras dans le pire des scénarios après répartition. Si > 0, tu es gagnant à coup sûr.",
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
                  "Choisis ta technique : Pari remboursé (bonus) ou Double Chance (sécuriser)",
                  "Si pari remboursé : précise Cash 100% ou Freebet 70% selon le type de remboursement",
                  "Entre la cote de la victoire (ton pari principal)",
                  "Entre la cote de couverture (l'issue opposée ou la DC)",
                  "Indique ta mise totale — le calculateur répartit automatiquement",
                  "Regarde les deux scénarios : si le profit min est > 0, tu es gagnant à coup sûr",
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
                    📌 Le <span className="font-bold text-emerald-400">matched betting</span> reste la technique la plus rentable et low-risk
                  </p>
                  <p>
                    📌 Privilégie les cotes <span className="font-bold text-white">proches</span> entre victoire et couverture (équilibre)
                  </p>
                  <p>
                    📌 Un freebet <span className="font-bold text-amber-400">se joue en entier</span> — impossible de le fractionner
                  </p>
                  <p>
                    📌 Joue les freebets sur des <span className="font-bold text-white">cotes hautes</span> (2.00+) pour maximiser leur valeur
                  </p>
                  <p>
                    📌 Note bien les <span className="font-bold text-red-400">conditions du bonus</span> (cote min, délai, mise min)
                  </p>
                  <p>
                    📌 Couvre <span className="font-bold text-emerald-400">rapidement</span> après le pari principal : les cotes bougent
                  </p>
                  <p>
                    📌 Certains bookmakers <span className="font-bold text-red-400">limitent</span> les comptes qui exploitent les bonus
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