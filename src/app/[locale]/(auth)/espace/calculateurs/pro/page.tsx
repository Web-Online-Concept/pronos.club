"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Mode = "stake" | "target";
type NLegs = 2 | 3 | 4 | 5 | 6 | 7 | 8;
type Rounding = 0 | 0.1 | 0.5 | 1 | 2 | 5;
type BetSide = "back" | "lay";
type Currency = "EUR" | "USD" | "GBP" | "BRL" | "CHF" | "CAD" | "AUD" | "JPY" | "BTC" | "ETH";

interface Leg {
  odd: string;
  bookmaker: string;
  label: string;
  commission: string;
  side: BetSide;
  locked: boolean;
  lockedStake: string;
  currency: Currency;
  distribute: boolean;
}

interface LegResult {
  side: BetSide;
  stake: number;
  stakeRounded: number;
  stakeMain: number;
  liability: number;
  liabilityRounded: number;
  payout: number;
  profit: number;
  sharePercent: number;
  isLocked: boolean;
  volatilityRank: number;
}

interface CalcResult {
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
  hasMultiCurrency: boolean;
  hasPartialDistribution: boolean;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════

const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "BRL", "CHF", "CAD", "AUD", "JPY", "BTC", "ETH"];

const DEFAULT_RATES: Record<Currency, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.85,
  BRL: 5.5,
  CHF: 0.95,
  CAD: 1.48,
  AUD: 1.65,
  JPY: 168,
  BTC: 0.000015,
  ETH: 0.00040,
};

const LEG_COLORS = [
  "#10b981", "#06b6d4", "#a855f7", "#f43f5e",
  "#eab308", "#84cc16", "#f97316", "#3b82f6",
];

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€", USD: "$", GBP: "£", BRL: "R$", CHF: "Fr",
  CAD: "C$", AUD: "A$", JPY: "¥", BTC: "₿", ETH: "Ξ",
};

// ═══════════════════════════════════════════════════════════════
// CALCULS
// ═══════════════════════════════════════════════════════════════

function roundStake(value: number, step: Rounding): number {
  if (step === 0) return Math.round(value * 100) / 100;
  return Math.round(value / step) * step;
}

function convert(amount: number, from: Currency, to: Currency, rates: Record<Currency, number>): number {
  if (from === to) return amount;
  const rFrom = rates[from] || 1;
  const rTo = rates[to] || 1;
  if (rFrom === 0) return 0;
  return (amount * rTo) / rFrom;
}

