"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";
import { useLocale } from "next-intl";

// ═══════════════════════════════════════════════════════════════
// 10 CALCULATEURS
// ═══════════════════════════════════════════════════════════════

const CALCULATORS = [
  {
    slug: "value-bet",
    icon: "🎯",
    title: "Value Bet",
    desc: "Détecter les value bets via PS3838 (Pinnacle). TRJ, Fair Odd, EV sur 8 marchés.",
    status: "ready",
  },
  {
    slug: "dutching",
    icon: "♻️",
    title: "Dutching",
    desc: "Répartir sa mise sur N issues pour garantir un gain identique.",
    status: "ready",
  },
  {
    slug: "surebet",
    icon: "🔒",
    title: "Surebet (Arbitrage)",
    desc: "Détecter les arbitrages entre 2 ou 3 bookmakers.",
    status: "ready",
  },
  {
    slug: "repartiteur-mises",
    icon: "📊",
    title: "Répartiteur de mises",
    desc: "Couvrir un pari remboursé ou sécuriser avec une Double Chance.",
    status: "ready",
  },
  {
    slug: "cote-live-couvrir",
    icon: "🛡️",
    title: "Cote live pour couvrir",
    desc: "Hedging live : sécuriser un pari pré-match avec une mise en direct.",
    status: "ready",
  },
  {
    slug: "probabilites-cotes",
    icon: "🎲",
    title: "Probabilités des cotes",
    desc: "Cote → probabilité implicite + réelle + TRJ + marge bookmaker.",
    status: "ready",
  },
  {
    slug: "benefice-acquerir",
    icon: "💰",
    title: "Bénéfice à acquérir",
    desc: "Gain cible + cote → mise exacte à placer.",
    status: "ready",
  },
  {
    slug: "roi",
    icon: "📈",
    title: "ROI %",
    desc: "Rendement de tes paris avec échelle de référence (Excellent → Perdant).",
    status: "ready",
  },
  {
    slug: "kelly",
    icon: "🧠",
    title: "Mise % du capital (Kelly)",
    desc: "Kelly Criterion — Full / Half / Quarter selon aversion au risque.",
    status: "soon",
  },
  {
    slug: "trj",
    icon: "⚖️",
    title: "TRJ (Taux de Retour)",
    desc: "Taux de retour joueur → marge du bookmaker.",
    status: "soon",
  },
] as const;

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export default function CalculateursLandingPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  if (!isPremium) {
    return (
      <>
        <EspaceHero title="Accès réservé" />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-4xl">🔒</p>
          <p className="mt-4 text-sm font-bold text-neutral-500">
            Les calculateurs sont réservés aux abonnés Premium.
          </p>
          <Link
            href={`/${locale}/premium`}
            className="mt-6 inline-block rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600"
          >
            Devenir Premium
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <EspaceHero title="Calculateurs" />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        {/* Intro */}
        <div className="mb-8 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-600">
            🧮 Boîte à outils Premium
          </p>
          <h2 className="mt-2 text-2xl font-black text-neutral-900">
            10 calculateurs pour affiner tes paris
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Toutes les maths dont tu as besoin, sans quitter PRONOS.CLUB
          </p>
        </div>

        {/* Grid 10 cartes */}
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CALCULATORS.map((calc) => {
            const isReady = calc.status === "ready";

            const cardContent = (
              <div
                className={`relative h-full overflow-hidden rounded-2xl border border-white/[0.06] p-5 transition ${
                  isReady ? "hover:-translate-y-0.5 hover:shadow-xl" : "opacity-75"
                }`}
                style={{
                  background: "linear-gradient(135deg, #0a0a0a 0%, #0d1f17 50%, #0a0a0a 100%)",
                }}
              >
                {/* Accent bar */}
                <div
                  className="absolute inset-x-0 top-0 h-0.5"
                  style={{
                    background: isReady
                      ? "linear-gradient(90deg, #059669, #10b981, #34d399, #10b981, #059669)"
                      : "linear-gradient(90deg, #525252, #737373, #525252)",
                  }}
                />

                {/* Badge status */}
                {!isReady && (
                  <span className="absolute right-3 top-3 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-400">
                    Bientôt
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/5 text-xl">
                    {calc.icon}
                  </span>
                  <h3 className="text-sm font-black text-white">{calc.title}</h3>
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-white/50">{calc.desc}</p>

                {/* CTA */}
                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-[0.15em] ${
                      isReady ? "text-emerald-400" : "text-white/30"
                    }`}
                  >
                    {isReady ? "Ouvrir →" : "En préparation"}
                  </span>
                </div>
              </div>
            );

            return isReady ? (
              <Link key={calc.slug} href={`/${locale}/espace/calculateurs/${calc.slug}`}>
                {cardContent}
              </Link>
            ) : (
              <div key={calc.slug} className="cursor-not-allowed">
                {cardContent}
              </div>
            );
          })}
        </div>

        {/* Back to dashboard */}
        <div className="mt-10 text-center">
          <Link
            href={`/${locale}/espace`}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-5 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50"
          >
            ← Retour à l&apos;espace
          </Link>
        </div>
      </main>
    </>
  );
}