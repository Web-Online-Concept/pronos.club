// src/app/[locale]/pronos-abonnes/page.tsx
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
      color: "emerald",
    },
    {
      href: `/${locale}/pronos-abonnes/historique`,
      icon: "📋",
      title: "Historique",
      desc: "Tous les pronostics résolus, filtrables par sport et tipster.",
      color: "blue",
    },
    {
      href: `/${locale}/pronos-abonnes/classement`,
      icon: "🏆",
      title: "Classement",
      desc: "Le top des tipsters sur la semaine, le mois ou all-time.",
      color: "amber",
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
            Les abonnés premium postent leurs pronostics, la communauté vote avec ses unités.
            Découvre les meilleurs tipsters, suis leurs picks, et rejoins la compétition.
          </p>
        </div>
      </div>

      {/* 3 cards de navigation */}
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 text-center transition hover:-translate-y-1 hover:border-emerald-500 hover:shadow-xl"
            >
              <div className="mb-3 text-5xl">{card.icon}</div>
              <h3 className="text-lg font-extrabold text-neutral-900">{card.title}</h3>
              <p className="mt-2 text-sm text-neutral-500">{card.desc}</p>
            </Link>
          ))}
        </div>

        {/* Fonctionnement */}
        <div className="mt-16">
          <div
            className="rounded-t-3xl px-6 py-5 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
              📚 Guide
            </p>
            <h2 className="mt-2 text-xl font-black text-white">Comment ça marche</h2>
          </div>

          <div className="space-y-4 rounded-b-3xl border-x-2 border-b-2 border-neutral-200 bg-white px-5 py-6 sm:px-8">
            <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300" open>
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">🎯</span>
                <span>C&apos;est quoi, les Pronos Abonnés ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Un espace communautaire où <strong className="text-emerald-600">les abonnés premium</strong> postent leurs propres pronostics sportifs.
                  Chaque prono affiche un screen du pari, la cote, et le sport. La communauté suit, compare,
                  et s&apos;inspire des meilleurs tipsters.
                </p>
              </div>
            </details>

            <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">📊</span>
                <span>Comment se calculent les statistiques ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  On part du principe que <strong className="text-emerald-600">chaque pronostic = 1 unité (1U)</strong> misée.
                  C&apos;est une convention qui permet de comparer les tipsters équitablement, peu importe leur bankroll.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs font-bold text-emerald-700">Gagné à @2.00</p>
                    <p className="text-sm font-extrabold text-emerald-700">+1.00 U</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs font-bold text-emerald-700">½ Gagné à @2.00</p>
                    <p className="text-sm font-extrabold text-emerald-700">+0.50 U</p>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-3">
                    <p className="text-xs font-bold text-blue-700">Remboursé</p>
                    <p className="text-sm font-extrabold text-blue-700">0 U</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3">
                    <p className="text-xs font-bold text-red-700">½ Perdu</p>
                    <p className="text-sm font-extrabold text-red-700">-0.50 U</p>
                  </div>
                  <div className="rounded-lg bg-red-50 p-3 sm:col-span-2">
                    <p className="text-xs font-bold text-red-700">Perdu</p>
                    <p className="text-sm font-extrabold text-red-700">-1.00 U</p>
                  </div>
                </div>
              </div>
            </details>

            <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">📸</span>
                <span>Comment poster un pronostic ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Depuis ton espace premium, rends-toi sur <strong className="text-emerald-600">Mon Tipster</strong>.
                  Tu uploades un screen de ton ticket, tu indiques la date/heure du premier match,
                  le sport, la cote totale, et le type (simple ou combiné).
                </p>
                <p className="mt-3">
                  <strong className="text-neutral-900">Limites :</strong> 3 pronostics par jour maximum,
                  et le match doit commencer dans au moins 5 minutes après publication.
                </p>
              </div>
            </details>

            <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">🏆</span>
                <span>Comment fonctionne le classement ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Le classement est calculé <strong className="text-emerald-600">sur 3 périodes</strong> :
                  cette semaine, ce mois (30 derniers jours glissants), all-time.
                </p>
                <p className="mt-3">
                  Plusieurs critères sont affichés : <strong>Total U</strong> (cumul des unités),
                  <strong> ROI</strong> (rendement moyen par pari), <strong>Winrate</strong>,
                  <strong> Cote moyenne</strong>, et la <strong>forme</strong> sur les 5 derniers pronos.
                </p>
              </div>
            </details>

            <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300">
              <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-base">⚠️</span>
                <span>Qui valide les résultats ?</span>
                <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
                <p>
                  Les résultats sont <strong className="text-emerald-600">validés manuellement</strong> par l&apos;équipe PRONOS.CLUB
                  après vérification du screen et du score final. Cela garantit la fiabilité des statistiques et la
                  confiance dans le classement.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </main>
  );
}