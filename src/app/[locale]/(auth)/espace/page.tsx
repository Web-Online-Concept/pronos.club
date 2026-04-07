"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations, useLocale } from "next-intl";

export default function MemberDashboard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { user, signOut } = useAuth();
  const isAdmin = user?.is_admin === true;
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const CARDS = [
    { href: `/${locale}/espace/stats`, icon: "📈", title: t("stats_title"), desc: t("stats_desc") },
    { href: `/${locale}/espace/historique`, icon: "📋", title: t("history_title"), desc: t("history_desc") },
  ];

  const CARDS_AFTER = [
    { href: `/${locale}/espace/notifications`, icon: "🔔", title: t("notif_title"), desc: t("notif_desc") },
    { href: `/${locale}/espace/gestion-bk`, icon: "🏦", title: t("bk_title"), desc: t("bk_desc") },
    { href: `/${locale}/espace/app-mobile`, icon: "📱", title: t("app_title"), desc: t("app_desc") },
    { href: `/${locale}/espace/profil`, icon: "👤", title: t("profile_title"), desc: t("profile_desc") },
    { href: `/${locale}/espace/reseaux`, icon: "🌐", title: t("social_title"), desc: t("social_desc") },
  ];

  return (
    <>
      <EspaceHero title={user?.pseudo ? `${user.pseudo}` : t("hero_default")} />

    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <span className="text-2xl">{card.icon}</span>
            <h3 className="mt-2 font-bold text-white">{card.title}</h3>
            <p className="mt-1 text-sm text-white/40">{card.desc}</p>
          </Link>
        ))}

        {isPremium && (
          <Link
            href={`/${locale}/espace/value-calculator`}
            className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <span className="text-2xl">🧮</span>
            <h3 className="mt-2 font-bold text-white">Value Calculator</h3>
            <p className="mt-1 text-sm text-white/40">Calculateur de Value Bet PS3838</p>
          </Link>
        )}

        {CARDS_AFTER.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <span className="text-2xl">{card.icon}</span>
            <h3 className="mt-2 font-bold text-white">{card.title}</h3>
            <p className="mt-1 text-sm text-white/40">{card.desc}</p>
          </Link>
        ))}

        <Link
          href={`/${locale}/espace/avis`}
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">⭐</span>
          <h3 className="mt-2 font-bold text-white">{t("review_title")}</h3>
          <p className="mt-1 text-sm text-white/40">{t("review_desc")}</p>
        </Link>

        <Link
          href={`/${locale}/espace/abonnement`}
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">💎</span>
          <h3 className="mt-2 font-bold text-white">{t("sub_title")}</h3>
          <p className="mt-1 text-sm text-white/40">{t("sub_desc")}</p>
        </Link>

        {isAdmin && (
          <Link
            href={`/${locale}/admin`}
            className="overflow-hidden rounded-xl border-2 border-emerald-500 p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <span className="text-2xl">⚙️</span>
            <h3 className="mt-2 font-bold text-emerald-400">{t("admin_title")}</h3>
            <p className="mt-1 text-sm text-emerald-400/60">{t("admin_desc")}</p>
          </Link>
        )}
      </div>

      <div className="mt-8 mb-16 text-center">
        <button
          onClick={signOut}
          className="cursor-pointer rounded-xl border border-red-300 px-8 py-3 text-sm font-bold text-red-500 transition hover:bg-red-50"
        >
          {t("logout")}
        </button>
      </div>
    </main>
    </>
  );
}