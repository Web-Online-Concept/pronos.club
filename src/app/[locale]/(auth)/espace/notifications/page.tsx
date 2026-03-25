"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import PushToggle from "@/components/notifications/PushToggle";
import EspaceHero from "@/components/layout/EspaceHero";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(user?.notify_email ?? true);
  const [bilanEnabled, setBilanEnabled] = useState(user?.notify_bilan ?? true);
  const [saving, setSaving] = useState(false);

  const isPremium = user?.subscription_status === "active";

  async function toggleEmail() {
    setSaving(true);
    const newValue = !emailEnabled;

    await fetch("/api/user/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notify_email: newValue }),
    });

    setEmailEnabled(newValue);
    setSaving(false);
  }

  async function toggleBilan() {
    setSaving(true);
    const newValue = !bilanEnabled;

    await fetch("/api/user/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notify_bilan: newValue }),
    });

    setBilanEnabled(newValue);
    setSaving(false);
  }

  return (
    <>
      <EspaceHero title="Mes Notifications" />

    <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
      <p className="text-sm text-neutral-500">
        Configurez vos alertes pour recevoir les notifications de chaque pronostic publié, avec votre méthode préférée (PC, App Mobile, Mails, Telegram)
      </p>

      <div className="mt-6 space-y-4">
        {/* Push */}
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-4">
          <PushToggle />
        </div>

        {/* Email */}
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Notifications email</p>
              <p className="text-xs opacity-40">
                {emailEnabled ? "Activées — recevez un email à chaque nouveau pick" : "Désactivées"}
              </p>
            </div>
            <button
              onClick={toggleEmail}
              disabled={saving}
              className={`relative h-7 w-12 rounded-full transition ${
                emailEnabled ? "bg-emerald-500" : "bg-neutral-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  emailEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Bilan mensuel */}
        <div className={`rounded-xl border p-4 ${isPremium ? "border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100/50" : "border-neutral-200 bg-neutral-50 opacity-60"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Bilan mensuel par email</p>
                {!isPremium && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">PREMIUM</span>
                )}
              </div>
              <p className="text-xs opacity-40">
                {isPremium
                  ? bilanEnabled ? "Activé — recevez le bilan du tipster chaque mois" : "Désactivé"
                  : "Réservé aux abonnés Premium"
                }
              </p>
            </div>
            <button
              onClick={toggleBilan}
              disabled={saving || !isPremium}
              className={`relative h-7 w-12 rounded-full transition ${
                bilanEnabled && isPremium ? "bg-emerald-500" : "bg-neutral-300"
              } ${!isPremium ? "cursor-not-allowed" : ""}`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  bilanEnabled && isPremium ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Telegram */}
        <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Notifications Telegram</p>
              <p className="text-xs opacity-40">
                Canal public — alertes à chaque nouveau pronostic
              </p>
            </div>
            <a
              href="https://t.me/pronos_club_notifs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[#2AABEE] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#229ED9]"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              Rejoindre
            </a>
          </div>
        </div>
      </div>

      {/* Tutoriel */}
      <div className="mt-10">
        <h2 className="text-lg font-bold">Comment recevoir les alertes ?</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Selon votre appareil, voici les meilleures options pour être prévenu dès qu&apos;un nouveau pronostic est publié. Vous recevrez une alerte avec le sport concerné — pour consulter le pick, rendez-vous sur le site.
        </p>

        <div className="mt-6 space-y-6">
          {/* Android */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <h3 className="font-bold">Android</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Les alertes push fonctionnent directement dans votre navigateur (Chrome, Firefox, Edge).
              Activez simplement le toggle ci-dessus et autorisez les notifications. Vous serez prévenu à chaque publication — il vous suffira de cliquer pour accéder au pronostic sur le site.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              💡 <strong>Astuce :</strong> ajoutez PRONOS.CLUB à votre écran d&apos;accueil pour y accéder comme une vraie application. Dans Chrome, appuyez sur les 3 points puis &quot;Ajouter à l&apos;écran d&apos;accueil&quot;.
            </p>
          </div>

          {/* iOS */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍎</span>
              <h3 className="font-bold">iPhone / iPad</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Pour recevoir les alertes push sur iOS, ajoutez PRONOS.CLUB à votre écran d&apos;accueil — vous aurez une vraie application et serez prévenu dès qu&apos;un nouveau pick est disponible :
            </p>
            <ol className="mt-2 space-y-1 text-sm text-neutral-600">
              <li>1. Ouvrez <strong>pronos.club</strong> dans Safari</li>
              <li>2. Appuyez sur le bouton <strong>Partager</strong> (icône carré avec flèche)</li>
              <li>3. Sélectionnez <strong>&quot;Sur l&apos;écran d&apos;accueil&quot;</strong></li>
              <li>4. Ouvrez l&apos;app depuis votre écran d&apos;accueil et activez les notifications</li>
            </ol>
            <p className="mt-3 text-sm text-neutral-500">
              Sans l&apos;installation, les alertes push ne sont pas disponibles sur iOS. Utilisez Telegram ou email pour être prévenu.
            </p>
          </div>

          {/* Telegram */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">✈️</span>
              <h3 className="font-bold">Telegram</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Fonctionne partout, sur tous les appareils. Rejoignez notre canal et recevez une alerte Telegram à chaque nouveau pick publié. Cliquez sur l&apos;alerte pour consulter le pronostic sur le site.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              💡 Pour une expérience encore plus complète, ajoutez aussi PRONOS.CLUB à votre écran d&apos;accueil et combinez les deux.
            </p>
          </div>

          {/* Email */}
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">📧</span>
              <h3 className="font-bold">Email</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Recevez une alerte email à chaque nouveau pick publié. Cliquez sur le lien dans l&apos;email pour accéder au pronostic sur le site. Pensez à vérifier vos spams si vous ne recevez rien.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">
              💡 Pour ne rien manquer, ajoutez PRONOS.CLUB à votre écran d&apos;accueil et activez les notifications push en complément.
            </p>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}