function calcPro(
  legs: Leg[],
  nLegs: NLegs,
  amount: number,
  mode: Mode,
  rounding: Rounding,
  useCommissions: boolean,
  rates: Record<Currency, number>,
  mainCurrency: Currency
): CalcResult | null {
  const active = legs.slice(0, nLegs);
  const odds = active.map((l) => parseFloat(l.odd));
  if (odds.some((o) => !o || o <= 1)) return null;
  if (!amount || amount <= 0) return null;

  const sides = active.map((l) => l.side);
  const commissions = active.map((l) =>
    useCommissions ? Math.max(0, (parseFloat(l.commission) || 0) / 100) : 0
  );

  const netOdds = odds.map((o, i) => {
    if (sides[i] === "back") return 1 + (o - 1) * (1 - commissions[i]);
    return 1 + (1 - commissions[i]) / (o - 1);
  });

  const distributeFlags = active.map((l) => l.distribute);
  const A = netOdds.reduce((s, o, i) => (distributeFlags[i] ? s + 1 / o : s), 0);
  const B = netOdds.reduce((s, o, i) => (!distributeFlags[i] ? s + 1 / o : s), 0);
  const invSumAll = netOdds.reduce((s, o) => s + 1 / o, 0);
  const trj = (1 / invSumAll) * 100;
  const arbPercent = trj - 100;
  const isSurebet = trj > 100;
  const hasPartialDistribution = distributeFlags.some((d) => !d);

  const lockedIdx = active.findIndex((l) => l.locked && parseFloat(l.lockedStake) > 0);
  const hasLock = lockedIdx >= 0;

  let T_main = 0;
  let P_main = 0;

  if (hasLock) {
    const lockedLeg = active[lockedIdx];
    const lockedInput = parseFloat(lockedLeg.lockedStake) || 0;
    let lockedCapitalLocal = lockedInput;
    if (lockedLeg.side === "lay") {
      lockedCapitalLocal = lockedInput * Math.max(0, parseFloat(lockedLeg.odd) - 1);
    }
    const lockedCapitalMain = convert(lockedCapitalLocal, lockedLeg.currency, mainCurrency, rates);
    const O = netOdds[lockedIdx];

    if (distributeFlags[lockedIdx]) {
      if (A > 0 && 1 - B > 1e-6) {
        T_main = (lockedCapitalMain * O * A) / (1 - B);
      }
    } else {
      T_main = lockedCapitalMain * O;
    }
    P_main = A > 0 ? (T_main * (1 - A - B)) / A : 0;
  } else if (mode === "stake") {
    T_main = amount;
    P_main = A > 0 ? (T_main * (1 - A - B)) / A : 0;
  } else {
    P_main = amount;
    if (A > 0 && 1 - A - B > 1e-6) {
      T_main = (P_main * A) / (1 - A - B);
    } else {
      return null;
    }
  }

  const capitalsMain = netOdds.map((O, i) => (distributeFlags[i] ? (T_main + P_main) / O : T_main / O));

  const stakesLocal = capitalsMain.map((cap, i) => {
    const local = convert(cap, mainCurrency, active[i].currency, rates);
    if (active[i].side === "lay") {
      const o = parseFloat(active[i].odd);
      return o > 1 ? local / (o - 1) : 0;
    }
    return local;
  });
  const liabilitiesLocal = capitalsMain.map((cap, i) =>
    active[i].side === "lay" ? convert(cap, mainCurrency, active[i].currency, rates) : 0
  );

  const stakesLocalRounded = stakesLocal.map((s, i) => {
    if (active[i].locked && i === lockedIdx) return parseFloat(active[i].lockedStake) || 0;
    return roundStake(s, rounding);
  });
  const liabilitiesLocalRounded = liabilitiesLocal.map((l, i) => {
    if (active[i].side !== "lay") return 0;
    return stakesLocalRounded[i] * Math.max(0, parseFloat(active[i].odd) - 1);
  });

  const actualCapitalsLocal = stakesLocalRounded.map((s, i) => {
    if (active[i].side === "lay") return s * Math.max(0, parseFloat(active[i].odd) - 1);
    return s;
  });
  const actualCapitalsMain = actualCapitalsLocal.map((c, i) =>
    convert(c, active[i].currency, mainCurrency, rates)
  );
  const totalMain = actualCapitalsMain.reduce((a, b) => a + b, 0);

  const payoutsMain = actualCapitalsMain.map((c, i) => c * netOdds[i]);
  const profitsMain = payoutsMain.map((p) => p - totalMain);

  const profitsDistributed = profitsMain.filter((_, i) => distributeFlags[i]);
  const guaranteedProfit = profitsDistributed.length > 0 ? Math.min(...profitsDistributed) : Math.min(...profitsMain);
  const guaranteedPayout = totalMain + guaranteedProfit;

  const profitMin = Math.min(...profitsMain);
  const roi = totalMain > 0.001 ? (profitMin / totalMain) * 100 : 0;

  const sortedByOdd = odds
    .map((o, i) => ({ o, i }))
    .sort((a, b) => b.o - a.o)
    .map((x, rank) => ({ ...x, rank }));
  const volatilityRankByIdx = new Map<number, number>();
  sortedByOdd.forEach(({ i, rank }) => volatilityRankByIdx.set(i, rank));

  const legResults: LegResult[] = active.map((leg, i) => ({
    side: leg.side,
    stake: stakesLocal[i],
    stakeRounded: stakesLocalRounded[i],
    stakeMain: actualCapitalsMain[i],
    liability: liabilitiesLocal[i],
    liabilityRounded: liabilitiesLocalRounded[i],
    payout: payoutsMain[i],
    profit: profitsMain[i],
    sharePercent: totalMain > 0 ? (actualCapitalsMain[i] / totalMain) * 100 : 0,
    isLocked: leg.locked && i === lockedIdx,
    volatilityRank: volatilityRankByIdx.get(i) ?? i,
  }));

  const hasRounding = rounding > 0 && stakesLocal.some((s, i) => Math.abs(s - stakesLocalRounded[i]) > 0.001);
  const roundingLoss = Math.max(0, guaranteedProfit < 0 ? 0 : Math.abs((T_main + P_main) - totalMain - guaranteedProfit));

  return {
    legs: legResults,
    totalStake: T_main,
    totalStakeRounded: totalMain,
    guaranteedPayout,
    guaranteedPayoutRounded: guaranteedPayout,
    guaranteedProfit,
    guaranteedProfitRounded: guaranteedProfit,
    roi,
    roiRounded: roi,
    trj,
    arbPercent,
    isSurebet,
    isSuspicious: isSurebet && roi > 5,
    hasRounding,
    roundingLoss,
    hasLay: sides.some((s) => s === "lay"),
    hasMultiCurrency: new Set(active.map((l) => l.currency)).size > 1,
    hasPartialDistribution,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANTS RÉUTILISABLES
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

function VerdictBanner({ result, mainSymbol }: { result: CalcResult; mainSymbol: string }) {
  if (result.isSurebet) {
    return (
      <div
        className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={{ background: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)" }}
      >
        <p className="text-2xl font-black text-white sm:text-3xl">🎯 SUREBET DÉTECTÉ</p>
        <p className="mt-2 text-xs font-semibold text-white/80">
          {result.hasPartialDistribution
            ? "Profit garanti sur les issues ciblées — neutre sur les autres"
            : "Arbitrage mathématique garanti — profit assuré peu importe le résultat"}
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
              entre 1% et 3%, rarement au-dessus de 5%.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (Math.abs(result.arbPercent) < 0.5) {
    return (
      <div
        className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
        style={{ background: "linear-gradient(135deg, #78350f 0%, #d97706 50%, #f59e0b 100%)" }}
      >
        <p className="text-2xl font-black text-white sm:text-3xl">⚖️ QUASI BREAK-EVEN</p>
        <p className="mt-2 text-xs font-semibold text-white/80">
          TRJ {result.trj.toFixed(2)}% — idéal pour un matched betting (qualification sur freebet)
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl"
      style={{ background: "linear-gradient(135deg, #991b1b 0%, #ef4444 50%, #f87171 100%)" }}
    >
      <p className="text-2xl font-black text-white sm:text-3xl">❌ PAS D&apos;ARBITRAGE</p>
      <p className="mt-2 text-xs font-semibold text-white/80">
        TRJ {result.trj.toFixed(2)}% &lt; 100% — tu perdrais {Math.abs(result.arbPercent).toFixed(2)}% en moyenne
      </p>
      <p className="mt-3 text-[11px] text-white/70">
        Cherche des cotes plus hautes, active un freebet/lay, ou abandonne cette combinaison.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CalculatorProPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [mode, setMode] = useState<Mode>("stake");
  const [amount, setAmount] = useState("100");
  const [nLegs, setNLegs] = useState<NLegs>(2);
  const [rounding, setRounding] = useState<Rounding>(0);
  const [useCommissions, setUseCommissions] = useState(false);
  const [useLay, setUseLay] = useState(false);
  const [useCurrencies, setUseCurrencies] = useState(false);
  const [useDistribution, setUseDistribution] = useState(false);
  const [mainCurrency, setMainCurrency] = useState<Currency>("EUR");
  const [rates, setRates] = useState<Record<Currency, number>>(DEFAULT_RATES);
  const [showRates, setShowRates] = useState(false);
  const [copied, setCopied] = useState(false);

  const [legs, setLegs] = useState<Leg[]>(() =>
    Array.from({ length: 8 }, (_, i) => ({
      odd: "",
      bookmaker: "",
      label: `Issue ${i + 1}`,
      commission: "0",
      side: "back" as BetSide,
      locked: false,
      lockedStake: "",
      currency: "EUR" as Currency,
      distribute: true,
    }))
  );

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
    if (!currentlyLocked) {
      for (let i = 0; i < next.length; i++) {
        if (i !== index && next[i].locked) {
          next[i] = { ...next[i], locked: false, lockedStake: "" };
        }
      }
    }
    setLegs(next);
  }

  function toggleDistribute(index: number) {
    const next = [...legs];
    const hasLock = next.slice(0, nLegs).some((l) => l.locked && parseFloat(l.lockedStake) > 0);
    const otherDOns = next.slice(0, nLegs).filter((l, i) => i !== index && l.distribute).length;
    if (next[index].distribute && otherDOns === 0 && !hasLock) return;
    next[index] = { ...next[index], distribute: !next[index].distribute };
    setLegs(next);
  }

  function resetAll() {
    setLegs(
      Array.from({ length: 8 }, (_, i) => ({
        odd: "",
        bookmaker: "",
        label: `Issue ${i + 1}`,
        commission: "0",
        side: "back" as BetSide,
        locked: false,
        lockedStake: "",
        currency: "EUR" as Currency,
        distribute: true,
      }))
    );
    setAmount("100");
    setRounding(0);
    setUseCommissions(false);
    setUseLay(false);
    setUseCurrencies(false);
    setUseDistribution(false);
    setMainCurrency("EUR");
  }

  const result = useMemo((): CalcResult | null => {
    const amt = parseFloat(amount);
    const hasLock = legs
      .slice(0, nLegs)
      .some((l) => l.locked && parseFloat(l.lockedStake) > 0);
    if (!hasLock && (!amt || amt <= 0)) return null;
    const safeAmt = !amt || amt <= 0 ? 1 : amt;
    return calcPro(legs, nLegs, safeAmt, mode, rounding, useCommissions, rates, mainCurrency);
  }, [legs, nLegs, amount, mode, rounding, useCommissions, rates, mainCurrency]);

  const lockedLeg = legs.slice(0, nLegs).find((l) => l.locked && parseFloat(l.lockedStake) > 0);
  const hasActiveLock = !!lockedLeg;
  const mainSymbol = CURRENCY_SYMBOLS[mainCurrency];

  async function copyRecap() {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`🎯 CALCULATEUR PRO — PRONOS.CLUB`);
    lines.push(
      `TRJ ${result.trj.toFixed(2)}% • ROI ${result.roiRounded.toFixed(2)}% • Profit garanti ${result.guaranteedProfitRounded.toFixed(2)}${mainSymbol}`
    );
    lines.push(`─────────────────────`);
    const ordered = result.legs
      .map((l, i) => ({ ...l, origIndex: i }))
      .sort((a, b) => a.volatilityRank - b.volatilityRank);
    ordered.forEach((leg, rank) => {
      const orig = legs[leg.origIndex];
      const sideTag = leg.side === "lay" ? " [LAY]" : "";
      const distTag = !orig.distribute ? " [NEUTRE]" : "";
      const bookName = orig.bookmaker || `Bookmaker ${leg.origIndex + 1}`;
      const labelName = orig.label || `Issue ${leg.origIndex + 1}`;
      const cur = CURRENCY_SYMBOLS[orig.currency];
      const amountTxt =
        leg.side === "back"
          ? `${leg.stakeRounded.toFixed(2)}${cur} @ ${parseFloat(orig.odd).toFixed(2)}`
          : `Lay ${leg.stakeRounded.toFixed(2)}${cur} @ ${parseFloat(orig.odd).toFixed(2)} (liability ${leg.liabilityRounded.toFixed(2)}${cur})`;
      lines.push(`${rank + 1}. ${labelName}${sideTag}${distTag} — ${bookName}`);
      lines.push(`   ${amountTxt}`);
    });
    lines.push(`─────────────────────`);
    lines.push(`Total engagé : ${result.totalStakeRounded.toFixed(2)}${mainSymbol}`);
    lines.push(`Gain garanti : ${result.guaranteedPayoutRounded.toFixed(2)}${mainSymbol}`);
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

  // Use-cases avec couleurs cohérentes (mêmes que les legs)
  const useCases = [
    { icon: "🎯", title: "Surebet classique", desc: "2 à 8 back chez différents bookmakers. Laisse tout en mode par défaut, saisis tes cotes.", color: "#10b981" },
    { icon: "🔄", title: "Matched betting", desc: "Active + Back/Lay, mets 1 back + 1 lay à la même cote. Calibre ton freebet de qualification.", color: "#06b6d4" },
    { icon: "🎁", title: "Freebet à convertir", desc: "Active + Back/Lay + 🔒 Fixer sur ta mise freebet, puis lay sur exchange pour sécuriser.", color: "#a855f7" },
    { icon: "⚖️", title: "Dutching", desc: "Plusieurs issues back chez un même book pour répartir ton risque. Active + Profit ciblé pour choisir les issues gagnantes.", color: "#f43f5e" },
    { icon: "🔒", title: "Trading same-book", desc: "Sur Betclic/Unibet : couvre toutes les issues sur le même book. Mode 'surebet négatif' avec FB à la clé.", color: "#f97316" },
    { icon: "🌍", title: "Multi-devises", desc: "Bookmakers internationaux ? Active + Devises, saisis tes taux de change et calcule cross-devise.", color: "#3b82f6" },
  ];

  return (
    <>
      <EspaceHero title="Calculateur Pro" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {/* ╔══════════════════════════════════════════════════════╗ */}
        {/* ║              CALCULATEUR                            ║ */}
        {/* ╚══════════════════════════════════════════════════════╝ */}

        <div
          className="overflow-hidden rounded-3xl border border-white/[0.06] shadow-2xl"
          style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d1f17 40%, #0a0a0a 100%)" }}
        >
          <div
            className="h-1"
            style={{ background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)" }}
          />

          <div className="px-5 pb-6 pt-5 sm:px-8">
            <p className="mb-4 text-center text-[11px] font-medium text-white/40">
              💎 Surebet • Matched betting • Freebet • Dutching • Trading same-book — tout-en-un
            </p>

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

            <div
              className={`mt-4 rounded-xl px-4 py-3 transition-opacity ${
                hasActiveLock ? "bg-white/5 opacity-40" : "bg-white/5"
              }`}
            >
              <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                {mode === "stake" ? `💰 Mise totale (${mainSymbol})` : `🎯 Gain cible (${mainSymbol})`}
              </label>
              <div className="mx-auto flex max-w-[280px] items-center justify-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  inputMode="decimal"
                  disabled={hasActiveLock}
                  className="block w-full rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-center font-mono text-xl font-black text-emerald-300 placeholder-emerald-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed"
                />
                {useCurrencies && (
                  <select
                    value={mainCurrency}
                    onChange={(e) => setMainCurrency(e.target.value as Currency)}
                    className="cursor-pointer rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-2 py-3 text-center font-mono text-xs font-black text-emerald-300 outline-none focus:border-emerald-400"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c} className="bg-black">
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {hasActiveLock && (
              <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center">
                <p className="text-[11px] text-amber-200">
                  🔒 Champ désactivé — une mise fixée est active (
                  <span className="font-mono font-black">
                    {parseFloat(lockedLeg!.lockedStake).toFixed(2)}
                    {CURRENCY_SYMBOLS[lockedLeg!.currency]}
                  </span>{" "}
                  sur {lockedLeg!.label || "une issue"})
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-white/5 px-3 py-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30">⚙️ Marché</span>
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setNLegs(n as NLegs)}
                  className={`h-8 w-8 cursor-pointer rounded-lg text-xs font-black transition-all ${
                    nLegs === n
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <p className="mt-2 text-center text-[10px] italic text-white/30">
              {nLegs === 2
                ? "Tennis, Basket, BTTS, Over/Under..."
                : nLegs === 3
                  ? "Football 1X2, matchs à 3 résultats possibles"
                  : nLegs === 4
                    ? "Golf top 4, hockey avec prolongations, courses..."
                    : `${nLegs} issues — handicaps multiples, outrights, combinés`}
            </p>

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
              <button
                onClick={() => setUseCurrencies(!useCurrencies)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                  useCurrencies
                    ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/50"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {useCurrencies ? "✓ Devises" : "+ Devises"}
              </button>
              <button
                onClick={() => setUseDistribution(!useDistribution)}
                className={`cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                  useDistribution
                    ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/50"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {useDistribution ? "✓ Profit ciblé" : "+ Profit ciblé"}
              </button>
              <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-white/40">Arrondi</span>
                <select
                  value={rounding}
                  onChange={(e) => setRounding(parseFloat(e.target.value) as Rounding)}
                  className="cursor-pointer bg-transparent text-[10px] font-extrabold text-white outline-none"
                >
                  <option value={0} className="bg-black">Aucun</option>
                  <option value={0.1} className="bg-black">0.10</option>
                  <option value={0.5} className="bg-black">0.50</option>
                  <option value={1} className="bg-black">1</option>
                  <option value={2} className="bg-black">2</option>
                  <option value={5} className="bg-black">5</option>
                </select>
              </div>
            </div>

            {useCurrencies && (
              <div className="mt-3">
                <button
                  onClick={() => setShowRates(!showRates)}
                  className="mx-auto flex cursor-pointer items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/60 hover:text-amber-300"
                >
                  {showRates ? "▼" : "▶"} Taux de change (1 EUR =)
                </button>
                {showRates && (
                  <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {CURRENCIES.filter((c) => c !== "EUR").map((cur) => (
                        <label key={cur} className="block">
                          <span className="mb-0.5 block text-center text-[9px] font-extrabold text-amber-400/60">
                            {cur}
                          </span>
                          <input
                            type="number"
                            step="0.0001"
                            value={rates[cur] || 1}
                            onChange={(e) =>
                              setRates({
                                ...rates,
                                [cur]: parseFloat(e.target.value) || 1,
                              })
                            }
                            className="w-full rounded-md border border-amber-500/20 bg-black/40 px-1.5 py-1 text-center font-mono text-[10px] text-amber-200 outline-none focus:border-amber-400"
                          />
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-center text-[9px] italic text-amber-400/50">
                      Édite ces taux pour matcher ton bookmaker (valeurs indicatives)
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            <p className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              📊 Cotes par bookmaker
            </p>

            <div className="space-y-3">
              {legs.slice(0, nLegs).map((leg, i) => {
                const legResult = result?.legs[i];
                const accentColor = LEG_COLORS[i % LEG_COLORS.length];
                const legSymbol = CURRENCY_SYMBOLS[leg.currency];

                return (
                  <div
                    key={i}
                    className="relative overflow-hidden rounded-2xl border-2 p-4 transition-all"
                    style={{
                      background: `linear-gradient(135deg, #0a0a0a 0%, ${accentColor}1a 50%, #0a0a0a 100%)`,
                      borderColor: accentColor,
                      boxShadow: `0 0 0 1px ${accentColor}40, 0 8px 24px -8px ${accentColor}80`,
                    }}
                  >
                    <div className="absolute inset-x-0 top-0 h-1" style={{ background: accentColor }} />

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
                      {useLay && (
                        <div className="flex overflow-hidden rounded-lg border border-white/10 text-[9px] font-black">
                          <button
                            onClick={() => updateLeg(i, "side", "back")}
                            className={`cursor-pointer px-2 py-1 transition-all ${
                              leg.side === "back"
                                ? "bg-emerald-500 text-white"
                                : "bg-white/5 text-white/50 hover:text-white/80"
                            }`}
                          >
                            BACK
                          </button>
                          <button
                            onClick={() => updateLeg(i, "side", "lay")}
                            className={`cursor-pointer px-2 py-1 transition-all ${
                              leg.side === "lay"
                                ? "bg-purple-500 text-white"
                                : "bg-white/5 text-white/50 hover:text-white/80"
                            }`}
                          >
                            LAY
                          </button>
                        </div>
                      )}
                      {useDistribution && (
                        <button
                          onClick={() => toggleDistribute(i)}
                          className={`flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-[10px] font-black transition-all ${
                            leg.distribute
                              ? "bg-rose-500/30 text-rose-200 ring-1 ring-rose-400/50"
                              : "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
                          }`}
                          title={leg.distribute ? "Profit concentré ici" : "Issue neutre (retour = mise)"}
                        >
                          {leg.distribute ? "💎" : "·"}
                        </button>
                      )}
                      <button
                        onClick={() => toggleLock(i)}
                        className={`flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-xs transition-all ${
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

                    {useCurrencies && (
                      <div className="mt-2">
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-amber-400/70">
                          Devise de cette ligne
                        </label>
                        <select
                          value={leg.currency}
                          onChange={(e) => updateLeg(i, "currency", e.target.value as Currency)}
                          className="w-full cursor-pointer rounded-xl border-2 border-amber-500/20 bg-amber-500/5 px-3 py-2 text-center font-mono text-sm font-bold text-amber-200 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c} className="bg-black">
                              {c} ({CURRENCY_SYMBOLS[c]})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {leg.locked && (
                      <div className="mt-2">
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-amber-400/70">
                          🔒 Mise {leg.side === "lay" ? "Lay " : ""}déjà placée ({legSymbol})
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

                    {legResult && (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div
                            className={`rounded-lg border px-3 py-2 text-center ${
                              leg.side === "lay"
                                ? "border-purple-500/30 bg-purple-500/10"
                                : "border-emerald-500/30 bg-emerald-500/10"
                            } ${!leg.distribute ? "opacity-60" : ""}`}
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
                              {legResult.stakeRounded.toFixed(2)}
                              {legSymbol}
                            </p>
                          </div>
                          <div className="rounded-lg bg-white/5 px-3 py-2 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                              {leg.side === "lay" ? "Liability" : "Si gagne"}
                            </p>
                            <p className="font-mono text-sm font-black text-white">
                              {leg.side === "lay"
                                ? `${legResult.liabilityRounded.toFixed(2)}${legSymbol}`
                                : `+${legResult.profit.toFixed(2)}${mainSymbol}`}
                            </p>
                          </div>
                        </div>

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

                        {!leg.distribute && useDistribution && (
                          <p className="mt-2 text-center text-[9px] italic text-white/30">
                            Issue neutre : retour ≈ mise, aucun profit si elle gagne
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-center text-[10px] italic text-white/30">
              💡 Astuce : 🔓 fixe une mise déjà placée • 💎 cible le profit sur certaines issues uniquement
            </p>

            <div className="mt-3 text-center">
              <button
                onClick={resetAll}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:bg-white/10 hover:text-white/70"
              >
                🔄 Réinitialiser
              </button>
            </div>

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
                    suffix={mainSymbol}
                    color="neutral"
                    icon="💰"
                  />
                  <ResultCard
                    label="Gain garanti"
                    value={result.guaranteedPayoutRounded}
                    suffix={mainSymbol}
                    color="neutral"
                    icon="🎯"
                  />
                  <ResultCard
                    label="Profit net"
                    value={result.guaranteedProfitRounded}
                    suffix={mainSymbol}
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

                {result.hasRounding && Math.abs(result.roundingLoss) > 0.01 && (
                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
                    <p className="text-[11px] text-amber-200">
                      ⚠️ L&apos;arrondi réduit le profit de{" "}
                      <span className="font-mono font-black">
                        {result.roundingLoss.toFixed(2)}
                        {mainSymbol}
                      </span>{" "}
                      — désactive-le pour le rendement maximal
                    </p>
                  </div>
                )}

                {result.hasMultiCurrency && (
                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center">
                    <p className="text-[11px] text-amber-200">
                      💱 Multi-devises actif — le profit dépend des taux de change saisis. Vérifie-les avant de miser.
                    </p>
                  </div>
                )}

                <VerdictBanner result={result} mainSymbol={mainSymbol} />

                {(result.isSurebet || result.hasLay) && (
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
                        const legSymbol = CURRENCY_SYMBOLS[orig.currency];
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
                                {!orig.distribute && useDistribution && (
                                  <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-black text-white/60">
                                    NEUTRE
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 text-white/60">
                                {leg.side === "lay" ? "Lay " : "Mise "}
                                <span className="font-mono font-black text-emerald-300">
                                  {leg.stakeRounded.toFixed(2)}
                                  {legSymbol}
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
                                        {leg.liabilityRounded.toFixed(2)}
                                        {legSymbol}
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
        {/* ║           POURQUOI "PRO" ?                          ║ */}
        {/* ╚══════════════════════════════════════════════════════╝ */}

        <div
          className="mt-12 overflow-hidden rounded-3xl border border-white/[0.06] shadow-2xl"
          style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d1f17 40%, #0a0a0a 100%)" }}
        >
          <div
            className="h-1"
            style={{ background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)" }}
          />
          <div className="px-5 py-5 text-center sm:px-8">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">💎 Le tout-en-un</p>
            <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">Ce calculateur remplace 6 autres outils</h2>
            <p className="mt-1 text-xs text-white/40">
              Active les options dont tu as besoin, pas plus, pas moins
            </p>
          </div>
          <div className="px-5 pb-6 sm:px-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {useCases.map((uc) => (
                <div
                  key={uc.title}
                  className="relative overflow-hidden rounded-2xl border-2 p-4 transition-all"
                  style={{
                    background: `linear-gradient(135deg, #0a0a0a 0%, ${uc.color}1a 50%, #0a0a0a 100%)`,
                    borderColor: `${uc.color}60`,
                    boxShadow: `0 0 0 1px ${uc.color}30, 0 8px 24px -8px ${uc.color}60`,
                  }}
                >
                  <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: uc.color }} />
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base"
                      style={{ background: `${uc.color}20`, border: `1px solid ${uc.color}40` }}
                    >
                      {uc.icon}
                    </span>
                    <p className="text-sm font-extrabold text-white">{uc.title}</p>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-white/70">{uc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}