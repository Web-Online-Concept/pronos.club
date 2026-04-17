"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type BetType = "qualifying" | "freebet_snr" | "freebet_sr";
type Quality = "excellent" | "good" | "decent" | "break_even" | "losing";

interface MatchedResult {
  betType: BetType;
  miseLay: number;          // Mise idéale du Lay
  liability: number;        // Fonds nécessaires sur l'exchange
  profitBack: number;       // Profit si le Back gagne (bookmaker)
  profitLay: number;        // Profit si le Lay gagne (exchange)
  profitMin: number;        // Profit garanti (min des deux)
  yieldPct: number;         // Rendement en % de la mise
  quality: Quality;
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcMatched(
  betType: BetType,
  miseBack: number,
  coteBack: number,
  commissionBack: number,
  coteLay: number,
  commissionLay: number
): MatchedResult | null {
  if (miseBack <= 0 || coteBack <= 1 || coteLay <= 1) return null;
  const cmB = commissionBack / 100;
  const cmL = commissionLay / 100;
  if (coteLay - cmL <= 0) return null;

  let miseLay: number;
  let profitBack: number;
  let profitLay: number;

  if (betType === "qualifying") {
    miseLay = (coteBack * miseBack) / (coteLay - cmL);
    const liab = miseLay * (coteLay - 1);
    profitBack = miseBack * (coteBack - 1) * (1 - cmB) - liab;
    profitLay = miseLay * (1 - cmL) - miseBack;
  } else if (betType === "freebet_snr") {
    miseLay = ((coteBack - 1) * miseBack) / (coteLay - cmL);
    const liab = miseLay * (coteLay - 1);
    profitBack = miseBack * (coteBack - 1) * (1 - cmB) - liab;
    profitLay = miseLay * (1 - cmL);
  } else {
    // freebet_sr
    miseLay = (coteBack * miseBack) / (coteLay - cmL);
    const liab = miseLay * (coteLay - 1);
    profitBack = miseBack * coteBack * (1 - cmB) - liab;
    profitLay = miseLay * (1 - cmL);
  }

  const liability = miseLay * (coteLay - 1);
  const profitMin = Math.min(profitBack, profitLay);
  const yieldPct = (profitMin / miseBack) * 100;

  let quality: Quality;
  if (betType === "qualifying") {
    if (yieldPct >= 0) quality = "excellent";
    else if (yieldPct >= -3) quality = "good";
    else if (yieldPct >= -7) quality = "decent";
    else if (yieldPct >= -15) quality = "break_even";
    else quality = "losing";
  } else {
    if (yieldPct >= 85) quality = "excellent";
    else if (yieldPct >= 70) quality = "good";
    else if (yieldPct >= 50) quality = "decent";
    else if (yieldPct >= 30) quality = "break_even";
    else quality = "losing";
  }

  return {
    betType,
    miseLay,
    liability,
    profitBack,
    profitLay,
    profitMin,
    yieldPct,
    quality,
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
  showSign = false,
}: {
  label: string;
  value: number;
  suffix: string;
  color: "green" | "red" | "amber" | "cyan" | "neutral";
  icon: string;
  showSign?: boolean;
}) {
  const bg = {
    green: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
    red: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
    amber: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
    cyan: "linear-gradient(135deg, #164e63 0%, #0891b2 100%)",
    neutral: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
  };
  return (
    <div className="overflow-hidden rounded-2xl p-4 text-center shadow-lg" style={{ background: bg[color] }}>
      <span className="text-lg">{icon}</span>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">{label}</p>
      <p className="mt-1 font-mono text-2xl font-black text-white">
        {showSign && value >= 0 ? "+" : ""}
        {value.toFixed(2)}
        {suffix}
      </p>
    </div>
  );
}

function MatchedHeroCard({ result }: { result: MatchedResult }) {
  const isQualif = result.betType === "qualifying";

  const config = {
    excellent: {
      bg: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)",
      label: isQualif ? "🏆 PARFAIT" : "🏆 EXCELLENT",
      sub: isQualif ? "Aucune perte — bonus à coût zéro" : "Extraction quasi totale du freebet",
    },
    good: {
      bg: "linear-gradient(135deg, #065f46 0%, #059669 100%)",
      label: isQualif ? "✅ TRÈS BON" : "✅ BON",
      sub: isQualif ? "Perte minime pour débloquer le bonus" : "Rendement supérieur à 70%",
    },
    decent: {
      bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
      label: isQualif ? "👍 ACCEPTABLE" : "👍 CORRECT",
      sub: isQualif ? "Perte raisonnable — vérifie le bonus derrière" : "Rendement honnête mais perfectible",
    },
    break_even: {
      bg: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
      label: "⚠️ LIMITE",
      sub: isQualif ? "Perte élevée — à reconsidérer" : "Rendement faible — vérifie les cotes",
    },
    losing: {
      bg: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)",
      label: "❌ DÉFAVORABLE",
      sub: isQualif ? "Perte trop importante — évite" : "Rendement trop faible — évite",
    },
  };
  const c = config[result.quality];
  const mainLabel = isQualif ? "Coût de qualification" : "Profit garanti";
  const mainIcon = isQualif ? "⚖️" : "💰";

  return (
    <div className="rounded-3xl px-6 py-8 text-center shadow-xl" style={{ background: c.bg }}>
      <span className="text-3xl">{mainIcon}</span>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">{mainLabel}</p>
      <p className="mt-2 font-mono text-6xl font-black text-white">
        {result.profitMin >= 0 ? "+" : ""}
        {result.profitMin.toFixed(2)}€
      </p>
      <p className="mt-1 font-mono text-sm font-bold text-white/70">
        ({result.yieldPct >= 0 ? "+" : ""}
        {result.yieldPct.toFixed(2)}% de rendement)
      </p>
      <div className="mt-4 inline-block rounded-xl bg-white/20 px-4 py-2">
        <p className="text-sm font-black text-white">{c.label}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-white/80">{c.sub}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function MatchedBettingPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [betType, setBetType] = useState<BetType>("qualifying");
  const [miseBack, setMiseBack] = useState("");
  const [coteBack, setCoteBack] = useState("");
  const [commissionBack, setCommissionBack] = useState("0");
  const [coteLay, setCoteLay] = useState("");
  const [commissionLay, setCommissionLay] = useState("5");

  function resetAll() {
    setBetType("qualifying");
    setMiseBack("");
    setCoteBack("");
    setCommissionBack("0");
    setCoteLay("");
    setCommissionLay("5");
  }

  const result = useMemo((): MatchedResult | null => {
    const mB = parseFloat(miseBack);
    const cB = parseFloat(coteBack);
    const cmB = parseFloat(commissionBack);
    const cL = parseFloat(coteLay);
    const cmL = parseFloat(commissionLay);
    if (isNaN(mB) || isNaN(cB) || isNaN(cL)) return null;
    if (isNaN(cmB) || isNaN(cmL)) return null;
    return calcMatched(betType, mB, cB, cmB, cL, cmL);
  }, [betType, miseBack, coteBack, commissionBack, coteLay, commissionLay]);

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

  const miseLabel = betType === "qualifying" ? "Montant mise (€)" : "Valeur freebet (€)";
  const miseIcon = betType === "qualifying" ? "🎯" : "🎁";
  const misePlaceholder = betType === "qualifying" ? "50" : "10";

  return (
    <>
      <EspaceHero title="Matched Betting" />

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
            <p className="text-center text-[11px] font-medium text-white/40">
              Extrais les bonus bookmakers en gain garanti (Back / Lay)
            </p>

            {/* Sélecteur type de pari */}
            <div className="mt-6">
              <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-white/50">
                Type de pari
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "qualifying" as BetType, label: "Qualification", icon: "🎯" },
                  { id: "freebet_snr" as BetType, label: "Freebet SNR", icon: "🎁" },
                  { id: "freebet_sr" as BetType, label: "Freebet SR", icon: "💎" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBetType(t.id)}
                    className={`rounded-xl border-2 px-2 py-3 text-center transition-all ${
                      betType === t.id
                        ? "border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/20"
                        : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                    }`}
                  >
                    <p className="text-lg">{t.icon}</p>
                    <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wider">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Inputs */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {/* Mise / Freebet — full width */}
              <div
                className="col-span-2 rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
              >
                <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                  {miseIcon} {miseLabel}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={miseBack}
                  onChange={(e) => setMiseBack(e.target.value)}
                  placeholder={misePlaceholder}
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-center font-mono text-xl font-black text-emerald-300 placeholder-emerald-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                />
              </div>

              {/* Cote Back */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1e3d 100%)" }}
              >
                <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                  📊 Cote Back
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={coteBack}
                  onChange={(e) => setCoteBack(e.target.value)}
                  placeholder="4.00"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-center font-mono text-xl font-black text-cyan-300 placeholder-cyan-700 outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                />
              </div>

              {/* Cote Lay */}
              <div
                className="rounded-2xl border border-white/10 p-4"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #3d1a0a 100%)" }}
              >
                <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-amber-400">
                  📉 Cote Lay
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  value={coteLay}
                  onChange={(e) => setCoteLay(e.target.value)}
                  placeholder="4.20"
                  inputMode="decimal"
                  className="w-full rounded-xl border-2 border-amber-500/30 bg-amber-500/10 px-3 py-3 text-center font-mono text-xl font-black text-amber-300 placeholder-amber-700 outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20"
                />
              </div>

              {/* Commission Back */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <label className="mb-2 block text-center text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">
                  Commission Back %
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={commissionBack}
                  onChange={(e) => setCommissionBack(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center font-mono text-sm font-bold text-white/80 outline-none transition-all focus:border-white/30"
                />
              </div>

              {/* Commission Lay */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <label className="mb-2 block text-center text-[9px] font-bold uppercase tracking-[0.15em] text-white/50">
                  Commission Lay %
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={commissionLay}
                  onChange={(e) => setCommissionLay(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center font-mono text-sm font-bold text-white/80 outline-none transition-all focus:border-white/30"
                />
              </div>
            </div>

            {/* Helper */}
            <p className="mt-3 text-center text-[11px] italic text-white/30">
              💡 Commissions exchange : Betfair 5% • Smarkets 2% • Matchbook 1.5%
            </p>

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

                {/* Hero */}
                <MatchedHeroCard result={result} />

                {/* Plan d'action en langage clair */}
                <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
                  <p className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/20 text-xs">
                      📋
                    </span>
                    Plan d&apos;action — en clair
                  </p>
                  <div className="space-y-2.5 text-[13px] leading-relaxed text-white/80">
                    {result.betType === "qualifying" ? (
                      <>
                        <p>
                          <span className="font-bold text-white">1.</span> Place une mise de{" "}
                          <span className="font-mono font-black text-emerald-300">
                            {parseFloat(miseBack).toFixed(2)}€
                          </span>{" "}
                          en <span className="font-bold text-cyan-300">Back</span> à la cote{" "}
                          <span className="font-mono font-black text-cyan-300">{parseFloat(coteBack).toFixed(2)}</span>{" "}
                          chez ton bookmaker.
                        </p>
                        <p>
                          <span className="font-bold text-white">2.</span> Simultanément, place une mise{" "}
                          <span className="font-bold text-amber-300">Lay</span> de{" "}
                          <span className="font-mono font-black text-amber-300">{result.miseLay.toFixed(2)}€</span> à la
                          cote{" "}
                          <span className="font-mono font-black text-amber-300">{parseFloat(coteLay).toFixed(2)}</span>{" "}
                          sur ton exchange (Betfair, Smarkets, Matchbook).
                        </p>
                        <p>
                          <span className="font-bold text-white">3.</span> Assure-toi d&apos;avoir{" "}
                          <span className="font-mono font-black text-amber-300">
                            {result.liability.toFixed(2)}€
                          </span>{" "}
                          disponibles sur ton compte exchange (liability).
                        </p>
                        <p className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                          <span className="font-bold text-white">👉 Résultat :</span> quel que soit le vainqueur, ta{" "}
                          {result.profitMin >= 0 ? (
                            <>
                              perte maximale est nulle — tu réalises même un{" "}
                              <span className="font-mono font-black text-emerald-300">
                                petit profit de {result.profitMin.toFixed(2)}€
                              </span>
                              .
                            </>
                          ) : (
                            <>
                              perte maximale sera de{" "}
                              <span className="font-mono font-black text-red-300">
                                {Math.abs(result.profitMin).toFixed(2)}€
                              </span>
                              . Cette qualification débloque le bonus bookmaker — le vrai profit se fera sur le freebet
                              obtenu.
                            </>
                          )}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <span className="font-bold text-white">1.</span> Utilise ton freebet de{" "}
                          <span className="font-mono font-black text-emerald-300">
                            {parseFloat(miseBack).toFixed(2)}€
                          </span>{" "}
                          en <span className="font-bold text-cyan-300">Back</span> à la cote{" "}
                          <span className="font-mono font-black text-cyan-300">{parseFloat(coteBack).toFixed(2)}</span>{" "}
                          chez ton bookmaker
                          {result.betType === "freebet_sr" ? " (mise rendue si gagnant)" : ""}.
                        </p>
                        <p>
                          <span className="font-bold text-white">2.</span> Simultanément, place une mise{" "}
                          <span className="font-bold text-amber-300">Lay</span> de{" "}
                          <span className="font-mono font-black text-amber-300">{result.miseLay.toFixed(2)}€</span> à la
                          cote{" "}
                          <span className="font-mono font-black text-amber-300">{parseFloat(coteLay).toFixed(2)}</span>{" "}
                          sur ton exchange (Betfair, Smarkets, Matchbook).
                        </p>
                        <p>
                          <span className="font-bold text-white">3.</span> Assure-toi d&apos;avoir{" "}
                          <span className="font-mono font-black text-amber-300">
                            {result.liability.toFixed(2)}€
                          </span>{" "}
                          disponibles sur ton compte exchange (liability).
                        </p>
                        <p className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                          <span className="font-bold text-white">👉 Résultat :</span> quel que soit le vainqueur, tu
                          extrais un profit garanti de{" "}
                          <span className="font-mono font-black text-emerald-300">
                            {result.profitMin.toFixed(2)}€
                          </span>{" "}
                          <span className="text-white/60">
                            (soit {result.yieldPct.toFixed(1)}% de la valeur du freebet
                            {result.betType === "freebet_sr" ? " — extraction quasi-totale, c'est le top" : ""}).
                          </span>
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <ResultCard label="Mise Lay" value={result.miseLay} suffix="€" color="cyan" icon="🎰" />
                  <ResultCard label="Liability" value={result.liability} suffix="€" color="amber" icon="🏦" />
                  <ResultCard
                    label="Rendement"
                    value={result.yieldPct}
                    suffix="%"
                    color={result.yieldPct >= 0 ? "green" : "red"}
                    icon="📊"
                    showSign
                  />
                </div>

                {/* Détail Back vs Lay */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                      Si Back gagne
                    </p>
                    <p
                      className={`mt-1 font-mono text-xl font-black ${
                        result.profitBack >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {result.profitBack >= 0 ? "+" : ""}
                      {result.profitBack.toFixed(2)}€
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/40">chez le bookmaker</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                      Si Lay gagne
                    </p>
                    <p
                      className={`mt-1 font-mono text-xl font-black ${
                        result.profitLay >= 0 ? "text-cyan-300" : "text-red-300"
                      }`}
                    >
                      {result.profitLay >= 0 ? "+" : ""}
                      {result.profitLay.toFixed(2)}€
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/40">sur l&apos;exchange</p>
                  </div>
                </div>

                {/* Échelle de référence adaptative */}
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 text-center text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                    📏 Échelle de référence {betType === "qualifying" ? "(qualification)" : "(freebet)"}
                  </p>
                  <div className="space-y-1.5">
                    {(betType === "qualifying"
                      ? [
                          { range: "≥ 0%", label: "🏆 Parfait", color: "text-emerald-400", active: result.quality === "excellent" },
                          { range: "−3% → 0%", label: "✅ Très bon", color: "text-emerald-300", active: result.quality === "good" },
                          { range: "−7% → −3%", label: "👍 Acceptable", color: "text-green-400", active: result.quality === "decent" },
                          { range: "−15% → −7%", label: "⚠️ Limite", color: "text-amber-400", active: result.quality === "break_even" },
                          { range: "< −15%", label: "❌ Défavorable", color: "text-red-400", active: result.quality === "losing" },
                        ]
                      : [
                          { range: "≥ 85%", label: "🏆 Excellent", color: "text-emerald-400", active: result.quality === "excellent" },
                          { range: "70% → 85%", label: "✅ Bon", color: "text-emerald-300", active: result.quality === "good" },
                          { range: "50% → 70%", label: "👍 Correct", color: "text-green-400", active: result.quality === "decent" },
                          { range: "30% → 50%", label: "⚠️ Limite", color: "text-amber-400", active: result.quality === "break_even" },
                          { range: "< 30%", label: "❌ Défavorable", color: "text-red-400", active: result.quality === "losing" },
                        ]
                    ).map((level) => (
                      <div
                        key={level.range}
                        className={`flex items-center justify-between rounded-lg px-3 py-1.5 transition ${
                          level.active ? "bg-white/10 ring-1 ring-white/20" : ""
                        }`}
                      >
                        <span className={`text-[11px] font-mono ${level.active ? "text-white" : "text-white/40"}`}>
                          {level.range}
                        </span>
                        <span className={`text-[11px] font-bold ${level.color}`}>{level.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
            <h2 className="mt-2 text-xl font-black text-white">Comprendre le Matched Betting</h2>
            <p className="mt-1 text-xs text-white/40">
              La technique pour extraire les bonus bookmakers en gain garanti
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — C'est quoi */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  💡
                </span>
                <span>C&apos;est quoi le Matched Betting ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Le <strong className="text-emerald-600">Matched Betting</strong> est une technique qui permet d&apos;extraire les bonus bookmakers en <strong>gain mathématiquement garanti</strong>.
                </p>
                <p className="mt-3">
                  Le principe : tu paries <strong>Back</strong> (POUR un résultat) chez le bookmaker, et <strong>Lay</strong> (CONTRE ce même résultat) sur un betting exchange (Betfair, Smarkets, Matchbook). Peu importe qui gagne le match, ton profit est sécurisé.
                </p>
                <div className="mt-3 rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🎯 Exemple rapide</p>
                  <p className="mt-0.5 text-emerald-800">
                    Freebet de 50€ → Back à 4.00 chez le bookie + Lay à 4.20 sur Betfair ={" "}
                    <strong>~34€ garantis</strong>, quel que soit le résultat du match.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 2 — Les 3 types */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  🎲
                </span>
                <span>Les 3 types de paris</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎯 Pari de Qualification</p>
                  <p className="mt-0.5">
                    Premier pari avec <strong>ton propre argent</strong> pour débloquer un bonus.
                    Objectif : <strong className="text-neutral-900">minimiser la perte</strong> (souvent 0 à 2€ sur 50€ misé).
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🎁 Freebet SNR (Stake Not Returned)</p>
                  <p className="mt-0.5">
                    Freebet classique. Si gagné, tu reçois <strong>uniquement les gains</strong> (pas la mise du freebet).
                    Extraction typique : <strong className="text-neutral-900">70-85%</strong> de la valeur du freebet.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">💎 Freebet SR (Stake Returned)</p>
                  <p className="mt-0.5">
                    Freebet rare qui <strong>rend la mise si gagné</strong>. Extraction quasi totale :{" "}
                    <strong className="text-neutral-900">95-100%</strong>. À privilégier en priorité.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 3 — Les formules */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  📐
                </span>
                <span>Les formules utilisées</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>Le calculateur applique les formules standard du matched betting :</p>
                <div className="rounded-xl bg-neutral-900 p-4 font-mono text-xs text-white/80">
                  <p className="font-bold text-emerald-400">Qualification / Freebet SR :</p>
                  <p className="mt-1 pl-3">miseLay = (coteBack × mise) / (coteLay − commLay)</p>
                  <p className="mt-3 font-bold text-emerald-400">Freebet SNR :</p>
                  <p className="mt-1 pl-3">miseLay = ((coteBack − 1) × freebet) / (coteLay − commLay)</p>
                  <p className="mt-3 font-bold text-amber-400">Liability (fonds exchange) :</p>
                  <p className="mt-1 pl-3">miseLay × (coteLay − 1)</p>
                </div>
                <div className="rounded-xl bg-purple-50 p-3">
                  <p className="font-extrabold text-purple-900">💎 Exemple chiffré — Freebet SNR</p>
                  <p className="mt-0.5 text-purple-800">
                    Freebet 50€ • cote Back 4.00 • cote Lay 4.20 • commission Lay 5%
                    <br />→ miseLay = (3 × 50) / 4.15 = <strong>36.14€</strong>
                    <br />→ liability = 36.14 × 3.20 = <strong>115.66€</strong>
                    <br />→ profit garanti ≈ <strong className="text-emerald-700">34.33€</strong> (68.7% du freebet)
                  </p>
                </div>
              </div>
            </details>

            {/* Section 4 — Optimisation */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  🎚️
                </span>
                <span>Comment optimiser le rendement</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">✅ Pari de qualification</p>
                  <p className="mt-0.5 text-emerald-800">
                    Choisis des cotes <strong>proches de 2.00</strong> où cote Back ≈ cote Lay. Plus l&apos;écart est faible, plus la perte est réduite (souvent moins d&apos;1€ sur 50€ misé).
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">🎁 Freebet SNR</p>
                  <p className="mt-0.5 text-emerald-800">
                    Privilégie des cotes <strong>élevées (4.00 - 6.00)</strong>. Plus la cote Back est haute, plus le rendement du freebet est bon (jusqu&apos;à 80-85%).
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🏦 Choix de l&apos;exchange</p>
                  <p className="mt-0.5">
                    Moins de commission = plus de profit. <strong>Smarkets</strong> (2%) et <strong>Matchbook</strong> (1.5%) battent Betfair (5%) — différence de 2-3€ sur un freebet 50€.
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">⚠️ Vérifie toujours la liability</p>
                  <p className="mt-0.5 text-amber-800">
                    La liability est le montant maximum exposé sur l&apos;exchange.{" "}
                    <strong>Assure-toi d&apos;avoir ce montant disponible</strong> avant de valider le pari Lay.
                  </p>
                </div>
              </div>
            </details>

            {/* Section 5 — Conseils pro (dark) */}
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
                    📌 Commence avec des <span className="font-bold text-emerald-400">freebets faibles (10-20€)</span>{" "}
                    pour te familiariser avec le process avant de scaler
                  </p>
                  <p>
                    📌 <span className="font-bold text-white">Tiens un tableau comptable</span> : bonus utilisé, cote Back/Lay, profit extrait, date — essentiel pour la déclaration
                  </p>
                  <p>
                    📌 Les <span className="font-bold text-cyan-400">offres &quot;remboursé si...&quot;</span> sont souvent des SNR déguisés — excellentes opportunités
                  </p>
                  <p>
                    📌 Méfie-toi des <span className="font-bold text-red-400">cotes Lay très hautes</span> : ça augmente mécaniquement la liability
                  </p>
                  <p>
                    📌 Les bookmakers <span className="font-bold text-amber-400">limitent les comptes</span> trop actifs sur les bonus — diversifie tes opérateurs
                  </p>
                  <p>
                    📌 Profite des <span className="font-bold text-emerald-400">gros événements</span> (CdM, Euro, finale CL) : les offres boostées pleuvent
                  </p>
                  <p>
                    📌 Un freebet <span className="font-bold text-white">SR vaut ~3× plus</span> qu&apos;un SNR à valeur égale — priorise-les absolument
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