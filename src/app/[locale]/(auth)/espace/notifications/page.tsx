"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * /espace/notifications/page.tsx (V3.5 Lot 14 + fix bugs notif 11/05/26)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page utilisateur des préférences de notifications.
 *
 * V3.5 Lot 14 (10/05) :
 *   1 push global, granularité par catégorie. Section 5 (Abonnés) lit
 *   tipster_notif_prefs ; Section 3 (Tipster) + Section 6 (Bilans) lisent
 *   directement les colonnes users.
 *
 * Fix bugs notif (11/05/2026) :
 *   - Bug #2 : useState n'initialise plus depuis `u` (qui est null au mount).
 *     Tous les toggles partent à false, puis un useEffect sync depuis u
 *     dès qu'il arrive + flag userPrefsLoaded qui désactive les toggles
 *     pendant le chargement. Avant ce fix, tous les toggles s'affichaient
 *     ON par défaut et l'utilisateur écrasait ses vraies prefs au 1er click.
 *   - Bug #3 : updateUserNotif / updateAbonnesPref vérifient maintenant
 *     response.ok et rollback sur 4xx/5xx (pas seulement sur erreur réseau).
 *     Avant, un 500 silencieux laissait le toggle ON côté UI alors qu'en
 *     base il était OFF.
 *
 * Path : src/app/[locale]/(auth)/espace/notifications/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import PushToggle from "@/components/notifications/PushToggle";
