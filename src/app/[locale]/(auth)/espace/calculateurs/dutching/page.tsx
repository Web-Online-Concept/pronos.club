"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Mode = "stake" | "target";

interface Issue {
  odd: string;
  label: string;
}

interface IssueResult {
  stake: number;      // Mise à placer
  payout: number;     // Gain brut si cette issue gagne
  profit: number;     // Profit net
}

interface DutchingResult {
  issues: IssueResult[];
  totalStake: number;        // Mise totale
  guaranteedPayout: number;  // Gain garanti (identique pour toutes)
  guaranteedProfit: number;  // Profit net garanti
  roi: number;               // ROI %
  trj: number;               // TRJ % (qualité du dutching)
  verdict: "surebet" | "acceptable" | "losing";
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Calcule le dutching :
 * - mode "stake" : on fixe la mise totale, on calcule le gain garanti
 * - mode "target" : on fixe le gain cible, on calcule la mise totale nécessaire
 *
 * Principe : stake_i = (amount / odd_i) / somme(1/odd_j)
 * Plus la cote est haute, moins on mise.
 */
function calcDutching(odds: number[], amount: number, mode: Mode): DutchingResult | null {
  if (odds.some((o) => o <= 1) || amount <= 0) return null;

  const invSum = odds.reduce((s, o) => s + 1 / o, 0);
  const trj = (1 / invSum) * 100;

  let totalStake: number;
  let guaranteedPayout: number;

  if (mode === "stake") {
    // On fixe la mise totale, on calcule le gain
    totalStake = amount;
    guaranteedPayout = amount / invSum;
  } else {
    // On fixe le gain cible, on calcule la mise nécessaire
    guaranteedPayout = amount;
    totalStake = amount * invSum;
  }

  // Répartition des mises (inversement proportionnelle aux cotes)
  const issues: IssueResult[] = odds.map((odd) => {
    const stake = guaranteedPayout / odd;
    const payout = stake * odd; // = guaranteedPayout
    return {
      stake,
      payout,
      profit: payout - totalStake,
    };
  });

  const guaranteedProfit = guaranteedPayout - totalStake;
  const roi = (guaranteedProfit / totalStake) * 100;

  let verdict: DutchingResult["verdict"] = "losing";
  if (trj >= 100) verdict = "surebet";
  else if (trj >= 95) verdict = "acceptable";

  return {
    issues,
    totalStake,
    guaranteedPayout,
    guaranteedProfit,
    roi,
    trj,
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

function VerdictBanner({ verdict, trj }: { verdict: DutchingResult["verdict"]; trj: number }) {
  const config = {
    surebet: {
      bg: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)",
      text: "🎯 SUREBET — Arbitrage garanti",
      sub: `TRJ ${trj.toFixed(2)}% > 100% — profit mathématique peu importe le résultat`,
    },
    acceptable: {
      bg: "linear-gradient(135deg, #92400e 0%, #f59e0b 50%, #fbbf24 100%)",
      text: "⚠️ DUTCHING ACCEPTABLE",
      sub: `TRJ ${trj.toFixed(2)}% — perte minime sur le long terme, utilisable pour couvrir`,
    },
    losing: {
      bg: "linear-gradient(135deg, #991b1b 0%, #ef4444 50%, #f87171 100%)",
      text: "❌ DUTCHING PERDANT",
      sub: `TRJ ${trj.toFixed(2)}% trop faible — marge bookmaker trop importante`,
    },
  };
  const c = config[verdict];
  return (
    <div className="mt-5 rounded-2xl px-6 py-5 text-center shadow-xl" style={{ background: c.bg }}>
      <p className="text-xl font-black text-white sm:text-2xl">{c.text}</p>
      <p className="mt-1 text-xs font-semibold text-white/70">{c.sub}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function DutchingCalculatorPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [mode, setMode] = useState<Mode>("stake");
  const [amount, setAmount] = useState("100");
  const [nIssues, setNIssues] = useState(3);
  const [issues, setIssues] = useState<Issue[]>(
    Array.from({ length: 8 }, (_, i) => ({ odd: "", label: `Issue ${i + 1}` }))
  );

  function updateOdd(index: number, value: string) {
    const next = [...issues];
    next[index] = { ...next[index], odd: value };
    setIssues(next);
  }

  function updateLabel(index: number, value: string) {
    const next = [...issues];
    next[index] = { ...next[index], label: value };
    setIssues(next);
  }

  function resetAll() {
    setIssues(Array.from({ length: 8 }, (_, i) => ({ odd: "", label: `Issue ${i + 1}` })));
    setAmount("100");
  }

  const result = useMemo((): DutchingResult | null => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return null;
    const oddsValues = issues.slice(0, nIssues).map((i) => parseFloat(i.odd));
    if (oddsValues.some((v) => !v || v <= 1)) return null;
    return calcDutching(oddsValues, amt, mode);
  }, [issues, amount, nIssues, mode]);

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
      <EspaceHero title="Dutching" />

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

            {/* Number of issues selector */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-white/30">
                ⚙️ Nombre d&apos;issues
              </span>
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setNIssues(n)}
                  className={`h-8 w-8 cursor-pointer rounded-lg text-xs font-black transition-all ${
                    nIssues === n
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* Issues inputs */}
            <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              📊 Cotes des {nIssues} issues
            </p>

            <div className="space-y-3">
              {issues.slice(0, nIssues).map((issue, i) => {
                const issueResult = result?.issues[i];
                const accentColor = ["#059669", "#0891b2", "#7c3aed", "#db2777", "#dc2626", "#d97706", "#65a30d", "#0284c7"][i];

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
                        value={issue.label}
                        onChange={(e) => updateLabel(i, e.target.value)}
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
                          value={issue.odd}
                          onChange={(e) => updateOdd(i, e.target.value)}
                          placeholder="2.000"
                          inputMode="decimal"
                          className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-3 py-2.5 text-center font-mono text-base font-extrabold text-white outline-none placeholder:text-white/20 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20"
                        />
                      </div>

                      {/* Mise calculée */}
                      <div>
                        <label className="mb-1 block text-center text-[9px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                          Mise à placer
                        </label>
                        <div className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-center font-mono text-base font-extrabold text-emerald-300">
                          {issueResult ? `${issueResult.stake.toFixed(2)}€` : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Gain si cette issue gagne */}
                    {issueResult && (
                      <div className="mt-2 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                          Si gagne
                        </span>
                        <span className="font-mono text-xs font-black text-white">
                          +{issueResult.payout.toFixed(2)}€
                        </span>
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
                  <ResultCard label="Gain garanti" value={result.guaranteedPayout} suffix="€" color="neutral" icon="🎯" />
                  <ResultCard
                    label="Profit net"
                    value={result.guaranteedProfit}
                    suffix="€"
                    color={result.guaranteedProfit > 0 ? "green" : "red"}
                    icon="💎"
                  />
                  <ResultCard
                    label="ROI"
                    value={result.roi}
                    suffix="%"
                    color={result.roi > 0 ? "green" : "red"}
                    icon="📈"
                  />
                </div>
                <VerdictBanner verdict={result.verdict} trj={result.trj} />
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
            <h2 className="mt-2 text-xl font-black text-white">Comprendre le Dutching</h2>
            <p className="mt-1 text-xs text-white/40">
              Répartir ta mise intelligemment sur plusieurs issues
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi le dutching */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  🎯
                </span>
                <span>C&apos;est quoi le Dutching ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Le Dutching consiste à <strong className="text-neutral-900">répartir ta mise sur plusieurs issues</strong> d&apos;un même événement, de manière à{" "}
                  <strong className="text-emerald-600">gagner la même chose peu importe laquelle gagne</strong>.
                </p>
                <p className="mt-3">
                  Le nom vient de Dutchy Schultz, un gangster américain des années 30 qui utilisait cette technique aux courses hippiques pour maximiser ses gains tout en limitant les risques.
                </p>
                <p className="mt-3">
                  C&apos;est une stratégie particulièrement utile quand tu as identifié{" "}
                  <strong className="text-neutral-900">plusieurs favoris plausibles</strong> et que tu veux couvrir tes arrières sans avoir à choisir.
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
                  <strong className="text-neutral-900">Course de chevaux</strong> : 3 favoris plausibles aux cotes 3.0 / 4.0 / 6.0.
                </p>
                <div className="rounded-xl bg-neutral-50 p-4">
                  <p className="font-bold text-neutral-900">Mise totale : 100€</p>
                  <div className="mt-2 space-y-1 font-mono text-xs">
                    <p>🥇 Cheval A (cote 3.0) → mise <span className="font-bold text-emerald-600">44.44€</span></p>
                    <p>🥈 Cheval B (cote 4.0) → mise <span className="font-bold text-emerald-600">33.33€</span></p>
                    <p>🥉 Cheval C (cote 6.0) → mise <span className="font-bold text-emerald-600">22.22€</span></p>
                  </div>
                </div>
                <p>
                  <strong className="text-emerald-600">Résultat</strong> : peu importe quel cheval gagne, tu récupères toujours{" "}
                  <strong className="text-emerald-600">133.33€</strong> (soit +33€ de profit).
                </p>
                <p className="text-xs italic text-neutral-500">
                  Plus la cote est haute, moins on mise. La répartition est inversement proportionnelle aux cotes.
                </p>
              </div>
            </details>

            {/* Section 3 — Les termes */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  📖
                </span>
                <span>Les termes à connaître</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                {[
                  {
                    term: "Mise totale",
                    desc: "La somme que tu engages au total, répartie sur toutes les issues sélectionnées.",
                  },
                  {
                    term: "Gain garanti",
                    desc: "Le montant récupéré peu importe quelle issue gagne (identique pour toutes).",
                  },
                  {
                    term: "Profit net",
                    desc: "Gain garanti - mise totale. C'est ton bénéfice réel assuré.",
                  },
                  {
                    term: "ROI % (Return On Investment)",
                    desc: "Profit / mise totale × 100. Indique le rendement du dutching.",
                  },
                  {
                    term: "TRJ (Taux de Retour Joueur)",
                    desc: "1 / Σ(1/cotes) × 100. Qualité globale du marché. Si TRJ > 100%, c'est un surebet.",
                  },
                ].map((item) => (
                  <div key={item.term} className="rounded-xl bg-neutral-50 p-3">
                    <p className="text-sm font-extrabold text-neutral-900">{item.term}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Section 4 — Les 3 verdicts */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  🚦
                </span>
                <span>Les 3 verdicts possibles</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4">
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4">
                  <span className="mt-0.5 text-xl">🎯</span>
                  <div>
                    <p className="text-sm font-extrabold text-emerald-700">SUREBET (TRJ ≥ 100%)</p>
                    <p className="mt-0.5 text-sm text-emerald-600">
                      Profit mathématique garanti. Ça arrive quand les cotes de différents bookmakers divergent suffisamment. Rare mais très intéressant.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                  <span className="mt-0.5 text-xl">⚠️</span>
                  <div>
                    <p className="text-sm font-extrabold text-amber-700">ACCEPTABLE (TRJ 95-100%)</p>
                    <p className="mt-0.5 text-sm text-amber-600">
                      Tu perds un peu en moyenne (marge du book), mais ça reste utilisable pour couvrir ou débloquer un bonus.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-red-50 p-4">
                  <span className="mt-0.5 text-xl">❌</span>
                  <div>
                    <p className="text-sm font-extrabold text-red-700">PERDANT (TRJ &lt; 95%)</p>
                    <p className="mt-0.5 text-sm text-red-600">
                      Marge du bookmaker trop importante. Dutching non rentable sur le long terme.
                    </p>
                  </div>
                </div>
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
                  "Choisis ton mode : Mise totale (combien tu veux engager) ou Gain cible (combien tu veux gagner)",
                  "Indique le montant correspondant au mode choisi",
                  "Sélectionne le nombre d'issues sur lesquelles tu veux répartir (2 à 8)",
                  "Entre les cotes de chaque issue (tu peux renommer le libellé pour t'y retrouver)",
                  "Les mises à placer et le gain garanti se calculent automatiquement",
                  "Regarde le verdict : surebet = profit assuré, acceptable = couverture OK, perdant = passe",
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

            {/* Section 6 — Quand utiliser */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-rose-300 open:shadow-lg open:shadow-rose-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-100 text-base">
                  🤔
                </span>
                <span>Quand utiliser le Dutching ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🏇 Courses hippiques</p>
                  <p className="mt-0.5">Plusieurs favoris plausibles, pas de certitude sur le vainqueur.</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">⛳ Golf / Tennis (tournois)</p>
                  <p className="mt-0.5">3-5 favoris pour gagner un tournoi, impossible de trancher entre eux.</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">⚽ Score exact groupé</p>
                  <p className="mt-0.5">Parier sur plusieurs scores plausibles d&apos;un match (1-0, 2-0, 2-1...).</p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎁 Débloquer un bonus bookmaker</p>
                  <p className="mt-0.5">
                    Atteindre un objectif de mise (rollover) avec un risque minimal.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">💎 Arbitrage multi-books</p>
                  <p className="mt-0.5">
                    Quand les cotes de 2-3 bookmakers divergent, le dutching peut devenir un surebet.
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
                    📌 Plus tu ajoutes d&apos;issues, plus le{" "}
                    <span className="font-bold text-amber-400">TRJ baisse</span> (marge cumulée)
                  </p>
                  <p>
                    📌 Le dutching <span className="font-bold text-white">rentable</span> existe : cherche les
                    divergences entre bookmakers
                  </p>
                  <p>
                    📌 Arrondis les mises à l&apos;euro supérieur côté{" "}
                    <span className="font-bold text-emerald-400">favori</span> pour simplifier
                  </p>
                  <p>
                    📌 Limite à <span className="font-bold text-red-400">2-4 issues</span> en pratique — au-delà le TRJ
                    explose
                  </p>
                  <p>
                    📌 Vérifie que tous les bookmakers acceptent tes mises{" "}
                    <span className="font-bold text-white">avant</span> de répartir
                  </p>
                  <p>
                    📌 Idéal pour <span className="font-bold text-emerald-400">débloquer un bonus</span> avec un risque
                    contrôlé
                  </p>
                  <p>
                    📌 Attention au <span className="font-bold text-red-400">remboursement en cash</span> (nul au foot) qui
                    casse le calcul
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