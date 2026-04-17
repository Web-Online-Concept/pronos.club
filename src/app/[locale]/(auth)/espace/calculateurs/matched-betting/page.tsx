"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type BetType = "qualifying" | "freebet_snr" | "freebet_sr";

export default function MatchedBettingPage() {
  const [betType, setBetType] = useState<BetType>("qualifying");
  const [miseBack, setMiseBack] = useState<number>(10);
  const [coteBack, setCoteBack] = useState<number>(2.0);
  const [commissionBack, setCommissionBack] = useState<number>(0);
  const [coteLay, setCoteLay] = useState<number>(2.1);
  const [commissionLay, setCommissionLay] = useState<number>(5);

  const calcul = useMemo(() => {
    const cB = Math.max(1.01, Number(coteBack) || 1.01);
    const cL = Math.max(1.01, Number(coteLay) || 1.01);
    const cmB = Math.max(0, Math.min(100, Number(commissionBack) || 0)) / 100;
    const cmL = Math.max(0, Math.min(100, Number(commissionLay) || 0)) / 100;
    const mB = Math.max(0, Number(miseBack) || 0);

    let miseLay: number;
    let profitBack: number;
    let profitLay: number;

    if (betType === "qualifying") {
      miseLay = (cB * mB) / (cL - cmL);
      const liability = miseLay * (cL - 1);
      profitBack = mB * (cB - 1) * (1 - cmB) - liability;
      profitLay = miseLay * (1 - cmL) - mB;
    } else if (betType === "freebet_snr") {
      miseLay = ((cB - 1) * mB) / (cL - cmL);
      const liability = miseLay * (cL - 1);
      profitBack = mB * (cB - 1) * (1 - cmB) - liability;
      profitLay = miseLay * (1 - cmL);
    } else {
      miseLay = (cB * mB) / (cL - cmL);
      const liability = miseLay * (cL - 1);
      profitBack = mB * cB * (1 - cmB) - liability;
      profitLay = miseLay * (1 - cmL);
    }

    const liability = miseLay * (cL - 1);
    const profitMin = Math.min(profitBack, profitLay);
    const base = betType === "qualifying" ? mB : mB;
    const roi = base > 0 ? (profitMin / base) * 100 : 0;

    return {
      miseLay: Number.isFinite(miseLay) ? miseLay : 0,
      liability: Number.isFinite(liability) ? liability : 0,
      profitBack: Number.isFinite(profitBack) ? profitBack : 0,
      profitLay: Number.isFinite(profitLay) ? profitLay : 0,
      profitMin: Number.isFinite(profitMin) ? profitMin : 0,
      roi: Number.isFinite(roi) ? roi : 0,
    };
  }, [betType, miseBack, coteBack, commissionBack, coteLay, commissionLay]);

  const fmt = (n: number) => n.toFixed(2);

  const verdict =
    betType === "qualifying"
      ? calcul.profitMin >= -0.5
        ? { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" }
        : calcul.profitMin >= -1.5
          ? { label: "Bon", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" }
          : calcul.profitMin >= -3
            ? { label: "Acceptable", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" }
            : { label: "Défavorable", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" }
      : calcul.roi >= 85
        ? { label: "Excellent", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" }
        : calcul.roi >= 70
          ? { label: "Bon", color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" }
          : calcul.roi >= 50
            ? { label: "Acceptable", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" }
            : { label: "Défavorable", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30" };

  const miseLabel =
    betType === "qualifying" ? "Montant de la mise (€)" : "Valeur du freebet (€)";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link
            href="/espace/calculateurs"
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Calculateurs</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">Matched Betting</h1>
              <p className="text-xs text-white/50">Bonus bookmakers garantis</p>
            </div>
          </div>
        </div>
        <div className="h-[2px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Type de pari */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-sm">
          <label className="block text-sm font-semibold text-white/80 mb-3">Type de pari</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                { id: "qualifying", label: "Pari de Qualification", desc: "Pour débloquer un bonus" },
                { id: "freebet_snr", label: "Pari Gratuit (SNR)", desc: "Freebet : gains uniquement" },
                { id: "freebet_sr", label: "Pari Gratuit (SR)", desc: "Freebet : gains + mise (rare)" },
              ] as const
            ).map(({ id, label, desc }) => (
              <button
                key={id}
                onClick={() => setBetType(id)}
                className={`text-left p-4 rounded-xl border transition ${
                  betType === id
                    ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                    : "border-white/10 bg-white/5 hover:border-white/20"
                }`}
              >
                <div className={`text-sm font-semibold ${betType === id ? "text-purple-300" : "text-white"}`}>
                  {label}
                </div>
                <div className="text-xs text-white/50 mt-1">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-sm">
          <h2 className="text-sm font-semibold text-white/80 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Paramètres du pari
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-white/60 mb-1.5">{miseLabel}</label>
              <input
                type="number"
                value={miseBack}
                step="0.01"
                min="0"
                onChange={(e) => setMiseBack(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1.5">Cote Back (bookmaker)</label>
              <input
                type="number"
                value={coteBack}
                step="0.01"
                min="1.01"
                onChange={(e) => setCoteBack(parseFloat(e.target.value) || 1.01)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1.5">Commission Back (%)</label>
              <input
                type="number"
                value={commissionBack}
                step="0.1"
                min="0"
                max="100"
                onChange={(e) => setCommissionBack(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1.5">Cote Lay (exchange)</label>
              <input
                type="number"
                value={coteLay}
                step="0.01"
                min="1.01"
                onChange={(e) => setCoteLay(parseFloat(e.target.value) || 1.01)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1.5">Commission Lay (%)</label>
              <input
                type="number"
                value={commissionLay}
                step="0.1"
                min="0"
                max="100"
                onChange={(e) => setCommissionLay(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Résultats */}
        <div className={`relative overflow-hidden rounded-2xl border ${verdict.border} ${verdict.bg} p-5 sm:p-6`}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Résultats</h2>
              <div className={`px-3 py-1 rounded-full text-xs font-bold ${verdict.color} border ${verdict.border}`}>
                {verdict.label}
              </div>
            </div>

            {/* Hero : Mise Lay */}
            <div className="bg-slate-950/60 rounded-xl p-5 border border-white/10 mb-4">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Mise Lay idéale</div>
              <div className="text-3xl sm:text-4xl font-bold text-purple-300">{fmt(calcul.miseLay)} €</div>
              <div className="text-xs text-white/50 mt-2">
                Liability (fonds nécessaires sur l&apos;exchange) :{" "}
                <span className="text-white font-semibold">{fmt(calcul.liability)} €</span>
              </div>
            </div>

            {/* Profits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/60 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-white/50 mb-1">Si Back gagne (bookmaker)</div>
                <div className={`text-xl font-bold ${calcul.profitBack >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {calcul.profitBack >= 0 ? "+" : ""}
                  {fmt(calcul.profitBack)} €
                </div>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-white/50 mb-1">Si Lay gagne (exchange)</div>
                <div className={`text-xl font-bold ${calcul.profitLay >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {calcul.profitLay >= 0 ? "+" : ""}
                  {fmt(calcul.profitLay)} €
                </div>
              </div>
              <div className="bg-slate-950/60 rounded-xl p-4 border border-white/10">
                <div className="text-xs text-white/50 mb-1">Rendement</div>
                <div className={`text-xl font-bold ${verdict.color}`}>{fmt(calcul.roi)} %</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tutoriel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6 backdrop-blur-sm space-y-5">
          <h2 className="text-xl font-bold flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-base">
              📘
            </span>
            Guide Matched Betting
          </h2>

          <div className="border-l-2 border-purple-500/50 pl-4">
            <h3 className="font-semibold text-purple-300 mb-2">1. Qu&apos;est-ce que le matched betting ?</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Le matched betting est une technique qui permet d&apos;extraire l&apos;argent des bonus bookmakers en{" "}
              <strong className="text-white">gain garanti</strong>, en couvrant chaque pari sur un betting exchange
              (Betfair, Smarkets, Matchbook). Le principe : tu paries <strong className="text-white">Back</strong> (POUR
              un résultat) chez le bookmaker, et <strong className="text-white">Lay</strong> (CONTRE ce résultat) sur
              l&apos;exchange. Peu importe l&apos;issue, le bonus est sécurisé.
            </p>
          </div>

          <div className="border-l-2 border-purple-500/50 pl-4">
            <h3 className="font-semibold text-purple-300 mb-2">2. Les 3 types de paris</h3>
            <div className="space-y-2 text-sm text-white/70">
              <p>
                <strong className="text-white">Pari de Qualification</strong> — Premier pari avec ton argent pour
                débloquer un bonus. Objectif : <em>minimiser la perte</em> (généralement quelques centimes à 2-3 €).
              </p>
              <p>
                <strong className="text-white">Pari Gratuit (SNR)</strong> — Freebet classique. Si gagné, tu reçois
                uniquement les gains (pas la mise). Objectif : <em>extraire 70-85 %</em> de la valeur du freebet.
              </p>
              <p>
                <strong className="text-white">Pari Gratuit (SR)</strong> — Freebet rare qui rend la mise si gagné.
                Rendement proche de 95-100 %.
              </p>
            </div>
          </div>

          <div className="border-l-2 border-purple-500/50 pl-4">
            <h3 className="font-semibold text-purple-300 mb-2">3. Les formules</h3>
            <div className="bg-slate-950/60 rounded-xl p-4 font-mono text-xs text-white/80 space-y-2">
              <p>
                <span className="text-purple-300">Qualification / SR :</span> miseLay = (coteBack × miseBack) / (coteLay
                − commissionLay)
              </p>
              <p>
                <span className="text-purple-300">Freebet SNR :</span> miseLay = ((coteBack − 1) × miseBack) / (coteLay
                − commissionLay)
              </p>
              <p>
                <span className="text-purple-300">Liability :</span> miseLay × (coteLay − 1)
              </p>
            </div>
          </div>

          <div className="border-l-2 border-purple-500/50 pl-4">
            <h3 className="font-semibold text-purple-300 mb-2">4. Exemple concret (freebet SNR 50 €)</h3>
            <div className="text-sm text-white/70 space-y-1">
              <p>Freebet de 50 €, cote Back 4.00, cote Lay 4.20, commission Betfair 5 %.</p>
              <p>
                Mise Lay = (3 × 50) / (4.20 − 0.05) = <strong className="text-purple-300">36.14 €</strong>
              </p>
              <p>
                Liability = 36.14 × 3.20 = <strong className="text-purple-300">115.66 €</strong> (fonds nécessaires sur
                Betfair)
              </p>
              <p>
                Profit garanti : <strong className="text-emerald-400">≈ 34.33 €</strong> (soit 68.7 % du freebet)
              </p>
            </div>
          </div>

          <div className="border-l-2 border-purple-500/50 pl-4">
            <h3 className="font-semibold text-purple-300 mb-2">5. Conseils pro</h3>
            <ul className="text-sm text-white/70 space-y-1.5 list-disc list-inside marker:text-purple-400">
              <li>
                Pour un <strong className="text-white">pari de qualification</strong>, choisis des cotes proches de 2.00
                (Back ≈ Lay) pour minimiser la perte.
              </li>
              <li>
                Pour un <strong className="text-white">freebet SNR</strong>, privilégie les cotes élevées (4.00 - 6.00)
                pour maximiser le rendement.
              </li>
              <li>
                Vérifie toujours la <strong className="text-white">liability</strong> : ce montant doit être disponible
                sur l&apos;exchange avant de parier.
              </li>
              <li>
                Commissions standards : Betfair 5 %, Smarkets 2 %, Matchbook 1.5 %. Moins de commission = plus de
                profit.
              </li>
              <li>
                Commence par des mises faibles (10-20 €) pour te familiariser avec le process, puis augmente
                progressivement.
              </li>
              <li>Note chaque opération : bonus utilisé, profit extrait, date — pour garder une trace comptable.</li>
            </ul>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-200">
            <strong>⚠️ Jeu responsable :</strong> Le matched betting est légal en France et repose sur un résultat
            mathématiquement garanti. Néanmoins, les bookmakers peuvent limiter ou fermer les comptes qui exploitent
            trop les bonus. Respecte toujours les CGU de chaque opérateur et joue de manière responsable.
          </div>
        </div>
      </div>
    </div>
  );
}