import DevicesList from "@/components/notifications/DevicesList";
import EspaceHero from "@/components/layout/EspaceHero";
import TipsterNotifSection from "@/components/tipster/TipsterNotifSection";
import { useTranslations } from "next-intl";

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

  // ─── Toggles users (Tipster + Bilan) ───
  // Fix bug #2 — init à false, sync via useEffect quand u arrive
  const [tipsterPush, setTipsterPush] = useState(false);
  const [tipsterEmail, setTipsterEmail] = useState(false);
  const [bilanEnabled, setBilanEnabled] = useState(false);
  const [userPrefsLoaded, setUserPrefsLoaded] = useState(false);

  // ─── Toggles Pronos Abonnés (câblés sur tipster_notif_prefs) ───
  const [abonnesPush, setAbonnesPush] = useState(false);
  const [abonnesEmail, setAbonnesEmail] = useState(true);
  const [abonnesPrefsLoaded, setAbonnesPrefsLoaded] = useState(false);

  const [saving, setSaving] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [telegramError, setTelegramError] = useState("");

  const isPremium =
    u?.subscription_status === "active" || u?.subscription_status === "trialing";
  const isInTelegramGroup = !!u?.telegram_user_id;

  // ─── Fix bug #2 — Sync toggles users dès que u est dispo ───
  useEffect(() => {
    if (!u) return;
    setTipsterPush(u.notify_tipster_push ?? true);
    setTipsterEmail(u.notify_tipster_email ?? true);
    setBilanEnabled(u.notify_bilan ?? true);
    setUserPrefsLoaded(true);
  }, [u]);

  // ─── Charger les prefs Pronos Abonnés depuis tipster_notif_prefs ───
  useEffect(() => {
    if (!user || !isPremium) return;
    fetch("/api/tipster-notif-prefs")
      .then((r) => r.json())
      .then((data) => {
        if (data.prefs) {
          setAbonnesPush(data.prefs.channel_push ?? false);
          setAbonnesEmail(data.prefs.channel_email ?? true);
        }
        setAbonnesPrefsLoaded(true);
      })
      .catch(() => setAbonnesPrefsLoaded(true));
  }, [user, isPremium]);

  // ─── Update toggles users (Tipster + Bilan) ───
  // Fix bug #3 — rollback aussi sur !response.ok (pas seulement sur catch réseau)
  async function updateUserNotif(
    field: string,
    newValue: boolean,
    setter: (v: boolean) => void,
  ) {
    setSaving(true);
    setter(newValue);
    try {
      const res = await fetch("/api/user/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error("[notif] updateUserNotif failed", field, e);
      setter(!newValue);
    }
    setSaving(false);
  }

  // ─── Update toggles Pronos Abonnés (tipster_notif_prefs) ───
  // Fix bug #3 — rollback aussi sur !response.ok
  async function updateAbonnesPref(
    field: "channel_push" | "channel_email",
    newValue: boolean,
    setter: (v: boolean) => void,
  ) {
    setSaving(true);
    setter(newValue);
    try {
      // Au premier toggle activé, on force le mode à "selected"
      // (l'utilisateur active des notifs → on suppose qu'il veut filtrer
      // par tipsters qu'il suit)
      const body: Record<string, unknown> = { [field]: newValue };
      if (newValue) body.mode = "selected";

      const res = await fetch("/api/tipster-notif-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error("[notif] updateAbonnesPref failed", field, e);
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
          {/* SECTION 1 — Activation push globale */}
          {/* ════════════════════════════════════════════════════════ */}
  <SectionContainer
    title="Activation des notifications push"
    subtitle="Active une seule fois sur ton appareil — tu choisis ensuite finement quelles notifs recevoir dans chaque section ci-dessous."
    color="emerald"
  >
    <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-4">
      <PushToggle />
      <DevicesList />
    </div>
  </SectionContainer>


          {/* ════════════════════════════════════════════════════════ */}
          {/* SECTION 2 — Groupe Telegram Premium */}
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
                      Lien généré ! Si la page ne s&apos;est pas ouverte :
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
                onChange={(v) =>
                  updateUserNotif("notify_tipster_push", v, setTipsterPush)
                }
                disabled={saving || !userPrefsLoaded}
                color="emerald"
              />
              <ToggleRow
                title="Notifs par email"
                subtitle={tipsterEmail ? "Activées" : "Désactivées"}
                value={tipsterEmail}
                onChange={(v) =>
                  updateUserNotif("notify_tipster_email", v, setTipsterEmail)
                }
                disabled={saving || !userPrefsLoaded}
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
              {/* Toggle Push (câblé sur tipster_notif_prefs.channel_push) */}
              <ToggleRow
                title="Notifs push (PC ou app mobile)"
                subtitle={abonnesPush ? "Activées" : "Désactivées"}
                value={abonnesPush}
                onChange={(v) =>
                  updateAbonnesPref("channel_push", v, setAbonnesPush)
                }
                disabled={saving || !abonnesPrefsLoaded || !isPremium}
                color="cyan"
              />

              {/* Toggle Email (câblé sur tipster_notif_prefs.channel_email) */}
              <ToggleRow
                title="Notifs par email"
                subtitle={abonnesEmail ? "Activées" : "Désactivées"}
                value={abonnesEmail}
                onChange={(v) =>
                  updateAbonnesPref("channel_email", v, setAbonnesEmail)
                }
                disabled={saving || !abonnesPrefsLoaded || !isPremium}
                color="cyan"
              />

              {/* Canal Telegram public */}
              <TelegramChannelRow
                title="Notifs Telegram (canal public)"
                subtitle="Recevez chaque pronostic Abonnés sur Telegram"
                href="https://t.me/pronos_abonnes_club"
                channelLabel="@pronos_abonnes_club"
                color="cyan"
              />

              {/* Liste tipsters suivis (composant simplifié) */}
              <div className="mt-2 pt-3 border-t border-cyan-200">
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
                  onChange={(v) => updateUserNotif("notify_bilan", v, setBilanEnabled)}
                  disabled={saving || !isPremium || !userPrefsLoaded}
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
  // Z1 — Bloc englobant marqué : bordure épaisse + fond teinté + padding généreux.
  // Chaque zone est ainsi clairement délimitée visuellement.
  const containerClasses: Record<SectionColor, string> = {
    emerald: "border-emerald-300 bg-emerald-50/60 shadow-sm shadow-emerald-100",
    violet: "border-violet-300 bg-violet-50/60 shadow-sm shadow-violet-100",
    cyan: "border-cyan-300 bg-cyan-50/60 shadow-sm shadow-cyan-100",
    purple: "border-purple-300 bg-purple-50/60 shadow-sm shadow-purple-100",
    amber: "border-amber-300 bg-amber-50/60 shadow-sm shadow-amber-100",
  };
  const headerColorClasses: Record<SectionColor, string> = {
    emerald: "text-emerald-800 border-emerald-300",
    violet: "text-violet-800 border-violet-300",
    cyan: "text-cyan-800 border-cyan-300",
    purple: "text-purple-800 border-purple-300",
    amber: "text-amber-800 border-amber-300",
  };

  return (
    <section className={`rounded-2xl border-2 p-5 sm:p-6 ${containerClasses[color]}`}>
      <div className={`mb-4 border-b-2 pb-3 ${headerColorClasses[color]}`}>
        <h2 className="text-base font-extrabold sm:text-lg">{title}</h2>
        <p className="mt-1 text-xs text-neutral-600 sm:text-[13px]">{subtitle}</p>
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