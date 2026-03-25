"use client";

import EspaceHero from "@/components/layout/EspaceHero";

export default function AppMobilePage() {
  return (
    <>
      <EspaceHero title="Application Mobile" />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <p className="text-sm text-neutral-500">
          PRONOS.CLUB fonctionne comme une vraie application sur votre téléphone — sans passer par l&apos;App Store ni le Play Store. 
          Installez-la en 30 secondes et recevez les notifications directement sur votre écran.
        </p>

        <div className="mt-8 space-y-6">

          {/* Android */}
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h2 className="font-bold text-emerald-900">Android</h2>
                <p className="text-[10px] text-emerald-600">Chrome, Samsung Internet, Edge, Firefox</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">1</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Ouvrez pronos.club dans Chrome</p>
                    <p className="mt-0.5 text-xs text-neutral-500">Assurez-vous d&apos;être connecté à votre compte</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">2</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Appuyez sur le menu ⋮ (3 points en haut à droite)</p>
                    <p className="mt-0.5 text-xs text-neutral-500">Sur Samsung Internet, c&apos;est le menu ☰ en bas</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">3</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Sélectionnez &quot;Ajouter à l&apos;écran d&apos;accueil&quot;</p>
                    <p className="mt-0.5 text-xs text-neutral-500">Ou &quot;Installer l&apos;application&quot; si proposé</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">4</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Confirmez en appuyant &quot;Ajouter&quot;</p>
                    <p className="mt-0.5 text-xs text-neutral-500">L&apos;icône PRONOS.CLUB apparaît sur votre écran d&apos;accueil</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-700">
                  <strong>C&apos;est tout !</strong> Ouvrez l&apos;app depuis votre écran d&apos;accueil — elle s&apos;ouvre en plein écran, comme une vraie application. 
                  Activez ensuite les notifications dans votre espace pour être alerté à chaque nouveau pronostic.
                </p>
              </div>
            </div>
          </div>

          {/* iOS */}
          <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-5 py-3">
              <span className="text-2xl">🍎</span>
              <div>
                <h2 className="font-bold text-blue-900">iPhone / iPad</h2>
                <p className="text-[10px] text-blue-600">Safari uniquement (obligatoire sur iOS)</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                <p className="text-xs text-amber-700">
                  <strong>Important :</strong> sur iPhone/iPad, vous devez utiliser <strong>Safari</strong>. 
                  Chrome et Firefox sur iOS ne permettent pas l&apos;installation d&apos;applications web.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">1</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Ouvrez pronos.club dans Safari</p>
                    <p className="mt-0.5 text-xs text-neutral-500">Pas Chrome ni Firefox — uniquement Safari</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">2</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Appuyez sur le bouton Partager</p>
                    <p className="mt-0.5 text-xs text-neutral-500">L&apos;icône carrée avec une flèche vers le haut — en bas de l&apos;écran sur iPhone, en haut sur iPad</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">3</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Faites défiler et appuyez &quot;Sur l&apos;écran d&apos;accueil&quot;</p>
                    <p className="mt-0.5 text-xs text-neutral-500">L&apos;option est dans la liste, parfois il faut scroller vers le bas</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">4</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Appuyez &quot;Ajouter&quot; en haut à droite</p>
                    <p className="mt-0.5 text-xs text-neutral-500">L&apos;icône PRONOS.CLUB apparaît sur votre écran d&apos;accueil</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">5</div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Ouvrez l&apos;app et activez les notifications</p>
                    <p className="mt-0.5 text-xs text-neutral-500">iOS demandera l&apos;autorisation — acceptez pour recevoir les alertes</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-700">
                  <strong>Pourquoi cette étape est indispensable sur iOS ?</strong> Apple ne permet les notifications push que 
                  pour les applications installées sur l&apos;écran d&apos;accueil. Sans cette installation, vous ne recevrez 
                  aucune alerte. C&apos;est une limitation d&apos;Apple, pas de PRONOS.CLUB.
                </p>
              </div>
            </div>
          </div>

          {/* PC / Desktop */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white">
            <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-5 py-3">
              <span className="text-2xl">💻</span>
              <div>
                <h2 className="font-bold text-neutral-800">Ordinateur</h2>
                <p className="text-[10px] text-neutral-500">Chrome, Edge, Brave</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-neutral-600">
                Sur ordinateur, pas besoin d&apos;installer quoi que ce soit. Ouvrez simplement <strong>pronos.club</strong> dans 
                votre navigateur et activez les notifications push depuis votre espace perso. Vous recevrez une alerte 
                sur votre bureau à chaque nouveau pronostic — même si le site n&apos;est pas ouvert.
              </p>
              <p className="mt-3 text-xs text-neutral-400">
                Si Chrome vous propose &quot;Installer PRONOS.CLUB&quot; dans la barre d&apos;adresse, vous pouvez aussi l&apos;installer 
                comme application de bureau pour un accès rapide.
              </p>
            </div>
          </div>

          {/* Avantages */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5">
            <h3 className="font-bold text-emerald-900">Pourquoi installer l&apos;application ?</h3>
            <div className="mt-3 space-y-2">
              {[
                { icon: "🔔", text: "Notifications push instantanées à chaque nouveau pronostic" },
                { icon: "📱", text: "S'ouvre en plein écran, comme une vraie app" },
                { icon: "⚡", text: "Accès rapide depuis votre écran d'accueil" },
                { icon: "🚫", text: "Pas besoin de l'App Store ni du Play Store" },
                { icon: "🆓", text: "100% gratuit, aucun téléchargement" },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-sm">{item.icon}</span>
                  <p className="text-sm text-emerald-800">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}