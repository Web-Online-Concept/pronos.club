// src/components/tipster/TipsterNotifSection.tsx
// V3.5 Lot 14 — refonte simplifiée
// Affiche UNIQUEMENT la liste des tipsters suivis avec leurs préférences
// individuelles (Email / Push). Les toggles globaux email/push ont été
// déplacés dans la page parente (espace/notifications) et écrivent dans
// tipster_notif_prefs.channel_email / channel_push.
//
// Plus de :
//   - bloc "Mode" (Aucun / Tous / Sélectionnés) → forcé à "selected"
//   - bloc "Canaux activés" globaux → déplacés dans la page parente
//   - système Telegram DM personnel via bot (Q92=A : supprimé)

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
  const isPremium =
    (user as { subscription_status?: string } | null)?.subscription_status === "active" ||
    (user as { subscription_status?: string } | null)?.subscription_status === "trialing";

  const [prefs, setPrefs] = useState<Prefs>({
    mode: "none",
    channel_email: true,
    channel_telegram: false,
    channel_push: false,
  });
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    const [prefsRes, followsRes] = await Promise.all([
      fetch("/api/tipster-notif-prefs"),
      fetch("/api/tipster-follows?action=my_follows"),
    ]);
    const prefsData = await prefsRes.json();
    const followsData = await followsRes.json();
    if (prefsData.prefs) {
      setPrefs(prefsData.prefs);
      // V3.5 Lot 14 : on force le mode à "selected" au premier accès
      // (l'utilisateur ne voit plus le choix none/all/selected, par défaut
      // il ne reçoit que les notifs des tipsters qu'il suit explicitement).
      if (prefsData.prefs.mode === "none") {
        await fetch("/api/tipster-notif-prefs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "selected" }),
        });
        setPrefs((p) => ({ ...p, mode: "selected" }));
      }
    }
    setFollows(followsData.follows || []);
    setLoading(false);
  }

  useEffect(() => {
    if (user && isPremium) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPremium]);

  async function updateFollowChannel(
    tipsterId: string,
    channel: "email" | "telegram" | "push",
    value: boolean
  ) {
    const body: Record<string, unknown> = { tipster_id: tipsterId };
    if (channel === "email") body.channel_email = value;
    if (channel === "telegram") body.channel_telegram = value;
    if (channel === "push") body.channel_push = value;

    await fetch("/api/tipster-follows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setFollows(
      follows.map((f) =>
        f.tipster_id === tipsterId ? { ...f, [`channel_${channel}`]: value } : f
      )
    );
  }

  async function unfollow(tipsterId: string) {
    if (!confirm(t("confirm_unfollow"))) return;
    await fetch(`/api/tipster-follows?tipster_id=${tipsterId}`, { method: "DELETE" });
    setFollows(follows.filter((f) => f.tipster_id !== tipsterId));
  }

  if (!user) return null;

  // ─── Premium gate ───
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

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  // ─── Liste tipsters suivis ───
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700 mb-3">
        Mes tipsters suivis ({follows.length})
      </p>

      {follows.length === 0 ? (
        <div className="rounded-xl bg-white border border-neutral-200 p-4 text-center">
          <p className="text-xs text-neutral-600">
            Vous ne suivez aucun tipster pour le moment. Activez les notifications
            email/push ci-dessus puis abonnez-vous à un tipster pour recevoir ses pronos.
          </p>
          <Link
            href={`/${locale}/pronos-abonnes/classement`}
            className="mt-3 inline-block rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-2 text-xs font-bold text-white transition"
          >
            Voir les tipsters
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {follows.map((f) => (
            <div
              key={f.tipster_id}
              className="rounded-xl bg-white border border-neutral-200 p-3"
            >
              <div className="flex items-center gap-3">
                {f.tipster?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={f.tipster.avatar_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-bold text-neutral-700">
                    {(f.tipster?.pseudo || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <Link
                  href={`/${locale}/pronos-abonnes/${encodeURIComponent(f.tipster?.pseudo || "")}`}
                  className="flex-1 text-sm font-bold text-neutral-900 hover:text-cyan-600 truncate"
                >
                  {f.tipster?.pseudo || "?"}
                </Link>
                <button
                  onClick={() => unfollow(f.tipster_id)}
                  className="text-[10px] text-red-500 hover:text-red-400 cursor-pointer"
                >
                  {t("unfollow_button")}
                </button>
              </div>

              {/* Badges canaux par tipster — visibles uniquement si le canal
                  global correspondant est activé dans tipster_notif_prefs */}
              <div className="mt-2 flex gap-1 flex-wrap">
                {prefs.channel_email && (
                  <button
                    onClick={() =>
                      updateFollowChannel(f.tipster_id, "email", !f.channel_email)
                    }
                    className={`text-[10px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                      f.channel_email
                        ? "bg-cyan-100 text-cyan-700"
                        : "bg-neutral-100 text-neutral-400 line-through"
                    }`}
                  >
                    📧 Email
                  </button>
                )}
                {prefs.channel_push && (
                  <button
                    onClick={() =>
                      updateFollowChannel(f.tipster_id, "push", !f.channel_push)
                    }
                    className={`text-[10px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                      f.channel_push
                        ? "bg-cyan-100 text-cyan-700"
                        : "bg-neutral-100 text-neutral-400 line-through"
                    }`}
                  >
                    🔔 Push
                  </button>
                )}
                {!prefs.channel_email && !prefs.channel_push && (
                  <p className="text-[10px] text-neutral-400 italic">
                    Activez Push ou Email ci-dessus pour recevoir des notifs
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}