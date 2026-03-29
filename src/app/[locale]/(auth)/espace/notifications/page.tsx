"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import PushToggle from "@/components/notifications/PushToggle";
import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations } from "next-intl";

export default function NotificationsPage() {
  const t = useTranslations("notif_page");
  const { user } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(user?.notify_email ?? true);
  const [bilanEnabled, setBilanEnabled] = useState(user?.notify_bilan ?? true);
  const [saving, setSaving] = useState(false);

  const isPremium = user?.subscription_status === "active";

  async function toggleEmail() {
    setSaving(true);
    const newValue = !emailEnabled;
    await fetch("/api/user/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notify_email: newValue }) });
    setEmailEnabled(newValue);
    setSaving(false);
  }

  async function toggleBilan() {
    setSaving(true);
    const newValue = !bilanEnabled;
    await fetch("/api/user/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notify_bilan: newValue }) });
    setBilanEnabled(newValue);
    setSaving(false);
  }

  return (
    <>
      <EspaceHero title={t("hero")} />

    <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
      <p className="text-sm text-neutral-500">{t("intro")}</p>

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-4">
          <PushToggle />
        </div>

        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-blue-100/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("email_title")}</p>
              <p className="text-xs opacity-40">{emailEnabled ? t("email_on") : t("email_off")}</p>
            </div>
            <button onClick={toggleEmail} disabled={saving} className={`relative h-7 w-12 rounded-full transition ${emailEnabled ? "bg-emerald-500" : "bg-neutral-300"}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${emailEnabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>

        <div className={`rounded-xl border p-4 ${isPremium ? "border-cyan-200 bg-gradient-to-r from-cyan-50 to-cyan-100/50" : "border-neutral-200 bg-neutral-50 opacity-60"}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{t("bilan_title")}</p>
                {!isPremium && (<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">{t("bilan_premium")}</span>)}
              </div>
              <p className="text-xs opacity-40">
                {isPremium ? (bilanEnabled ? t("bilan_on") : t("bilan_off")) : t("bilan_locked")}
              </p>
            </div>
            <button onClick={toggleBilan} disabled={saving || !isPremium} className={`relative h-7 w-12 rounded-full transition ${bilanEnabled && isPremium ? "bg-emerald-500" : "bg-neutral-300"} ${!isPremium ? "cursor-not-allowed" : ""}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${bilanEnabled && isPremium ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t("telegram_title")}</p>
              <p className="text-xs opacity-40">{t("telegram_desc")}</p>
            </div>
            <a href="https://t.me/pronos_club_notifs" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-[#2AABEE] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#229ED9]">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
              {t("telegram_join")}
            </a>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-bold">{t("tuto_title")}</h2>
        <p className="mt-1 text-sm text-neutral-500">{t("tuto_intro")}</p>

        <div className="mt-6 space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2"><span className="text-xl">🤖</span><h3 className="font-bold">{t("android_title")}</h3></div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t("android_p1")}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500" dangerouslySetInnerHTML={{ __html: t("android_tip") }} />
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2"><span className="text-xl">🍎</span><h3 className="font-bold">{t("ios_title")}</h3></div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t("ios_p1")}</p>
            <ol className="mt-2 space-y-1 text-sm text-neutral-600">
              <li dangerouslySetInnerHTML={{ __html: t("ios_step1") }} />
              <li dangerouslySetInnerHTML={{ __html: t("ios_step2") }} />
              <li dangerouslySetInnerHTML={{ __html: t("ios_step3") }} />
              <li dangerouslySetInnerHTML={{ __html: t("ios_step4") }} />
            </ol>
            <p className="mt-3 text-sm text-neutral-500">{t("ios_note")}</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2"><span className="text-xl">✈️</span><h3 className="font-bold">{t("tg_tuto_title")}</h3></div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t("tg_tuto_p1")}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">{t("tg_tuto_tip")}</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
            <div className="flex items-center gap-2"><span className="text-xl">📧</span><h3 className="font-bold">{t("email_tuto_title")}</h3></div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t("email_tuto_p1")}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-500">{t("email_tuto_tip")}</p>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}