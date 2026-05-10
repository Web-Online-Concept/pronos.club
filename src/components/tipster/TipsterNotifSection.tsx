// src/components/tipster/TipsterNotifSection.tsx
//
// V3.5 (10/05/2026) — Simplifié.
//
// Affiche UNIQUEMENT la liste des tipsters suivis avec leurs toggles
// individuels Email/Push.
//
// Les toggles globaux Email/Push pour les Pronos Abonnés sont maintenant
// dans la section parente (page /espace/notifications). Le mode de réception
// est forcé à "selected" : les utilisateurs choisissent explicitement les
// tipsters qu'ils veulent suivre.

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

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
  const isPremium =
    (user as any)?.subscription_status === "active" ||
    (user as any)?.subscription_status === "trialing";

  const [follows, setFollows] = useState<Follow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    try {
      const [prefsRes, followsRes] = await Promise.all([
        fetch("/api/tipster-notif-prefs"),
        fetch("/api/tipster-follows?action=my_follows"),
      ]);
      const prefsData = await prefsRes.json();
      const followsData = await followsRes.json();

      // Migration auto : forcer mode="selected" pour tous les users
      // (le sélecteur de mode a été supprimé, on ne propose plus que ce mode).
      const currentMode = prefsData.prefs?.mode;
      if (currentMode && currentMode !== "selected") {
        await fetch("/api/tipster-notif-prefs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "selected" }),
        });
      }

      setFollows(followsData.follows || []);
    } catch (err) {
      console.error("[TipsterNotifSection] fetchAll error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && isPremium) fetchAll();
    else setLoading(false);
  }, [user, isPremium]);

  async function unfollow(tipsterId: string) {
    if (!confirm(t("confirm_unfollow"))) return;
    setSaving(true);
    await fetch("/api/tipster-follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unfollow", tipster_id: tipsterId }),
    });
    await fetchAll();
    setSaving(false);
  }

  async function updateFollowChannel(
    tipsterId: string,
    channel: "email" | "push",
    value: boolean
  ) {
    setSaving(true);
    const body: Record<string, unknown> = { tipster_id: tipsterId };
    if (channel === "email") body.channel_email = value;
    if (channel === "push") body.channel_push = value;
    await fetch("/api/tipster-follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_channels", ...body }),
    });
    setFollows((prev) =>
      prev.map((f) =>
        f.tipster_id === tipsterId
          ? { ...f, [`channel_${channel}`]: value }
          : f
      )
    );
    setSaving(false);
  }

  if (!user) return null;

  // ─── Bloc premium-locked ────────────────────────────────────────
  if (!isPremium) {
    return (
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 text-center">
        <p className="text-sm font-bold text-amber-700">
          {t("premium_locked_title")}
        </p>
        <Link
          href={`/${locale}/abonnement`}
          className="mt-3 inline-block rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-white transition"
        >
          {t("premium_cta")}
        </Link>
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  // ─── Liste des tipsters suivis ──────────────────────────────────
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 mb-3">
        {t("follows_section_title", { count: follows.length })}
      </p>

      {follows.length === 0 ? (
        <div className="rounded-xl bg-white/60 border border-cyan-200 p-4 text-center">
          <p className="text-xs text-cyan-900/70">{t("no_follows_text")}</p>
          <Link
            href={`/${locale}/pronos-abonnes/classement`}
            className="mt-3 inline-block rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-2 text-xs font-bold text-white transition"
          >
            {t("no_follows_cta")}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {follows.map((f) => (
            <div
              key={f.tipster_id}
              className="rounded-xl bg-white/60 border border-cyan-200 p-3"
            >
              <div className="flex items-center gap-3">
                {f.tipster?.avatar_url ? (
                  <img
                    src={f.tipster.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-cyan-100 flex items-center justify-center text-sm font-bold text-cyan-700">
                    {(f.tipster?.pseudo || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <Link
                  href={`/${locale}/pronos-abonnes/${encodeURIComponent(
                    f.tipster?.pseudo || ""
                  )}`}
                  className="flex-1 text-sm font-bold text-cyan-900 hover:text-cyan-700 truncate"
                >
                  {f.tipster?.pseudo || "?"}
                </Link>
                <button
                  onClick={() => unfollow(f.tipster_id)}
                  disabled={saving}
                  className="text-[10px] text-red-500 hover:text-red-400 cursor-pointer"
                >
                  {t("unfollow_button")}
                </button>
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  onClick={() =>
                    updateFollowChannel(f.tipster_id, "email", !f.channel_email)
                  }
                  disabled={saving}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                    f.channel_email
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-white/40 text-cyan-900/40 line-through border border-cyan-200"
                  }`}
                >
                  {t("channel_badge_email")}
                </button>
                <button
                  onClick={() =>
                    updateFollowChannel(f.tipster_id, "push", !f.channel_push)
                  }
                  disabled={saving}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                    f.channel_push
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-white/40 text-cyan-900/40 line-through border border-cyan-200"
                  }`}
                >
                  {t("channel_badge_push")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}