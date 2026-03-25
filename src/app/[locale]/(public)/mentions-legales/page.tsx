export default function MentionsLegalesPage() {
  return (
    <>
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Légal</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Mentions légales</h1>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">

          {/* Éditeur */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">1. Éditeur du site</h2>
            <div className="mt-3 rounded-xl bg-neutral-50 p-5">
              <p>Le site <strong>pronos.club</strong> est édité par :</p>
              <p className="mt-2">
                <strong>Auto-Entreprise Web Online Concept</strong><br />
                Forme juridique : Auto-entrepreneur<br />
                Siège social : Rue Paul Estival, 31200 Toulouse, France<br />
                SIRET : 510 583 800 00048<br />
                Directeur de la publication : Florent R.<br />
                Email : <a href="mailto:contact@pronos.club" className="text-emerald-600 underline">contact@pronos.club</a>
              </p>
            </div>
          </section>

          {/* Hébergeur */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">2. Hébergement</h2>
            <div className="mt-3 rounded-xl bg-neutral-50 p-5">
              <p>
                <strong>Vercel Inc.</strong><br />
                340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis<br />
                Site : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">vercel.com</a>
              </p>
              <p className="mt-2">
                Base de données hébergée par <strong>Supabase Inc.</strong><br />
                970 Toa Payoh North #07-04, Singapore 318992<br />
                Site : <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">supabase.com</a>
              </p>
            </div>
          </section>

          {/* Nature du site */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">3. Nature du site et avertissements</h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
                <p className="font-bold text-red-800">AVERTISSEMENT IMPORTANT</p>
                <p className="mt-2 text-red-700">
                  Le site pronos.club est un <strong>site d&apos;information indépendant</strong> dédié à l&apos;analyse sportive 
                  et au partage d&apos;opinions sur les événements sportifs. Il ne constitue en aucun cas un opérateur de paris 
                  sportifs, un bookmaker, ou un intermédiaire de jeux d&apos;argent.
                </p>
                <p className="mt-2 text-red-700">
                  Les contenus publiés sur ce site, y compris les analyses, pronostics, avis et recommandations, 
                  sont des <strong>opinions personnelles</strong> du tipster et ne constituent en aucun cas des conseils 
                  financiers, des incitations à parier, ni des garanties de gains. Ces contenus sont fournis à titre 
                  purement informatif et éducatif.
                </p>
              </div>

              <p>
                <strong>PRONOS.CLUB ne garantit en aucun cas que les pronostics publiés assureront des gains</strong>, ni ne 
                permettent de faire des paris sportifs une source de revenus fiable, régulière et alternative au travail. 
                Les paris sportifs comportent un risque de perte financière. Tout utilisateur qui décide de parier le fait 
                sous sa seule et entière responsabilité.
              </p>

              <p>
                Le site et son éditeur ne sauraient être tenus responsables de quelque perte financière que ce soit 
                résultant directement ou indirectement de l&apos;utilisation des informations publiées sur ce site. 
                L&apos;utilisateur reconnaît que les paris sportifs sont des activités à risque et qu&apos;il est le seul 
                décisionnaire de ses mises.
              </p>

              <p>
                Conformément à l&apos;article L. 121-4 du Code de la consommation, le site ne prétend pas augmenter les 
                chances de gagner aux jeux d&apos;argent et de hasard. Les analyses publiées sont des opinions basées sur 
                l&apos;expérience et les connaissances sportives du tipster, et ne constituent pas une méthode garantissant 
                des gains.
              </p>
            </div>
          </section>

          {/* Interdiction aux mineurs */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">4. Interdiction aux mineurs</h2>
            <p className="mt-3">
              Les paris sportifs sont <strong>strictement interdits aux personnes de moins de 18 ans</strong>. 
              Ce site s&apos;adresse exclusivement à un public majeur. En accédant au site, l&apos;utilisateur certifie 
              avoir l&apos;âge légal requis dans son pays de résidence pour consulter des contenus liés aux paris sportifs.
            </p>
          </section>

          {/* Jeu responsable */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">5. Jeu responsable</h2>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-amber-800">
                <strong>Jouer comporte des risques : endettement, dépendance, isolement.</strong><br />
                Appelez le <strong>09 74 75 13 13</strong> (appel non surtaxé) — Service d&apos;aide aux joueurs.<br /><br />
                <strong>Interdiction volontaire de jeux :</strong> toute personne souhaitant faire l&apos;objet d&apos;une 
                interdiction de jeux peut en faire la demande auprès du Ministère de l&apos;Intérieur. Cette interdiction est 
                valable dans les casinos, les clubs de jeux et sur les sites de jeux en ligne autorisés en vertu de la loi 
                n°2010-476 du 12 mai 2010. Elle est prononcée pour une durée minimale de 3 ans.
              </p>
              <p className="mt-3 text-amber-800">
                <strong>Ressources d&apos;aide :</strong><br />
                • <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" className="underline">Joueurs Info Service</a> — 09 74 75 13 13<br />
                • <a href="https://www.addictaide.fr" target="_blank" rel="noopener noreferrer" className="underline">Addict&apos;Aide</a><br />
                • <a href="https://www.anj.fr" target="_blank" rel="noopener noreferrer" className="underline">Autorité Nationale des Jeux (ANJ)</a>
              </p>
            </div>
          </section>

          {/* Liens d'affiliation */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">6. Liens d&apos;affiliation</h2>
            <p className="mt-3">
              Le site pronos.club contient des <strong>liens d&apos;affiliation</strong> vers des bookmakers et opérateurs 
              de paris sportifs. L&apos;éditeur du site peut percevoir une commission lorsqu&apos;un utilisateur s&apos;inscrit 
              sur un bookmaker via ces liens. Cette rémunération n&apos;a aucune influence sur les pronostics publiés ni sur 
              les recommandations de bookmakers. Les bookmakers ARJEL mentionnés sur le site disposent d&apos;un agrément 
              délivré par l&apos;Autorité Nationale des Jeux (ANJ). Les bookmakers internationaux mentionnés ne sont pas 
              régulés par l&apos;ANJ et sont accessibles depuis certains pays uniquement.
            </p>
          </section>

          {/* Propriété intellectuelle */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">7. Propriété intellectuelle</h2>
            <p className="mt-3">
              L&apos;ensemble des contenus du site pronos.club (textes, analyses, pronostics, graphismes, logos, design, 
              base de données, code source) sont la propriété exclusive de Web Online Concept ou font l&apos;objet d&apos;une 
              autorisation d&apos;utilisation. Toute reproduction, représentation, diffusion ou redistribution, intégrale 
              ou partielle, du contenu du site est <strong>strictement interdite</strong> sans autorisation écrite préalable.
            </p>
            <p className="mt-2">
              La diffusion, le partage ou la revente des pronostics publiés sur le site, que ce soit sur des réseaux sociaux, 
              des groupes Telegram, des sites tiers ou tout autre support, constitue une violation de la propriété intellectuelle 
              et pourra donner lieu à des poursuites judiciaires. Tout utilisateur contrevenant verra son compte immédiatement 
              supprimé sans remboursement.
            </p>
          </section>

          {/* Limitation de responsabilité */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">8. Limitation de responsabilité</h2>
            <div className="mt-3 space-y-3">
              <p>
                L&apos;éditeur du site ne pourra être tenu responsable :
              </p>
              <p>
                • Des pertes financières subies par l&apos;utilisateur suite à l&apos;utilisation des informations publiées sur le site.<br />
                • De l&apos;indisponibilité temporaire ou permanente du site.<br />
                • Des erreurs, inexactitudes ou omissions dans les contenus publiés.<br />
                • De l&apos;utilisation frauduleuse du site ou de ses contenus par des tiers.<br />
                • Des décisions de paris prises par l&apos;utilisateur sur la base des pronostics publiés.<br />
                • Des conséquences liées à l&apos;inscription et l&apos;utilisation de bookmakers tiers recommandés sur le site.<br />
                • Des modifications de cotes, annulations de matchs ou tout événement indépendant de sa volonté.
              </p>
              <p>
                L&apos;utilisateur reconnaît expressément que l&apos;utilisation du site et des pronostics publiés se fait 
                à ses risques et périls. En aucun cas la responsabilité de l&apos;éditeur ne pourra être engagée au-delà 
                du montant de l&apos;abonnement payé par l&apos;utilisateur.
              </p>
            </div>
          </section>

          {/* Droit applicable */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">9. Droit applicable et juridiction</h2>
            <p className="mt-3">
              Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative 
              de résolution amiable, compétence expresse est attribuée aux tribunaux compétents de Toulouse.
            </p>
          </section>

          {/* LCEN */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">10. Loi applicable</h2>
            <p className="mt-3">
              Conformément aux dispositions de l&apos;article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance 
              dans l&apos;économie numérique (LCEN), les présentes mentions légales sont portées à la connaissance de tout 
              utilisateur du site.
            </p>
          </section>

        </article>
      </main>
    </>
  );
}