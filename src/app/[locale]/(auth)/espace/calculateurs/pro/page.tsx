"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Mode = "stake" | "target";
type NLegs = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type Rounding = 0 | 0.1 | 0.5 | 1 | 2 | 5;
type BetSide = "back" | "lay";
type LayStakeMode = "backer" | "liability";
type Currency = "EUR" | "USD" | "GBP" | "BRL" | "CHF" | "CAD" | "AUD" | "JPY" | "BTC" | "ETH";
type TabKey = "surebet" | "matched" | "freebet" | "dutching" | "allInOne";

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
  layStakeMode: LayStakeMode; // pour les lignes Lay : saisir en backer stake ou en liability
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
  netOdd: number; // cote effective après application de la commission
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

const MAX_LEGS = 10;

const CURRENCIES: Currency[] = ["EUR", "USD", "GBP", "BRL", "CHF", "CAD", "AUD", "JPY", "BTC", "ETH"];

const DEFAULT_RATES: Record<Currency, number> = {
  EUR: 1, USD: 1.08, GBP: 0.85, BRL: 5.5, CHF: 0.95,
  CAD: 1.48, AUD: 1.65, JPY: 168, BTC: 0.000015, ETH: 0.00040,
};

const LEG_COLORS = [
  "#10b981", "#06b6d4", "#a855f7", "#f43f5e", "#eab308",
  "#84cc16", "#f97316", "#3b82f6", "#ec4899", "#14b8a6",
];

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: "€", USD: "$", GBP: "£", BRL: "R$", CHF: "Fr",
  CAD: "C$", AUD: "A$", JPY: "¥", BTC: "₿", ETH: "Ξ",
};

const TABS: { key: TabKey; icon: string; label: string; hint: string; color: string }[] = [
  { key: "surebet", icon: "🎯", label: "Surebet", hint: "Arbitrage pur : 2 à 10 back chez différents bookmakers pour profit garanti", color: "#10b981" },
  { key: "matched", icon: "🔄", label: "Matched", hint: "Qualifier un freebet : 1 back bookmaker + 1 lay exchange à la même cote", color: "#06b6d4" },
  { key: "freebet", icon: "🎁", label: "Freebet", hint: "Convertir un freebet (non-rendu) en cash via un lay sur exchange", color: "#a855f7" },
  { key: "dutching", icon: "⚖️", label: "Dutching", hint: "Répartir ta mise sur N issues pour gain identique — coche les issues gagnantes en D", color: "#f43f5e" },
  { key: "allInOne", icon: "💎", label: "Tout-en-un", hint: "Toutes les options accessibles — à toi de régler finement chaque paramètre", color: "#3b82f6" },
];

function getFormulas(n: number): { label: string; legLabels: string[] }[] {
  if (n === 2) {
    return [
      { label: "1 - 2", legLabels: ["1", "2"] },
      { label: "1 - X2", legLabels: ["1", "X2"] },
      { label: "1X - 2", legLabels: ["1X", "2"] },
      { label: "12 - X", legLabels: ["12", "X"] },
    ];
  }
  if (n === 3) {
    return [{ label: "1 - X - 2", legLabels: ["1", "X", "2"] }];
  }
  const labels = Array.from({ length: n }, (_, i) => `${i + 1}`);
  return [{ label: labels.join(" - "), legLabels: labels }];
}

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

// Calcul autonome de la cote effective après commission, pour UNE ligne isolée.
// Utilisé pour afficher en live la cote nette dès qu'une cote + commission sont saisies,
// indépendamment du calcul global (qui exige toutes les cotes valides).
// Retourne null si la cote est invalide ou la commission incohérente.
function computeNetOdd(oddStr: string, commissionStr: string, side: BetSide, useCommissions: boolean): number | null {
  const odd = parseFloat(oddStr);
  if (!odd || odd <= 1) return null;
  const c = useCommissions ? Math.max(0, Math.min(0.4, (parseFloat(commissionStr) || 0) / 100)) : 0;
  if (side === "back") return 1 + (odd - 1) * (1 - c);
  return 1 + (1 - c) / (odd - 1);
}

