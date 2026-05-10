// src/components/tipster/TipsterNotifSection.tsx
// Section dépliable à insérer dans la page /espace/notifications

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

type Prefs = {
  mode: "none" | "all" | "selected";
  channel_email: boolean;
  channel_telegram: boolean;
  channel_push: boolean;
};

type Follow = {
  tipster_id: string;
  channel_email: boolean;
  channel_telegram: boolean;
  channel_push: boolean;
  created_at: string;
  tipster: {
    id: string;
    pseudo: string;
    avatar_url: string | null;
  } | null;
};

export default function TipsterNotifSection() {
  const { user } = useAuth();
  const locale = useLocale();
  const t = useTranslations("pronos_abonnes_notif_section");
  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({
    mode: "none",
    channel_email: true,
    channel_telegram: false,
    channel_push: false,
  });
  const [follows, setFollows] = useState<Follow[]>([]);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramLinkInfo, setTelegramLinkInfo] = useState<{ token: string; deep_link: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    const [prefsRes, followsRes, tgRes] = await Promise.all([
      fetch("/api/tipster-notif-prefs"),
      fetch("/api/tipster-follows?action=my_follows"),
      fetch("/api/tipsters-telegram-link"),
    ]);
    const prefsData = await prefsRes.json();
    const followsData = await followsRes.json();
    const tgData = await tgRes.json();
    if (prefsData.prefs) setPrefs(prefsData.prefs);
    setFollows(followsData.follows || []);
    setTelegramLinked(!!tgData.linked);
    setLoading(false);
  }

  useEffect(() => {
    if (user && isPremium && open) fetchAll();
  }, [user, isPremium, open]);

  async function updatePrefs(updates: Partial<Prefs>) {
    setSaving(true);
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    await fetch("/api/tipster-notif-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setSaving(false);
  }

  async function updateFollowChannel(tipsterId: string, channel: "email" | "telegram" | "push", value: boolean) {
    const body: any = { tipster_id: tipsterId };
    if (channel === "email") body.channel_email = value;
    if (channel === "telegram") body.channel_telegram = value;
    if (channel === "push") body.channel_push = value;

    await fetch("/api/tipster-follows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setFollows(follows.map((f) =>
      f.tipster_id === tipsterId
        ? { ...f, [`channel_${channel}`]: value }
        : f
    ));
  }

  async function unfollow(tipsterId: string) {
    if (!confirm(t("confirm_unfollow"))) return;
    await fetch(`/api/tipster-follows?tipster_id=${tipsterId}`, { method: "DELETE" });
    setFollows(follows.filter((f) => f.tipster_id !== tipsterId));
  }

  async function generateTelegramLink() {
    const res = await fetch("/api/tipsters-telegram-link", { method: "POST" });
    const data = await res.json();
    if (data.deep_link) setTelegramLinkInfo(data);
  }

  async function unlinkTelegram() {
    if (!confirm(t("confirm_unlink_telegram"))) return;
    await fetch("/api/tipsters-telegram-link", { method: "DELETE" });
    setTelegramLinked(false);
    setTelegramLinkInfo(null);
  }

  if (!user) return null;

  const modeBadgeLabel =
    prefs.mode === "none" ? t("mode_badge_none") :
    prefs.mode === "all" ? t("mode_badge_all") :
    t("mode_badge_selected");

  return (
    <details
      className="group overflow-hidden rounded-2xl border border-white/[0.06] mt-4"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer flex items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-lg">🎯</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-white">{t("title")}</p>
          <p className="text-xs text-white/50">{t("subtitle")}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
          prefs.mode === "none" ? "bg-neutral-500/20 text-neutral-300" :
          prefs.mode === "all" ? "bg-emerald-500/20 text-emerald-300" :
          "bg-amber-500/20 text-amber-300"
        }`}>
          {modeBadgeLabel}
        </span>
        <span className="text-white/40 transition-transform group-open:rotate-180">▼</span>
      </summary>

      <div className="border-t border-white/[0.06] p-5 space-y-5">
        {!isPremium ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-center">
            <p className="text-sm font-bold text-amber-300">{t("premium_locked_title")}</p>
            <Link
              href={`/${locale}/abonnement`}
              className="mt-3 inline-block rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-white transition"
            >
              {t("premium_cta")}
            </Link>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* Mode */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
                {t("mode_section_title")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "none", label: t("mode_none_label"), desc: t("mode_none_desc") },
                  { value: "all", label: t("mode_all_label"), desc: t("mode_all_desc") },
                  { value: "selected", label: t("mode_selected_label"), desc: t("mode_selected_desc") },
                ].map((o) => (
                  <button
                    key={o.value}
                    onClick={() => updatePrefs({ mode: o.value as any })}
                    disabled={saving}
                    className={`cursor-pointer rounded-xl px-3 py-3 text-center transition ${
                      prefs.mode === o.value
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                        : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <p className="text-xs font-bold">{o.label}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Canaux globaux */}
            {prefs.mode !== "none" && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
                  {t("channels_section_title")}
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3 cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={prefs.channel_email}
                      onChange={(e) => updatePrefs({ channel_email: e.target.checked })}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-lg">📧</span>
                    <span className="flex-1 text-sm font-bold text-white">{t("channel_email")}</span>
                    <span className="text-[10px] text-white/40">{user?.email}</span>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3 cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={prefs.channel_push}
                      onChange={(e) => updatePrefs({ channel_push: e.target.checked })}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-lg">🔔</span>
                    <span className="flex-1 text-sm font-bold text-white">{t("channel_push")}</span>
                  </label>
                </div>
              </div>
            )}

            {/* Liste tipsters suivis (si mode selected) */}
            {prefs.mode === "selected" && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3">
                  {t("follows_section_title", { count: follows.length })}
                </p>
                {follows.length === 0 ? (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                    <p className="text-xs text-white/60">
                      {t("no_follows_text")}
                    </p>
                    <Link
                      href={`/${locale}/pronos-abonnes/classement`}
                      className="mt-3 inline-block rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-xs font-bold text-white transition"
                    >
                      {t("no_follows_cta")}
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {follows.map((f) => (
                      <div key={f.tipster_id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <div className="flex items-center gap-3">
                          {f.tipster?.avatar_url ? (
                            <img src={f.tipster.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                              {(f.tipster?.pseudo || "?").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <Link
                            href={`/${locale}/pronos-abonnes/${encodeURIComponent(f.tipster?.pseudo || "")}`}
                            className="flex-1 text-sm font-bold text-white hover:text-emerald-300 truncate"
                          >
                            {f.tipster?.pseudo || "?"}
                          </Link>
                          <button
                            onClick={() => unfollow(f.tipster_id)}
                            className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                          >
                            {t("unfollow_button")}
                          </button>
                        </div>
                        <div className="mt-2 flex gap-1">
                          {prefs.channel_email && (
                            <button
                              onClick={() => updateFollowChannel(f.tipster_id, "email", !f.channel_email)}
                              className={`text-[10px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                                f.channel_email
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-white/5 text-white/40 line-through"
                              }`}
                            >
                              {t("channel_badge_email")}
                            </button>
                          )}
                          {prefs.channel_push && (
                            <button
                              onClick={() => updateFollowChannel(f.tipster_id, "push", !f.channel_push)}
                              className={`text-[10px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                                f.channel_push
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-white/5 text-white/40 line-through"
                              }`}
                            >
                              {t("channel_badge_push")}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Info */}
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-3">
              <p className="text-[11px] text-blue-200 leading-relaxed">
                <strong>{t("info_mode_emploi_title")}</strong>{t("info_mode_emploi_text")}
              </p>
            </div>
          </>
        )}
      </div>
    </details>
  );
}