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

function OddInput({ label, value, onChange, highlight = false, placeholder = "1.000" }: {
  label: string; value: string; onChange: (v: string) => void; highlight?: boolean; placeholder?: string;
}) {
  return (
    <div className="flex-1">
      <label className={`mb-1.5 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] ${highlight ? "text-emerald-600" : "text-neutral-500"}`}>
        {label}
      </label>
      <input
        type="number" step="0.001" min="1.001" value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} inputMode="decimal"
        className={`w-full rounded-xl border-2 px-3 py-3 text-center font-mono text-base font-extrabold outline-none transition-all focus:ring-4 ${
          highlight
            ? "border-emerald-500 bg-emerald-50 text-emerald-800 placeholder-emerald-300 focus:border-emerald-600 focus:ring-emerald-100"
            : "border-neutral-800 bg-neutral-900 text-white placeholder-neutral-500 focus:border-neutral-600 focus:ring-neutral-200"
        }`}
      />
    </div>
  );
}

function ResultCard({ label, value, suffix, color, icon }: {
  label: string; value: number; suffix: string; color: "green" | "red" | "amber" | "neutral"; icon: string;
}) {
  const styles = {
    green: { bg: "#059669", text: "text-white" },
    red: { bg: "#dc2626", text: "text-white" },
    amber: { bg: "#d97706", text: "text-white" },
    neutral: { bg: "#1e293b", text: "text-white" },
  };
  const s = styles[color];
  return (
    <div className="overflow-hidden rounded-2xl p-4 text-center shadow-md" style={{ background: s.bg }}>
      <span className="text-lg">{icon}</span>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-black ${s.text}`}>
        {value.toFixed(2)}{suffix}
      </p>
    </div>
  );
}

function VerdictBanner({ verdict }: { verdict: CalcResult["verdict"] }) {
  if (verdict === "play") {
    return (
      <div className="mt-5 rounded-2xl bg-emerald-600 px-6 py-5 text-center shadow-xl">
        <p className="text-2xl font-black text-white">✅ JOUER</p>
        <p className="mt-1 text-xs font-semibold text-white/70">EV et TRJ au-dessus des seuils — Value confirmée</p>
      </div>
    );
  }
  if (verdict === "play_margin") {
    return (
      <div className="mt-5 rounded-2xl bg-amber-500 px-6 py-5 text-center shadow-xl">
        <p className="text-2xl font-black text-white">⚠️ JOUER (EV+TRJ &gt; 100%)</p>
        <p className="mt-1 text-xs font-semibold text-white/70">TRJ sous le seuil mais règle de secours validée</p>
      </div>
    );
  }
  return (
    <div className="mt-5 rounded-2xl bg-red-600 px-6 py-5 text-center shadow-xl">
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
      const n = market === "4combi" ? 2 : 3;
      const m1 = match1Odds.slice(0, n).map((v) => parseFloat(v));
      const m2 = match2Odds.slice(0, n).map((v) => parseFloat(v));
      if (m1.some((v) => !v || v <= 1) || m2.some((v) => !v || v <= 1)) return null;
      return calcCombi(m1, m2, cb, ev, trj);
    }
    const ps = odds.slice(0, marketConfig.fields).map((v) => parseFloat(v));
    if (ps.some((v) => !v || v <= 1)) return null;
    return calcValue(ps, cb, ev, trj, isDC ? "dc" : "simple");
  }, [odds, match1Odds, match2Odds, betOdd, evMin, trjMin, market, isCombi, isDC, marketConfig.fields]);

  function trjColor(trj: number): "green" | "amber" | "red" {
    if (trj >= (parseFloat(trjMin) || 99)) return "green";
    if (trj >= 95) return "amber";
    return "red";
  }
  function evColor(ev: number): "green" | "red" { return ev >= (parseFloat(evMin) || 2.5) ? "green" : "red"; }
  function evTrjColor(v: number): "green" | "red" { return v > 100 ? "green" : "red"; }

  function renderSimpleForm() {
    const labels = SIMPLE_LABELS[market] ?? [];
    const fieldCount = marketConfig.fields;
    return (
      <div>
        {isDC && (
          <div className="mb-4 rounded-xl bg-neutral-900 px-4 py-3 text-center text-[11px] font-semibold text-emerald-400">
            💡 Les 2 premières cotes = les 2 issues couvertes par la Double Chance
          </div>
        )}
        {market === "9simple" && (
          <div className="mb-4 rounded-xl bg-neutral-900 px-4 py-3 text-center text-[11px] font-semibold text-amber-400">
            ⚠️ Si PS3838 n&apos;affiche que 8 cotes, mettre 100 pour la 9ème
          </div>
        )}
        <div className={`grid gap-3 ${fieldCount <= 2 ? "mx-auto max-w-xs grid-cols-2" : fieldCount <= 3 ? "mx-auto max-w-md grid-cols-3" : "grid-cols-2 sm:grid-cols-3"}`}>
          {labels.slice(0, fieldCount).map((label, i) => (
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
    return (
      <div className="space-y-5">
        {/* Match 1 */}
        <div className="rounded-2xl border-2 border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">1</span>
            <p className="text-xs font-extrabold uppercase tracking-wider text-white">Match 1 — PS3838</p>
          </div>
          <div className={`grid gap-3 ${n <= 2 ? "mx-auto max-w-xs grid-cols-2" : "grid-cols-3"}`}>
            {labels.slice(0, n).map((label, i) => (
              <OddInput key={`m1-${i}`} label={label} value={match1Odds[i]}
                onChange={(v) => { const next = [...match1Odds]; next[i] = v; setMatch1Odds(next); }}
                highlight={i === 0}
              />
            ))}
          </div>
          {result?.trj1 !== undefined && (
            <p className="mt-2 text-center text-[11px] font-bold text-neutral-400">
              TRJ : <span className={`font-extrabold ${result.trj1 >= 95 ? "text-emerald-400" : "text-red-400"}`}>{result.trj1.toFixed(2)}%</span>
            </p>
          )}
        </div>
        {/* Match 2 */}
        <div className="rounded-2xl border-2 border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">2</span>
            <p className="text-xs font-extrabold uppercase tracking-wider text-white">Match 2 — PS3838</p>
          </div>
          <div className={`grid gap-3 ${n <= 2 ? "mx-auto max-w-xs grid-cols-2" : "grid-cols-3"}`}>
            {labels.slice(0, n).map((label, i) => (
              <OddInput key={`m2-${i}`} label={label} value={match2Odds[i]}
                onChange={(v) => { const next = [...match2Odds]; next[i] = v; setMatch2Odds(next); }}
                highlight={i === 0}
              />
            ))}
          </div>
          {result?.trj2 !== undefined && (
            <p className="mt-2 text-center text-[11px] font-bold text-neutral-400">
              TRJ : <span className={`font-extrabold ${result.trj2 >= 95 ? "text-emerald-400" : "text-red-400"}`}>{result.trj2.toFixed(2)}%</span>
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

        {/* Market selector — dark buttons, scrollable mobile */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
          {MARKET_TYPES.map((m) => (
            <button key={m.id} onClick={() => switchMarket(m.id)}
              className={`flex-shrink-0 cursor-pointer rounded-xl px-3.5 py-2.5 text-[11px] font-bold transition-all ${
                market === m.id
                  ? "bg-neutral-900 text-white shadow-lg"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              }`}
            >{m.label}</button>
          ))}
        </div>

        {/* Market description */}
        <p className="mt-3 text-center text-xs font-medium text-neutral-500">{marketConfig.desc}</p>

        {/* Criteria — dark bar */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 rounded-2xl bg-neutral-900 px-5 py-3.5">
          <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400">⚙️ Critères</span>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-neutral-400">EV min</label>
            <input type="number" step="0.1" value={evMin} onChange={(e) => setEvMin(e.target.value)}
              className="w-16 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-center font-mono text-xs font-bold text-white outline-none focus:border-emerald-500"
            />
            <span className="text-[11px] font-bold text-neutral-500">%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-neutral-400">TRJ min</label>
            <input type="number" step="0.5" value={trjMin} onChange={(e) => setTrjMin(e.target.value)}
              className="w-16 rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-center font-mono text-xs font-bold text-white outline-none focus:border-emerald-500"
            />
            <span className="text-[11px] font-bold text-neutral-500">%</span>
          </div>
        </div>

        {/* PS3838 Odds */}
        <div className="mt-8">
          <p className="mb-4 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-neutral-900">📊 Cotes PS3838 (Pinnacle)</p>
          {isCombi ? renderCombiForm() : renderSimpleForm()}
        </div>

        {/* CB input */}
        <div className="mt-8">
          <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-neutral-900">🎯 Côte du Book (CB)</p>
          <div className="mx-auto max-w-[220px]">
            <input type="number" step="0.01" min="1.01" value={betOdd} onChange={(e) => setBetOdd(e.target.value)}
              placeholder="Ex: 2.20" inputMode="decimal"
              className="w-full rounded-2xl border-3 border-neutral-900 bg-neutral-900 px-4 py-4 text-center font-mono text-xl font-black text-emerald-400 placeholder-neutral-500 shadow-lg outline-none transition-all focus:ring-4 focus:ring-neutral-300"
            />
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-10">
            <p className="mb-4 text-center text-xs font-extrabold uppercase tracking-[0.2em] text-neutral-900">📈 Résultats</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ResultCard label="Fair Odd" value={result.fairOdd} suffix="" color="neutral" icon="⚖️" />
              <ResultCard label="TRJ" value={result.trj} suffix="%" color={trjColor(result.trj)} icon="📐" />
              <ResultCard label="EV" value={result.ev} suffix="%" color={evColor(result.ev)} icon="💰" />
              <ResultCard label="EV + TRJ" value={result.evPlusTrj} suffix="%" color={evTrjColor(result.evPlusTrj)} icon="🔥" />
            </div>
            <VerdictBanner verdict={result.verdict} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* MEGA TUTORIAL                                          */}
        {/* ═══════════════════════════════════════════════════════ */}

        <div className="mt-16 space-y-8">

          <div className="text-center">
            <span className="inline-block rounded-full bg-neutral-900 px-5 py-2 text-xs font-extrabold uppercase tracking-[0.25em] text-white">📚 Guide complet</span>
            <h2 className="mt-4 text-2xl font-black text-neutral-900">Comment utiliser le calculateur</h2>
            <p className="mt-2 text-sm text-neutral-500">Tout ce que tu dois savoir pour détecter les value bets avec la méthode PS3838</p>
          </div>

          {/* C'est quoi une Value Bet ? */}
          <div className="rounded-2xl border-2 border-neutral-200 p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-neutral-900">🎯 C&apos;est quoi une Value Bet ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Une value bet c&apos;est un pari où la cote proposée par ton bookmaker (Betclic, Unibet, Winamax...) est <span className="font-bold text-neutral-900">supérieure à la cote juste</span> calculée mathématiquement. En gros, le bookmaker te paie plus que ce que le pari vaut réellement. Sur le long terme, tu es mathématiquement gagnant.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Ce calculateur compare la cote de ton bookmaker avec les cotes de <span className="font-bold text-neutral-900">PS3838 (Pinnacle)</span>, considéré comme la référence mondiale. Pinnacle a les marges les plus faibles du marché — ses cotes sont les plus proches de la &quot;vraie&quot; probabilité.
            </p>
          </div>

          {/* Les termes à connaître */}
          <div className="rounded-2xl border-2 border-neutral-200 p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-neutral-900">📖 Les termes à connaître</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">CB (Côte du Book)</p>
                <p className="mt-1 text-sm text-neutral-600">La cote proposée par ton bookmaker ANJ (Betclic, Unibet, Winamax...) que tu veux évaluer. C&apos;est cette cote qu&apos;on va comparer à la &quot;vraie&quot; cote.</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">Fair Odd (Côte Juste)</p>
                <p className="mt-1 text-sm text-neutral-600">La cote théorique si le bookmaker ne prenait aucune marge. C&apos;est la &quot;vraie&quot; valeur du pari, calculée à partir des cotes PS3838.</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">TRJ (Taux de Retour Joueur)</p>
                <p className="mt-1 text-sm text-neutral-600">Le pourcentage de l&apos;argent misé que le bookmaker redistribue. 100% = pas de marge. Plus c&apos;est haut, mieux c&apos;est. On recommande minimum 99% (jamais sous 98.5%).</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">EV (Expected Value — Espérance de gain)</p>
                <p className="mt-1 text-sm text-neutral-600">L&apos;espérance de gain à long terme en %. Une EV positive signifie que tu es mathématiquement gagnant. On recommande minimum 2.5%.</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">EV + TRJ</p>
                <p className="mt-1 text-sm text-neutral-600">La somme des deux. Règle de secours : si le TRJ est sous le seuil mais que EV + TRJ dépasse 100%, on peut quand même jouer.</p>
              </div>
            </div>
          </div>

          {/* Les 3 verdicts */}
          <div className="rounded-2xl border-2 border-neutral-200 p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-neutral-900">🚦 Les 3 verdicts possibles</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
                <span className="mt-0.5 text-xl">✅</span>
                <div>
                  <p className="text-sm font-extrabold text-emerald-700">JOUER</p>
                  <p className="mt-0.5 text-sm text-emerald-600">EV ≥ seuil ET TRJ ≥ seuil. C&apos;est une value confirmée, tu peux miser.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                <span className="mt-0.5 text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-extrabold text-amber-700">JOUER (EV+TRJ &gt; 100%)</p>
                  <p className="mt-0.5 text-sm text-amber-600">EV ≥ seuil mais TRJ un peu bas. La règle de secours s&apos;applique car EV + TRJ dépasse 100%. Tu peux jouer avec prudence.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
                <span className="mt-0.5 text-xl">❌</span>
                <div>
                  <p className="text-sm font-extrabold text-red-700">NE PAS JOUER</p>
                  <p className="mt-0.5 text-sm text-red-600">EV trop faible ou TRJ trop bas sans règle de secours. Ce pari n&apos;est pas value, passe.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Les 8 types de marchés */}
          <div className="rounded-2xl border-2 border-neutral-200 p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-neutral-900">📋 Les 8 types de marchés</h3>
            <p className="mt-2 text-sm text-neutral-500">Chaque onglet correspond à un type de marché différent. Choisis celui qui correspond à ton pari.</p>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">2 Possibilités</p>
                <p className="mt-1 text-sm text-neutral-600">Over/Under (tous sports), BTTS/No BTTS, Handicap, ML Tennis/Basket. Tu entres les 2 cotes PS3838 + ta cote CB.</p>
                <p className="mt-2 text-xs font-semibold text-emerald-600">Exemple : Over 3.5 buts Liverpool-Southampton → PS3838 : 1.943 / 1.909, CB : 2.20</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">3 Possibilités</p>
                <p className="mt-1 text-sm text-neutral-600">1X2 Football classique. Tu entres la cote étudiée + le Nul + l&apos;opposée depuis PS3838.</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">4 Possibilités (Simple)</p>
                <p className="mt-1 text-sm text-neutral-600">Marchés combinés sur 1 même match : BTTS + Over, Score correct groupé. 4 issues possibles, 4 cotes PS3838.</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">4 Possibilités (Combiné)</p>
                <p className="mt-1 text-sm text-neutral-600">2 matchs en ML (basket, tennis) ou HP -0.5 (foot). Tu entres les cotes PS3838 de chaque match séparément. Le TRJ se dégrade multiplicativement.</p>
                <p className="mt-2 text-xs font-semibold text-amber-600">⚠️ Le TRJ d&apos;un combiné 99% × 99% = 98%. C&apos;est pourquoi on évite les combinés de 3+ matchs.</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">6 Possibilités (Simple)</p>
                <p className="mt-1 text-sm text-neutral-600">1X2 × BTTS (3 × 2 = 6 issues), Score correct groupé. La cote étudiée est toujours la première.</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">6 Possibilités (Double Chance)</p>
                <p className="mt-1 text-sm text-neutral-600">DC + BTTS (ex: &quot;Real ou Nul ET BTTS&quot;). Les 2 premières cotes sont les 2 issues couvertes par la DC. La fair odd combine les probabilités des 2 premières issues.</p>
                <p className="mt-2 text-xs font-semibold text-emerald-600">💡 Différence avec le 6 Simple : ici on calcule la fair odd sur la SOMME des 2 premières probabilités.</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">9 Possibilités (Simple)</p>
                <p className="mt-1 text-sm text-neutral-600">HT/FT (Mi-temps/Fin de match = 3 × 3 = 9 issues). Si PS3838 n&apos;affiche que 8 cotes, mettre 100 pour la 9ème (PS3838 considère cette issue quasi impossible).</p>
              </div>

              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-extrabold text-neutral-900">9 Possibilités (Combiné)</p>
                <p className="mt-1 text-sm text-neutral-600">2 matchs en 1X2 (3 × 3 = 9 combinaisons). Ex: OM Win + Lille Win. Tu entres les 3 cotes 1X2 PS3838 de chaque match.</p>
              </div>
            </div>
          </div>

          {/* Comment utiliser pas à pas */}
          <div className="rounded-2xl border-2 border-neutral-200 p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-neutral-900">🔢 Mode d&apos;emploi pas à pas</h3>
            <div className="mt-4 space-y-4">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-black text-white">1</span>
                <p className="text-sm text-neutral-600"><span className="font-bold text-neutral-900">Choisis le type de marché</span> en cliquant sur l&apos;onglet correspondant (2 Poss., 3 Poss., etc.)</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-black text-white">2</span>
                <p className="text-sm text-neutral-600"><span className="font-bold text-neutral-900">Entre les cotes PS3838</span> pour toutes les issues du marché. La &quot;côte étudiée&quot; (en vert) est celle sur laquelle tu veux parier.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-black text-white">3</span>
                <p className="text-sm text-neutral-600"><span className="font-bold text-neutral-900">Entre la Côte du Book (CB)</span> — c&apos;est la cote que ton bookmaker ANJ te propose pour cette même sélection.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-black text-white">4</span>
                <p className="text-sm text-neutral-600"><span className="font-bold text-neutral-900">Le résultat s&apos;affiche automatiquement</span> — Fair Odd, TRJ, EV, EV+TRJ et le verdict final (JOUER / NE PAS JOUER).</p>
              </div>
            </div>
          </div>

          {/* Qu'est-ce que la côte opposée ? */}
          <div className="rounded-2xl border-2 border-neutral-200 p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-neutral-900">🤔 C&apos;est quoi la &quot;Côte opposée&quot; ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-neutral-600">
              Dans un marché à 2 possibilités (ex: Over/Under), tu as toujours 2 cotes sur PS3838. La <span className="font-bold text-emerald-600">&quot;côte étudiée&quot;</span> c&apos;est celle sur laquelle tu veux parier (ex: Over 3.5 à 1.943). La <span className="font-bold text-neutral-900">&quot;côte opposée&quot;</span> c&apos;est l&apos;autre issue du même marché (ex: Under 3.5 à 1.909).
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              On a besoin des deux cotes pour calculer la marge du bookmaker (le TRJ) et la fair odd. Sans la côte opposée, impossible de savoir si ta cote est réellement value.
            </p>
          </div>

          {/* Conseils pro */}
          <div className="rounded-2xl bg-neutral-900 p-5 sm:p-6">
            <h3 className="text-lg font-extrabold text-white">💎 Conseils de pro</h3>
            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <p>📌 Ne jouer en value que sur des cotes <span className="font-bold text-emerald-400">≤ 2.50</span></p>
              <p>📌 Mise très faible : <span className="font-bold text-emerald-400">~0.25% de la bankroll</span></p>
              <p>📌 TRJ bien meilleur sur <span className="font-bold text-white">ML/1X2</span> que sur marchés annexes (Over, BTTS, buteurs)</p>
              <p>📌 Combiné de <span className="font-bold text-red-400">2 matchs maximum</span>, jamais 3+ (TRJ se dégrade : 99%×99%=98%, 95%×95%×95%=85.7%)</p>
              <p>📌 Une value est value <span className="font-bold text-white">à l&apos;instant T</span>, elle peut changer si les cotes bougent</p>
              <p>📌 C&apos;est une value <span className="font-bold text-emerald-400">MATHÉMATIQUE</span> basée sur PS3838, pas subjective ni statistique</p>
              <p>📌 Les marchés buteurs ne sont <span className="font-bold text-red-400">PAS inclus</span> — ils se comparent avec OrbitX, pas PS3838</p>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}