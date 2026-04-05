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
  { id: "6dc", label: "DC 6 Poss.", desc: "Double Chance + BTTS (ex: Real ou Nul ET BTTS)", fields: 6 },
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
    // Double Chance: combine probabilities of first 2 outcomes
    const prob1 = (1 / ps3838Odds[0]) / sumProb;
    const prob2 = (1 / ps3838Odds[1]) / sumProb;
    fairOdd = 1 / (prob1 + prob2);
  } else {
    // Simple: first odd is the studied outcome
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
      <label className={`mb-1 block text-[10px] font-bold uppercase tracking-[0.15em] ${highlight ? "text-blue-400" : "text-white/30"}`}>
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
        className={`w-full rounded-lg border px-3 py-2.5 text-center font-mono text-sm font-bold text-white placeholder-white/20 outline-none transition focus:ring-2 ${
          highlight
            ? "border-blue-500/50 bg-blue-500/10 focus:border-blue-500 focus:ring-blue-500/20"
            : "border-white/10 bg-white/[0.05] focus:border-white/30 focus:ring-white/10"
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
}: {
  label: string;
  value: number;
  suffix: string;
  color: "green" | "red" | "amber" | "neutral";
}) {
  const colorMap = {
    green: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400",
    red: "border-red-500/30 bg-red-500/[0.06] text-red-400",
    amber: "border-amber-500/30 bg-amber-500/[0.06] text-amber-400",
    neutral: "border-white/10 bg-white/[0.04] text-white/70",
  };

  return (
    <div className={`rounded-xl border p-4 text-center transition-all ${colorMap[color]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">{label}</p>
      <p className="mt-1 font-mono text-xl font-extrabold">
        {value.toFixed(2)}{suffix}
      </p>
    </div>
  );
}

function VerdictBanner({ verdict }: { verdict: CalcResult["verdict"] }) {
  if (verdict === "play") {
    return (
      <div className="mt-4 rounded-xl px-6 py-4 text-center" style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)" }}>
        <p className="text-lg font-extrabold text-white">✅ JOUER</p>
        <p className="mt-0.5 text-xs text-white/60">EV et TRJ au-dessus des seuils — Value confirmée</p>
      </div>
    );
  }
  if (verdict === "play_margin") {
    return (
      <div className="mt-4 rounded-xl px-6 py-4 text-center" style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)" }}>
        <p className="text-lg font-extrabold text-white">⚠️ JOUER (EV+TRJ &gt; 100%)</p>
        <p className="mt-0.5 text-xs text-white/60">TRJ sous le seuil mais règle de secours validée</p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl px-6 py-4 text-center" style={{ background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)" }}>
      <p className="text-lg font-extrabold text-white">❌ NE PAS JOUER</p>
      <p className="mt-0.5 text-xs text-white/60">Value insuffisante — passer ce pari</p>
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

  // Simple markets: array of odds strings
  const [odds, setOdds] = useState<string[]>(Array(9).fill(""));

  // Combi markets: 2 arrays
  const [match1Odds, setMatch1Odds] = useState<string[]>(Array(3).fill(""));
  const [match2Odds, setMatch2Odds] = useState<string[]>(Array(3).fill(""));

  const marketConfig = MARKET_TYPES.find((m) => m.id === market)!;
  const isCombi = market === "4combi" || market === "9combi";
  const isDC = market === "6dc";

  // Reset odds when market changes
  function switchMarket(id: MarketId) {
    setMarket(id);
    setBetOdd("");
    setOdds(Array(9).fill(""));
    setMatch1Odds(Array(3).fill(""));
    setMatch2Odds(Array(3).fill(""));
  }

  // Calculation
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

  // Color helpers
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

  // Render simple form
  function renderSimpleForm() {
    const labels = SIMPLE_LABELS[market] ?? [];
    const fieldCount = marketConfig.fields;
    return (
      <div>
        {isDC && (
          <p className="mb-3 rounded-lg bg-blue-500/10 px-3 py-2 text-center text-[11px] text-blue-400">
            Les 2 premières cotes correspondent aux issues couvertes par la Double Chance
          </p>
        )}
        {market === "9simple" && (
          <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-[11px] text-amber-400">
            Si PS3838 n&apos;affiche que 8 cotes, mettre 100 pour la 9ème
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

  // Render combi form
  function renderCombiForm() {
    const labels = COMBI_LABELS[market] ?? [];
    const fieldsPerMatch = market === "4combi" ? 2 : 3;
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">Match 1 — Cotes PS3838</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            <p className="mt-1 text-center text-[10px] text-white/30">
              TRJ Match 1 : <span className={result.trj1 >= 95 ? "text-emerald-400" : "text-red-400"}>{result.trj1.toFixed(2)}%</span>
            </p>
          )}
        </div>
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">Match 2 — Cotes PS3838</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            <p className="mt-1 text-center text-[10px] text-white/30">
              TRJ Match 2 : <span className={result.trj2 >= 95 ? "text-emerald-400" : "text-red-400"}>{result.trj2.toFixed(2)}%</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Admin guard — block access for non-admins
  if (!isAdmin) {
    return (
      <>
        <EspaceHero title="Accès refusé" />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-4 text-sm font-bold text-white/50">Cette page est réservée aux administrateurs.</p>
        </main>
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#0a0e17" }}>
      <EspaceHero title="Value Bet Calculator" />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">

        {/* Market selector */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {MARKET_TYPES.map((m) => (
            <button
              key={m.id}
              onClick={() => switchMarket(m.id)}
              className={`cursor-pointer rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                market === m.id
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Market description */}
        <div className="mt-3 rounded-lg bg-white/[0.03] px-4 py-2.5 text-center">
          <p className="text-xs text-white/50">{marketConfig.desc}</p>
        </div>

        {/* Criteria */}
        <div className="mt-4 flex items-center justify-center gap-4 rounded-xl border border-white/[0.06] px-4 py-3" style={{ background: "linear-gradient(135deg, #111 0%, #0a2a1f 100%)" }}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">⚙️ Critères</span>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-white/40">EV min</label>
            <input
              type="number"
              step="0.1"
              value={evMin}
              onChange={(e) => setEvMin(e.target.value)}
              className="w-16 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1.5 text-center font-mono text-xs font-bold text-white placeholder-white/20 outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-white/30">%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-white/40">TRJ min</label>
            <input
              type="number"
              step="0.5"
              value={trjMin}
              onChange={(e) => setTrjMin(e.target.value)}
              className="w-16 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1.5 text-center font-mono text-xs font-bold text-white placeholder-white/20 outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-white/30">%</span>
          </div>
        </div>

        {/* PS3838 Odds inputs */}
        <div className="mt-6">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">📊 Cotes PS3838</p>
          {isCombi ? renderCombiForm() : renderSimpleForm()}
        </div>

        {/* CB input */}
        <div className="mt-6">
          <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">🎯 Côte du Book (CB)</p>
          <div className="mx-auto max-w-[200px]">
            <input
              type="number"
              step="0.01"
              min="1.01"
              value={betOdd}
              onChange={(e) => setBetOdd(e.target.value)}
              placeholder="Ex: 2.20"
              inputMode="decimal"
              className="w-full rounded-xl border-2 border-blue-500/50 bg-blue-500/10 px-4 py-3 text-center font-mono text-lg font-extrabold text-white placeholder-white/20 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-8 animate-[fadeIn_0.3s_ease-out]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultCard label="Fair Odd" value={result.fairOdd} suffix="" color="neutral" />
              <ResultCard label="TRJ" value={result.trj} suffix="%" color={trjColor(result.trj)} />
              <ResultCard label="EV" value={result.ev} suffix="%" color={evColor(result.ev)} />
              <ResultCard label="EV + TRJ" value={result.evPlusTrj} suffix="%" color={evTrjColor(result.evPlusTrj)} />
            </div>
            <VerdictBanner verdict={result.verdict} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-10 space-y-2 rounded-xl border border-white/[0.06] px-5 py-4" style={{ background: "linear-gradient(135deg, #111 0%, #0a1a14 100%)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Méthode & Conseils</p>
          <div className="space-y-1 text-[11px] leading-relaxed text-white/30">
            <p>• Comparaison mathématique avec PS3838 (Pinnacle), référence mondiale</p>
            <p>• Ne jouer en value que sur des cotes ≤ 2.50</p>
            <p>• Mise très faible : ~0.25% de la bankroll</p>
            <p>• TRJ bien meilleur sur ML/1X2 que sur marchés annexes (Over, BTTS, buteurs)</p>
            <p>• Combiné de 2 matchs maximum, jamais 3+ (TRJ se dégrade : 99%×99% = 98%)</p>
            <p>• Une value est value à l&apos;instant T, elle peut changer</p>
            <p>• Value MATHÉMATIQUE (basée sur PS3838), pas subjective</p>
          </div>
        </div>

      </main>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}