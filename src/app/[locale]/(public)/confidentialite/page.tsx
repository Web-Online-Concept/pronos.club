export default function ConfidentialitePage() {
  return (
    <>
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Légal</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Politique de confidentialité</h1>
          <p className="mt-2 text-sm text-white/40">Dernière mise à jour : mars 2026</p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">1. Responsable du traitement</h2>
            <p className="mt-3">
              Le responsable du traitement des données personnelles est :<br />
              <strong>Auto-Entreprise Web Online Concept</strong><br />
              Rue Paul Estival, 31200 Toulouse, France<br />
              SIRET : 510 583 800 00048<br />
              Email : <a href="mailto:contact@pronos.club" className="text-emerald-600 underline">contact@pronos.club</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">2. Données collectées</h2>
            <div className="mt-3 space-y-2">
              <p>Dans le cadre de l&apos;utilisation du site, les données suivantes peuvent être collectées :</p>
              <p><strong>Lors de l&apos;inscription :</strong> adresse email, pseudo (facultatif), avatar (facultatif).</p>
              <p><strong>Lors de l&apos;abonnement Premium :</strong> les données de paiement sont traitées directement par Stripe. L&apos;éditeur ne stocke aucune donnée bancaire.</p>
              <p><strong>Lors de l&apos;utilisation du site :</strong> préférences de notification, historique des pronostics suivis, configuration de bankroll personnelle.</p>
              <p><strong>Données techniques :</strong> adresse IP, type de navigateur, données de connexion (à des fins de sécurité et d&apos;amélioration du service).</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">3. Finalités du traitement</h2>
            <div className="mt-3 space-y-2">
              <p>Les données personnelles sont collectées pour les finalités suivantes :</p>
              <p>• Gestion du compte utilisateur et authentification.</p>
              <p>• Fourniture du service (accès aux pronostics, personnalisation de l&apos;espace personnel).</p>
              <p>• Gestion des abonnements et facturation via Stripe.</p>
              <p>• Envoi de notifications (email, push) selon les préférences de l&apos;utilisateur.</p>
              <p>• Gestion de l&apos;accès au groupe Telegram Premium.</p>
              <p>• Amélioration du service et statistiques d&apos;utilisation anonymisées.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">4. Base légale du traitement</h2>
            <div className="mt-3 space-y-2">
              <p>Les traitements sont fondés sur :</p>
              <p>• <strong>L&apos;exécution du contrat</strong> (article 6.1.b du RGPD) : inscription, abonnement, fourniture du service.</p>
              <p>• <strong>Le consentement</strong> (article 6.1.a du RGPD) : envoi de notifications par email, cookies non essentiels.</p>
              <p>• <strong>L&apos;intérêt légitime</strong> (article 6.1.f du RGPD) : sécurité du site, prévention des fraudes, amélioration du service.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">5. Sous-traitants et transferts de données</h2>
            <div className="mt-3 rounded-xl bg-neutral-50 p-5">
              <p>Les données peuvent être transmises aux sous-traitants suivants, dans le cadre strict de la fourniture du service :</p>
              <p className="mt-2">
                • <strong>Supabase</strong> (Singapour/UE) — hébergement de la base de données et authentification.<br />
                • <strong>Vercel</strong> (États-Unis) — hébergement du site web.<br />
                • <strong>Stripe</strong> (États-Unis) — traitement des paiements.<br />
                • <strong>Brevo</strong> (France) — envoi d&apos;emails transactionnels et notifications.<br />
                • <strong>Telegram</strong> (Émirats Arabes Unis) — gestion du groupe de discussion Premium.
              </p>
              <p className="mt-2">
                Les transferts de données hors de l&apos;Union Européenne sont encadrés par les clauses contractuelles 
                types de la Commission Européenne et/ou le Data Privacy Framework UE-US.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">6. Durée de conservation</h2>
            <div className="mt-3 space-y-2">
              <p>• <strong>Données de compte :</strong> conservées pendant toute la durée d&apos;existence du compte, puis supprimées dans un délai de 30 jours après la demande de suppression.</p>
              <p>• <strong>Données de paiement :</strong> conservées conformément aux obligations légales comptables (10 ans).</p>
              <p>• <strong>Données de connexion :</strong> conservées 12 mois conformément à la législation en vigueur.</p>
              <p>• <strong>Cookies :</strong> durée maximale de 13 mois.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">7. Droits des utilisateurs</h2>
            <div className="mt-3 space-y-2">
              <p>Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
              <p>• <strong>Droit d&apos;accès :</strong> obtenir la confirmation que des données vous concernant sont traitées et en obtenir une copie.</p>
              <p>• <strong>Droit de rectification :</strong> demander la correction de données inexactes ou incomplètes.</p>
              <p>• <strong>Droit à l&apos;effacement :</strong> demander la suppression de vos données personnelles (suppression de compte possible depuis l&apos;espace personnel).</p>
              <p>• <strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré, couramment utilisé et lisible par machine.</p>
              <p>• <strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos données pour des motifs légitimes.</p>
              <p>• <strong>Droit de retrait du consentement :</strong> retirer votre consentement à tout moment (notifications, cookies).</p>
              <p className="mt-2">
                Pour exercer vos droits, contactez-nous à <a href="mailto:contact@pronos.club" className="text-emerald-600 underline">contact@pronos.club</a>. 
                Nous répondrons dans un délai de 30 jours.
              </p>
              <p>
                En cas de réclamation, vous pouvez saisir la <strong>CNIL</strong> (Commission Nationale de l&apos;Informatique et des Libertés) : 
                <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline"> www.cnil.fr</a>.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">8. Cookies</h2>
            <div className="mt-3 space-y-2">
              <p>Le site utilise des cookies strictement nécessaires au fonctionnement du service :</p>
              <p>• <strong>Cookie d&apos;authentification :</strong> permet de maintenir votre session de connexion (durée : 7 jours).</p>
              <p>• <strong>Cookie de protection du site :</strong> vérifie l&apos;accès au site en phase de test (supprimé au lancement public).</p>
              <p>Ces cookies sont essentiels au fonctionnement du site et ne nécessitent pas votre consentement préalable. Aucun cookie publicitaire ou de tracking n&apos;est utilisé.</p>
              <p>Si Google Analytics est activé à l&apos;avenir, un bandeau de consentement sera mis en place conformément aux recommandations de la CNIL.</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">9. Sécurité</h2>
            <p className="mt-3">
              L&apos;éditeur met en œuvre les mesures techniques et organisationnelles appropriées pour protéger les données 
              personnelles contre l&apos;accès non autorisé, la perte, la destruction ou l&apos;altération. L&apos;authentification 
              est réalisée par lien magique (magic link) sans stockage de mot de passe. Les communications sont chiffrées 
              via HTTPS (TLS 1.3). Les données de paiement sont traitées exclusivement par Stripe (certifié PCI DSS Level 1).
            </p>
          </section>

        </article>
      </main>
    </>
  );
}