"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// MARKET TYPES
// ═══════════════════════════════════════════════════════════════

const MARKET_TYPES = [
  { id: "2way", label: "2 Poss.", desc: "Over/Under, BTTS, Handicap, ML Tennis/Basket", fields: 2 },
  { id: "3way", label: "3 Poss.", desc: "1X2 Football", fields: 3 },
  { id: "4simple", label: "4 Simple", desc: "BTTS + Over, combinaisons sur 1 match", fields: 4 },
  { id: "4combi", label: "4 Combiné", desc: "2 matchs ML×ML (Basket, Tennis, HP -0.5)", fields: 0 },
  { id: "6simple", label: "6 Poss.", desc: "1X2 × BTTS, Score correct groupé", fields: 6 },
  { id: "6dc", label: "DC 6P.", desc: "Double Chance + BTTS (ex: Real ou Nul ET BTTS)", fields: 6 },
  { id: "9simple", label: "9 Poss.", desc: "HT/FT (Mi-temps/Fin de match = 3×3)", fields: 9 },
  { id: "9combi", label: "9 Combiné", desc: "2 matchs 1X2×1X2 (2 équipes Win)", fields: 0 },
] as const;

type MarketId = (typeof MARKET_TYPES)[number]["id"];

// ═══════════════════════════════════════════════════════════════
// CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

interface CalcResult {
  fairOdd: number;
  trj: number;
  ev: number;
  evPlusTrj: number;
  verdict: "play" | "play_margin" | "no_play";
  trj1?: number;
  trj2?: number;
}

function calcValue(
  ps3838Odds: number[],
  betOdd: number,
  evMin: number,
  trjMin: number,
  marketType: "simple" | "dc"
): CalcResult | null {
  if (ps3838Odds.some((o) => o <= 1) || betOdd <= 1) return null;

  const sumProb = ps3838Odds.reduce((s, o) => s + 1 / o, 0);
  const trj = (1 / sumProb) * 100;

  let fairOdd: number;
  if (marketType === "dc") {
    const prob1 = (1 / ps3838Odds[0]) / sumProb;
    const prob2 = (1 / ps3838Odds[1]) / sumProb;
    fairOdd = 1 / (prob1 + prob2);
  } else {
    const probFair = (1 / ps3838Odds[0]) / sumProb;
    fairOdd = 1 / probFair;
  }

  const ev = ((betOdd / fairOdd) - 1) * 100;
  const evPlusTrj = ev + trj;

  let verdict: CalcResult["verdict"] = "no_play";
  if (ev >= evMin && trj >= trjMin) verdict = "play";
  else if (ev >= evMin && trj < trjMin && evPlusTrj > 100) verdict = "play_margin";

  return { fairOdd, trj, ev, evPlusTrj, verdict };
}

