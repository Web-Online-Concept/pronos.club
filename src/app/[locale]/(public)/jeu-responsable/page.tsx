export default function JeuResponsablePage() {
  return (
    <>
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">Prévention</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">Jeu responsable</h1>
          <p className="mt-4 text-sm text-white/40">
            Les paris sportifs doivent rester un loisir. Si le jeu n&apos;est plus un plaisir, il est temps de demander de l&apos;aide.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">

          {/* Warning banner */}
          <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-center">
            <p className="text-lg font-extrabold text-red-800">
              Jouer comporte des risques : endettement, dépendance, isolement.
            </p>
            <p className="mt-2 text-2xl font-extrabold text-red-600">
              09 74 75 13 13
            </p>
            <p className="mt-1 text-sm text-red-700">Appel non surtaxé — Joueurs Info Service</p>
          </div>

          {/* Notre engagement */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">Notre engagement</h2>
            <p className="mt-3">
              PRONOS.CLUB est un service d&apos;analyse sportive. Nous ne sommes ni un bookmaker, ni un opérateur de 
              jeux d&apos;argent. Nous publions des opinions sur des événements sportifs à titre informatif. 
              Cependant, nous sommes conscients que nos utilisateurs peuvent utiliser ces informations dans le cadre 
              de paris sportifs, et nous prenons très au sérieux notre responsabilité en matière de prévention.
            </p>
            <p className="mt-2">
              C&apos;est pourquoi nous nous engageons à promouvoir une approche responsable et à sensibiliser 
              nos utilisateurs aux risques liés aux jeux d&apos;argent.
            </p>
          </section>

          {/* Signaux d'alerte */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">Reconnaître les signaux d&apos;alerte</h2>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-800">Vous pourriez avoir un problème avec le jeu si :</p>
              <div className="mt-3 space-y-2 text-amber-700">
                <p>• Vous misez plus d&apos;argent que vous ne pouvez vous permettre de perdre.</p>
                <p>• Vous cherchez à &quot;vous refaire&quot; après une perte en augmentant vos mises.</p>
                <p>• Vous empruntez de l&apos;argent ou utilisez vos économies pour parier.</p>
                <p>• Vous mentez à vos proches sur le montant de vos paris.</p>
                <p>• Le jeu affecte votre travail, vos études ou vos relations personnelles.</p>
                <p>• Vous ressentez de l&apos;anxiété, du stress ou de l&apos;irritabilité liés au jeu.</p>
                <p>• Vous passez de plus en plus de temps à parier ou à penser aux paris.</p>
                <p>• Vous n&apos;arrivez pas à vous arrêter de jouer malgré votre volonté.</p>
              </div>
              <p className="mt-3 font-bold text-amber-800">
                Si vous vous reconnaissez dans un ou plusieurs de ces signes, nous vous encourageons fortement à 
                demander de l&apos;aide auprès d&apos;un professionnel.
              </p>
            </div>
          </section>

          {/* Nos recommandations */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">Nos recommandations</h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Fixez-vous un budget et respectez-le</p>
                <p className="mt-1 text-emerald-700">Définissez un montant mensuel maximum que vous pouvez vous permettre de perdre. Ne dépassez jamais ce budget, quelles que soient les circonstances.</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Ne jouez jamais pour récupérer vos pertes</p>
                <p className="mt-1 text-emerald-700">La &quot;chasse aux pertes&quot; est le piège le plus courant. Si vous perdez, acceptez-le et attendez le prochain pick. N&apos;augmentez jamais vos mises pour vous refaire.</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Ne pariez pas sous l&apos;influence de l&apos;alcool ou des émotions</p>
                <p className="mt-1 text-emerald-700">Les décisions impulsives sont les plus dangereuses. Pariez uniquement lorsque vous êtes lucide et serein.</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Le jeu doit rester un loisir</p>
                <p className="mt-1 text-emerald-700">Les paris sportifs ne sont pas un moyen de gagner sa vie. Si le jeu n&apos;est plus amusant ou qu&apos;il génère du stress, c&apos;est le moment de faire une pause.</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">Utilisez les outils de gestion de bankroll</p>
                <p className="mt-1 text-emerald-700">PRONOS.CLUB propose un outil de gestion de bankroll intégré. Utilisez-le pour suivre vos mises et ne jamais dépasser vos limites.</p>
              </div>
            </div>
          </section>

          {/* Interdiction aux mineurs */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">Interdiction aux mineurs</h2>
            <div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-5">
              <p className="font-bold text-red-800">
                Les jeux d&apos;argent et les paris sportifs sont strictement interdits aux personnes de moins de 18 ans.
              </p>
              <p className="mt-2 text-red-700">
                Si vous êtes parent, nous vous encourageons à mettre en place des contrôles parentaux sur les appareils 
                de vos enfants et à les sensibiliser aux risques des jeux d&apos;argent.
              </p>
            </div>
          </section>

          {/* Auto-exclusion */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">Auto-exclusion</h2>
            <p className="mt-3">
              Vous pouvez demander à être <strong>interdit de jeux</strong> auprès du Ministère de l&apos;Intérieur. 
              Cette interdiction est applicable dans les casinos, les clubs de jeux et sur les sites de jeux en ligne 
              autorisés en vertu de la loi n°2010-476 du 12 mai 2010. Elle est prononcée pour une durée minimale de 3 ans 
              et ne peut pas être levée avant ce délai.
            </p>
            <p className="mt-2">
              Pour effectuer cette demande, rendez-vous sur le site de l&apos;ANJ ou contactez directement le service 
              d&apos;interdiction volontaire de jeux.
            </p>
          </section>

          {/* Ressources */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">Ressources et aide</h2>
            <div className="mt-3 space-y-3">
              <a href="https://www.joueurs-info-service.fr" target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md">
                <p className="font-bold text-neutral-900">Joueurs Info Service</p>
                <p className="text-xs text-neutral-500">09 74 75 13 13 (appel non surtaxé) — 7j/7 de 8h à 2h</p>
                <p className="text-xs text-emerald-600">www.joueurs-info-service.fr →</p>
              </a>
              <a href="https://www.addictaide.fr" target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md">
                <p className="font-bold text-neutral-900">Addict&apos;Aide</p>
                <p className="text-xs text-neutral-500">Le village des addictions — information, prévention, orientation</p>
                <p className="text-xs text-emerald-600">www.addictaide.fr →</p>
              </a>
              <a href="https://www.anj.fr" target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md">
                <p className="font-bold text-neutral-900">Autorité Nationale des Jeux (ANJ)</p>
                <p className="text-xs text-neutral-500">Régulation des jeux d&apos;argent en France — auto-exclusion</p>
                <p className="text-xs text-emerald-600">www.anj.fr →</p>
              </a>
              <a href="https://www.sosjoueurs.org" target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md">
                <p className="font-bold text-neutral-900">SOS Joueurs</p>
                <p className="text-xs text-neutral-500">Association d&apos;aide aux joueurs en difficulté</p>
                <p className="text-xs text-emerald-600">www.sosjoueurs.org →</p>
              </a>
            </div>
          </section>

          {/* Suppression de compte */}
          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">Supprimer votre compte</h2>
            <p className="mt-3">
              Si vous souhaitez vous éloigner des paris sportifs, vous pouvez supprimer votre compte PRONOS.CLUB 
              à tout moment depuis votre espace personnel (Mon Profil → Supprimer mon compte). La suppression est 
              définitive et entraîne la perte de toutes vos données. Si vous avez un abonnement actif, pensez à le 
              résilier avant de supprimer votre compte.
            </p>
          </section>

          {/* Footer warning */}
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center">
            <p className="font-bold text-amber-800">
              Jouer comporte des risques : endettement, dépendance, isolement.
            </p>
            <p className="mt-1 text-amber-700">
              Appelez le <strong>09 74 75 13 13</strong> (appel non surtaxé)
            </p>
          </div>

        </article>
      </main>
    </>
  );
}