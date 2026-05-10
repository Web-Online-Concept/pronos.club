"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * /espace/notifications/page.tsx (V3.5 Lot 14 — refonte complète)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page utilisateur des préférences de notifications.
 *
 * Structure (V3.5 Lot 14) :
 *   1. Push global activation (1 toggle browser, partagé entre catégories)
 *   2. Groupe Telegram Premium (privé, premium uniquement)
 *   3. PRONOS TIPSTER (Jérôme Bollaert)
 *      · Push (toggle granulaire)
 *      · Email (toggle granulaire)
 *      · Telegram canal public @pronos_club_notifs
 *   4. PRONOS IA
 *      · Telegram canal public @pronos_club_ia (uniquement, pas de push/email)
 *   5. PRONOS ABONNÉS
 *      · Push (toggle granulaire)
 *      · Email (toggle granulaire)
 *      · Telegram canal public @pronos_abonnes_club
 *      · Notifs des tipsters suivis (TipsterNotifSection existant)
 *   6. BILANS (premium)
 *      · Email récap hebdo/mensuel
 *   7. Tutos push (Android/iOS) + Telegram + Email
 *
 * Path : src/app/[locale]/(auth)/espace/notifications/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import PushToggle from "@/components/notifications/PushToggle";
import EspaceHero from "@/components/layout/EspaceHero";
import TipsterNotifSection from "@/components/tipster/TipsterNotifSection";
import { useTranslations } from "next-intl";

// Type pour étendre le user avec les nouveaux toggles
type UserWithNotifs = {
  id: string;
  notify_email?: boolean;
  notify_push?: boolean;
  notify_bilan?: boolean;
  notify_tipster_push?: boolean;
  notify_tipster_email?: boolean;
  subscription_status?: string;
  telegram_user_id?: number | null;
};


