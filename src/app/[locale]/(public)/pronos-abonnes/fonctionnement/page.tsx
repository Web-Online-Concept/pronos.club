// src/app/[locale]/(public)/pronos-abonnes/fonctionnement/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import PronosAbonnesNav from "@/components/tipster/PronosAbonnesNav";

type Config = {
  week: { prize_amount: number; min_picks: number; active: boolean };
  month: { prize_amount: number; min_picks: number; active: boolean };
};

export default function FonctionnementPage() {
  const locale = useLocale();
  const [config, setConfig] = useState<Config>({
    week: { prize_amount: 10, min_picks: 3, active: true },
    month: { prize_amount: 40, min_picks: 10, active: true },
  });

  useEffect(() => {
    fetch("/api/tipster-concours-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.week && data.month) setConfig(data);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div
        className="px-4 py-10 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            📚 Guide complet
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Comment ça marche</h1>
          <p className="mt-3 text-base text-white/70">
            Tout ce que tu dois savoir sur les Pronos Abonnés
          </p>
        </div>
      </div>

      <PronosAbonnesNav active="fonctionnement" locale={locale} />

      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-4">

          {/* 1 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50" open>
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">🎯</span>
              <span>C&apos;est quoi, les Pronos Abonnés ?</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>
                Un espace communautaire où <strong className="text-emerald-600">les abonnés premium</strong> postent leurs propres pronostics sportifs.
                Chaque pronostic affiche un screen du pari, la cote, et le sport.
              </p>
              <p className="mt-3">
                La communauté suit les tipsters, s&apos;inspire des meilleurs, et les plus performants gagnent
                des <strong className="text-amber-600">gains en cash</strong> chaque semaine et chaque mois.
              </p>
            </div>
          </details>

          {/* 2 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">📸</span>
              <span>Comment poster un pronostic ?</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>
                Depuis ton espace premium, rends-toi sur <strong className="text-emerald-600">Pronos Abonnés</strong>,
                puis clique sur <strong>+ Nouveau pronostic</strong>.
              </p>
              <ol className="mt-3 space-y-2 pl-5 list-decimal">
                <li>Uploade un <strong>screen de ton ticket</strong> (JPG, PNG, WEBP, max 5 Mo)</li>
                <li>Choisis le <strong>sport</strong></li>
                <li>Indique la <strong>date et l&apos;heure du 1er match</strong></li>
                <li>Renseigne la <strong>cote totale</strong> (max 5.00)</li>
                <li>Précise si c&apos;est un <strong>simple ou combiné</strong></li>
                <li>Sélectionne le <strong>bookmaker</strong> où tu as pris le pari</li>
                <li>Clique sur <strong>Publier</strong> — et c&apos;est parti !</li>
              </ol>
            </div>
          </details>

          {/* 3 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">📊</span>
              <span>Comment se calculent les unités ?</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>
                Chaque pronostic équivaut à <strong className="text-emerald-600">1 unité (1U)</strong> misée,
                peu importe ta bankroll réelle. C&apos;est la convention pour comparer équitablement tous les tipsters.
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="font-bold text-emerald-800">✓ Gagné</span>
                  <span className="font-extrabold text-emerald-800">+(cote - 1) U</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-emerald-50/50 px-3 py-2">
                  <span className="font-bold text-emerald-700">½ Gagné</span>
                  <span className="font-extrabold text-emerald-700">+(cote - 1)/2 U</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
                  <span className="font-bold text-blue-800">↻ Remboursé</span>
                  <span className="font-extrabold text-blue-800">0 U</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50/50 px-3 py-2">
                  <span className="font-bold text-red-700">½ Perdu</span>
                  <span className="font-extrabold text-red-700">-0.5 U</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <span className="font-bold text-red-800">✗ Perdu</span>
                  <span className="font-extrabold text-red-800">-1 U</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                <strong>Exemple :</strong> Un pronostic @2.00 gagné rapporte +1U. Un pronostic @3.50 gagné à moitié rapporte +1.25U.
              </p>
            </div>
          </details>

          {/* 4 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">⚠️</span>
              <span>Quelles sont les limites et règles ?</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">3 pronostics par jour maximum</p>
                    <p className="text-xs mt-1">Pour forcer la sélectivité et la qualité. Ça évite aussi le spam.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">Cote maximum : 5.00</p>
                    <p className="text-xs mt-1">On reste sérieux — pas de combinés à 25 sélections ou de cotes à 1500. PRONOS.CLUB c&apos;est le pari pro.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">⏰</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">Match dans au moins 30 minutes</p>
                    <p className="text-xs mt-1">Tu ne peux pas poster sur un match qui commence dans moins de 30 min. Ça laisse le temps aux suiveurs de prendre le pari à la même cote.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">🏦</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">Bookmaker obligatoire</p>
                    <p className="text-xs mt-1">Tu dois préciser le bookmaker où tu as pris ton pari (Winamax, Betclic, Unibet, PMU, etc.). Ça permet aux suiveurs de retrouver la même cote au même endroit.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
                  <span className="text-xl">🚫</span>
                  <div>
                    <p className="font-extrabold text-red-900">Cotes boostées interdites</p>
                    <p className="text-xs mt-1">Les pronostics sur des <strong>cotes boostées</strong> (Super Boost, Mega Boost, etc.) ne sont <strong>pas autorisés</strong> car ces offres sont très <strong>limitées en mises</strong> chez les bookmakers (souvent 5€ à 20€ max). Un tipster ne peut pas mettre +XXXU là-dessus — joue uniquement sur des cotes standards accessibles à tous.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <span className="text-xl">🔒</span>
                  <div>
                    <p className="font-extrabold text-amber-900">Modification et suppression : 10 minutes</p>
                    <p className="text-xs mt-1">Tu peux supprimer ton pronostic dans les <strong>10 minutes</strong> après publication (pour corriger un mauvais screen, une faute de cote, etc.). Au-delà, il est <strong>verrouillé définitivement</strong> — c&apos;est une règle d&apos;intégrité pour respecter les tipsters qui te suivent. Si tu as besoin d&apos;une correction au-delà, contacte-nous à <a href="mailto:contact@pronos.club" className="font-bold underline">contact@pronos.club</a>.</p>
                  </div>
                </div>
              </div>
            </div>
          </details>

          {/* 5 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">🏆</span>
              <span>Comment fonctionne le classement ?</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>
                Le classement (page <strong className="text-emerald-600">Classement</strong>) est calculé sur <strong>3 périodes glissantes</strong> :
              </p>
              <ul className="mt-3 space-y-2 pl-5 list-disc">
                <li><strong>Cette semaine</strong> : 7 derniers jours</li>
                <li><strong>Ce mois</strong> : 30 derniers jours</li>
                <li><strong>All-time</strong> : depuis ton inscription</li>
              </ul>
              <p className="mt-4">Plusieurs critères sont affichés et <strong>sortables</strong> :</p>
              <ul className="mt-2 space-y-1 pl-5 list-disc text-xs">
                <li><strong>Total U</strong> : cumul de tes unités gagnées/perdues</li>
                <li><strong>ROI</strong> : rendement moyen par pari (% de gain par unité misée)</li>
                <li><strong>Winrate</strong> : pourcentage de paris gagnés</li>
                <li><strong>Cote moy.</strong> : cote moyenne de tes pronostics</li>
                <li><strong>Forme</strong> : pastilles colorées des 5 derniers pronostics</li>
              </ul>
              <p className="mt-4 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <strong className="text-blue-800">Bon à savoir :</strong> le classement est différent du <strong>concours</strong> (voir section suivante). Le classement est glissant et purement informatif ; le concours désigne les gagnants officiels de chaque semaine et chaque mois.
              </p>
            </div>
          </details>

          {/* 6 */}
          <details className="group rounded-2xl border-2 border-amber-300 bg-amber-50/30 open:border-amber-400 open:shadow-lg open:shadow-amber-100">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg">💰</span>
              <span>Le concours semaine / mois et les gains</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-amber-200 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>
                Chaque semaine et chaque mois, <strong className="text-amber-700">le meilleur tipster gagne un prix en cash</strong>. Actuellement :
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border-2 border-emerald-300 bg-white p-4 text-center">
                  <div className="text-3xl">🏆</div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-emerald-700">Semaine</p>
                  <p className="text-3xl font-black text-emerald-600">{config.week.prize_amount} €</p>
                  <p className="mt-1 text-[11px] text-neutral-500">Min. {config.week.min_picks} picks sur la semaine</p>
                </div>
                <div className="rounded-xl border-2 border-amber-300 bg-white p-4 text-center">
                  <div className="text-3xl">👑</div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-700">Mois</p>
                  <p className="text-3xl font-black text-amber-600">{config.month.prize_amount} €</p>
                  <p className="mt-1 text-[11px] text-neutral-500">Min. {config.month.min_picks} picks sur le mois</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] italic text-neutral-500 text-center">
                Les montants peuvent évoluer, notamment lors d&apos;opérations spéciales (EURO, Coupe du Monde, etc.).
                La <Link href={`/${locale}/pronos-abonnes/concours`} className="text-amber-700 font-bold underline">page Concours</Link> affiche toujours les montants à jour.
              </p>

              <div className="mt-5 space-y-2 text-xs">
                <p>
                  <strong className="text-neutral-900">📅 Semaine :</strong> du <strong>lundi 00h au dimanche 23h59</strong>, classement figé automatiquement chaque lundi à 00h15.
                </p>
                <p>
                  <strong className="text-neutral-900">📅 Mois :</strong> du <strong>1er au dernier jour du mois</strong>, classement figé automatiquement le 1er du mois suivant à 00h30.
                </p>
                <p className="mt-3">
                  <strong className="text-neutral-900">🎯 Critère de désignation :</strong> le plus grand <strong className="text-emerald-700">Total d&apos;unités (+U)</strong> sur la période. Tu dois avoir posté au minimum <strong>{config.week.min_picks} picks</strong> (semaine) ou <strong>{config.month.min_picks} picks</strong> (mois) résolus sur la période pour être éligible.
                </p>
                <p className="mt-3">
                  <strong className="text-neutral-900">🏅 Badges :</strong> Chaque victoire t&apos;ajoute un badge 🏆 (semaine) ou 👑 (mois) sur ton profil, avec le compteur de victoires cumulées.
                </p>
              </div>
            </div>
          </details>

          {/* 7 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">💳</span>
              <span>Comment recevoir les gains ?</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>
                Les gains sont versés par <strong className="text-emerald-600">virement PayPal</strong> dans les <strong>48h</strong> suivant la clôture de la période (lundi pour le gain de la semaine, 1er du mois pour le gain du mois).
              </p>
              <p className="mt-3">
                Pour recevoir tes gains, pense à renseigner ton <strong>email PayPal</strong> dans{" "}
                <Link href={`/${locale}/espace/profil`} className="text-emerald-600 font-bold underline">
                  Mon Profil
                </Link>
                . Un bloc dédié t&apos;est proposé si tu es premium.
              </p>
              <p className="mt-3 text-xs">
                Tu recevras aussi un <strong>email de confirmation</strong> quand tu gagnes, avec les détails du concours et ton gain.
              </p>
              <p className="mt-3 text-xs italic text-neutral-500">
                Si tu gagnes sans avoir renseigné ton PayPal, on te contactera par email pour récupérer l&apos;info.
              </p>
            </div>
          </details>

          {/* 8 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">✅</span>
              <span>Qui valide les résultats ?</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>
                Les résultats sont <strong className="text-emerald-600">validés manuellement</strong> par l&apos;équipe PRONOS.CLUB
                après vérification du screen et du score final du match.
              </p>
              <p className="mt-3">
                Cela garantit la <strong>fiabilité des statistiques</strong> et la confiance dans le classement.
                Un pronostic mal validé peut être contesté en nous contactant à <a href="mailto:contact@pronos.club" className="text-emerald-600 font-bold underline">contact@pronos.club</a>.
              </p>
            </div>
          </details>

        </div>

        <div className="mt-10 text-center">
          <Link
            href={`/${locale}/espace/tipster/nouveau`}
            className="inline-block rounded-xl bg-emerald-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
          >
            🎯 Poster mon 1er pronostic
          </Link>
        </div>
      </div>
    </main>
  );
}