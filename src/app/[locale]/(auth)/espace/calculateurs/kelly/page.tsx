"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type Mode = "flat" | "kelly";
type KellyFraction = "full" | "half" | "quarter";

interface FlatResult {
  stake: number;
  percentOfCapital: number;
}

interface KellyResult {
  stakePercent: number;      // % de BK à miser (après fraction)
  stake: number;             // Mise en €
  rawKellyPercent: number;   // Kelly brut (sans fraction)
  ev: number;                // Espérance de gain en %
  verdict: "play" | "small" | "no_edge" | "no_play";
  verdictMessage: string;
}

// ═══════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════

function calcFlat(capital: number, percent: number): FlatResult | null {
  if (capital <= 0 || percent <= 0) return null;
  return {
    stake: (capital * percent) / 100,
    percentOfCapital: percent,
  };
}

/**
 * Kelly Criterion :
 * f* = (b * p - q) / b
 *   ou b = cote - 1 (gain net par euro mise)
 *        p = probabilite estimee de gagner (0 a 1)
 *        q = 1 - p (probabilite de perdre)
 *
 * Half Kelly : divise f* par 2, Quarter Kelly : divise f* par 4
 */
function calcKelly(
  capital: number,
  odd: number,
  probPercent: number,
  fraction: KellyFraction
): KellyResult | null {
  if (capital <= 0 || odd <= 1 || probPercent <= 0 || probPercent >= 100) return null;

  const p = probPercent / 100;
  const q = 1 - p;
  const b = odd - 1;

  // Kelly brut (en fraction, 0 à 1)
  const rawKelly = (b * p - q) / b;

  // Fraction
  const divisor = fraction === "full" ? 1 : fraction === "half" ? 2 : 4;
  const kellyFracted = rawKelly / divisor;

  // En %
  const rawKellyPercent = rawKelly * 100;
  const stakePercent = kellyFracted * 100;
  const stake = capital * kellyFracted;

  // Espérance de gain (EV) en % = p * (cote - 1) - q
  const ev = (p * b - q) * 100;

  let verdict: KellyResult["verdict"] = "no_play";
  let verdictMessage = "";

  if (rawKellyPercent <= 0) {
    verdict = "no_edge";
    verdictMessage = "Aucun edge mathématique — ne parie PAS ce pari";
  } else if (rawKellyPercent < 1) {
    verdict = "small";
    verdictMessage = "Edge très faible — mise minimale recommandée";
  } else if (rawKellyPercent > 25) {
    verdict = "play";
    verdictMessage = "Edge fort détecté — mais attention, Half/Quarter Kelly recommandés";
  } else {
    verdict = "play";
    verdictMessage = "Edge solide — mise Kelly optimale pour maximiser croissance";
  }

  return {
    stakePercent,
    stake,
    rawKellyPercent,
    ev,
    verdict,
    verdictMessage,
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
  big = false,
}: {
  label: string;
  value: number;
  suffix: string;
  color: "green" | "red" | "amber" | "neutral" | "emerald_hero";
  icon: string;
  big?: boolean;
}) {
  const bg = {
    green: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
    red: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
    amber: "linear-gradient(135deg, #78350f 0%, #d97706 100%)",
    neutral: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    emerald_hero: "linear-gradient(135deg, #047857 0%, #10b981 50%, #34d399 100%)",
  };
  return (
    <div
      className={`overflow-hidden rounded-2xl text-center shadow-lg ${big ? "p-6" : "p-4"}`}
      style={{ background: bg[color] }}
    >
      <span className={big ? "text-2xl" : "text-lg"}>{icon}</span>
      <p className={`mt-1 font-bold uppercase tracking-[0.2em] text-white/70 ${big ? "text-[10px]" : "text-[9px]"}`}>
        {label}
      </p>
      <p className={`mt-1 font-mono font-black text-white ${big ? "text-4xl" : "text-2xl"}`}>
        {value.toFixed(2)}
        {suffix}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function KellyPage() {
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const [mode, setMode] = useState<Mode>("flat");

  // Flat betting state
  const [flatCapital, setFlatCapital] = useState("1000");
  const [flatPercent, setFlatPercent] = useState("2");

  // Kelly state
  const [kellyCapital, setKellyCapital] = useState("1000");
  const [kellyOdd, setKellyOdd] = useState("");
  const [kellyProb, setKellyProb] = useState("");
  const [kellyFraction, setKellyFraction] = useState<KellyFraction>("half");

  function resetAll() {
    setFlatCapital("1000");
    setFlatPercent("2");
    setKellyCapital("1000");
    setKellyOdd("");
    setKellyProb("");
    setKellyFraction("half");
  }

  const flatResult = useMemo((): FlatResult | null => {
    const c = parseFloat(flatCapital);
    const p = parseFloat(flatPercent);
    if (!c || !p) return null;
    return calcFlat(c, p);
  }, [flatCapital, flatPercent]);

  const kellyResult = useMemo((): KellyResult | null => {
    const c = parseFloat(kellyCapital);
    const o = parseFloat(kellyOdd);
    const p = parseFloat(kellyProb);
    if (!c || !o || !p) return null;
    return calcKelly(c, o, p, kellyFraction);
  }, [kellyCapital, kellyOdd, kellyProb, kellyFraction]);

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
      <EspaceHero title="Mise % du capital" />

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
            {/* Mode selector */}
            <p className="mb-3 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
              🧠 Stratégie de mise
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("flat")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-3 text-xs font-bold transition-all ${
                  mode === "flat"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                📐 Flat Betting
              </button>
              <button
                onClick={() => setMode("kelly")}
                className={`flex-1 cursor-pointer rounded-xl px-4 py-3 text-xs font-bold transition-all ${
                  mode === "kelly"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                🧠 Kelly Criterion
              </button>
            </div>

            <p className="mt-3 text-center text-[11px] font-medium text-white/30">
              {mode === "flat"
                ? "Mise fixe en % du capital, identique à chaque pari"
                : "Mise optimale selon l'edge mathématique de chaque pari"}
            </p>

            {/* Divider */}
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FLAT BETTING MODE */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {mode === "flat" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {/* Mise en % */}
                  <div
                    className="rounded-2xl border border-white/10 p-4"
                    style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
                  >
                    <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                      📐 Mise en %
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="100"
                        value={flatPercent}
                        onChange={(e) => setFlatPercent(e.target.value)}
                        placeholder="2"
                        inputMode="decimal"
                        className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-3 pr-8 text-center font-mono text-xl font-black text-emerald-300 placeholder-emerald-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-emerald-400">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Capital */}
                  <div
                    className="rounded-2xl border border-white/10 p-4"
                    style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1e3d 100%)" }}
                  >
                    <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                      🏦 Capital (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={flatCapital}
                      onChange={(e) => setFlatCapital(e.target.value)}
                      placeholder="1000"
                      inputMode="decimal"
                      className="w-full rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-center font-mono text-xl font-black text-cyan-300 placeholder-cyan-700 outline-none transition-all focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                    />
                  </div>
                </div>

                {/* Preset buttons */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Presets :</span>
                  {[
                    { val: "1", label: "Ultra prudent" },
                    { val: "2", label: "Standard" },
                    { val: "3", label: "Modéré" },
                    { val: "5", label: "Agressif" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      onClick={() => setFlatPercent(p.val)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                        flatPercent === p.val
                          ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500"
                          : "bg-white/5 text-white/40 hover:bg-white/10"
                      }`}
                    >
                      {p.val}% <span className="opacity-60">({p.label})</span>
                    </button>
                  ))}
                </div>

                {flatResult && (
                  <>
                    <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
                    <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                      💎 Mise à placer
                    </p>
                    <ResultCard
                      label="Mise recommandée"
                      value={flatResult.stake}
                      suffix="€"
                      color="emerald_hero"
                      icon="🎯"
                      big
                    />
                    <p className="mt-3 text-center text-[11px] italic text-white/40">
                      Soit {flatResult.percentOfCapital}% de ton capital de {parseFloat(flatCapital).toFixed(2)}€
                    </p>
                  </>
                )}
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* KELLY MODE */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {mode === "kelly" && (
              <>
                {/* Kelly fraction selector */}
                <div className="mb-4 rounded-xl bg-white/5 px-4 py-3">
                  <p className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-white/40">
                    Fraction Kelly
                  </p>
                  <div className="flex gap-2">
                    {[
                      { id: "full" as const, label: "Full Kelly", sub: "Max agressif" },
                      { id: "half" as const, label: "Half Kelly", sub: "Recommandé" },
                      { id: "quarter" as const, label: "Quarter Kelly", sub: "Ultra safe" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setKellyFraction(f.id)}
                        className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-center transition-all ${
                          kellyFraction === f.id
                            ? "bg-emerald-500/30 text-emerald-300 ring-2 ring-emerald-500"
                            : "bg-white/5 text-white/40 hover:bg-white/10"
                        }`}
                      >
                        <p className="text-[11px] font-bold">{f.label}</p>
                        <p className="text-[9px] opacity-70">{f.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Capital */}
                  <div
                    className="rounded-2xl border border-white/10 p-4"
                    style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1e3d 100%)" }}
                  >
                    <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-cyan-400">
                      🏦 Capital (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={kellyCapital}
                      onChange={(e) => setKellyCapital(e.target.value)}
                      placeholder="1000"
                      inputMode="decimal"
                      className="w-full rounded-xl border-2 border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-center font-mono text-lg font-black text-cyan-300 placeholder-cyan-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Cote */}
                    <div
                      className="rounded-2xl border border-white/10 p-4"
                      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
                    >
                      <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-400">
                        🎯 Cote
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="1.001"
                        value={kellyOdd}
                        onChange={(e) => setKellyOdd(e.target.value)}
                        placeholder="2.000"
                        inputMode="decimal"
                        className="w-full rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-center font-mono text-lg font-black text-emerald-300 placeholder-emerald-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20"
                      />
                    </div>

                    {/* Probabilité estimée */}
                    <div
                      className="rounded-2xl border border-white/10 p-4"
                      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #3b0764 100%)" }}
                    >
                      <label className="mb-2 block text-center text-[10px] font-extrabold uppercase tracking-[0.15em] text-purple-400">
                        📊 Ta proba (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="99.9"
                          value={kellyProb}
                          onChange={(e) => setKellyProb(e.target.value)}
                          placeholder="55"
                          inputMode="decimal"
                          className="w-full rounded-xl border-2 border-purple-500/30 bg-purple-500/10 px-3 py-3 pr-8 text-center font-mono text-lg font-black text-purple-300 placeholder-purple-700 outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-500/20"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-purple-400">
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-[10px] italic text-white/30">
                    💡 Ta proba = ton estimation personnelle de la chance de gagner ce pari
                  </p>
                </div>

                {/* Results */}
                {kellyResult && (
                  <>
                    <div className="my-6 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                    {kellyResult.verdict === "no_edge" ? (
                      <div
                        className="rounded-2xl px-6 py-5 text-center shadow-xl"
                        style={{ background: "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)" }}
                      >
                        <p className="text-2xl font-black text-white">❌ PAS D&apos;EDGE</p>
                        <p className="mt-2 text-xs font-semibold text-white/80">
                          {kellyResult.verdictMessage}
                        </p>
                        <p className="mt-3 text-[11px] text-white/70">
                          EV = {kellyResult.ev.toFixed(2)}% — ta proba est trop faible par rapport à la cote
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="mb-4 text-center text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                          💎 Mise Kelly optimale
                        </p>
                        <ResultCard
                          label={`Mise (${kellyFraction === "full" ? "Full" : kellyFraction === "half" ? "Half" : "Quarter"} Kelly)`}
                          value={kellyResult.stake}
                          suffix="€"
                          color="emerald_hero"
                          icon="🧠"
                          big
                        />

                        <div className="mt-4 grid grid-cols-3 gap-3">
                          <ResultCard
                            label="% du capital"
                            value={kellyResult.stakePercent}
                            suffix="%"
                            color="neutral"
                            icon="📊"
                          />
                          <ResultCard
                            label="Kelly brut"
                            value={kellyResult.rawKellyPercent}
                            suffix="%"
                            color={kellyResult.rawKellyPercent > 25 ? "amber" : "neutral"}
                            icon="📐"
                          />
                          <ResultCard
                            label="EV"
                            value={kellyResult.ev}
                            suffix="%"
                            color={kellyResult.ev >= 0 ? "green" : "red"}
                            icon="💰"
                          />
                        </div>

                        <div
                          className={`mt-4 rounded-xl px-4 py-3 text-center ${
                            kellyResult.verdict === "small"
                              ? "bg-amber-500/10 ring-1 ring-amber-500/30"
                              : "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                          }`}
                        >
                          <p
                            className={`text-xs font-bold ${
                              kellyResult.verdict === "small" ? "text-amber-400" : "text-emerald-400"
                            }`}
                          >
                            {kellyResult.verdict === "small" ? "⚠️" : "✅"} {kellyResult.verdictMessage}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* Reset button */}
            <div className="mt-6 text-center">
              <button
                onClick={resetAll}
                className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:bg-white/10 hover:text-white/70"
              >
                🔄 Réinitialiser
              </button>
            </div>
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
            <h2 className="mt-2 text-xl font-black text-white">Money management</h2>
            <p className="mt-1 text-xs text-white/40">
              Flat betting vs Kelly — trouver la mise optimale selon ta stratégie
            </p>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            {/* Section 1 — Pourquoi c'est important */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">
                  💰
                </span>
                <span>Pourquoi gérer ta mise ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  La <strong className="text-neutral-900">gestion de bankroll</strong> est ce qui sépare les parieurs pros des amateurs. Peu importe ta stratégie, si tu gères mal tes mises, tu finiras à zéro.
                </p>
                <p className="mt-3">
                  Le principe fondamental : <strong className="text-emerald-600">ne jamais miser un % trop élevé de ta bankroll</strong> sur un seul pari. Même avec un ROI positif, la variance peut te mettre à terre si tu mises trop gros.
                </p>
                <p className="mt-3">
                  Deux approches principales :
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>
                    <strong className="text-neutral-900">Flat Betting</strong> : mise fixe en % (ex: 2% toujours). Simple et robuste.
                  </li>
                  <li>
                    <strong className="text-neutral-900">Kelly</strong> : mise variable selon l&apos;edge. Mathématiquement optimal mais plus volatil.
                  </li>
                </ul>
              </div>
            </details>

            {/* Section 2 — Flat Betting */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-blue-300 open:shadow-lg open:shadow-blue-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-base">
                  📐
                </span>
                <span>Flat Betting — simple et efficace</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Miser <strong className="text-neutral-900">un % fixe de ta bankroll</strong> à chaque pari, peu importe la cote ou la confiance.
                </p>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">Avantages</p>
                  <p className="mt-0.5">
                    ✓ Simple à appliquer<br />
                    ✓ Résilient aux mauvaises séries<br />
                    ✓ Impossible de griller sa BK en un jour<br />
                    ✓ Idéal quand tu ne connais pas tes probas avec précision
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
                  <p className="font-bold">📊 Benchmarks</p>
                  <div className="mt-1 space-y-1 text-xs">
                    <p>→ <strong>1% de BK</strong> : ultra prudent (amateur débutant)</p>
                    <p>→ <strong>2% de BK</strong> : standard recommandé (Pinnacle, Unibet)</p>
                    <p>→ <strong>3% de BK</strong> : modéré (parieur confirmé)</p>
                    <p>→ <strong>5% de BK</strong> : agressif (risque élevé)</p>
                    <p>→ <strong>&gt; 10% de BK</strong> : imprudent, tu vas griller ta BK</p>
                  </div>
                </div>
                <p className="mt-2 text-xs italic">
                  Avec 2% de BK, il faut 50 pertes consécutives pour tout perdre. Très improbable même en phase froide.
                </p>
              </div>
            </details>

            {/* Section 3 — Kelly Criterion */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-purple-300 open:shadow-lg open:shadow-purple-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-base">
                  🧠
                </span>
                <span>Kelly Criterion — optimal mathématiquement</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <p>
                  Le <strong className="text-emerald-600">Kelly Criterion</strong> est une formule mathématique qui calcule la mise <strong>optimale</strong> pour maximiser la croissance de ta bankroll sur le long terme.
                </p>
                <div className="rounded-xl bg-neutral-50 p-4 text-center font-mono">
                  <p className="text-sm font-bold text-neutral-900">f* = (b × p - q) / b</p>
                  <div className="mt-2 text-xs text-neutral-500">
                    <p>b = cote - 1 (gain net)</p>
                    <p>p = ta proba estimée</p>
                    <p>q = 1 - p</p>
                  </div>
                </div>
                <p>
                  <strong className="text-neutral-900">Exemple concret :</strong> cote 2.00, tu estimes 55% de chance de gagner.
                </p>
                <div className="rounded-xl bg-emerald-50 p-3 font-mono text-xs text-emerald-800">
                  <p>b = 2.00 - 1 = 1.00</p>
                  <p>p = 0.55, q = 0.45</p>
                  <p>f* = (1 × 0.55 - 0.45) / 1 = 0.10 = 10%</p>
                  <p className="mt-1 font-bold">→ Full Kelly = mise 10% de la BK</p>
                </div>
                <p className="mt-2">
                  Mais Full Kelly est <strong className="text-red-600">extrêmement volatil</strong>. Les pros utilisent quasi toujours Half Kelly ou Quarter Kelly.
                </p>
              </div>
            </details>

            {/* Section 4 — Pourquoi Half Kelly */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-amber-300 open:shadow-lg open:shadow-amber-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-base">
                  ⚖️
                </span>
                <span>Full, Half, Quarter Kelly — quelle différence ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-extrabold text-red-900">🔥 Full Kelly (f*)</p>
                  <p className="mt-0.5 text-red-800">
                    Croissance maximale théorique MAIS variance énorme. Une estimation de proba un peu fausse et tu peux ruiner ta BK. Déconseillé en pratique.
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="font-extrabold text-emerald-900">⚖️ Half Kelly (f*/2) — RECOMMANDÉ</p>
                  <p className="mt-0.5 text-emerald-800">
                    75% de la croissance du Full Kelly avec seulement 50% de la variance. Le meilleur compromis en pratique. Utilisé par les pros.
                  </p>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🛡️ Quarter Kelly (f*/4)</p>
                  <p className="mt-0.5">
                    Ultra prudent. Croissance plus lente mais variance très faible. Idéal si tu n&apos;es pas sûr de tes probas estimées.
                  </p>
                </div>
                <p className="mt-2 text-xs italic">
                  Règle d&apos;or : en paris sportifs, tes probas estimées ont toujours une marge d&apos;erreur. Half ou Quarter Kelly compensent cette imprécision.
                </p>
              </div>
            </details>

            {/* Section 5 — Flat vs Kelly */}
            <details className="group rounded-2xl border-2 border-neutral-200 transition-all open:border-cyan-300 open:shadow-lg open:shadow-cyan-50">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-base">
                  🔀
                </span>
                <span>Flat ou Kelly — que choisir ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="space-y-3 border-t border-neutral-100 px-5 py-4 text-sm text-neutral-600">
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">📐 Utilise Flat si...</p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    <li>Tu débutes ou es parieur récréatif</li>
                    <li>Tu suis des pronostiqueurs (pas tes probas à toi)</li>
                    <li>Tu ne sais pas estimer des probabilités précises</li>
                    <li>Tu veux de la simplicité avant tout</li>
                  </ul>
                </div>
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-extrabold text-neutral-900">🧠 Utilise Kelly si...</p>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    <li>Tu es parieur avancé avec une méthode rigoureuse</li>
                    <li>Tu fais du value betting (tes probas vs bookmaker)</li>
                    <li>Tu veux maximiser la croissance de ta BK</li>
                    <li>Tu acceptes plus de volatilité court terme</li>
                  </ul>
                </div>
              </div>
            </details>

            {/* Section 6 — Conseils pro */}
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
                    📌 Limite chaque mise à <span className="font-bold text-emerald-400">max 5% de BK</span>, même en Kelly
                  </p>
                  <p>
                    📌 <span className="font-bold text-white">Recalcule ta BK mensuellement</span> — tes mises évoluent avec
                  </p>
                  <p>
                    📌 <span className="font-bold text-emerald-400">Half Kelly</span> est quasi toujours le meilleur choix
                  </p>
                  <p>
                    📌 Tes probas estimées sont <span className="font-bold text-red-400">TOUJOURS imprécises</span> — fractionne Kelly
                  </p>
                  <p>
                    📌 Sur les cotes hautes (&gt;4.00), Full Kelly devient <span className="font-bold text-red-400">très risqué</span>
                  </p>
                  <p>
                    📌 Débutants : <span className="font-bold text-emerald-400">2% flat</span> est parfait pendant 6+ mois
                  </p>
                  <p>
                    📌 Ne mélange pas BK paris et argent personnel : <span className="font-bold text-white">séparation stricte</span>
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