function calcCombi(
  match1Odds: number[],
  match2Odds: number[],
  betOdd: number,
  evMin: number,
  trjMin: number
): CalcResult | null {
  if (match1Odds.some((o) => o <= 1) || match2Odds.some((o) => o <= 1) || betOdd <= 1) return null;

  const sum1 = match1Odds.reduce((s, o) => s + 1 / o, 0);
  const sum2 = match2Odds.reduce((s, o) => s + 1 / o, 0);

  const trj1Raw = 1 / sum1;
  const trj2Raw = 1 / sum2;
  const trj = trj1Raw * trj2Raw * 100;

  const fairProb1 = (1 / match1Odds[0]) / sum1;
  const fairProb2 = (1 / match2Odds[0]) / sum2;
  const fairOdd = 1 / (fairProb1 * fairProb2);

  const ev = ((betOdd / fairOdd) - 1) * 100;
  const evPlusTrj = ev + trj;

  let verdict: CalcResult["verdict"] = "no_play";
  if (ev >= evMin && trj >= trjMin) verdict = "play";
  else if (ev >= evMin && trj < trjMin && evPlusTrj > 100) verdict = "play_margin";

  return { fairOdd, trj, ev, evPlusTrj, verdict, trj1: trj1Raw * 100, trj2: trj2Raw * 100 };
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function OddInput({
  label,
  value,
  onChange,
  highlight = false,
  placeholder = "1.000",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  highlight?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex-1">
      <label className={`mb-1.5 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] ${highlight ? "text-indigo-600" : "text-slate-400"}`}>
        {label}
      </label>
      <input
        type="number"
        step="0.001"
        min="1.001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className={`w-full rounded-xl border-2 px-3 py-3 text-center font-mono text-base font-extrabold outline-none transition-all focus:ring-4 ${
          highlight
            ? "border-indigo-400 bg-indigo-50 text-indigo-700 placeholder-indigo-300 shadow-sm shadow-indigo-100 focus:border-indigo-500 focus:ring-indigo-100"
            : "border-slate-200 bg-white text-slate-800 placeholder-slate-300 focus:border-slate-400 focus:ring-slate-100"
        }`}
      />
    </div>
  );
}

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
  const styles = {
    green: { bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", border: "#6ee7b7", text: "#059669", iconBg: "#d1fae5" },
    red: { bg: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", border: "#fca5a5", text: "#dc2626", iconBg: "#fee2e2" },
    amber: { bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", border: "#fcd34d", text: "#d97706", iconBg: "#fef3c7" },
    neutral: { bg: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", border: "#cbd5e1", text: "#475569", iconBg: "#f1f5f9" },
  };
  const s = styles[color];

  return (
    <div className="overflow-hidden rounded-2xl border-2 p-4 text-center shadow-sm" style={{ background: s.bg, borderColor: s.border }}>
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-base" style={{ background: s.iconBg }}>
        {icon}
      </div>
      <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: s.text }}>{label}</p>
      <p className="mt-1 font-mono text-2xl font-black" style={{ color: s.text }}>
        {value.toFixed(2)}{suffix}
      </p>
    </div>
  );
}

function VerdictBanner({ verdict }: { verdict: CalcResult["verdict"] }) {
  if (verdict === "play") {
    return (
      <div className="mt-5 overflow-hidden rounded-2xl px-6 py-5 text-center shadow-lg shadow-emerald-200" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)" }}>
        <p className="text-2xl font-black text-white">✅ JOUER</p>
        <p className="mt-1 text-xs font-semibold text-white/70">EV et TRJ au-dessus des seuils — Value confirmée</p>
      </div>
    );
  }
  if (verdict === "play_margin") {
    return (
      <div className="mt-5 overflow-hidden rounded-2xl px-6 py-5 text-center shadow-lg shadow-amber-200" style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)" }}>
        <p className="text-2xl font-black text-white">⚠️ JOUER (EV+TRJ &gt; 100%)</p>
        <p className="mt-1 text-xs font-semibold text-white/70">TRJ sous le seuil mais règle de secours validée</p>
      </div>
    );
  }
  return (
    <div className="mt-5 overflow-hidden rounded-2xl px-6 py-5 text-center shadow-lg shadow-red-200" style={{ background: "linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)" }}>
      <p className="text-2xl font-black text-white">❌ NE PAS JOUER</p>
      <p className="mt-1 text-xs font-semibold text-white/70">Value insuffisante — passer ce pari</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FORM CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

const SIMPLE_LABELS: Record<string, string[]> = {
  "2way": ["Côte étudiée", "Côte opposée"],
  "3way": ["Côte étudiée", "Nul", "Opposée"],
  "4simple": ["Côte étudiée", "Issue 2", "Issue 3", "Issue 4"],
  "6simple": ["Côte étudiée", "Issue 2", "Issue 3", "Issue 4", "Issue 5", "Issue 6"],
  "6dc": ["DC Issue 1", "DC Issue 2", "Issue 3", "Issue 4", "Issue 5", "Issue 6"],
  "9simple": ["Côte étudiée", "Issue 2", "Issue 3", "Issue 4", "Issue 5", "Issue 6", "Issue 7", "Issue 8", "Issue 9"],
};

const COMBI_LABELS: Record<string, string[]> = {
  "4combi": ["Côte étudiée", "Côte opposée"],
  "9combi": ["Côte étudiée", "Nul", "Opposée"],
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function ValueCalculatorPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;

  const [market, setMarket] = useState<MarketId>("2way");
  const [evMin, setEvMin] = useState("2.5");
  const [trjMin, setTrjMin] = useState("99");
  const [betOdd, setBetOdd] = useState("");
  const [odds, setOdds] = useState<string[]>(Array(9).fill(""));
  const [match1Odds, setMatch1Odds] = useState<string[]>(Array(3).fill(""));
  const [match2Odds, setMatch2Odds] = useState<string[]>(Array(3).fill(""));

  const marketConfig = MARKET_TYPES.find((m) => m.id === market)!;
  const isCombi = market === "4combi" || market === "9combi";
  const isDC = market === "6dc";

  function switchMarket(id: MarketId) {
    setMarket(id);
    setBetOdd("");
    setOdds(Array(9).fill(""));
    setMatch1Odds(Array(3).fill(""));
    setMatch2Odds(Array(3).fill(""));
  }

  const result = useMemo((): CalcResult | null => {
    const ev = parseFloat(evMin) || 2.5;
    const trj = parseFloat(trjMin) || 99;
    const cb = parseFloat(betOdd);
    if (!cb || cb <= 1) return null;

    if (isCombi) {
      const fieldsPerMatch = market === "4combi" ? 2 : 3;
      const m1 = match1Odds.slice(0, fieldsPerMatch).map((v) => parseFloat(v));
      const m2 = match2Odds.slice(0, fieldsPerMatch).map((v) => parseFloat(v));
      if (m1.some((v) => !v || v <= 1) || m2.some((v) => !v || v <= 1)) return null;
      return calcCombi(m1, m2, cb, ev, trj);
    }

    const fieldCount = marketConfig.fields;
    const ps = odds.slice(0, fieldCount).map((v) => parseFloat(v));
    if (ps.some((v) => !v || v <= 1)) return null;
    return calcValue(ps, cb, ev, trj, isDC ? "dc" : "simple");
  }, [odds, match1Odds, match2Odds, betOdd, evMin, trjMin, market, isCombi, isDC, marketConfig.fields]);

  function trjColor(trj: number): "green" | "amber" | "red" {
    const threshold = parseFloat(trjMin) || 99;
    if (trj >= threshold) return "green";
    if (trj >= 95) return "amber";
    return "red";
  }
  function evColor(ev: number): "green" | "red" {
    return ev >= (parseFloat(evMin) || 2.5) ? "green" : "red";
  }
  function evTrjColor(evTrj: number): "green" | "red" {
    return evTrj > 100 ? "green" : "red";
  }

  function renderSimpleForm() {
    const labels = SIMPLE_LABELS[market] ?? [];
    const fieldCount = marketConfig.fields;
    return (
      <div>
        {isDC && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3">
            <span className="text-lg">💡</span>
            <p className="text-[11px] font-semibold text-indigo-600">Les 2 premières cotes correspondent aux issues couvertes par la Double Chance</p>
          </div>
        )}
        {market === "9simple" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-lg">⚠️</span>
            <p className="text-[11px] font-semibold text-amber-600">Si PS3838 n&apos;affiche que 8 cotes, mettre 100 pour la 9ème</p>
          </div>
        )}
        <div className={`grid gap-3 ${fieldCount <= 2 ? "mx-auto max-w-xs grid-cols-2" : fieldCount <= 3 ? "mx-auto max-w-md grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
          {labels.slice(0, fieldCount).map((label, i) => (
            <OddInput
              key={i}
              label={label}
              value={odds[i]}
              onChange={(v) => {
                const next = [...odds];
                next[i] = v;
                setOdds(next);
              }}
              highlight={isDC ? i < 2 : i === 0}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderCombiForm() {
    const labels = COMBI_LABELS[market] ?? [];
    const fieldsPerMatch = market === "4combi" ? 2 : 3;
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">1</span>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">Match 1 — Cotes PS3838</p>
          </div>
          <div className={`grid gap-3 ${fieldsPerMatch <= 2 ? "mx-auto max-w-xs grid-cols-2" : "grid-cols-3"}`}>
            {labels.slice(0, fieldsPerMatch).map((label, i) => (
              <OddInput
                key={`m1-${i}`}
                label={label}
                value={match1Odds[i]}
                onChange={(v) => {
                  const next = [...match1Odds];
                  next[i] = v;
                  setMatch1Odds(next);
                }}
                highlight={i === 0}
              />
            ))}
          </div>
          {result?.trj1 !== undefined && (
            <p className="mt-2 text-center text-[11px] font-bold text-slate-400">
              TRJ : <span className={`font-extrabold ${result.trj1 >= 95 ? "text-emerald-600" : "text-red-500"}`}>{result.trj1.toFixed(2)}%</span>
            </p>
          )}
        </div>

        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">2</span>
            <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Match 2 — Cotes PS3838</p>
          </div>
          <div className={`grid gap-3 ${fieldsPerMatch <= 2 ? "mx-auto max-w-xs grid-cols-2" : "grid-cols-3"}`}>
            {labels.slice(0, fieldsPerMatch).map((label, i) => (
              <OddInput
                key={`m2-${i}`}
                label={label}
                value={match2Odds[i]}
                onChange={(v) => {
                  const next = [...match2Odds];
                  next[i] = v;
                  setMatch2Odds(next);
                }}
                highlight={i === 0}
              />
            ))}
          </div>
          {result?.trj2 !== undefined && (
            <p className="mt-2 text-center text-[11px] font-bold text-slate-400">
              TRJ : <span className={`font-extrabold ${result.trj2 >= 95 ? "text-emerald-600" : "text-red-500"}`}>{result.trj2.toFixed(2)}%</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Admin guard
  if (!isAdmin) {
    return (
      <>
        <EspaceHero title="Accès refusé" />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-4 text-sm font-bold text-neutral-500">Cette page est réservée aux administrateurs.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <EspaceHero title="Value Bet Calculator" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">

        {/* Market selector — scrollable on mobile */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
          {MARKET_TYPES.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMarket(m.id)}
              className={`flex-shrink-0 cursor-pointer rounded-xl px-3.5 py-2.5 text-[11px] font-bold transition-all ${
                market === m.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Market description */}
        <div className="mt-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-3 text-center">
          <p className="text-xs font-semibold text-slate-500">{marketConfig.desc}</p>
        </div>

        {/* Criteria */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/50 px-5 py-3.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">⚙️ Critères</span>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">EV min</label>
            <input
              type="number"
              step="0.1"
              value={evMin}
              onChange={(e) => setEvMin(e.target.value)}
              className="w-16 rounded-lg border-2 border-slate-200 bg-white px-2 py-1.5 text-center font-mono text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <span className="text-[11px] font-bold text-slate-400">%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-slate-500">TRJ min</label>
            <input
              type="number"
              step="0.5"
              value={trjMin}
              onChange={(e) => setTrjMin(e.target.value)}
              className="w-16 rounded-lg border-2 border-slate-200 bg-white px-2 py-1.5 text-center font-mono text-xs font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <span className="text-[11px] font-bold text-slate-400">%</span>
          </div>
        </div>

        {/* PS3838 Odds */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-sm">📊</span>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-600">Cotes PS3838 (Pinnacle)</p>
          </div>
          {isCombi ? renderCombiForm() : renderSimpleForm()}
        </div>

        {/* CB input */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-sm">🎯</span>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-orange-600">Côte du Book (CB)</p>
          </div>
          <div className="mx-auto max-w-[220px]">
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={betOdd}
              onChange={(e) => setBetOdd(e.target.value)}
              placeholder="Ex: 2.20"
              inputMode="decimal"
              className="w-full rounded-2xl border-3 border-orange-400 bg-orange-50 px-4 py-4 text-center font-mono text-xl font-black text-orange-700 placeholder-orange-300 shadow-lg shadow-orange-100 outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-sm">📈</span>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-600">Résultats</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultCard label="Fair Odd" value={result.fairOdd} suffix="" color="neutral" icon="⚖️" />
              <ResultCard label="TRJ" value={result.trj} suffix="%" color={trjColor(result.trj)} icon="📐" />
              <ResultCard label="EV" value={result.ev} suffix="%" color={evColor(result.ev)} icon="💰" />
              <ResultCard label="EV + TRJ" value={result.evPlusTrj} suffix="%" color={evTrjColor(result.evPlusTrj)} icon="🔥" />
            </div>
            <VerdictBanner verdict={result.verdict} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 overflow-hidden rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50">
          <div className="border-b border-slate-200 px-5 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-slate-400">📚 Méthode & Conseils</p>
          </div>
          <div className="space-y-2 px-5 py-4 text-[12px] leading-relaxed text-slate-500">
            <p>📌 Comparaison mathématique avec <span className="font-bold text-indigo-600">PS3838 (Pinnacle)</span>, référence mondiale</p>
            <p>📌 Ne jouer en value que sur des cotes <span className="font-bold text-slate-700">≤ 2.50</span></p>
            <p>📌 Mise très faible : <span className="font-bold text-slate-700">~0.25%</span> de la bankroll</p>
            <p>📌 TRJ bien meilleur sur <span className="font-bold text-slate-700">ML/1X2</span> que sur marchés annexes</p>
            <p>📌 Combiné de <span className="font-bold text-red-500">2 matchs maximum</span>, jamais 3+ (TRJ 99%×99% = 98%)</p>
            <p>📌 Une value est value à l&apos;instant T, elle peut changer</p>
            <p>📌 Value <span className="font-bold text-slate-700">MATHÉMATIQUE</span> (PS3838), pas subjective</p>
          </div>
        </div>

      </main>
    </>
  );
}