export default function NotificationsPage() {
  const t = useTranslations("notif_page");
  const { user } = useAuth();
  const u = user as UserWithNotifs | null;

  // États des toggles granulaires
  const [tipsterPush, setTipsterPush] = useState(u?.notify_tipster_push ?? true);
  const [tipsterEmail, setTipsterEmail] = useState(u?.notify_tipster_email ?? true);
  const [bilanEnabled, setBilanEnabled] = useState(u?.notify_bilan ?? true);

  const [saving, setSaving] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState("");

  const isPremium =
    u?.subscription_status === "active" || u?.subscription_status === "trialing";
  const isInTelegramGroup = !!u?.telegram_user_id;

  async function updateNotif(field: string, newValue: boolean, setter: (v: boolean) => void) {
    setSaving(true);
    setter(newValue);
    try {
      await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
    } catch {
      // En cas d'erreur, on revert visuellement
      setter(!newValue);
    }
    setSaving(false);
  }

  async function requestTelegramInvite() {
    setTelegramLoading(true);
    setTelegramError("");
    try {
      const res = await fetch("/api/telegram/invite", { method: "POST" });
      const data = await res.json();
      if (data.invite_link) {
        setTelegramLink(data.invite_link);
        window.open(data.invite_link, "_blank");
      } else if (data.error === "Already in the Telegram group") {
        setTelegramError("Vous êtes déjà dans le groupe Telegram !");
      } else {
        setTelegramError(data.error || "Erreur lors de la génération du lien");
      }
    } catch {
      setTelegramError("Erreur réseau");
    }
    setTelegramLoading(false);
  }

  return (
    <>
      <EspaceHero title={t("hero")} />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <p className="text-sm text-neutral-500">{t("intro")}</p>

        <div className="mt-6 space-y-8">

          {/* ════════════════════════════════════════════════════════ */}
          {/* SECTION 1 — Activation push globale (browser permission) */}
          {/* ════════════════════════════════════════════════════════ */}
          <SectionContainer
            title="Activation des notifications push"
            subtitle="Active une seule fois sur ton appareil — tu choisis ensuite finement quelles notifs recevoir dans chaque section ci-dessous."
            color="emerald"
          >
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-4">
              <PushToggle />
            </div>
          </SectionContainer>


          {/* ════════════════════════════════════════════════════════ */}
          {/* SECTION 2 — Groupe Telegram Premium (privé, premium only) */}
          {/* ════════════════════════════════════════════════════════ */}
          {isPremium && (
            <SectionContainer
              title="💜 Groupe Telegram Premium"
              subtitle="Le groupe privé exclusif des abonnés Premium pour échanger avec la communauté."
              color="purple"
            >
              <div className="rounded-xl border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-purple-100/50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Rejoindre le groupe</p>
                    <p className="text-xs opacity-50">
                      {isInTelegramGroup
                        ? "Vous êtes dans le groupe — échangez avec la communauté"
                        : "Discussions exclusives entre abonnés Premium"}
                    </p>
                  </div>
                  {isInTelegramGroup ? (
                    <span className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      Connecté
                    </span>
                  ) : (
                    <button
                      onClick={requestTelegramInvite}
                      disabled={telegramLoading}
                      className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50 cursor-pointer"
                    >
                      <TelegramIcon />
                      {telegramLoading ? "..." : "Rejoindre"}
                    </button>
                  )}
                </div>
                {telegramLink && !isInTelegramGroup && (
                  <div className="mt-3 rounded-lg bg-purple-100 p-3 text-center">
                    <p className="text-xs text-purple-700">
                      Lien généré ! Si la page ne s'est pas ouverte :
                    </p>
                    <a
                      href={telegramLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-sm font-bold text-purple-600 underline"
                    >
                      Cliquer ici pour rejoindre
                    </a>
                  </div>
                )}
                {telegramError && (
                  <p className="mt-2 text-xs text-red-500">{telegramError}</p>
                )}
              </div>
            </SectionContainer>
          )}


          {/* ════════════════════════════════════════════════════════ */}
          {/* SECTION 3 — Pronos Tipster (Jérôme Bollaert) */}
          {/* ════════════════════════════════════════════════════════ */}
          <SectionContainer
            title="🎯 Pronos Tipster"
            subtitle="Pronostics expertisés de Jérôme Bollaert, notre tipster référent."
            color="emerald"
          >
            <div className="space-y-3">
              <ToggleRow
                title="Notifs push (PC ou app mobile)"
                subtitle={tipsterPush ? "Activées" : "Désactivées"}
                value={tipsterPush}
                onChange={(v) => updateNotif("notify_tipster_push", v, setTipsterPush)}
                disabled={saving}
                color="emerald"
              />
              <ToggleRow
                title="Notifs par email"
                subtitle={tipsterEmail ? "Activées" : "Désactivées"}
                value={tipsterEmail}
                onChange={(v) => updateNotif("notify_tipster_email", v, setTipsterEmail)}
                disabled={saving}
                color="emerald"
              />
              <TelegramChannelRow
                title="Notifs Telegram (canal public)"
                subtitle="Recevez chaque pronostic Tipster sur Telegram"
                href="https://t.me/pronos_club_notifs"
                channelLabel="@pronos_club_notifs"
                color="emerald"
              />
            </div>
          </SectionContainer>


          {/* ════════════════════════════════════════════════════════ */}
          {/* SECTION 4 — Pronos IA */}
          {/* ════════════════════════════════════════════════════════ */}
          <SectionContainer
            title="🤖 Pronos IA"
            subtitle="Pronostics générés automatiquement par notre IA, gratuits, 9 sports."
            color="violet"
          >
            <div className="space-y-3">
              <TelegramChannelRow
                title="Notifs Telegram (canal public)"
                subtitle="Recevez chaque pronostic IA sur Telegram"
                href="https://t.me/pronos_club_ia"
                channelLabel="@pronos_club_ia"
                color="violet"
              />
            </div>
          </SectionContainer>


          {/* ════════════════════════════════════════════════════════ */}
          {/* SECTION 5 — Pronos Abonnés */}
          {/* ════════════════════════════════════════════════════════ */}
          <SectionContainer
            title="👥 Pronos Abonnés"
            subtitle="Pronostics partagés par la communauté des tipsters abonnés."
            color="cyan"
          >
            <div className="space-y-3">
              {/* Canal Telegram public */}
              <TelegramChannelRow
                title="Notifs Telegram (canal public)"
                subtitle="Recevez chaque pronostic Abonnés sur Telegram"
                href="https://t.me/pronos_abonnes_club"
                channelLabel="@pronos_abonnes_club"
                color="cyan"
              />

              {/* Notifs des tipsters suivis (composant existant qui gère
                  email + telegram DM + push de manière granulaire via
                  tipster_notif_prefs et tipster_follows) */}
              <div className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100/50 p-4">
                <TipsterNotifSection />
              </div>
            </div>
          </SectionContainer>


          {/* ════════════════════════════════════════════════════════ */}
          {/* SECTION 6 — Bilans (premium) */}
          {/* ════════════════════════════════════════════════════════ */}
          <SectionContainer
            title="📊 Bilans"
            subtitle="Récapitulatifs hebdo et mensuels par email (réservé Premium)."
            color="amber"
          >
            <div
              className={`rounded-xl border p-4 ${
                isPremium
                  ? "border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/50"
                  : "border-neutral-200 bg-neutral-50 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Récap email hebdo + mensuel</p>
                    {!isPremium && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                        PREMIUM
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-50">
                    {isPremium
                      ? bilanEnabled
                        ? "Activées"
                        : "Désactivées"
                      : "Disponible avec un abonnement Premium"}
                  </p>
                </div>
                <Toggle
                  value={bilanEnabled && isPremium}
                  onChange={(v) => updateNotif("notify_bilan", v, setBilanEnabled)}
                  disabled={saving || !isPremium}
                  color="amber"
                />
              </div>
            </div>
          </SectionContainer>

        </div>


        {/* ════════════════════════════════════════════════════════ */}
        {/* TUTOS (existant, conservé) */}
        {/* ════════════════════════════════════════════════════════ */}
        <div className="mt-12">
          <h2 className="text-lg font-bold">{t("tuto_title")}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t("tuto_intro")}</p>

          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h3 className="font-bold">{t("android_title")}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {t("android_p1")}
              </p>
              <p
                className="mt-2 text-sm leading-relaxed text-neutral-500"
                dangerouslySetInnerHTML={{ __html: t("android_tip") }}
              />
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🍎</span>
                <h3 className="font-bold">{t("ios_title")}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {t("ios_p1")}
              </p>
              <ol className="mt-2 space-y-1 text-sm text-neutral-600">
                <li dangerouslySetInnerHTML={{ __html: t("ios_step1") }} />
                <li dangerouslySetInnerHTML={{ __html: t("ios_step2") }} />
                <li dangerouslySetInnerHTML={{ __html: t("ios_step3") }} />
                <li dangerouslySetInnerHTML={{ __html: t("ios_step4") }} />
              </ol>
              <p className="mt-3 text-sm text-neutral-500">{t("ios_note")}</p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">✈️</span>
                <h3 className="font-bold">{t("tg_tuto_title")}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {t("tg_tuto_p1")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {t("tg_tuto_tip")}
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">📧</span>
                <h3 className="font-bold">{t("email_tuto_title")}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {t("email_tuto_p1")}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {t("email_tuto_tip")}
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════

type SectionColor = "emerald" | "violet" | "cyan" | "purple" | "amber";

function SectionContainer({
  title,
  subtitle,
  color,
  children,
}: {
  title: string;
  subtitle: string;
  color: SectionColor;
  children: React.ReactNode;
}) {
  const colorClasses: Record<SectionColor, string> = {
    emerald: "text-emerald-700 border-emerald-200",
    violet: "text-violet-700 border-violet-200",
    cyan: "text-cyan-700 border-cyan-200",
    purple: "text-purple-700 border-purple-200",
    amber: "text-amber-700 border-amber-200",
  };

  return (
    <section>
      <div className={`mb-3 border-b pb-2 ${colorClasses[color]}`}>
        <h2 className="text-base font-extrabold">{title}</h2>
        <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
  color,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color: SectionColor;
}) {
  const bgClasses: Record<SectionColor, string> = {
    emerald: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50",
    violet: "border-violet-200 bg-gradient-to-r from-violet-50 to-violet-100/50",
    cyan: "border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100/50",
    purple: "border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100/50",
    amber: "border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/50",
  };

  return (
    <div className={`rounded-xl border p-4 ${bgClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs opacity-50">{subtitle}</p>
        </div>
        <Toggle value={value} onChange={onChange} disabled={disabled} color={color} />
      </div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
  color,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  color: SectionColor;
}) {
  const onColors: Record<SectionColor, string> = {
    emerald: "bg-emerald-500",
    violet: "bg-violet-500",
    cyan: "bg-cyan-500",
    purple: "bg-purple-500",
    amber: "bg-amber-500",
  };

  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative h-7 w-12 cursor-pointer rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        value ? onColors[color] : "bg-neutral-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
          value ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function TelegramChannelRow({
  title,
  subtitle,
  href,
  channelLabel,
  color,
}: {
  title: string;
  subtitle: string;
  href: string;
  channelLabel: string;
  color: SectionColor;
}) {
  const bgClasses: Record<SectionColor, string> = {
    emerald: "border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50",
    violet: "border-violet-200 bg-gradient-to-r from-violet-50 to-violet-100/50",
    cyan: "border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100/50",
    purple: "border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100/50",
    amber: "border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/50",
  };

  return (
    <div className={`rounded-xl border p-4 ${bgClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs opacity-50">
            {subtitle} ·{" "}
            <span className="font-mono font-semibold">{channelLabel}</span>
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-[#2AABEE] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#229ED9]"
        >
          <TelegramIcon />
          Rejoindre
        </a>
      </div>
    </div>
  );
}

function TelegramIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}