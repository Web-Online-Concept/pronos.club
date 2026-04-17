"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Mode = "stake" | "target";
type NLegs = 2 | 3 | 4;
type Rounding = 0 | 0.1 | 0.5 | 1 | 2 | 5;
type BetSide = "back" | "lay";

interface Leg {
  odd: string;
  bookmaker: string;
  label: string;
  commission: string;
  side: BetSide;
  locked: boolean;
  lockedStake: string;
}

interface LegResult {
  side: BetSide;
  stake: number;
  stakeRounded: number;
  liability: number;
  liabilityRounded: number;
  payout: number;
  profit: number;
  sharePercent: number;
  isLocked: boolean;
  volatilityRank: number;
}

interface SurebetResult {
  legs: LegResult[];
  totalStake: number;
  totalStakeRounded: number;
  guaranteedPayout: number;
  guaranteedPayoutRounded: number;
  guaranteedProfit: number;
  guaranteedProfitRounded: number;
  roi: number;
  roiRounded: number;
  trj: number;
  arbPercent: number;
  isSurebet: boolean;
  isSuspicious: boolean;
  hasRounding: boolean;
  roundingLoss: number;
  hasLay: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function roundStake(value: number, step: Rounding): number {
  if (step === 0) return Math.round(value * 100) / 100;
  return Math.round(value / step) * step;
}

function calcSurebet(
  legs: Leg[],
  nLegs: NLegs,
  amount: number,
  mode: Mode,
  rounding: Rounding,
  useCommissions: boolean
): SurebetResult | null {
  const active = legs.slice(0, nLegs);
  const odds = active.map((l) => parseFloat(l.odd));
  if (odds.some((o) => !o || o <= 1)) return null;
  if (!amount || amount <= 0) return null;

  const sides = active.map((l) => l.side);
  const commissions = active.map((l) =>
    useCommissions ? Math.max(0, (parseFloat(l.commission) || 0) / 100) : 0
  );

  // Cote effective par issue
  // BACK : netOdd = 1 + (odd - 1) * (1 - c)
  // LAY  : netOdd = 1 + (1 - c) / (odd - 1)
  const netOdds = odds.map((o, i) => {
    if (sides[i] === "back") return 1 + (o - 1) * (1 - commissions[i]);
    return 1 + (1 - commissions[i]) / (o - 1);
  });

  const invSum = netOdds.reduce((s, o) => s + 1 / o, 0);
  const trj = (1 / invSum) * 100;
  const arbPercent = trj - 100;
  const isSurebet = trj > 100;

  // Capital engagé par leg (stake pour back, liability pour lay)
  // payout unifié = engaged * netOdd
  const lockedIdx = active.findIndex(
    (l) => l.locked && parseFloat(l.lockedStake) > 0
  );

  let totalEngaged: number;
  let guaranteedPayout: number;
  const engaged: number[] = new Array(nLegs).fill(0);
  const stakes: number[] = new Array(nLegs).fill(0);

  if (lockedIdx >= 0) {
    const anchorStake = parseFloat(active[lockedIdx].lockedStake);
    const anchorEngaged =
      sides[lockedIdx] === "back"
        ? anchorStake
        : anchorStake * (odds[lockedIdx] - 1);
    guaranteedPayout = anchorEngaged * netOdds[lockedIdx];

    for (let i = 0; i < nLegs; i++) {
      const locked = active[i].locked && parseFloat(active[i].lockedStake) > 0;
      if (locked) {
        const s = parseFloat(active[i].lockedStake);
        stakes[i] = s;
        engaged[i] = sides[i] === "back" ? s : s * (odds[i] - 1);
      } else {
        engaged[i] = guaranteedPayout / netOdds[i];
        stakes[i] = sides[i] === "back" ? engaged[i] : engaged[i] / (odds[i] - 1);
      }
    }
    totalEngaged = engaged.reduce((a, b) => a + b, 0);
  } else if (mode === "stake") {
    totalEngaged = amount;
    guaranteedPayout = amount / invSum;
    for (let i = 0; i < nLegs; i++) {
      engaged[i] = guaranteedPayout / netOdds[i];
      stakes[i] = sides[i] === "back" ? engaged[i] : engaged[i] / (odds[i] - 1);
    }
  } else {
    guaranteedPayout = amount;
    totalEngaged = amount * invSum;
    for (let i = 0; i < nLegs; i++) {
      engaged[i] = guaranteedPayout / netOdds[i];
      stakes[i] = sides[i] === "back" ? engaged[i] : engaged[i] / (odds[i] - 1);
    }
  }

  // Arrondi sur la stake (engaged déduit)
  const hasRounding = rounding > 0;
  const stakesRounded = stakes.map((s) => roundStake(s, rounding));
  const engagedRounded = stakesRounded.map((s, i) =>
    sides[i] === "back" ? s : s * (odds[i] - 1)
  );
  const payoutsRounded = engagedRounded.map((e, i) => e * netOdds[i]);
  const guaranteedPayoutRounded = Math.min(...payoutsRounded);
  const totalEngagedRounded = engagedRounded.reduce((a, b) => a + b, 0);
  const guaranteedProfit = guaranteedPayout - totalEngaged;
  const guaranteedProfitRounded = guaranteedPayoutRounded - totalEngagedRounded;
  const roi = (guaranteedProfit / totalEngaged) * 100;
  const roiRounded = (guaranteedProfitRounded / totalEngagedRounded) * 100;
  const roundingLoss = guaranteedProfit - guaranteedProfitRounded;

  // Volatility rank : cote la plus haute = à placer en premier
  const sortedByOdd = odds
    .map((o, i) => ({ o, i }))
    .sort((a, b) => b.o - a.o)
    .map((x, rank) => ({ ...x, rank: rank + 1 }));

  const legsResults: LegResult[] = active.map((_, i) => {
    const stakeRounded = stakesRounded[i];
    const engagedR = engagedRounded[i];
    const liability = sides[i] === "back" ? 0 : stakes[i] * (odds[i] - 1);
    const liabilityRounded = sides[i] === "back" ? 0 : engagedR;
    const payout = payoutsRounded[i];
    const sharePercent =
      totalEngagedRounded > 0 ? (engagedR / totalEngagedRounded) * 100 : 0;
    const volatilityRank = sortedByOdd.find((x) => x.i === i)?.rank ?? i + 1;
    return {
      side: sides[i],
      stake: stakes[i],
      stakeRounded,
      liability,
      liabilityRounded,
      payout,
      profit: payout - totalEngagedRounded,
      sharePercent,
      isLocked: active[i].locked && parseFloat(active[i].lockedStake) > 0,
      volatilityRank,
    };
  });

  return {
    legs: legsResults,
    totalStake: totalEngaged,
    totalStakeRounded: totalEngagedRounded,
    guaranteedPayout,
    guaranteedPayoutRounded,
    guaranteedProfit,
    guaranteedProfitRounded,
    roi,
    roiRounded,
    trj,
    arbPercent,
    isSurebet,
    isSuspicious: isSurebet && roi > 10,
    hasRounding,
    roundingLoss,
    hasLay: sides.some((s) => s === "lay"),
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
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Marge d&apos;arbitrage</p>
          <p className="font-mono text-xl font-black text-white">+{result.arbPercent.toFixed(2)}%</p>
        </div>
        {result.isSuspicious && (
          <div className="mt-4 rounded-xl bg-amber-500/30 px-4 py-3 text-left">
            <p className="text-xs font-black text-white">⚠️ ROI anormalement élevé ({result.roi.toFixed(2)}%)</p>
            <p className="mt-1 text-[11px] text-white/80">
              Vérifie tes cotes : erreur de saisie probable, ou cote qui vient de bouger. Les vrais surebets tournent
              entre 1% et 5%.
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
  const [nLegs, setNLegs] = useState<NLegs>(2);
  const [rounding, setRounding] = useState<Rounding>(0);
  const [useCommissions, setUseCommissions] = useState(false);
  const [useLay, setUseLay] = useState(false);
  const [copied, setCopied] = useState(false);

  const [legs, setLegs] = useState<Leg[]>([
    { odd: "", bookmaker: "", label: "Issue 1", commission: "0", side: "back", locked: false, lockedStake: "" },
    { odd: "", bookmaker: "", label: "Issue 2", commission: "0", side: "back", locked: false, lockedStake: "" },
    { odd: "", bookmaker: "", label: "Issue 3", commission: "0", side: "back", locked: false, lockedStake: "" },
    { odd: "", bookmaker: "", label: "Issue 4", commission: "0", side: "back", locked: false, lockedStake: "" },
  ]);

  function updateLeg<K extends keyof Leg>(index: number, field: K, value: Leg[K]) {
    const next = [...legs];
    next[index] = { ...next[index], [field]: value };
    setLegs(next);
  }

  function toggleLock(index: number) {
    const next = [...legs];
    const currentlyLocked = next[index].locked;
    next[index] = {
      ...next[index],
      locked: !currentlyLocked,
      lockedStake: !currentlyLocked ? next[index].lockedStake : "",
    };
    setLegs(next);
  }

  function resetAll() {
    setLegs([
      { odd: "", bookmaker: "", label: "Issue 1", commission: "0", side: "back", locked: false, lockedStake: "" },
      { odd: "", bookmaker: "", label: "Issue 2", commission: "0", side: "back", locked: false, lockedStake: "" },
      { odd: "", bookmaker: "", label: "Issue 3", commission: "0", side: "back", locked: false, lockedStake: "" },
      { odd: "", bookmaker: "", label: "Issue 4", commission: "0", side: "back", locked: false, lockedStake: "" },
    ]);
    setAmount("100");
    setRounding(0);
    setUseCommissions(false);
    setUseLay(false);
  }

  const result = useMemo((): SurebetResult | null => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return null;
    return calcSurebet(legs, nLegs, amt, mode, rounding, useCommissions);
  }, [legs, nLegs, amount, mode, rounding, useCommissions]);

  async function copyRecap() {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`🎯 SUREBET PRONOS.CLUB`);
    lines.push(
      `TRJ ${result.trj.toFixed(2)}% • ROI ${result.roiRounded.toFixed(2)}% • Profit garanti ${result.guaranteedProfitRounded.toFixed(2)}€`
    );
    lines.push(`─────────────────────`);
    const ordered = result.legs
      .map((l, i) => ({ ...l, origIndex: i }))
      .sort((a, b) => a.volatilityRank - b.volatilityRank);
    ordered.forEach((leg, rank) => {
      const orig = legs[leg.origIndex];
      const sideTag = leg.side === "lay" ? " [LAY]" : "";
      const bookName = orig.bookmaker || `Bookmaker ${leg.origIndex + 1}`;
      const labelName = orig.label || `Issue ${leg.origIndex + 1}`;
      const amountTxt =
        leg.side === "back"
          ? `${leg.stakeRounded.toFixed(2)}€ @ ${parseFloat(orig.odd).toFixed(2)}`
          : `Lay ${leg.stakeRounded.toFixed(2)}€ @ ${parseFloat(orig.odd).toFixed(2)} (liability ${leg.liabilityRounded.toFixed(2)}€)`;
      lines.push(`${rank + 1}. ${labelName}${sideTag} — ${bookName}`);
      lines.push(`   ${amountTxt}`);
    });
    lines.push(`─────────────────────`);
    lines.push(`Total engagé : ${result.totalStakeRounded.toFixed(2)}€`);
    lines.push(`Gain garanti : ${result.guaranteedPayoutRounded.toFixed(2)}€`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard non dispo
    }
  }

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

  const placementOrder = result
    ? result.legs.map((l, i) => ({ ...l, origIndex: i })).sort((a, b) => a.volatilityRank - b.volatilityRank)
    : [];

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
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30">⚙️ Marché</span>
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setNLegs(n as NLegs)}
                  className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-black transition-all ${
                    nLegs === n
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                  }`}
                >
                  {n} issues
                </button>
              ))}
            </div>

            <p className="mt-2 text-center text-[10px] italic text-white/30">
              {nLegs === 2
                ? "Tennis, Basket, BTTS, Over/Under..."
                : nLegs === 3
                  ? "Football 1X2, matchs à 3 résultats possibles"
                  : "Golf top 4, hockey avec prolongations, courses..."}
            </p>

            {/* Options avancées */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setUseCommissions(!useCommissions)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                  useCommissions
                    ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/50"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {useCommissions ? "✓ Commissions" : "+ Commissions"}
              </button>
              <button
                onClick={() => setUseLay(!useLay)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                  useLay
                    ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/50"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {useLay ? "✓ Back/Lay" : "+ Back/Lay"}
              </button>
              <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-white/40">Arrondi</span>
                <select
                  value={rounding}
                  onChange={(e) => setRounding(parseFloat(e.target.value) as Rounding)}
                  className="cursor-pointer bg-transparent text-[10px] font-extrabold text-white outline-none"
                >
                  <option value={0} className="bg-black">Aucun</option>
                  <option value={0.1} className="bg-black">0.10€</option>
                  <option value={0.5} className="bg-black">0.50€</option>
                  <option value={1} className="bg-black">1€</option>
                  <option value={2} className="bg-black">2€</option>
                  <option value={5} className="bg-black">5€</option>
                </select>
              </div>
            </div>

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* Legs inputs */}
            <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              📊 Cotes par bookmaker
            </p>

            <div className="space-y-3">
              {legs.slice(0, nLegs).map((leg, i) => {
                const legResult = result?.legs[i];
                const accentColor = ["#059669", "#0891b2", "#7c3aed", "#e11d48"][i];

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
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
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
                      {/* Back/Lay toggle */}
                      {useLay && (
                        <div className="flex overflow-hidden rounded-lg border border-white/10 text-[9px] font-black">
                          <button
                            onClick={() => updateLeg(i, "side", "back")}
                            className={`px-2 py-1 transition-all ${
                              leg.side === "back"
                                ? "bg-emerald-500 text-white"
                                : "bg-white/5 text-white/50 hover:text-white/80"
                            }`}
                          >
                            BACK
                          </button>
                          <button
                            onClick={() => updateLeg(i, "side", "lay")}
                            className={`px-2 py-1 transition-all ${
                              leg.side === "lay"
                                ? "bg-purple-500 text-white"
                                : "bg-white/5 text-white/50 hover:text-white/80"
                            }`}
                          >
                            LAY
                          </button>
                        </div>
                      )}
                      {/* Lock toggle */}
                      <button
                        onClick={() => toggleLock(i)}
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs transition-all ${
                          leg.locked
                            ? "bg-amber-500/30 text-amber-300 ring-1 ring-amber-400/50"
                            : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                        }`}
                        title={leg.locked ? "Déverrouiller la mise" : "Fixer cette mise"}
                      >
                        {leg.locked ? "🔒" : "🔓"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Cote */}
                      <div>
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-white/40">
                          Cote {leg.side === "lay" ? "Lay" : "Back"}
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="1.001"
                          value={leg.odd}
                          onChange={(e) => updateLeg(i, "odd", e.target.value)}
                          placeholder="2.100"
                          inputMode="decimal"
                          className={`w-full rounded-xl border-2 bg-white/5 px-3 py-2.5 text-center font-mono text-base font-extrabold text-white outline-none placeholder:text-white/20 focus:ring-4 ${
                            leg.side === "lay"
                              ? "border-purple-500/30 focus:border-purple-500 focus:ring-purple-500/20"
                              : "border-white/10 focus:border-emerald-500 focus:ring-emerald-500/20"
                          }`}
                        />
                      </div>