function calcPro(
  legs: Leg[],
  nLegs: NLegs,
  amount: number,
  mode: Mode,
  rounding: Rounding,
  useCommissions: boolean,
  rates: Record<Currency, number>,
  mainCurrency: Currency,
  roundInMain: boolean
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
      if (lockedLeg.layStakeMode === "liability") {
        // l'input est déjà la liability = capital engagé
        lockedCapitalLocal = lockedInput;
      } else {
        // input = backer stake, capital engagé = backer × (odd - 1)
        lockedCapitalLocal = lockedInput * Math.max(0, parseFloat(lockedLeg.odd) - 1);
      }
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

  // Calcul mise/liability en devise locale (sans arrondi)
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

  // Arrondi : soit en devise locale (défaut), soit en devise principale
  const stakesLocalRounded = stakesLocal.map((s, i) => {
    if (active[i].locked && i === lockedIdx) {
      return parseFloat(active[i].lockedStake) || 0;
    }
    if (roundInMain) {
      // Arrondir le capital en devise principale, puis convertir en local
      const capMainRounded = roundStake(capitalsMain[i], rounding);
      const capLocalRounded = convert(capMainRounded, mainCurrency, active[i].currency, rates);
      if (active[i].side === "lay") {
        const o = parseFloat(active[i].odd);
        return o > 1 ? capLocalRounded / (o - 1) : 0;
      }
      return capLocalRounded;
    }
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

  const sortedByOdd = odds.map((o, i) => ({ o, i })).sort((a, b) => b.o - a.o).map((x, rank) => ({ ...x, rank }));
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
    netOdd: netOdds[i],
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

// Calcul de TRJ indicatif même sans tous les résultats complets (pour le badge permanent)
function calcTrjOnly(legs: Leg[], nLegs: NLegs, useCommissions: boolean): { trj: number; arbPercent: number; valid: boolean } {
  const active = legs.slice(0, nLegs);
  const odds = active.map((l) => parseFloat(l.odd));
  if (odds.some((o) => !o || o <= 1)) return { trj: 0, arbPercent: 0, valid: false };
  const netOdds = odds.map((o, i) => {
    const c = useCommissions ? Math.max(0, (parseFloat(active[i].commission) || 0) / 100) : 0;
    if (active[i].side === "back") return 1 + (o - 1) * (1 - c);
    return 1 + (1 - c) / (o - 1);
  });
  const invSum = netOdds.reduce((s, o) => s + 1 / o, 0);
  if (invSum <= 0) return { trj: 0, arbPercent: 0, valid: false };
  const trj = (1 / invSum) * 100;
  return { trj, arbPercent: trj - 100, valid: true };
}

interface FreebetResult {
  freebetValue: number;
  oddBack: number;
  oddLay: number;
  commissionLay: number;
  layStake: number;
  layStakeRounded: number;
  liability: number;
  liabilityRounded: number;
  // Scénario "si back gagne" décomposé
  backWinsBookie: number;   // + freebet × (oddBack - 1)
  backWinsExchange: number; // - liability
  profitBackWins: number;   // total = bookie + exchange
  // Scénario "si back perd"
  backLosesBookie: number;   // 0 (freebet perdu, pas d'argent)
  backLosesExchange: number; // + lay × (1 - commission)
  profitBackLoses: number;
  guaranteedProfit: number;
  conversionRate: number;
}

function calcFreebet(
  freebetValue: number,
  oddBack: number,
  oddLay: number,
  commissionLayPct: number,
  rounding: Rounding
): FreebetResult | null {
  if (freebetValue <= 0 || oddBack <= 1 || oddLay <= 1) return null;
  const c = Math.max(0, Math.min(0.4, commissionLayPct / 100));
  const B = (freebetValue * (oddBack - 1)) / (oddLay - c);
  const L = B * (oddLay - 1);
  const BRounded = roundStake(B, rounding);
  const LRounded = BRounded * (oddLay - 1);
  // Scénario si back gagne : gain bookie = freebet × (oddBack-1), perte exchange = liability
  const backWinsBookie = freebetValue * (oddBack - 1);
  const backWinsExchange = -LRounded;
  const profitBackWins = backWinsBookie + backWinsExchange;
  // Scénario si back perd : freebet perdu (0), gain lay net = lay × (1-c)
  const backLosesBookie = 0;
  const backLosesExchange = BRounded * (1 - c);
  const profitBackLoses = backLosesBookie + backLosesExchange;
  const guaranteedProfit = Math.min(profitBackWins, profitBackLoses);
  const conversionRate = (guaranteedProfit / freebetValue) * 100;
  return {
    freebetValue,
    oddBack,
    oddLay,
    commissionLay: c * 100,
    layStake: B,
    layStakeRounded: BRounded,
    liability: L,
    liabilityRounded: LRounded,
    backWinsBookie,
    backWinsExchange,
    profitBackWins,
    backLosesBookie,
    backLosesExchange,
    profitBackLoses,
    guaranteedProfit,
    conversionRate,
  };
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function CalculatorProPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [activeTab, setActiveTab] = useState<TabKey>("allInOne");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [mode, setMode] = useState<Mode>("stake");
  const [amount, setAmount] = useState("100");
  const [nLegs, setNLegs] = useState<NLegs>(2);
  const [formulaIdx, setFormulaIdx] = useState(0);
  const [rounding, setRounding] = useState<Rounding>(0);
  const [roundInMain, setRoundInMain] = useState(false);
  const [useCommissions, setUseCommissions] = useState(false);
  const [useCurrencies, setUseCurrencies] = useState(false);
  const [useDistribution, setUseDistribution] = useState(true);
  const [mainCurrency, setMainCurrency] = useState<Currency>("EUR");
  const [rates, setRates] = useState<Record<Currency, number>>(DEFAULT_RATES);
  const [showRates, setShowRates] = useState(false);
  const [copied, setCopied] = useState(false);

  const [fbValue, setFbValue] = useState("");
  const [fbOddBack, setFbOddBack] = useState("");
  const [fbOddLay, setFbOddLay] = useState("");
  const [fbCommission, setFbCommission] = useState("3");

  const [legs, setLegs] = useState<Leg[]>(() => {
    const initialLabels = getFormulas(2)[0].legLabels;
    return Array.from({ length: MAX_LEGS }, (_, i) => ({
      odd: "",
      bookmaker: "",
      label: initialLabels[i] ?? `Issue ${i + 1}`,
      commission: "0",
      side: "back" as BetSide,
      locked: false,
      lockedStake: "",
      currency: "EUR" as Currency,
      distribute: true,
      layStakeMode: "backer" as LayStakeMode,
    }));
  });

  const formulas = useMemo(() => getFormulas(nLegs), [nLegs]);

  function applyFormula(idx: number) {
    const f = getFormulas(nLegs)[idx];
    if (!f) return;
    setFormulaIdx(idx);
    setLegs(
      legs.map((l, i) => {
        if (i < f.legLabels.length) return { ...l, label: f.legLabels[i] };
        return { ...l, label: `Issue ${i + 1}` };
      })
    );
  }

  function changeNLegs(n: NLegs) {
    setNLegs(n);
    setFormulaIdx(0);
    const f = getFormulas(n)[0];
    if (!f) return;
    setLegs(
      legs.map((l, i) => {
        if (i < f.legLabels.length) return { ...l, label: f.legLabels[i] };
        return { ...l, label: `Issue ${i + 1}` };
      })
    );
  }

  function applyTab(tab: TabKey) {
    setActiveTab(tab);
    setMobileMenuOpen(false);

    if (tab === "surebet") {
      setUseCommissions(false);
      setUseCurrencies(false);
      setUseDistribution(false);
      const f = getFormulas(nLegs)[formulaIdx] ?? getFormulas(nLegs)[0];
      setLegs(
        legs.map((l, i) => ({
          ...l, side: "back", distribute: true, locked: false, lockedStake: "", commission: "0",
          layStakeMode: "backer",
          label: i < f.legLabels.length ? f.legLabels[i] : `Issue ${i + 1}`,
        }))
      );
    } else if (tab === "matched") {
      setNLegs(2);
      setUseCommissions(true);
      setUseCurrencies(false);
      setUseDistribution(false);
      setLegs(
        legs.map((l, i) => ({
          ...l,
          side: i === 0 ? "back" : i === 1 ? "lay" : l.side,
          distribute: true,
          locked: false,
          lockedStake: "",
          commission: i === 1 ? "3" : "0",
          layStakeMode: "backer",
          label: i === 0 ? "Back bookmaker" : i === 1 ? "Lay exchange" : l.label,
        }))
      );
    } else if (tab === "dutching") {
      setUseCommissions(false);
      setUseCurrencies(false);
      setUseDistribution(true);
      const f = getFormulas(nLegs)[formulaIdx] ?? getFormulas(nLegs)[0];
      setLegs(
        legs.map((l, i) => ({
          ...l, side: "back", distribute: true, locked: false, lockedStake: "", commission: "0",
          layStakeMode: "backer",
          label: i < f.legLabels.length ? f.legLabels[i] : `Issue ${i + 1}`,
        }))
      );
    } else if (tab === "allInOne") {
      const f = getFormulas(nLegs)[formulaIdx] ?? getFormulas(nLegs)[0];
      setLegs(
        legs.map((l, i) => ({
          ...l,
          label: i < f.legLabels.length ? f.legLabels[i] : `Issue ${i + 1}`,
        }))
      );
    }
  }

  function updateLeg<K extends keyof Leg>(index: number, field: K, value: Leg[K]) {
    const next = [...legs];
    next[index] = { ...next[index], [field]: value };
    setLegs(next);
  }

  // Bascule Mise parieur / Obligations sur une ligne Lay, avec conversion auto de la valeur lockée
  function toggleLayStakeMode(index: number) {
    const next = [...legs];
    const leg = next[index];
    if (leg.side !== "lay") return;
    const odd = parseFloat(leg.odd);
    const newMode: LayStakeMode = leg.layStakeMode === "backer" ? "liability" : "backer";
    if (leg.locked && leg.lockedStake && odd > 1) {
      const current = parseFloat(leg.lockedStake) || 0;
      // backer → liability : liability = backer × (odd - 1)
      // liability → backer : backer = liability / (odd - 1)
      const converted = newMode === "liability" ? current * (odd - 1) : current / (odd - 1);
      next[index] = { ...leg, layStakeMode: newMode, lockedStake: converted.toFixed(2) };
    } else {
      next[index] = { ...leg, layStakeMode: newMode };
    }
    setLegs(next);
  }

  function setLegLocked(index: number, locked: boolean, newStake?: string) {
    const next = [...legs];
    if (locked) {
      for (let i = 0; i < next.length; i++) {
        next[i] = {
          ...next[i],
          locked: i === index,
          lockedStake: i === index ? (newStake ?? next[i].lockedStake ?? "") : "",
        };
      }
    } else {
      next[index] = { ...next[index], locked: false, lockedStake: "" };
    }
    setLegs(next);
  }

  function toggleSide(index: number) {
    updateLeg(index, "side", legs[index].side === "back" ? "lay" : "back");
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
    // Reset simple de tous les états à leurs valeurs de départ
    setAmount("100");
    setRounding(0);
    setRoundInMain(false);
    setFormulaIdx(0);
    setNLegs(2);

    // Construction des legs fraiches
    const fresh: Leg[] = Array.from({ length: MAX_LEGS }, (_, i) => ({
      odd: "", bookmaker: "", label: `Issue ${i + 1}`, commission: "0",
      side: "back" as BetSide, locked: false, lockedStake: "",
      currency: "EUR" as Currency, distribute: true, layStakeMode: "backer" as LayStakeMode,
    }));

    // Application du preset correspondant à l'onglet actif (sans lire le state stale)
    if (activeTab === "matched") {
      setUseCommissions(true);
      setUseCurrencies(false);
      setUseDistribution(false);
      setLegs(
        fresh.map((l, i) => ({
          ...l,
          side: i === 0 ? "back" : i === 1 ? "lay" : "back",
          commission: i === 1 ? "3" : "0",
          label: i === 0 ? "Back bookmaker" : i === 1 ? "Lay exchange" : `Issue ${i + 1}`,
        }))
      );
    } else if (activeTab === "dutching") {
      setUseCommissions(false);
      setUseCurrencies(false);
      setUseDistribution(true);
      const f = getFormulas(2)[0];
      setLegs(fresh.map((l, i) => ({ ...l, label: i < f.legLabels.length ? f.legLabels[i] : `Issue ${i + 1}` })));
    } else if (activeTab === "surebet") {
      setUseCommissions(false);
      setUseCurrencies(false);
      setUseDistribution(false);
      const f = getFormulas(2)[0];
      setLegs(fresh.map((l, i) => ({ ...l, label: i < f.legLabels.length ? f.legLabels[i] : `Issue ${i + 1}` })));
    } else {
      // allInOne : on garde les options actives (ne force rien), juste les legs fresh avec formule 1-2
      const f = getFormulas(2)[0];
      setLegs(fresh.map((l, i) => ({ ...l, label: i < f.legLabels.length ? f.legLabels[i] : `Issue ${i + 1}` })));
    }
  }

  const result = useMemo((): CalcResult | null => {
    if (activeTab === "freebet") return null;
    const amt = parseFloat(amount);
    const hasLock = legs.slice(0, nLegs).some((l) => l.locked && parseFloat(l.lockedStake) > 0);
    if (!hasLock && (!amt || amt <= 0)) return null;
    const safeAmt = !amt || amt <= 0 ? 1 : amt;
    return calcPro(legs, nLegs, safeAmt, mode, rounding, useCommissions, rates, mainCurrency, roundInMain);
  }, [activeTab, legs, nLegs, amount, mode, rounding, useCommissions, rates, mainCurrency, roundInMain]);

  // TRJ indicatif toujours calculé (pour le badge permanent, même si le reste n'est pas prêt)
  const trjOnly = useMemo(() => calcTrjOnly(legs, nLegs, useCommissions), [legs, nLegs, useCommissions]);

  const freebetResult = useMemo((): FreebetResult | null => {
    if (activeTab !== "freebet") return null;
    return calcFreebet(parseFloat(fbValue), parseFloat(fbOddBack), parseFloat(fbOddLay), parseFloat(fbCommission), rounding);
  }, [activeTab, fbValue, fbOddBack, fbOddLay, fbCommission, rounding]);

  const mainSymbol = CURRENCY_SYMBOLS[mainCurrency];

  async function copyRecap() {
    if (!result) return;
    const lines: string[] = [];
    lines.push(`🎯 CALCULATEUR PRO — PRONOS.CLUB — Mode ${TABS.find((t) => t.key === activeTab)?.label}`);
    lines.push(`TRJ ${result.trj.toFixed(2)}% • ROI ${result.roiRounded.toFixed(2)}% • Profit ${result.guaranteedProfitRounded.toFixed(2)}${mainSymbol}`);
    lines.push(`─────────────────────`);
    const ordered = result.legs.map((l, i) => ({ ...l, origIndex: i })).sort((a, b) => a.volatilityRank - b.volatilityRank);
    ordered.forEach((leg, rank) => {
      const orig = legs[leg.origIndex];
      const sideTag = leg.side === "lay" ? " [LAY]" : "";
      const distTag = !orig.distribute ? " [NEUTRE]" : "";
      const bookName = orig.bookmaker || `Bookmaker ${leg.origIndex + 1}`;
      const labelName = orig.label || `Issue ${leg.origIndex + 1}`;
      const cur = CURRENCY_SYMBOLS[orig.currency];
      const amountTxt = leg.side === "back"
        ? `${leg.stakeRounded.toFixed(2)}${cur} @ ${parseFloat(orig.odd).toFixed(2)}`
        : `Lay ${leg.stakeRounded.toFixed(2)}${cur} @ ${parseFloat(orig.odd).toFixed(2)} (liab. ${leg.liabilityRounded.toFixed(2)}${cur})`;
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
    } catch {}
  }

  async function copyFreebetRecap() {
    if (!freebetResult) return;
    const lines: string[] = [];
    lines.push(`🎁 CALCULATEUR PRO — PRONOS.CLUB — Conversion Freebet`);
    lines.push(`─────────────────────`);
    lines.push(`Freebet : ${freebetResult.freebetValue.toFixed(2)}€ @ ${freebetResult.oddBack.toFixed(2)} (back)`);
    lines.push(`Lay     : ${freebetResult.layStakeRounded.toFixed(2)}€ @ ${freebetResult.oddLay.toFixed(2)} (comm ${freebetResult.commissionLay.toFixed(1)}%)`);
    lines.push(`Liability : ${freebetResult.liabilityRounded.toFixed(2)}€`);
    lines.push(`─────────────────────`);
    lines.push(`Profit garanti : ${freebetResult.guaranteedProfit.toFixed(2)}€ (conversion ${freebetResult.conversionRate.toFixed(2)}%)`);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  if (!isPremium) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <p className="mt-4 text-sm font-bold text-neutral-500">Cette page est réservée aux abonnés Premium.</p>
      </main>
    );
  }

  const placementOrder = result
    ? result.legs.map((l, i) => ({ ...l, origIndex: i })).sort((a, b) => a.volatilityRank - b.volatilityRank)
    : [];

  const currentTab = TABS.find((t) => t.key === activeTab)!;

  const statusAccent = activeTab === "freebet"
    ? (freebetResult && freebetResult.guaranteedProfit > 0
        ? "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)"
        : "linear-gradient(90deg, #525252, #737373, #525252)")
    : !result
      ? "linear-gradient(90deg, #525252, #737373, #525252)"
      : result.isSurebet
        ? "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)"
        : Math.abs(result.arbPercent) < 0.5
          ? "linear-gradient(90deg, #b45309, #d97706, #f59e0b, #d97706, #b45309)"
          : "linear-gradient(90deg, #991b1b, #ef4444, #f87171, #ef4444, #991b1b)";

  const showBLToggle = activeTab === "matched" || activeTab === "allInOne";
  const showDistributionCol = useDistribution;
  const showCommissionCol = useCommissions;
  const showEffectiveOddCol = useCommissions; // cote effective = cote avec commission
  const showCurrencyCol = useCurrencies;
  const showBookmakerCol = true;
  const showMarketSelector = activeTab !== "matched";
  const showOptionsFooter = activeTab === "allInOne";
  const showFormulaSelector = activeTab !== "matched" && activeTab !== "freebet";
  const showPermanentBadge = activeTab !== "freebet";
  const maxLegsForTab = activeTab === "matched" ? 2 : 10;
  const displayedNLegs = activeTab === "matched" ? 2 : nLegs;

  const useCases = [
    { icon: "🎯", title: "Surebet classique", desc: "2 à 10 back chez différents bookmakers. Tous tes gains garantis.", color: "#10b981" },
    { icon: "🔄", title: "Matched betting", desc: "1 back + 1 lay pour convertir ton freebet de qualification.", color: "#06b6d4" },
    { icon: "🎁", title: "Freebet → Cash", desc: "Convertir un freebet non-rendu en cash garanti via un lay.", color: "#a855f7" },
    { icon: "⚖️", title: "Dutching", desc: "Répartir la mise sur plusieurs issues, cibler celles gagnantes.", color: "#f43f5e" },
    { icon: "💎", title: "Tout-en-un", desc: "Tous les paramètres accessibles pour les cas les plus tordus.", color: "#3b82f6" },
  ];

  const inputBase = "w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-center font-mono text-[13px] font-bold text-white outline-none placeholder:text-white/20 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30";

  // Badge permanent : couleur selon état
  const badgePct = trjOnly.valid ? trjOnly.arbPercent : null;
  const badgeColor = badgePct === null
    ? "text-white/40"
    : badgePct > 0
      ? "text-emerald-300"
      : Math.abs(badgePct) < 0.5
        ? "text-amber-300"
        : "text-rose-300";
  const badgeBg = badgePct === null
    ? "bg-white/5 border-white/10"
    : badgePct > 0
      ? "bg-emerald-500/10 border-emerald-500/30"
      : Math.abs(badgePct) < 0.5
        ? "bg-amber-500/10 border-amber-500/30"
        : "bg-rose-500/10 border-rose-500/30";

  return (
    <main className="mx-auto max-w-4xl px-3 pb-12 pt-6 md:px-4 md:pt-8">
      <div
        className="overflow-hidden rounded-2xl border border-white/[0.06] shadow-2xl"
        style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d1f17 40%, #0a0a0a 100%)" }}
      >
        <div className="h-0.5" style={{ background: statusAccent }} />

        <div className="p-4 sm:p-5">
          {/* ─── ONGLETS DESKTOP ─── */}
          <div className="mb-3 hidden gap-1 md:flex">
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  onClick={() => applyTab(tab.key)}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                    active ? "text-white shadow-lg" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80"
                  }`}
                  style={active ? { background: `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}cc 100%)`, boxShadow: `0 4px 12px -2px ${tab.color}80` } : undefined}
                >
                  <span className="text-sm">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ─── DROPDOWN MOBILE ─── */}
          <div className="relative mb-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-extrabold uppercase tracking-wider text-white shadow-lg"
              style={{ background: `linear-gradient(135deg, ${currentTab.color} 0%, ${currentTab.color}cc 100%)`, boxShadow: `0 4px 12px -2px ${currentTab.color}80` }}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{currentTab.icon}</span>
                {currentTab.label}
              </span>
              <span className={`text-xs transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
            {mobileMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMobileMenuOpen(false)} />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-white/10 bg-zinc-950 shadow-2xl">
                  {TABS.map((tab) => {
                    const isActive = tab.key === activeTab;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => applyTab(tab.key)}
                        className={`flex w-full items-center gap-2 border-b border-white/5 px-4 py-3 text-left text-sm font-bold uppercase tracking-wider transition last:border-b-0 ${
                          isActive ? "text-white" : "text-white/70 hover:bg-white/5"
                        }`}
                        style={isActive ? { background: `linear-gradient(90deg, ${tab.color}30 0%, ${tab.color}10 100%)`, borderLeft: `3px solid ${tab.color}` } : undefined}
                      >
                        <span className="text-base">{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ─── Hint + BADGE PERMANENT ─── */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex-1 text-[11px] italic text-white/50">{currentTab.hint}</p>
            {showPermanentBadge && (
              <div
                className={`flex flex-shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${badgeBg}`}
              >
                <span className="text-white/40">TRJ</span>
                <span className={`font-mono ${badgeColor}`}>
                  {trjOnly.valid ? trjOnly.trj.toFixed(2) + "%" : "—"}
                </span>
                <span className="text-white/20">•</span>
                <span className={`font-mono ${badgeColor}`}>
                  {badgePct !== null ? (badgePct > 0 ? "+" : "") + badgePct.toFixed(2) + "%" : "—"}
                </span>
              </div>
            )}
          </div>

          {/* ═══ MODE FREEBET ═══ */}
          {activeTab === "freebet" ? (
            <div className="space-y-4">
              {freebetResult && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px] font-bold">
                  <span className="text-white/40">
                    Profit garanti{" "}
                    <span className={`font-mono ${freebetResult.guaranteedProfit > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {freebetResult.guaranteedProfit > 0 ? "+" : ""}
                      {freebetResult.guaranteedProfit.toFixed(2)}€
                    </span>
                  </span>
                  <span className="text-white/40">
                    Conversion{" "}
                    <span className={`font-mono ${freebetResult.conversionRate > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {freebetResult.conversionRate.toFixed(2)}%
                    </span>
                  </span>
                  <span className="text-white/40">
                    Liability requise <span className="font-mono text-amber-300">{freebetResult.liabilityRounded.toFixed(2)}€</span>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border-2 border-purple-500/30 bg-purple-500/[0.06] p-3">
                  <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-purple-300">🎁 Freebet (back bookmaker)</p>
                  <div className="space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Valeur freebet (€)</span>
                      <input type="number" step="0.01" min="0.01" value={fbValue} onChange={(e) => setFbValue(e.target.value)} inputMode="decimal"
                        className="w-full rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-center font-mono text-base font-black text-purple-200 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Cote back</span>
                      <input type="number" step="0.001" min="1.001" value={fbOddBack} onChange={(e) => setFbOddBack(e.target.value)} inputMode="decimal"
                        className="w-full rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-center font-mono text-base font-black text-white outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/30" />
                    </label>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/[0.06] p-3">
                  <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-300">🔄 Lay (exchange)</p>
                  <div className="space-y-2">
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Cote lay</span>
                      <input type="number" step="0.001" min="1.001" value={fbOddLay} onChange={(e) => setFbOddLay(e.target.value)} inputMode="decimal"
                        className="w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center font-mono text-base font-black text-white outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Commission exchange (%)</span>
                      <input type="number" step="0.1" min="0" max="40" value={fbCommission} onChange={(e) => setFbCommission(e.target.value)} inputMode="decimal"
                        className="w-full rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-center font-mono text-base font-black text-cyan-200 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30" />
                    </label>
                  </div>
                </div>
              </div>

              {freebetResult && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 p-3 text-center">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">🎯 Mise lay à placer</p>
                    <p className="mt-1 font-mono text-2xl font-black text-emerald-200">{freebetResult.layStakeRounded.toFixed(2)}€</p>
                    <p className="mt-0.5 text-[10px] text-emerald-400/70">@ cote {freebetResult.oddLay.toFixed(3)}</p>
                  </div>
                  <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 p-3 text-center">
                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300">💳 Liability requise (exchange)</p>
                    <p className="mt-1 font-mono text-2xl font-black text-amber-200">{freebetResult.liabilityRounded.toFixed(2)}€</p>
                    <p className="mt-0.5 text-[10px] text-amber-400/70">Solde à disposer</p>
                  </div>
                </div>
              )}

              {freebetResult && (
                <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                  <p className="border-b border-white/5 bg-white/[0.02] px-3 py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/50">
                    📊 Scénarios — flux d&apos;argent détaillé
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                          <th className="px-3 py-2 text-left"></th>
                          <th className="px-3 py-2 text-right">Bookie</th>
                          <th className="px-3 py-2 text-right">Exchange</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Si back gagne */}
                        <tr className="border-b border-white/5">
                          <td className="px-3 py-2.5">
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                              Back gagne
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-black ${freebetResult.backWinsBookie >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {freebetResult.backWinsBookie >= 0 ? "+" : ""}
                            {freebetResult.backWinsBookie.toFixed(2)}€
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-black ${freebetResult.backWinsExchange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {freebetResult.backWinsExchange >= 0 ? "+" : ""}
                            {freebetResult.backWinsExchange.toFixed(2)}€
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-black ${freebetResult.profitBackWins >= 0 ? "text-white" : "text-rose-300"}`}>
                            = {freebetResult.profitBackWins >= 0 ? "+" : ""}
                            {freebetResult.profitBackWins.toFixed(2)}€
                          </td>
                        </tr>
                        {/* Si lay gagne (= back perd) */}
                        <tr>
                          <td className="px-3 py-2.5">
                            <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-purple-300">
                              Lay gagne
                            </span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-black ${freebetResult.backLosesBookie > 0 ? "text-emerald-300" : freebetResult.backLosesBookie < 0 ? "text-rose-300" : "text-white/50"}`}>
                            {freebetResult.backLosesBookie > 0 ? "+" : ""}
                            {freebetResult.backLosesBookie.toFixed(2)}€
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-black ${freebetResult.backLosesExchange >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                            {freebetResult.backLosesExchange >= 0 ? "+" : ""}
                            {freebetResult.backLosesExchange.toFixed(2)}€
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono font-black ${freebetResult.profitBackLoses >= 0 ? "text-white" : "text-rose-300"}`}>
                            = {freebetResult.profitBackLoses >= 0 ? "+" : ""}
                            {freebetResult.profitBackLoses.toFixed(2)}€
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <div className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-white/40">Arrondi</span>
                  <select value={rounding} onChange={(e) => setRounding(parseFloat(e.target.value) as Rounding)} className="cursor-pointer bg-transparent text-[10px] font-extrabold text-white outline-none">
                    <option value={0} className="bg-black">Aucun</option>
                    <option value={0.1} className="bg-black">0.10</option>
                    <option value={0.5} className="bg-black">0.50</option>
                    <option value={1} className="bg-black">1</option>
                    <option value={2} className="bg-black">2</option>
                    <option value={5} className="bg-black">5</option>
                  </select>
                </div>
                {freebetResult && (
                  <button onClick={copyFreebetRecap} className="cursor-pointer rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20">
                    {copied ? "✅ Copié" : "📋 Copier"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ═══ CONTROLS ═══ */}
              <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                <div className="flex overflow-hidden rounded-lg border border-white/10">
                  <button onClick={() => setMode("stake")} className={`flex-1 cursor-pointer px-3 py-1.5 text-[11px] font-bold transition ${mode === "stake" ? "bg-emerald-500 text-white" : "bg-white/5 text-white/50 hover:text-white/80"}`}>
                    💰 Mise totale
                  </button>
                  <button onClick={() => setMode("target")} className={`flex-1 cursor-pointer px-3 py-1.5 text-[11px] font-bold transition ${mode === "target" ? "bg-emerald-500 text-white" : "bg-white/5 text-white/50 hover:text-white/80"}`}>
                    🎯 Gain cible
                  </button>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400/80">{mode === "stake" ? "Enjeu" : "Gain"}</span>
                  <input type="number" step="0.01" min="1" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setLegs(legs.map((l) => ({ ...l, locked: false, lockedStake: "" }))); }}
                    placeholder="100" inputMode="decimal"
                    className="w-24 bg-transparent text-center font-mono text-sm font-black text-emerald-300 outline-none placeholder:text-emerald-700" />
                  <select value={mainCurrency} onChange={(e) => setMainCurrency(e.target.value as Currency)} className="cursor-pointer bg-transparent text-[11px] font-bold text-emerald-300 outline-none">
                    {CURRENCIES.map((c) => (<option key={c} value={c} className="bg-black">{c}</option>))}
                  </select>
                </div>

                {showMarketSelector ? (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30">⚙️ Marché</span>
                    {Array.from({ length: maxLegsForTab - 1 }, (_, i) => i + 2).map((n) => (
                      <button key={n} onClick={() => changeNLegs(n as NLegs)}
                        className={`h-7 w-7 cursor-pointer rounded-md text-[11px] font-black transition ${
                          nLegs === n ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/40" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                        }`}>{n}</button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30">🔄 2 paris (back + lay)</span>
                )}
              </div>

              {showFormulaSelector && (
                <div className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">📋 Formule</span>
                  <select value={formulaIdx} onChange={(e) => applyFormula(parseInt(e.target.value))}
                    className="cursor-pointer rounded-md bg-transparent px-2 py-0.5 text-[11px] font-extrabold text-white outline-none hover:bg-white/5">
                    {formulas.map((f, i) => (<option key={i} value={i} className="bg-black">{f.label}</option>))}
                  </select>
                </div>
              )}

              {/* ═══ TABLEAU DESKTOP ═══ */}
              <div className="hidden md:block">
                <div className="overflow-x-auto rounded-lg border border-white/5">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="bg-white/[0.03] text-[9px] font-extrabold uppercase tracking-wider text-white/40">
                        <th className="w-8 px-1 py-1.5"></th>
                        <th className="px-2 py-1.5 text-left">Label</th>
                        {showBLToggle && <th className="w-12 px-1 py-1.5">B/L</th>}
                        <th className="w-20 px-1 py-1.5">Cote</th>
                        {showCommissionCol && <th className="w-28 px-1 py-1.5">% Comm</th>}
                        {showEffectiveOddCol && <th className="w-20 px-1 py-1.5" title="Cote effective après commission">Cote eff.</th>}
                        {showBookmakerCol && <th className="px-2 py-1.5 text-left">Bookmaker</th>}
                        <th className="w-28 px-1 py-1.5">Mise</th>
                        {showCurrencyCol && <th className="w-16 px-1 py-1.5">Dev.</th>}
                        {showDistributionCol && <th className="w-10 px-1 py-1.5">D</th>}
                        <th className="w-10 px-1 py-1.5">C</th>
                        <th className="w-24 px-2 py-1.5 text-right">Gains</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legs.slice(0, displayedNLegs).map((leg, i) => {
                        const legResult = result?.legs[i];
                        const color = LEG_COLORS[i % LEG_COLORS.length];
                        const profit = legResult?.profit ?? 0;
                        const isLay = leg.side === "lay";
                        // Détermination de la valeur affichée dans la cellule Mise (backer stake ou liability selon layStakeMode)
                        const displayedStake = leg.locked
                          ? leg.lockedStake
                          : legResult
                            ? (isLay && leg.layStakeMode === "liability"
                                ? legResult.liabilityRounded.toFixed(2)
                                : legResult.stakeRounded.toFixed(2))
                            : "0.00";
                        return (
                          <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
                            <td className="px-1 py-1.5 text-center">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: color }}>{i + 1}</span>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" value={leg.label} onChange={(e) => updateLeg(i, "label", e.target.value)} placeholder={`Issue ${i + 1}`}
                                className="w-full rounded-md border border-white/5 bg-white/5 px-2 py-1 text-[12px] font-bold text-white outline-none focus:border-white/20" />
                            </td>
                            {showBLToggle && (
                              <td className="px-1 py-1.5 text-center">
                                <button onClick={() => toggleSide(i)} title={isLay ? "Bascule en Back" : "Bascule en Lay"}
                                  className={`h-7 w-10 cursor-pointer rounded-md text-xs font-black transition ${
                                    isLay ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/50" : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50"
                                  }`}>{isLay ? "−" : "+"}</button>
                              </td>
                            )}
                            <td className="px-1 py-1.5">
                              <input type="number" step="0.001" min="1.001" value={leg.odd} onChange={(e) => updateLeg(i, "odd", e.target.value)} placeholder="2.000" inputMode="decimal"
                                className={inputBase + (isLay ? " border-purple-500/20 focus:border-purple-500 focus:ring-purple-500/30" : "")} />
                            </td>
                            {showCommissionCol && (
                              <td className="px-1 py-1.5">
                                <div className="flex items-center gap-1">
                                  <input type="number" step="0.1" min="0" max="40" value={leg.commission} onChange={(e) => updateLeg(i, "commission", e.target.value)} placeholder="0" inputMode="decimal"
                                    className="min-w-0 flex-1 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-1 py-1 text-center font-mono text-[12px] font-bold text-cyan-200 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30" />
                                  <button
                                    type="button"
                                    onClick={() => updateLeg(i, "commission", leg.commission === "3" ? "0" : "3")}
                                    title={leg.commission === "3" ? "Désactiver commission OrbitX (3%)" : "Appliquer commission OrbitX (3%)"}
                                    className={`shrink-0 cursor-pointer rounded-md px-1.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
                                      leg.commission === "3"
                                        ? "bg-orange-500/30 text-orange-200 ring-1 ring-orange-400/60"
                                        : "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-orange-500/10 hover:text-orange-300 hover:ring-orange-400/30"
                                    }`}>
                                    OrbX
                                  </button>
                                </div>
                              </td>
                            )}
                            {showEffectiveOddCol && (
                              <td className="px-1 py-1.5">
                                <div className="w-full rounded-md border border-white/10 bg-white/[0.02] px-2 py-1 text-center font-mono text-[12px] font-bold text-white/70" title="Cote après commission appliquée">
                                  {(() => {
                                    const net = computeNetOdd(leg.odd, leg.commission, leg.side, useCommissions);
                                    return net !== null ? net.toFixed(3) : "—";
                                  })()}
                                </div>
                              </td>
                            )}
                            {showBookmakerCol && (
                              <td className="px-2 py-1.5">
                                <input type="text" value={leg.bookmaker} onChange={(e) => updateLeg(i, "bookmaker", e.target.value)} placeholder={isLay ? "Betfair" : "Betclic"}
                                  className="w-full rounded-md border border-white/5 bg-white/5 px-2 py-1 text-[12px] font-bold text-white outline-none focus:border-white/20" />
                              </td>
                            )}
                            <td className="px-1 py-1.5">
                              <div className="flex flex-col gap-0.5">
                                {isLay && (
                                  <div className="flex gap-0.5 text-[8px] font-extrabold uppercase">
                                    <button onClick={() => { if (leg.layStakeMode !== "backer") toggleLayStakeMode(i); }}
                                      className={`flex-1 cursor-pointer rounded px-1 py-0.5 transition ${
                                        leg.layStakeMode === "backer"
                                          ? "bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/60"
                                          : "bg-white/5 text-white/40 hover:text-white/70"
                                      }`} title="Tu saisis la mise du parieur (backer stake)">Mise</button>
                                    <button onClick={() => { if (leg.layStakeMode !== "liability") toggleLayStakeMode(i); }}
                                      className={`flex-1 cursor-pointer rounded px-1 py-0.5 transition ${
                                        leg.layStakeMode === "liability"
                                          ? "bg-amber-500/30 text-amber-200 ring-1 ring-amber-400/60"
                                          : "bg-white/5 text-white/40 hover:text-white/70"
                                      }`} title="Tu saisis l'engagement / liability">Oblig.</button>
                                  </div>
                                )}
                                <input type="number" step="0.01" min="0" value={displayedStake}
                                  onChange={(e) => setLegLocked(i, true, e.target.value)} inputMode="decimal"
                                  className={`w-full rounded-md border px-2 py-1 text-center font-mono text-[12px] font-bold outline-none focus:ring-1 ${
                                    leg.locked
                                      ? "border-amber-500/40 bg-amber-500/10 text-amber-200 focus:border-amber-400 focus:ring-amber-500/30"
                                      : "border-white/10 bg-white/5 text-white focus:border-emerald-500 focus:ring-emerald-500/30"
                                  }`} />
                              </div>
                            </td>
                            {showCurrencyCol && (
                              <td className="px-1 py-1.5">
                                <select value={leg.currency} onChange={(e) => updateLeg(i, "currency", e.target.value as Currency)}
                                  className="w-full cursor-pointer rounded-md border border-amber-500/20 bg-amber-500/5 px-1 py-1 text-center text-[11px] font-bold text-amber-200 outline-none focus:border-amber-400">
                                  {CURRENCIES.map((c) => (<option key={c} value={c} className="bg-black">{c}</option>))}
                                </select>
                              </td>
                            )}
                            {showDistributionCol && (
                              <td className="px-1 py-1.5 text-center">
                                <input type="checkbox" checked={leg.distribute} onChange={() => toggleDistribute(i)} className="h-4 w-4 cursor-pointer accent-rose-500" />
                              </td>
                            )}
                            <td className="px-1 py-1.5 text-center">
                              <input type="radio" name="lockRadio" checked={leg.locked} onChange={() => setLegLocked(i, !leg.locked)} className="h-4 w-4 cursor-pointer accent-amber-400" />
                            </td>
                            <td className={`px-2 py-1.5 text-right font-mono text-[12px] font-black ${profit > 0.01 ? "text-emerald-300" : profit < -0.01 ? "text-rose-300" : "text-white/60"}`}>
                              {profit > 0 ? "+" : ""}{profit.toFixed(2)}{mainSymbol}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-emerald-500/30 bg-emerald-500/[0.03]">
                        <td colSpan={2 + (showBLToggle ? 1 : 0) + 1 + (showCommissionCol ? 1 : 0) + (showEffectiveOddCol ? 1 : 0) + (showBookmakerCol ? 1 : 0)} className="px-2 py-1.5 text-right text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                          Enjeu total
                        </td>
                        <td className="px-1 py-1.5">
                          <div className="w-full rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-center font-mono text-[13px] font-black text-emerald-200">
                            {result ? result.totalStakeRounded.toFixed(2) : "0.00"}
                          </div>
                        </td>
                        {showCurrencyCol && (<td className="px-1 py-1.5 text-center text-[11px] font-bold text-emerald-300">{mainCurrency}</td>)}
                        {showDistributionCol && <td />}
                        <td className="px-1 py-1.5 text-center">
                          <input type="radio" name="lockRadio" checked={!legs.some((l) => l.locked)} onChange={() => setLegs(legs.map((l) => ({ ...l, locked: false, lockedStake: "" })))} className="h-4 w-4 cursor-pointer accent-emerald-400" />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-[12px] font-black text-emerald-300">
                          {result ? (result.guaranteedProfitRounded >= 0 ? "+" : "") + result.guaranteedProfitRounded.toFixed(2) + mainSymbol : ""}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ═══ CARDS MOBILE ═══ */}
              <div className="md:hidden">
                <div className="space-y-2">
                  {legs.slice(0, displayedNLegs).map((leg, i) => {
                    const legResult = result?.legs[i];
                    const color = LEG_COLORS[i % LEG_COLORS.length];
                    const profit = legResult?.profit ?? 0;
                    const isLay = leg.side === "lay";
                    const displayedStake = leg.locked
                      ? leg.lockedStake
                      : legResult
                        ? (isLay && leg.layStakeMode === "liability"
                            ? legResult.liabilityRounded.toFixed(2)
                            : legResult.stakeRounded.toFixed(2))
                        : "0.00";
                    return (
                      <div key={i} className="rounded-lg border p-2"
                        style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${color}12 50%, #0a0a0a 100%)`, borderColor: `${color}50` }}>
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ background: color }}>{i + 1}</span>
                          <input type="text" value={leg.label} onChange={(e) => updateLeg(i, "label", e.target.value)} placeholder={`Issue ${i + 1}`}
                            className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] font-bold text-white outline-none" />
                          {showBLToggle && (
                            <button onClick={() => toggleSide(i)}
                              className={`h-7 w-9 cursor-pointer rounded-md text-xs font-black transition ${
                                isLay ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-400/50" : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50"
                              }`}>{isLay ? "−" : "+"}</button>
                          )}
                          {showDistributionCol && (
                            <button onClick={() => toggleDistribute(i)}
                              className={`h-7 w-7 cursor-pointer rounded-md text-[10px] font-black transition ${
                                leg.distribute ? "bg-rose-500/25 text-rose-200 ring-1 ring-rose-400/50" : "bg-white/5 text-white/30"
                              }`} title="Distribuer profit">D</button>
                          )}
                          <button onClick={() => setLegLocked(i, !leg.locked)}
                            className={`h-7 w-7 cursor-pointer rounded-md text-xs transition ${
                              leg.locked ? "bg-amber-500/25 text-amber-300 ring-1 ring-amber-400/50" : "bg-white/5 text-white/40"
                            }`} title="Fixer">{leg.locked ? "🔒" : "🔓"}</button>
                        </div>

                        <div className={`mt-1.5 grid gap-1.5 ${showBookmakerCol ? "grid-cols-[80px_1fr]" : "grid-cols-1"}`}>
                          <input type="number" step="0.001" min="1.001" value={leg.odd} onChange={(e) => updateLeg(i, "odd", e.target.value)} placeholder="Cote" inputMode="decimal"
                            className={`rounded-md border px-2 py-1 text-center font-mono text-[12px] font-bold text-white outline-none focus:ring-1 ${
                              isLay ? "border-purple-500/25 bg-purple-500/5 focus:border-purple-500 focus:ring-purple-500/30" : "border-white/10 bg-white/5 focus:border-emerald-500 focus:ring-emerald-500/30"
                            }`} />
                          {showBookmakerCol && (
                            <input type="text" value={leg.bookmaker} onChange={(e) => updateLeg(i, "bookmaker", e.target.value)} placeholder={isLay ? "Exchange" : "Bookmaker"}
                              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] font-bold text-white outline-none" />
                          )}
                        </div>

                        {(showCommissionCol || showCurrencyCol) && (
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                            {showCommissionCol && (
                              <div className="flex items-center gap-1">
                                <input type="number" step="0.1" min="0" max="40" value={leg.commission} onChange={(e) => updateLeg(i, "commission", e.target.value)} placeholder="Commission %" inputMode="decimal"
                                  className="min-w-0 flex-1 rounded-md border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-center font-mono text-[11px] font-bold text-cyan-200 outline-none" />
                                <button
                                  type="button"
                                  onClick={() => updateLeg(i, "commission", leg.commission === "3" ? "0" : "3")}
                                  title={leg.commission === "3" ? "Désactiver commission OrbitX (3%)" : "Appliquer commission OrbitX (3%)"}
                                  className={`shrink-0 cursor-pointer rounded-md px-1.5 py-1 text-[9px] font-black uppercase tracking-wider transition ${
                                    leg.commission === "3"
                                      ? "bg-orange-500/30 text-orange-200 ring-1 ring-orange-400/60"
                                      : "bg-white/5 text-white/50 ring-1 ring-white/10"
                                  }`}>
                                  OrbX
                                </button>
                              </div>
                            )}
                            {showCurrencyCol && (
                              <select value={leg.currency} onChange={(e) => updateLeg(i, "currency", e.target.value as Currency)}
                                className="cursor-pointer rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-center text-[11px] font-bold text-amber-200 outline-none">
                                {CURRENCIES.map((c) => (<option key={c} value={c} className="bg-black">{c} ({CURRENCY_SYMBOLS[c]})</option>))}
                              </select>
                            )}
                          </div>
                        )}

                        {showEffectiveOddCol && (() => {
                          const net = computeNetOdd(leg.odd, leg.commission, leg.side, useCommissions);
                          if (net === null) return null;
                          return (
                            <div className="mt-1.5 flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-2 py-1">
                              <span className="text-[9px] font-extrabold uppercase tracking-wider text-white/40">Cote eff. (après comm.)</span>
                              <span className="font-mono text-[12px] font-bold text-white/80">{net.toFixed(3)}</span>
                            </div>
                          );
                        })()}

                        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                          <div>
                            {isLay ? (
                              <div className="mb-0.5 grid grid-cols-2 gap-0.5">
                                <button onClick={() => { if (leg.layStakeMode !== "backer") toggleLayStakeMode(i); }}
                                  className={`rounded px-1 py-0.5 text-[9px] font-extrabold uppercase transition ${
                                    leg.layStakeMode === "backer"
                                      ? "bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/60"
                                      : "bg-white/5 text-white/40"
                                  }`}>Mise</button>
                                <button onClick={() => { if (leg.layStakeMode !== "liability") toggleLayStakeMode(i); }}
                                  className={`rounded px-1 py-0.5 text-[9px] font-extrabold uppercase transition ${
                                    leg.layStakeMode === "liability"
                                      ? "bg-amber-500/30 text-amber-200 ring-1 ring-amber-400/60"
                                      : "bg-white/5 text-white/40"
                                  }`}>Oblig.</button>
                              </div>
                            ) : (
                              <div className="mb-0.5 text-center text-[9px] font-extrabold uppercase tracking-wider text-white/40">Mise</div>
                            )}
                            <input type="number" step="0.01" min="0" value={displayedStake}
                              onChange={(e) => setLegLocked(i, true, e.target.value)} inputMode="decimal"
                              className={`w-full rounded-md border px-2 py-1 text-center font-mono text-[13px] font-black outline-none ${
                                leg.locked ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                              }`} />
                          </div>
                          <div>
                            <div className="mb-0.5 text-center text-[9px] font-extrabold uppercase tracking-wider text-white/40">Gain si gagne</div>
                            <div className={`rounded-md border px-2 py-1 text-center font-mono text-[13px] font-black ${
                              profit > 0.01 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : profit < -0.01 ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                : "border-white/10 bg-white/5 text-white/60"
                            }`}>
                              {profit > 0 ? "+" : ""}{profit.toFixed(2)}{mainSymbol}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="flex items-center justify-between rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">Enjeu total</span>
                    <span className="font-mono text-base font-black text-emerald-200">{result ? result.totalStakeRounded.toFixed(2) : "0.00"}{mainSymbol}</span>
                  </div>
                </div>
              </div>

              {/* ═══ FOOTER ACTIONS ═══ */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {showOptionsFooter && (
                    <>
                      <OptCheckbox checked={useCommissions} onChange={setUseCommissions} label="Commissions" color="cyan" />
                      <OptCheckbox checked={useCurrencies} onChange={setUseCurrencies} label="Devises" color="amber" />
                      <OptCheckbox checked={useDistribution} onChange={setUseDistribution} label="Profit ciblé" color="rose" />
                    </>
                  )}
                  <div className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-white/40">Arrondi</span>
                    <select value={rounding} onChange={(e) => setRounding(parseFloat(e.target.value) as Rounding)} className="cursor-pointer bg-transparent text-[10px] font-extrabold text-white outline-none">
                      <option value={0} className="bg-black">Aucun</option>
                      <option value={0.1} className="bg-black">0.10</option>
                      <option value={0.5} className="bg-black">0.50</option>
                      <option value={1} className="bg-black">1</option>
                      <option value={2} className="bg-black">2</option>
                      <option value={5} className="bg-black">5</option>
                    </select>
                  </div>
                  {useCurrencies && rounding > 0 && (
                    <button onClick={() => setRoundInMain(!roundInMain)}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider transition ${
                        roundInMain ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/50" : "bg-white/5 text-white/40 hover:text-white/70"
                      }`} title="Arrondir les mises dans la devise principale puis convertir">
                      <span className={`h-1.5 w-1.5 rounded-full ${roundInMain ? "bg-amber-400" : "bg-white/20"}`} />
                      Arrondi en {mainCurrency}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={resetAll} className="cursor-pointer rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:text-white">
                    🔄 Reset
                  </button>
                  {result && (
                    <button onClick={copyRecap} className="cursor-pointer rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20">
                      {copied ? "✅ Copié" : "📋 Copier"}
                    </button>
                  )}
                </div>
              </div>

              {showOptionsFooter && useCurrencies && (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <button onClick={() => setShowRates(!showRates)} className="mx-auto flex cursor-pointer items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/70 hover:text-amber-300">
                    {showRates ? "▼" : "▶"} Taux de change (1 EUR =)
                  </button>
                  {showRates && (
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 md:grid-cols-9">
                        {CURRENCIES.filter((c) => c !== "EUR").map((cur) => (
                          <label key={cur} className="block">
                            <span className="mb-0.5 block text-center text-[9px] font-extrabold text-amber-400/70">{cur}</span>
                            <input type="number" step="0.0001" value={rates[cur] || 1} onChange={(e) => setRates({ ...rates, [cur]: parseFloat(e.target.value) || 1 })}
                              className="w-full rounded border border-amber-500/20 bg-black/40 px-1 py-0.5 text-center font-mono text-[10px] text-amber-200 outline-none focus:border-amber-400" />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {activeTab !== "freebet" && result && <VerdictMini result={result} mainSymbol={mainSymbol} />}

      {activeTab !== "freebet" && result?.isSurebet && (
        <div
          className="mt-3 overflow-hidden rounded-xl border border-emerald-500/30 shadow-xl"
          style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d1f17 40%, #0a0a0a 100%)" }}
        >
          <div className="h-0.5" style={{ background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)" }} />
          <div className="p-3 sm:p-4">
            <p className="mb-2.5 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
              <span className="flex h-4 w-4 items-center justify-center rounded bg-emerald-500/20">⚡</span>
              Ordre de placement — cote la plus haute en premier
            </p>
            <div className="space-y-1.5">
              {placementOrder.map((leg, rank) => {
                const orig = legs[leg.origIndex];
                const legSymbol = CURRENCY_SYMBOLS[orig.currency];
                const legColor = LEG_COLORS[leg.origIndex % LEG_COLORS.length];
                return (
                  <div
                    key={leg.origIndex}
                    className="flex items-center gap-2.5 rounded-lg border p-2"
                    style={{
                      background: `linear-gradient(90deg, ${legColor}26 0%, rgba(13,31,23,0.9) 35%, rgba(10,10,10,0.9) 100%)`,
                      borderColor: `${legColor}55`,
                    }}
                  >
                    <span
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white"
                      style={{ background: legColor, boxShadow: `0 2px 8px -2px ${legColor}80` }}
                    >
                      {rank + 1}
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-extrabold text-white">{orig.label || `Issue ${leg.origIndex + 1}`}</span>
                        {leg.side === "lay" && <span className="rounded bg-purple-500/30 px-1 py-0.5 text-[9px] font-black text-purple-200">LAY</span>}
                        {leg.isLocked && <span className="rounded bg-amber-500/30 px-1 py-0.5 text-[9px] font-black text-amber-200">🔒</span>}
                        {!orig.distribute && useDistribution && (<span className="rounded bg-white/10 px-1 py-0.5 text-[9px] font-black text-white/60">NEUTRE</span>)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/70">
                        {leg.side === "lay" ? "Lay " : ""}
                        <span className="font-mono font-black text-emerald-300">{leg.stakeRounded.toFixed(2)}{legSymbol}</span>
                        <span className="mx-1 text-white/30">@</span>
                        <span className="font-mono font-black text-white">{parseFloat(orig.odd).toFixed(2)}</span>
                        <span className="mx-1 text-white/30">chez</span>
                        <span className="font-bold text-cyan-300">{orig.bookmaker || `Bookmaker ${leg.origIndex + 1}`}</span>
                        {leg.side === "lay" && (<span className="ml-1 text-white/40">(liab. <span className="font-mono font-black text-amber-300">{leg.liabilityRounded.toFixed(2)}{legSymbol}</span>)</span>)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab !== "freebet" && result?.hasRounding && Math.abs(result.roundingLoss) > 0.01 && (
        <Warning icon="⚠️">
          L&apos;arrondi réduit le profit de <span className="font-mono font-black">{result.roundingLoss.toFixed(2)}{mainSymbol}</span>
        </Warning>
      )}
      {activeTab !== "freebet" && result?.hasMultiCurrency && (
        <Warning icon="💱">Multi-devises actif — le profit dépend des taux de change saisis</Warning>
      )}
      {activeTab !== "freebet" && result?.isSuspicious && (
        <Warning icon="⚠️">
          ROI anormalement élevé ({result.roi.toFixed(2)}%) — vérifie tes cotes, erreur probable
        </Warning>
      )}

      <div className="mt-10 overflow-hidden rounded-2xl border border-white/[0.06] shadow-xl"
        style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d1f17 40%, #0a0a0a 100%)" }}>
        <div className="h-0.5" style={{ background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)" }} />
        <div className="px-5 py-4 text-center sm:px-6">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">💎 Le tout-en-un</p>
          <h2 className="mt-1 text-lg font-black text-white sm:text-xl">Ce calculateur remplace 5 autres outils</h2>
          <p className="mt-1 text-xs text-white/40">Clique sur l&apos;onglet qui correspond à ton besoin, les options inutiles sont masquées</p>
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
            {useCases.map((uc) => (
              <div key={uc.title} className="relative overflow-hidden rounded-xl border-2 p-3"
                style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${uc.color}1a 50%, #0a0a0a 100%)`, borderColor: `${uc.color}50` }}>
                <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: uc.color }} />
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-base" style={{ background: `${uc.color}20`, border: `1px solid ${uc.color}40` }}>{uc.icon}</span>
                  <p className="text-[13px] font-extrabold text-white">{uc.title}</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function OptCheckbox({ checked, onChange, label, color }: { checked: boolean; onChange: (v: boolean) => void; label: string; color: "cyan" | "amber" | "rose" }) {
  const colorMap = {
    cyan: { on: "bg-cyan-500/20 text-cyan-300 ring-cyan-400/50", dot: "bg-cyan-400" },
    amber: { on: "bg-amber-500/20 text-amber-300 ring-amber-400/50", dot: "bg-amber-400" },
    rose: { on: "bg-rose-500/20 text-rose-300 ring-rose-400/50", dot: "bg-rose-400" },
  };
  const c = colorMap[color];
  return (
    <button onClick={() => onChange(!checked)}
      className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider transition ${
        checked ? `${c.on} ring-1` : "bg-white/5 text-white/40 hover:text-white/70"
      }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${checked ? c.dot : "bg-white/20"}`} />
      {label}
    </button>
  );
}

function Warning({ children, icon = "⚠️" }: { children: React.ReactNode; icon?: string }) {
  return (
    <div
      className="mt-3 overflow-hidden rounded-lg border border-amber-500/40 shadow-lg"
      style={{ background: "linear-gradient(90deg, rgba(120,53,15,0.35) 0%, rgba(10,10,10,0.92) 55%, rgba(10,10,10,0.92) 100%)" }}
    >
      <div className="flex items-center justify-center gap-2 px-3 py-2">
        <span className="text-sm">{icon}</span>
        <p className="text-[11px] font-semibold text-amber-200">{children}</p>
      </div>
    </div>
  );
}

function VerdictMini({ result, mainSymbol }: { result: CalcResult; mainSymbol: string }) {
  if (result.isSurebet) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 overflow-hidden rounded-xl px-4 py-3 shadow-lg"
        style={{ background: "linear-gradient(90deg, #047857 0%, #10b981 50%, #059669 100%)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <p className="text-sm font-black text-white sm:text-base">SUREBET</p>
          <span className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-xs font-black text-white">+{result.arbPercent.toFixed(2)}%</span>
        </div>
        <p className="text-right text-[11px] font-semibold text-white/90 sm:text-xs">
          Profit garanti <span className="font-mono font-black">+{result.guaranteedProfitRounded.toFixed(2)}{mainSymbol}</span> sur{" "}
          <span className="font-mono font-black">{result.totalStakeRounded.toFixed(2)}{mainSymbol}</span>
        </p>
      </div>
    );
  }
  if (Math.abs(result.arbPercent) < 0.5) {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 overflow-hidden rounded-xl px-4 py-3 shadow-lg"
        style={{ background: "linear-gradient(90deg, #b45309 0%, #d97706 50%, #f59e0b 100%)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚖️</span>
          <p className="text-sm font-black text-white sm:text-base">QUASI BREAK-EVEN</p>
        </div>
        <p className="text-right text-[11px] font-semibold text-white/90 sm:text-xs">
          TRJ <span className="font-mono font-black">{result.trj.toFixed(2)}%</span> — idéal matched betting
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center justify-between gap-3 overflow-hidden rounded-xl px-4 py-3 shadow-lg"
      style={{ background: "linear-gradient(90deg, #991b1b 0%, #dc2626 50%, #ef4444 100%)" }}>
      <div className="flex items-center gap-2">
        <span className="text-xl">❌</span>
        <p className="text-sm font-black text-white sm:text-base">PAS D&apos;ARBITRAGE</p>
      </div>
      <p className="text-right text-[11px] font-semibold text-white/90 sm:text-xs">
        TRJ <span className="font-mono font-black">{result.trj.toFixed(2)}%</span> — perte{" "}
        <span className="font-mono font-black">{Math.abs(result.arbPercent).toFixed(2)}%</span> en moyenne
      </p>
    </div>
  );
}