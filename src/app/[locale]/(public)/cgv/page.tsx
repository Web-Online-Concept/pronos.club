export default function CGVPage() {
  return (
    <>
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Légal</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Conditions Générales de Vente</h1>
          <p className="mt-2 text-sm text-white/40">Dernière mise à jour : mars 2026</p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">1. Objet</h2>
            <p className="mt-3">
              Les présentes Conditions Générales de Vente (ci-après &quot;CGV&quot;) régissent la vente de l&apos;abonnement 
              Premium proposé sur le site pronos.club, édité par Auto-Entreprise Web Online Concept 
              (SIRET : 510 583 800 00048), dont le siège social est situé Rue Paul Estival, 31200 Toulouse, France.
            </p>
            <p className="mt-2">
              Toute souscription à l&apos;abonnement Premium implique l&apos;acceptation entière et sans réserve des 
              présentes CGV, ainsi que des Conditions Générales d&apos;Utilisation (CGU) du site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">2. Description du service vendu</h2>
            <div className="mt-3 space-y-2">
              <p>L&apos;abonnement Premium donne accès aux services suivants :</p>
              <p>• L&apos;intégralité des pronostics publiés par le tipster (gratuits et premium).</p>
              <p>• L&apos;accès au groupe Telegram exclusif réservé aux abonnés Premium.</p>
              <p>• Les notifications prioritaires (email, push) à chaque nouveau pronostic.</p>
              <p>• La réception du bilan mensuel par email.</p>
              <p>• L&apos;accès à l&apos;ensemble des fonctionnalités de l&apos;espace personnel (statistiques personnalisées, gestion de bankroll, historique des pronostics suivis).</p>
            </div>
            <div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-5">
              <p className="text-red-700">
                <strong>IMPORTANT :</strong> les pronostics publiés sont des <strong>opinions personnelles</strong> du tipster 
                basées sur son analyse sportive. Ils ne constituent en aucun cas des conseils financiers, des incitations à 
                parier, ni des garanties de gains. L&apos;abonnement Premium donne accès à un contenu informationnel. 
                PRONOS.CLUB ne garantit aucun résultat.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">3. Prix</h2>
            <div className="mt-3 space-y-2">
              <p><strong>Prix de l&apos;abonnement Premium :</strong> 20€ TTC par mois.</p>
              <p>Le prix est indiqué en euros, toutes taxes comprises. L&apos;éditeur étant auto-entrepreneur, la TVA n&apos;est pas applicable en vertu de l&apos;article 293 B du Code Général des Impôts.</p>
              <p>L&apos;éditeur se réserve le droit de modifier le prix de l&apos;abonnement à tout moment. Toute modification sera notifiée par email à l&apos;utilisateur au moins <strong>30 jours</strong> avant son entrée en vigueur. L&apos;utilisateur pourra résilier son abonnement avant l&apos;application du nouveau tarif.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">4. Modalités de paiement</h2>
            <div className="mt-3 space-y-2">
              <p>Le paiement est effectué par carte bancaire via la plateforme sécurisée <strong>Stripe</strong>. L&apos;éditeur ne stocke aucune donnée bancaire.</p>
              <p>L&apos;abonnement est à <strong>prélèvement automatique mensuel</strong>. Le montant est débité chaque mois à la date anniversaire de la souscription.</p>
              <p>Stripe est certifié PCI DSS Level 1, le plus haut niveau de sécurité dans l&apos;industrie du paiement.</p>
              <p>En cas d&apos;échec de paiement, l&apos;accès Premium pourra être suspendu jusqu&apos;à régularisation.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">5. Facturation</h2>
            <p className="mt-3">
              Une facture est générée automatiquement par Stripe à chaque prélèvement et envoyée par email à l&apos;adresse 
              associée au compte. L&apos;utilisateur peut également consulter l&apos;historique de ses factures depuis son 
              espace personnel via le portail client Stripe.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">6. Durée et renouvellement</h2>
            <div className="mt-3 space-y-2">
              <p>L&apos;abonnement Premium est souscrit pour une durée d&apos;un mois, <strong>renouvelable automatiquement</strong> par tacite reconduction.</p>
              <p>L&apos;abonnement est <strong>sans engagement</strong> : l&apos;utilisateur peut résilier à tout moment.</p>
              <p>Le renouvellement s&apos;effectue automatiquement à la date anniversaire de la souscription, sauf résiliation préalable par l&apos;utilisateur.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">7. Résiliation</h2>
            <div className="mt-3 space-y-2">
              <p>L&apos;utilisateur peut résilier son abonnement à tout moment depuis son espace personnel (section &quot;Mon Abonnement&quot;) en un clic.</p>
              <p>La résiliation prend effet à la <strong>fin de la période de facturation en cours</strong>. L&apos;utilisateur conserve l&apos;accès aux contenus Premium jusqu&apos;à cette date.</p>
              <p><strong>Aucun remboursement prorata temporis</strong> ne sera effectué pour la période entamée.</p>
              <p>À l&apos;expiration de la période, le compte repasse automatiquement en version gratuite. Les données de l&apos;utilisateur (historique, statistiques, préférences) sont conservées.</p>
              <p>L&apos;accès au groupe Telegram Premium est <strong>automatiquement retiré</strong> à la fin de la période d&apos;abonnement.</p>
              <p>L&apos;utilisateur peut se réabonner à tout moment depuis son espace personnel.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">8. Droit de rétractation</h2>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-amber-800">
                Conformément à l&apos;article <strong>L. 221-28, 13°</strong> du Code de la consommation, le droit de 
                rétractation ne peut être exercé pour les contrats de fourniture de contenus numériques non fournis 
                sur un support matériel dont l&apos;exécution a commencé avec l&apos;accord préalable exprès du consommateur 
                et son renoncement exprès à son droit de rétractation.
              </p>
              <p className="mt-2 text-amber-800">
                En souscrivant à l&apos;abonnement Premium, l&apos;utilisateur <strong>accepte expressément</strong> que 
                l&apos;accès immédiat aux pronostics et contenus Premium constitue le début d&apos;exécution du contrat, 
                et <strong>renonce expressément</strong> à son droit de rétractation.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">9. Suspension et résiliation par l&apos;éditeur</h2>
            <div className="mt-3 space-y-2">
              <p>L&apos;éditeur se réserve le droit de suspendre ou résilier l&apos;abonnement d&apos;un utilisateur, sans préavis ni remboursement, en cas de :</p>
              <p>• Violation des CGU ou des CGV.</p>
              <p>• Diffusion, partage ou revente des pronostics à des tiers.</p>
              <p>• Utilisation frauduleuse du service.</p>
              <p>• Création de comptes multiples pour contourner les restrictions.</p>
              <p>• Comportement nuisible envers les autres membres (insultes, harcèlement, spam dans le groupe Telegram).</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">10. Exclusion de garantie et limitation de responsabilité</h2>
            <div className="mt-3 space-y-2">
              <p>L&apos;éditeur fournit un service d&apos;information et d&apos;analyse sportive. <strong>Aucune garantie de résultat ni de gain</strong> n&apos;est donnée.</p>
              <p>L&apos;utilisateur reconnaît que :</p>
              <p>• Les paris sportifs comportent un risque de perte financière.</p>
              <p>• Il est seul décisionnaire de ses mises et de ses choix de paris.</p>
              <p>• Les performances passées ne préjugent pas des résultats futurs.</p>
              <p>• La variance inhérente aux paris sportifs peut entraîner des séries de pertes.</p>
              <p className="mt-2">
                En tout état de cause, la responsabilité de l&apos;éditeur est <strong>limitée au montant total 
                des abonnements effectivement payés</strong> par l&apos;utilisateur au cours des 12 derniers mois.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">11. Informations précontractuelles</h2>
            <p className="mt-3">
              Conformément aux articles L.111-1 à L.111-7 du Code de la consommation, l&apos;utilisateur est informé 
              préalablement à la souscription de l&apos;abonnement des caractéristiques essentielles du service, du prix, 
              des modalités de paiement, de la durée du contrat et des conditions de résiliation, tels que décrits 
              dans les présentes CGV.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">12. Médiation des litiges</h2>
            <div className="mt-3 space-y-2">
              <p>
                Conformément aux articles L.611-1 et suivants du Code de la consommation, en cas de litige non résolu 
                par voie amiable, l&apos;utilisateur peut recourir gratuitement à un <strong>médiateur de la consommation</strong>.
              </p>
              <p>
                Le médiateur compétent est :<br />
                <strong>CMAP — Centre de Médiation et d&apos;Arbitrage de Paris</strong><br />
                39, avenue Franklin D. Roosevelt, 75008 Paris<br />
                Site : <a href="https://www.cmap.fr" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">www.cmap.fr</a>
              </p>
              <p>
                L&apos;utilisateur peut également déposer une réclamation sur la plateforme européenne de règlement 
                des litiges en ligne : <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">https://ec.europa.eu/consumers/odr</a>
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">13. Droit applicable et juridiction</h2>
            <p className="mt-3">
              Les présentes CGV sont régies par le droit français. En cas de litige, et après tentative de résolution 
              amiable et/ou de médiation, compétence expresse est attribuée aux tribunaux compétents de Toulouse.
            </p>
          </section>

        </article>
      </main>
    </>
  );
}