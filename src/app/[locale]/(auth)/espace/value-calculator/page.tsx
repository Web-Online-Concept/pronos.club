"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES & CONFIG
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

interface CalcResult {
  fairOdd: number; trj: number; ev: number; evPlusTrj: number;
  verdict: "play" | "play_margin" | "no_play";
  trj1?: number; trj2?: number;
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcValue(ps: number[], cb: number, evMin: number, trjMin: number, mode: "simple" | "dc"): CalcResult | null {
  if (ps.some((o) => o <= 1) || cb <= 1) return null;
  const sum = ps.reduce((s, o) => s + 1 / o, 0);
  const trj = (1 / sum) * 100;
  const fairOdd = mode === "dc"
    ? 1 / ((1 / ps[0]) / sum + (1 / ps[1]) / sum)
    : 1 / ((1 / ps[0]) / sum);
  const ev = ((cb / fairOdd) - 1) * 100;
  const evPlusTrj = ev + trj;
  let verdict: CalcResult["verdict"] = "no_play";
  if (ev >= evMin && trj >= trjMin) verdict = "play";
  else if (ev >= evMin && trj < trjMin && evPlusTrj > 100) verdict = "play_margin";
  return { fairOdd, trj, ev, evPlusTrj, verdict };
}

function calcCombi(m1: number[], m2: number[], cb: number, evMin: number, trjMin: number): CalcResult | null {
  if (m1.some((o) => o <= 1) || m2.some((o) => o <= 1) || cb <= 1) return null;
  const s1 = m1.reduce((s, o) => s + 1 / o, 0);
  const s2 = m2.reduce((s, o) => s + 1 / o, 0);
  const t1 = 1 / s1, t2 = 1 / s2;
  const trj = t1 * t2 * 100;
  const fairOdd = 1 / (((1 / m1[0]) / s1) * ((1 / m2[0]) / s2));
  const ev = ((cb / fairOdd) - 1) * 100;
  const evPlusTrj = ev + trj;
  let verdict: CalcResult["verdict"] = "no_play";
  if (ev >= evMin && trj >= trjMin) verdict = "play";
  else if (ev >= evMin && trj < trjMin && evPlusTrj > 100) verdict = "play_margin";
  return { fairOdd, trj, ev, evPlusTrj, verdict, trj1: t1 * 100, trj2: t2 * 100 };
}

// ═══════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════════════

function OddInput({ label, value, onChange, highlight = false }: {
  label: string; value: string; onChange: (v: string) => void; highlight?: boolean;
}) {
  return (
    <div className="flex-1">
      <label className={`mb-1.5 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] ${highlight ? "text-emerald-400" : "text-white/40"}`}>
        {label}
      </label>
      <input
        type="number" step="0.001" min="1.001" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="1.000" inputMode="decimal"
        className={`w-full rounded-xl border-2 px-3 py-3 text-center font-mono text-base font-extrabold outline-none transition-all focus:ring-4 ${
          highlight
            ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 placeholder-emerald-700 focus:border-emerald-400 focus:ring-emerald-500/20"
            : "border-white/10 bg-white/5 text-white placeholder-white/20 focus:border-white/30 focus:ring-white/10"
        }`}
      />
    </div>
  );
}

function ResultCard({ label, value, suffix, color, icon }: {
  label: string; value: number; suffix: string; color: "green" | "red" | "amber" | "neutral"; icon: string;
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
      <p className="mt-1 font-mono text-2xl font-black text-white">{value.toFixed(2)}{suffix}</p>
    </div>
  );
}

function VerdictBanner({ verdict }: { verdict: CalcResult["verdict"] }) {
  const config = {
    play: { bg: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)", text: "✅ JOUER", sub: "EV et TRJ au-dessus des seuils — Value confirmée" },
    play_margin: { bg: "linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fbbf24 100%)", text: "⚠️ JOUER (EV+TRJ > 100%)", sub: "TRJ sous le seuil mais règle de secours validée" },
    no_play: { bg: "linear-gradient(135deg, #991b1b 0%, #ef4444 50%, #f87171 100%)", text: "❌ NE PAS JOUER", sub: "Value insuffisante — passer ce pari" },
  };
  const c = config[verdict];
  return (
    <div className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl" style={{ background: c.bg }}>
      <p className="text-2xl font-black text-white">{c.text}</p>
      <p className="mt-1 text-xs font-semibold text-white/70">{c.sub}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LABELS
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

  const mc = MARKET_TYPES.find((m) => m.id === market)!;
  const isCombi = market === "4combi" || market === "9combi";
  const isDC = market === "6dc";

  function switchMarket(id: MarketId) {
    setMarket(id); setBetOdd(""); setOdds(Array(9).fill("")); setMatch1Odds(Array(3).fill("")); setMatch2Odds(Array(3).fill(""));
  }

  const result = useMemo((): CalcResult | null => {
    const ev = parseFloat(evMin) || 2.5, trj = parseFloat(trjMin) || 99, cb = parseFloat(betOdd);
    if (!cb || cb <= 1) return null;
    if (isCombi) {
      const n = market === "4combi" ? 2 : 3;
      const m1 = match1Odds.slice(0, n).map(Number), m2 = match2Odds.slice(0, n).map(Number);
      if (m1.some((v) => !v || v <= 1) || m2.some((v) => !v || v <= 1)) return null;
      return calcCombi(m1, m2, cb, ev, trj);
    }
    const ps = odds.slice(0, mc.fields).map(Number);
    if (ps.some((v) => !v || v <= 1)) return null;
    return calcValue(ps, cb, ev, trj, isDC ? "dc" : "simple");
  }, [odds, match1Odds, match2Odds, betOdd, evMin, trjMin, market, isCombi, isDC, mc.fields]);

  function trjColor(v: number): "green" | "amber" | "red" { if (v >= (parseFloat(trjMin) || 99)) return "green"; if (v >= 95) return "amber"; return "red"; }
  function evColor(v: number): "green" | "red" { return v >= (parseFloat(evMin) || 2.5) ? "green" : "red"; }

  function renderSimpleForm() {
    const labels = SIMPLE_LABELS[market] ?? [];
    const n = mc.fields;
    return (
      <div>
        {isDC && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-[11px] font-semibold text-emerald-400">
            💡 Les 2 premières cotes = les 2 issues couvertes par la Double Chance
          </div>
        )}
        {market === "9simple" && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-[11px] font-semibold text-amber-400">
            ⚠️ Si PS3838 n&apos;affiche que 8 cotes, mettre 100 pour la 9ème
          </div>
        )}
        <div className={`grid gap-3 ${n <= 2 ? "mx-auto max-w-xs grid-cols-2" : n <= 3 ? "mx-auto max-w-md grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
          {labels.slice(0, n).map((label, i) => (
            <OddInput key={i} label={label} value={odds[i]}
              onChange={(v) => { const next = [...odds]; next[i] = v; setOdds(next); }}
              highlight={isDC ? i < 2 : i === 0}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderCombiForm() {
    const labels = COMBI_LABELS[market] ?? [];
    const n = market === "4combi" ? 2 : 3;
    const matchBlock = (num: number, color: string, oddsArr: string[], setArr: (v: string[]) => void, trjVal?: number) => (
      <div className="rounded-2xl border border-white/10 p-4" style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${color} 100%)` }}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-black text-white">{num}</span>
          <p className="text-xs font-extrabold uppercase tracking-wider text-white/70">Match {num} — PS3838</p>
        </div>
        <div className={`grid gap-3 ${n <= 2 ? "mx-auto max-w-xs grid-cols-2" : "grid-cols-3"}`}>
          {labels.slice(0, n).map((label, i) => (
            <OddInput key={`m${num}-${i}`} label={label} value={oddsArr[i]}
              onChange={(v) => { const next = [...oddsArr]; next[i] = v; setArr(next); }}
              highlight={i === 0}
            />
          ))}
        </div>
        {trjVal !== undefined && (
          <p className="mt-2 text-center text-[11px] font-bold text-white/40">
            TRJ : <span className={trjVal >= 95 ? "text-emerald-400" : "text-red-400"}>{trjVal.toFixed(2)}%</span>
          </p>
        )}
      </div>
    );
    return (
      <div className="space-y-4">
        {matchBlock(1, "#062e1f", match1Odds, setMatch1Odds, result?.trj1)}
        {matchBlock(2, "#0a1e3d", match2Odds, setMatch2Odds, result?.trj2)}
      </div>
    );
  }

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

        {/* ╔══════════════════════════════════════════════════════╗ */}
        {/* ║              CALCULATEUR                            ║ */}
        {/* ╚══════════════════════════════════════════════════════╝ */}

        <div className="overflow-hidden rounded-3xl border border-white/[0.06] shadow-2xl" style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #0d1f17 40%, #0a0a0a 100%)" }}>

          {/* Header accent */}
          <div className="h-1" style={{ background: "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)" }} />

          <div className="px-5 pb-6 pt-5 sm:px-8">

            {/* Market selector */}
            <div className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-2 sm:flex-wrap sm:justify-center">
              {MARKET_TYPES.map((m) => (
                <button key={m.id} onClick={() => switchMarket(m.id)}
                  className={`flex-shrink-0 cursor-pointer rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${
                    market === m.id
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                  }`}
                >{m.label}</button>
              ))}
            </div>

            <p className="mt-3 text-center text-[11px] font-medium text-white/30">{mc.desc}</p>

            {/* Criteria */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-white/5 px-4 py-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30">⚙️ Critères</span>
              {[
                { label: "EV min", val: evMin, set: setEvMin },
                { label: "TRJ min", val: trjMin, set: setTrjMin },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-white/40">{c.label}</label>
                  <input type="number" step="0.1" value={c.val} onChange={(e) => c.set(e.target.value)}
                    className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center font-mono text-xs font-bold text-white outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-white/30">%</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* PS3838 Odds */}
            <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">📊 Cotes PS3838 (Pinnacle)</p>
            {isCombi ? renderCombiForm() : renderSimpleForm()}

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* CB Input */}
            <p className="mb-3 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-amber-400">🎯 Côte du Book (CB)</p>
            <div className="mx-auto max-w-[200px]">
              <input type="number" step="0.01" min="1.01" value={betOdd} onChange={(e) => setBetOdd(e.target.value)}
                placeholder="2.20" inputMode="decimal"
                className="w-full rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 px-4 py-4 text-center font-mono text-xl font-black text-amber-300 placeholder-amber-600/40 shadow-lg shadow-amber-500/10 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20"
              />
            </div>

            {/* Results */}
            {result && (
              <>
                <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">📈 Résultats</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ResultCard label="Fair Odd" value={result.fairOdd} suffix="" color="neutral" icon="⚖️" />
                  <ResultCard label="TRJ" value={result.trj} suffix="%" color={trjColor(result.trj)} icon="📐" />
                  <ResultCard label="EV" value={result.ev} suffix="%" color={evColor(result.ev)} icon="💰" />
                  <ResultCard label="EV + TRJ" value={result.evPlusTrj} suffix="%" color={result.evPlusTrj > 100 ? "green" : "red"} icon="🔥" />
                </div>
                <VerdictBanner verdict={result.verdict} />
              </>
            )}
          </div>
        </div>

        {/* ╔══════════════════════════════════════════════════════╗ */}
        {/* ║              TUTORIEL                               ║ */}
        {/* ╚══════════════════════════════════════════════════════╝ */}

        <div className="mt-12">
          {/* Tutorial header — full width dark banner */}
          <div className="rounded-t-3xl px-6 py-5 text-center" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">📚 Guide complet</p>
            <h2 className="mt-2 text-xl font-black text-white">Comment utiliser le calculateur</h2>
            <p className="mt-1 text-xs text-white/40">Tout ce que tu dois savoir pour détecter les value bets</p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">

            {/* Section 1 — C'est quoi une Value Bet */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">🎯</span>
                <span>C&apos;est quoi une Value Bet ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>Une value bet c&apos;est un pari où la cote proposée par ton bookmaker (Betclic, Unibet, Winamax...) est <strong className="text-neutral-900">supérieure à la cote juste</strong> calculée mathématiquement. Le bookmaker te paie plus que ce que le pari vaut réellement.</p>
                <p className="mt-3">Ce calculateur compare ta cote avec celles de <strong className="text-emerald-600">PS3838 (Pinnacle)</strong>, la référence mondiale. Pinnacle a les marges les plus faibles — ses cotes sont les plus proches de la &quot;vraie&quot; probabilité.</p>
              </div>
            </details>

            {/* Section 2 — Les termes */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">📖</span>
                <span>Les termes à connaître</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  { term: "CB (Côte du Book)", desc: "La cote proposée par ton bookmaker ANJ que tu veux évaluer." },
                  { term: "Fair Odd (Côte Juste)", desc: "La cote théorique sans marge du bookmaker. La \"vraie\" valeur du pari." },
                  { term: "TRJ (Taux de Retour Joueur)", desc: "Le % redistribué par le book. 100% = pas de marge. Minimum recommandé : 99%." },
                  { term: "EV (Expected Value)", desc: "Espérance de gain à long terme en %. EV positive = mathématiquement gagnant. Minimum : 2.5%." },
                  { term: "EV + TRJ", desc: "Règle de secours : si TRJ est sous le seuil mais EV + TRJ > 100%, on peut jouer." },
                ].map((item) => (
                  <div key={item.term} className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-sm font-extrabold text-neutral-900">{item.term}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 3 — Les 3 verdicts */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">🚦</span>
                <span>Les 3 verdicts possibles</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
                  <span className="mt-0.5 text-xl">✅</span>
                  <div><p className="text-sm font-extrabold text-emerald-700">JOUER</p><p className="mt-0.5 text-sm text-emerald-600">EV ≥ seuil ET TRJ ≥ seuil. Value confirmée.</p></div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                  <span className="mt-0.5 text-xl">⚠️</span>
                  <div><p className="text-sm font-extrabold text-amber-700">JOUER (EV+TRJ &gt; 100%)</p><p className="mt-0.5 text-sm text-amber-600">TRJ un peu bas mais règle de secours validée. Jouer avec prudence.</p></div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
                  <span className="mt-0.5 text-xl">❌</span>
                  <div><p className="text-sm font-extrabold text-red-700">NE PAS JOUER</p><p className="mt-0.5 text-sm text-red-600">EV trop faible ou TRJ trop bas. Ce pari n&apos;est pas value.</p></div>
                </div>
              </div>
            </details>

            {/* Section 4 — Les 8 marchés */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">📋</span>
                <span>Les 8 types de marchés</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  { title: "2 Possibilités", desc: "Over/Under, BTTS, Handicap, ML Tennis/Basket. 2 cotes PS3838 + 1 CB.", ex: "Over 3.5 buts → PS3838 : 1.943 / 1.909, CB : 2.20" },
                  { title: "3 Possibilités", desc: "1X2 Football classique. Côte étudiée + Nul + Opposée.", ex: "" },
                  { title: "4 Simple", desc: "Marchés combinés sur 1 match (BTTS + Over). 4 cotes PS3838.", ex: "" },
                  { title: "4 Combiné", desc: "2 matchs en ML ou HP -0.5. Cotes séparées par match. TRJ se dégrade multiplicativement.", ex: "Chelsea + Liverpool Win → TRJ 99%×99% = 98%" },
                  { title: "6 Simple", desc: "1X2 × BTTS (3×2 = 6 issues), Score correct groupé.", ex: "" },
                  { title: "6 Double Chance", desc: "DC + BTTS. Les 2 premières cotes = les 2 issues couvertes par la DC. Fair odd calculée sur la somme des 2 premières probabilités.", ex: "Real ou Nul ET BTTS" },
                  { title: "9 Simple", desc: "HT/FT (Mi-temps/Fin = 3×3 = 9). Si 8 cotes dispo, mettre 100 pour la 9ème.", ex: "" },
                  { title: "9 Combiné", desc: "2 matchs en 1X2 (3×3 = 9 combinaisons). Ex: OM Win + Lille Win.", ex: "" },
                ].map((m) => (
                  <div key={m.title} className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-sm font-extrabold text-neutral-900">{m.title}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{m.desc}</p>
                    {m.ex && <p className="mt-1 text-xs font-semibold text-emerald-600">{m.ex}</p>}
                  </div>
                ))}
              </div>
            </details>

            {/* Section 5 — Mode d'emploi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-cyan-300 open:shadow-lg open:shadow-cyan-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-base">🔢</span>
                <span>Mode d&apos;emploi pas à pas</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  "Choisis le type de marché en cliquant sur l'onglet correspondant",
                  "Entre les cotes PS3838 pour toutes les issues. La \"côte étudiée\" (en vert) = celle sur laquelle tu veux parier",
                  "Entre la Côte du Book (CB) — la cote que ton bookmaker te propose",
                  "Le résultat s'affiche automatiquement : Fair Odd, TRJ, EV et le verdict",
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500 text-xs font-black text-white">{i + 1}</span>
                    <p className="text-sm text-neutral-600">{step}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 6 — C'est quoi la côte opposée */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-rose-300 open:shadow-lg open:shadow-rose-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-base">🤔</span>
                <span>C&apos;est quoi la &quot;Côte opposée&quot; ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>Dans un marché à 2 possibilités (ex: Over/Under), PS3838 affiche toujours 2 cotes. La <strong className="text-emerald-600">&quot;côte étudiée&quot;</strong> = celle que tu veux parier (ex: Over 3.5 à 1.943). La <strong className="text-neutral-900">&quot;côte opposée&quot;</strong> = l&apos;autre issue (ex: Under 3.5 à 1.909).</p>
                <p className="mt-2">On a besoin des deux pour calculer la marge du book (TRJ) et la fair odd. Sans la côte opposée, impossible de savoir si ta cote est value.</p>
              </div>
            </details>

            {/* Section 7 — Conseils pro */}
            <div className="overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
              <div className="px-5 py-5 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-base">💎</span>
                  <h3 className="text-sm font-extrabold text-white">Conseils de pro</h3>
                </div>
                <div className="mt-4 space-y-2.5 text-[13px] text-white/60">
                  <p>📌 Ne jouer en value que sur des cotes <span className="font-bold text-emerald-400">≤ 2.50</span></p>
                  <p>📌 Mise très faible : <span className="font-bold text-emerald-400">~0.25% de la bankroll</span></p>
                  <p>📌 TRJ bien meilleur sur <span className="font-bold text-white">ML/1X2</span> que sur Over, BTTS, buteurs</p>
                  <p>📌 Combiné de <span className="font-bold text-red-400">2 matchs max</span> — jamais 3+ (99%×99%×99% = 97%)</p>
                  <p>📌 Une value est value <span className="font-bold text-white">à l&apos;instant T</span>, elle peut changer</p>
                  <p>📌 Value <span className="font-bold text-emerald-400">MATHÉMATIQUE</span> (PS3838), pas subjective</p>
                  <p>📌 Marchés buteurs <span className="font-bold text-red-400">NON inclus</span> — se comparent avec OrbitX</p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </main>
    </>
  );
}