                      {/* Bookmaker */}
                      <div>
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-white/40">
                          {leg.side === "lay" ? "Exchange" : "Bookmaker"}
                        </label>
                        <input
                          type="text"
                          value={leg.bookmaker}
                          onChange={(e) => updateLeg(i, "bookmaker", e.target.value)}
                          placeholder={leg.side === "lay" ? "Betfair" : "Betclic"}
                          className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-center font-mono text-sm font-bold text-white outline-none placeholder:text-white/20 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    {/* Commission par leg */}
                    {useCommissions && (
                      <div className="mt-2">
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-cyan-400/70">
                          Commission {leg.side === "lay" ? "exchange" : "bookmaker"} (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="40"
                          value={leg.commission}
                          onChange={(e) => updateLeg(i, "commission", e.target.value)}
                          placeholder={leg.side === "lay" ? "5" : "0"}
                          inputMode="decimal"
                          className="w-full rounded-xl border-2 border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-center font-mono text-sm font-bold text-cyan-200 outline-none placeholder:text-cyan-700 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                        />
                      </div>
                    )}

                    {/* Mise fixée */}
                    {leg.locked && (
                      <div className="mt-2">
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-amber-400/70">
                          🔒 Mise {leg.side === "lay" ? "Lay " : ""}déjà placée (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={leg.lockedStake}
                          onChange={(e) => updateLeg(i, "lockedStake", e.target.value)}
                          placeholder="50.00"
                          inputMode="decimal"
                          className="w-full rounded-xl border-2 border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center font-mono text-sm font-black text-amber-200 outline-none placeholder:text-amber-800 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20"
                        />
                        <p className="mt-1 text-center text-[9px] italic text-amber-400/60">
                          Les autres mises sont recalculées autour
                        </p>
                      </div>
                    )}

                    {/* Résultat par leg */}
                    {legResult && (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div
                            className={`rounded-lg border px-3 py-2 text-center ${
                              leg.side === "lay"
                                ? "border-purple-500/30 bg-purple-500/10"
                                : "border-emerald-500/30 bg-emerald-500/10"
                            }`}
                          >
                            <p
                              className={`text-[9px] font-bold uppercase tracking-wider ${
                                leg.side === "lay" ? "text-purple-400/70" : "text-emerald-400/70"
                              }`}
                            >
                              {leg.side === "lay" ? "Mise Lay" : "Mise à placer"}
                            </p>
                            <p
                              className={`font-mono text-sm font-black ${
                                leg.side === "lay" ? "text-purple-300" : "text-emerald-300"
                              }`}
                            >
                              {legResult.stakeRounded.toFixed(2)}€
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                              {leg.side === "lay" ? "Liability" : "Si gagne"}
                            </p>
                            <p className="font-mono text-sm font-black text-white">
                              {leg.side === "lay"
                                ? `${legResult.liabilityRounded.toFixed(2)}€`
                                : `+${legResult.payout.toFixed(2)}€`}
                            </p>
                          </div>
                        </div>

                        {/* Barre de répartition */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[9px] font-bold text-white/40">
                            <span>Part du capital</span>
                            <span className="font-mono">{legResult.sharePercent.toFixed(1)}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, legResult.sharePercent)}%`,
                                background: accentColor,
                              }}
                            />
                          </div>
                        </div>
                      </>
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
                  <ResultCard
                    label={result.hasLay ? "Capital engagé" : "Mise totale"}
                    value={result.totalStakeRounded}
                    suffix="€"
                    color="neutral"
                    icon="💰"
                  />
                  <ResultCard
                    label="Gain garanti"
                    value={result.guaranteedPayoutRounded}
                    suffix="€"
                    color="neutral"
                    icon="🎯"
                  />
                  <ResultCard
                    label="Profit net"
                    value={result.guaranteedProfitRounded}
                    suffix="€"
                    color={result.guaranteedProfitRounded >= 0 ? "green" : "red"}
                    icon="💎"
                  />
                  <ResultCard
                    label="ROI"
                    value={result.roiRounded}
                    suffix="%"
                    color={result.roiRounded >= 0 ? "green" : "red"}
                    icon="📈"
                  />
                </div>

                {/* Warning arrondi */}
                {result.hasRounding && Math.abs(result.roundingLoss) > 0.01 && (
                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
                    <p className="text-[11px] text-amber-200">
                      ⚠️ L&apos;arrondi réduit le profit de{" "}
                      <span className="font-mono font-black">{result.roundingLoss.toFixed(2)}€</span> — désactive-le
                      pour le rendement maximal
                    </p>
                  </div>
                )}

                <VerdictBanner result={result} />

                {/* Ordre de placement */}
                {result.isSurebet && (
                  <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
                    <p className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20 text-xs">
                        ⚡
                      </span>
                      Ordre de placement — en clair
                    </p>
                    <div className="space-y-2 text-[13px] leading-relaxed text-white/80">
                      <p className="text-[11px] italic text-white/50">
                        Mise en premier sur la cote la plus haute (la plus susceptible de baisser).
                      </p>
                      {placementOrder.map((leg, rank) => {
                        const orig = legs[leg.origIndex];
                        return (
                          <div
                            key={leg.origIndex}
                            className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                          >
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-black text-white">
                              {rank + 1}
                            </span>
                            <div className="flex-1 text-[12px]">
                              <p className="font-bold text-white">
                                {orig.label || `Issue ${leg.origIndex + 1}`}
                                {leg.side === "lay" && (
                                  <span className="ml-1 rounded bg-purple-500/30 px-1.5 py-0.5 text-[9px] font-black text-purple-200">
                                    LAY
                                  </span>
                                )}
                                {leg.isLocked && (
                                  <span className="ml-1 rounded bg-amber-500/30 px-1.5 py-0.5 text-[9px] font-black text-amber-200">
                                    🔒 FIXÉE
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-white/60">
                                {leg.side === "lay" ? "Lay " : "Mise "}
                                <span className="font-mono font-black text-emerald-300">
                                  {leg.stakeRounded.toFixed(2)}€
                                </span>{" "}
                                à la cote{" "}
                                <span className="font-mono font-black text-white">
                                  {parseFloat(orig.odd).toFixed(2)}
                                </span>{" "}
                                chez{" "}
                                <span className="font-bold text-cyan-300">
                                  {orig.bookmaker || `Bookmaker ${leg.origIndex + 1}`}
                                </span>
                                {leg.side === "lay" && (
                                  <>
                                    {" "}
                                    <span className="text-white/40">
                                      (liability{" "}
                                      <span className="font-mono font-black text-amber-300">
                                        {leg.liabilityRounded.toFixed(2)}€
                                      </span>
                                      )
                                    </span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Copier le récap */}
                    <button
                      onClick={copyRecap}
                      className="mt-4 w-full cursor-pointer rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      {copied ? "✅ Copié !" : "📋 Copier le récap"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ╔══════════════════════════════════════════════════════╗ */}
        {/* ║              TUTORIEL                               ║ */}
        {/* ╚══════════════════════════════════════════════════════╝ */}

        <div className="mt-12">
          <div
            className="rounded-t-3xl px-6 py-5 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">📚 Guide complet</p>
            <h2 className="mt-2 text-xl font-black text-white">Comprendre le Surebet</h2>
            <p className="mt-1 text-xs text-white/40">
              Le graal : gagner à coup sûr en exploitant les divergences entre bookmakers
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi */}
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
                  Un <strong className="text-emerald-600">Surebet</strong> (ou arbitrage, ou arb) est une combinaison
                  de paris où tu{" "}
                  <strong className="text-neutral-900">gagnes de l&apos;argent peu importe le résultat</strong> de
                  l&apos;événement.
                </p>
                <p className="mt-3">
                  C&apos;est possible quand deux bookmakers ont des cotes qui divergent : en prenant la cote la plus
                  haute pour chaque issue chez des bookmakers différents, la somme des probabilités implicites peut
                  descendre sous 100%.
                </p>
                <p className="mt-3">
                  <strong className="text-neutral-900">Règle d&apos;or :</strong> si TRJ &gt; 100%, profit garanti.
                  C&apos;est le graal — mais ça demande rapidité et plusieurs comptes.
                </p>
              </div>
            </details>

            {/* Section 2 — Exemple */}
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
                  <strong className="text-neutral-900">Match de tennis</strong> : Nadal vs Djokovic. Les bookmakers ne
                  sont pas d&apos;accord sur le favori.
                </p>
                <div className="rounded-xl bg-neutral-50 p-4">
                  <p className="font-bold text-neutral-900">Cotes relevées :</p>
                  <div className="mt-2 space-y-1 font-mono text-xs">
                    <p>
                      🎾 <strong>Nadal chez Betclic</strong> → cote{" "}
                      <span className="font-bold text-emerald-600">2.10</span>
                    </p>
                    <p>
                      🎾 <strong>Djokovic chez Unibet</strong> → cote{" "}
                      <span className="font-bold text-emerald-600">2.20</span>
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    TRJ = 1/2.10 + 1/2.20 = 93.7% + 90.9% ={" "}
                    <strong className="text-emerald-600">102%</strong>
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
                  Les vrais surebets tournent entre 1% et 5%. Au-dessus, c&apos;est suspect (erreur de saisie ou cote
                  périmée).
                </p>
              </div>
            </details>

            {/* Section 3 — Options avancées */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  ⚙️
                </span>
                <span>Options avancées : Commissions, Back/Lay, Lock, Arrondi</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-cyan-50 p-3">
                  <p className="font-extrabold text-cyan-900">💱 Commissions</p>
                  <p className="mt-0.5 text-cyan-800">
                    Active cette option si tu utilises un <strong>betting exchange</strong> comme Betfair (5%),
                    Smarkets (2%) ou Matchbook (1.5%). La commission est prélevée sur les gains — le calculateur ajuste
                    automatiquement la mise.
                  </p>
                </div>
                <div className="rounded-xl bg-purple-50 p-3">
                  <p className="font-extrabold text-purple-900">🔄 Back / Lay par issue</p>
                  <p className="mt-0.5 text-purple-800">
                    Par défaut, toutes tes mises sont <strong>Back</strong> (tu paries POUR une issue). Active{" "}
                    <strong>Back/Lay</strong> pour modéliser un pari <strong>Lay</strong> (CONTRE une issue) sur un
                    exchange. Permet de construire des arbs cross-bookmaker/exchange. Pour chaque Lay, le calculateur
                    affiche aussi la <strong>liability</strong> (fonds à bloquer sur l&apos;exchange).
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">🔒 Mise fixée (lock)</p>
                  <p className="mt-0.5 text-amber-800">
                    Tu as déjà placé une mise et tu veux calculer combien miser sur les autres issues ? Clique sur le
                    cadenas 🔓 à côté d&apos;une issue, renseigne la mise déjà placée, et le calculateur{" "}
                    <strong>recalcule automatiquement</strong> les autres mises autour de celle-ci. Indispensable pour
                    rattraper un pari.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">📐 Arrondi des mises</p>
                  <p className="mt-0.5">
                    Certains bookmakers imposent un minimum par tranche (0.50€, 1€, voire 5€). Le calculateur arrondit
                    automatiquement et t&apos;affiche la <strong>perte de profit</strong> liée à l&apos;arrondi.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 4 — Dutching vs Surebet */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  🔀
                </span>
                <span>Dutching vs Surebet</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">♻️ Dutching</p>
                  <p className="mt-0.5">
                    <strong>Même bookmaker</strong>, plusieurs issues d&apos;un même marché. On couvre plusieurs
                    favoris. Le TRJ est généralement &lt; 100% (marge du book).
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🔒 Surebet</p>
                  <p className="mt-0.5">
                    <strong>Plusieurs bookmakers</strong>, on exploite leurs divergences de cotes. Le TRJ passe
                    au-dessus de 100% → profit garanti.
                  </p>
                </div>
                <p className="mt-2 text-xs italic">
                  Différence clé : Dutching gère le <strong>choix</strong> entre favoris, Surebet exploite
                  l&apos;<strong>inefficacité</strong> du marché.
                </p>
              </div>
            </details>

            {/* Section 5 — Termes */}
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
                  { term: "TRJ (Taux de Retour Joueur)", desc: "1 / Σ(1/cotes) × 100. Si > 100%, c'est un surebet." },
                  { term: "Marge d'arbitrage", desc: "TRJ - 100. Profit garanti en % de la mise totale." },
                  { term: "ROI %", desc: "Profit / mise totale × 100. Équivalent à la marge d'arbitrage." },
                  { term: "Gain garanti", desc: "Le montant récupéré peu importe l'issue (identique)." },
                  {
                    term: "Back / Lay",
                    desc: "Back = parier POUR une issue (bookmaker). Lay = parier CONTRE une issue (exchange type Betfair).",
                  },
                  {
                    term: "Liability",
                    desc: "Pour un Lay : montant max que tu peux perdre si l'issue se produit. À avoir disponible sur l'exchange.",
                  },
                  { term: "Arbing", desc: "Placer des surebets de manière récurrente." },
                ].map((item) => (
                  <div key={item.term} className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-sm font-extrabold text-neutral-900">{item.term}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 6 — Mode d'emploi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  🔢
                </span>
                <span>Mode d&apos;emploi pas à pas</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  "Choisis le marché : 2 issues (tennis, BTTS, O/U), 3 issues (foot 1X2) ou 4 issues (golf, hockey, courses)",
                  "Choisis le mode : Mise totale ou Gain cible",
                  "Active Commissions si tu utilises un exchange (Betfair 5%, Smarkets 2%)",
                  "Active Back/Lay pour combiner un pari classique + un lay sur exchange",
                  "Pour chaque issue, saisis la cote la plus haute + le nom du bookmaker",
                  "Vérifie le TRJ : > 100% = surebet → profit garanti",
                  "Place les mises dans l'ordre suggéré (cote la plus haute en premier)",
                  "Copie le récap pour garder une trace",
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">
                      {i + 1}
                    </span>
                    <p className="text-sm text-neutral-600">{step}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 7 — Limites */}
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
                    Les bookmakers détectent vite les arbitreurs et limitent tes mises (parfois à 1€). LE principal
                    risque.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">⚡ Cotes qui bougent</p>
                  <p className="mt-0.5 text-red-700">
                    Les cotes changent en continu. Si la 2ème cote baisse avant que tu aies pu miser, le surebet
                    devient perdant.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">💸 Multi-comptes nécessaire</p>
                  <p className="mt-0.5 text-red-700">
                    Il faut des comptes ouverts et alimentés chez plusieurs bookmakers, ce qui immobilise du capital.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🎰 Match annulé / remboursé</p>
                  <p className="mt-0.5 text-red-700">
                    Si un match est annulé chez un bookmaker (mise remboursée) mais pas chez l&apos;autre, le surebet
                    casse.
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">📊 Marges faibles</p>
                  <p className="mt-0.5 text-red-700">
                    Les vrais surebets tournent à 1-3%. Pour gagner 100€/mois il faut miser des gros volumes.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 8 — Conseils pro */}
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
                    📌 Un surebet <span className="font-bold text-emerald-400">1-5%</span> est normal — au-delà,
                    vérifie tes cotes
                  </p>
                  <p>
                    📌 Place les paris <span className="font-bold text-red-400">le plus vite possible</span>, les cotes
                    bougent
                  </p>
                  <p>
                    📌 Commence par la cote{" "}
                    <span className="font-bold text-white">la plus volatile</span> — le calculateur te donne
                    l&apos;ordre
                  </p>
                  <p>
                    📌 Varie les mises pour ne pas te faire{" "}
                    <span className="font-bold text-red-400">limiter</span> (éviter les montants ronds)
                  </p>
                  <p>
                    📌 Privilégie les <span className="font-bold text-emerald-400">événements majeurs</span>{" "}
                    (liquidité), évite les championnats obscurs
                  </p>
                  <p>
                    📌 Pour les surebets Back/Lay cross-exchange : garde{" "}
                    <span className="font-bold text-purple-400">toujours la liability</span> disponible
                  </p>
                  <p>
                    📌 Garde de la marge sur chaque compte pour absorber les{" "}
                    <span className="font-bold text-white">variations</span>
                  </p>
                  <p>
                    📌 Value bet <span className="font-bold text-emerald-400">&gt;</span> Surebet sur le long terme si
                    tu ne te fais pas limiter
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