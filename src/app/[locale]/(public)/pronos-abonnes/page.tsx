// src/app/[locale]/(public)/pronos-abonnes/page.tsx
"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

export default function PronosAbonnesLanding() {
  const locale = useLocale();

  const cards = [
    {
      href: `/${locale}/pronos-abonnes/en-cours`,
      icon: "🎯",
      title: "Pronos en cours",
      desc: "Découvre les pronostics postés par la communauté, triés par heure de match.",
    },
    {
      href: `/${locale}/pronos-abonnes/historique`,
      icon: "📋",
      title: "Historique",
      desc: "Tous les pronostics résolus, filtrables par sport et résultat.",
    },
    {
      href: `/${locale}/pronos-abonnes/classement`,
      icon: "🏆",
      title: "Classement",
      desc: "Le top des tipsters sur la semaine, le mois ou all-time.",
    },
    {
      href: `/${locale}/pronos-abonnes/concours`,
      icon: "💰",
      title: "Concours & Gains",
      desc: "10€ au meilleur tipster de la semaine, 40€ au meilleur du mois.",
      highlight: true,
    },
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="px-4 py-16 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            Communauté PRONOS.CLUB
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Pronos Abonnés</h1>
          <p className="mt-4 text-base text-white/70">
            Les abonnés premium postent leurs pronostics. Les meilleurs remportent des <strong className="text-amber-400">gains en cash</strong> chaque semaine et chaque mois.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <div className="rounded-xl bg-white/5 border border-emerald-500/30 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">🏆 Semaine</p>
              <p className="mt-1 text-2xl font-black text-white">10 €</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-amber-500/30 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">👑 Mois</p>
              <p className="mt-1 text-2xl font-black text-white">40 €</p>
            </div>
          </div>
          <Link
            href={`/${locale}/pronos-abonnes/fonctionnement`}
            className="mt-6 inline-block text-xs font-bold text-white/60 hover:text-emerald-400 underline"
          >
            📚 Comment ça marche ?
          </Link>
        </div>
      </div>

      {/* 4 cards de navigation */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group relative overflow-hidden rounded-2xl border-2 bg-white p-6 text-center transition hover:-translate-y-1 hover:shadow-xl ${
                card.highlight
                  ? "border-amber-300 hover:border-amber-500 bg-gradient-to-br from-amber-50 to-white"
                  : "border-neutral-200 hover:border-emerald-500"
              }`}
            >
              <div className="mb-3 text-5xl">{card.icon}</div>
              <h3 className={`text-lg font-extrabold ${card.highlight ? "text-amber-900" : "text-neutral-900"}`}>
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-500">{card.desc}</p>
            </Link>
          ))}
        </div>

        {/* Section gains commercial */}
        <div className="mt-12 rounded-3xl bg-gradient-to-br from-emerald-50 via-amber-50 to-white border-2 border-amber-200 p-8 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-amber-700">
            💰 Concours mensuel
          </p>
          <h2 className="mt-2 text-2xl font-black text-neutral-900 sm:text-3xl">
            Deviens le meilleur et gagne du cash
          </h2>
          <p className="mt-3 text-sm text-neutral-600 max-w-xl mx-auto">
            Chaque semaine, <strong className="text-emerald-700">10€ offerts</strong> au tipster qui a fait le meilleur total d&apos;unités.
            Et chaque mois, <strong className="text-amber-700">40€ pour le champion</strong>. Versements par PayPal.
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="rounded-xl bg-white border-2 border-emerald-300 p-4">
              <div className="text-3xl">🏆</div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-emerald-700">Semaine</p>
              <p className="text-3xl font-black text-emerald-600">10 €</p>
              <p className="mt-1 text-[11px] text-neutral-500">Min. 3 picks · Lundi 00h → Dimanche 23h59</p>
            </div>
            <div className="rounded-xl bg-white border-2 border-amber-300 p-4">
              <div className="text-3xl">👑</div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-700">Mois</p>
              <p className="text-3xl font-black text-amber-600">40 €</p>
              <p className="mt-1 text-[11px] text-neutral-500">Min. 10 picks · Du 1er au dernier jour</p>
            </div>
          </div>
          <Link
            href={`/${locale}/pronos-abonnes/concours`}
            className="mt-6 inline-block rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-600/25 transition hover:bg-amber-500"
          >
            🏆 Voir le concours en cours
          </Link>
        </div>

        {/* Guide résumé */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-black text-neutral-900">Tu veux participer ?</h2>
          <p className="mt-3 text-sm text-neutral-600 max-w-xl mx-auto">
            Passe Premium, rends-toi dans <strong className="text-emerald-600">Mon espace → Pronos Abonnés</strong>, et poste ton premier pronostic.
            Chaque pronostic = 1 unité universelle, comparable entre tous les tipsters.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/pronos-abonnes/fonctionnement`}
              className="rounded-xl border-2 border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-700 transition hover:border-emerald-500"
            >
              📚 Le guide complet
            </Link>
            <Link
              href={`/${locale}/abonnement`}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
            >
              💎 Devenir Premium
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}