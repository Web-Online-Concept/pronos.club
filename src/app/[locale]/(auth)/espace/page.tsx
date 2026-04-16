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

  const CARD_CLASS =
    "overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg";
  const CARD_STYLE = { background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" };

  return (
    <>
      <EspaceHero title={user?.pseudo ? `${user.pseudo}` : t("hero_default")} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">

          {/* 1. Mes Stats */}
          <Link href={`/${locale}/espace/stats`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">📈</span>
            <h3 className="mt-2 font-bold text-white">{t("stats_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("stats_desc")}</p>
          </Link>

          {/* 2. Mon Historique */}
          <Link href={`/${locale}/espace/historique`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">📋</span>
            <h3 className="mt-2 font-bold text-white">{t("history_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("history_desc")}</p>
          </Link>

          {/* 3. Value Calculator — premium only */}
          {isPremium && (
            <Link href={`/${locale}/espace/value-calculator`} className={CARD_CLASS} style={CARD_STYLE}>
              <span className="text-2xl">🧮</span>
              <h3 className="mt-2 font-bold text-white">Value Calculator</h3>
              <p className="mt-1 text-sm text-white/40">Calculateur de Value Bet PS3838</p>
            </Link>
          )}

          {/* 4. Montantes — premium only */}
          {isPremium && (
            <Link href={`/${locale}/espace/montantes`} className={CARD_CLASS} style={CARD_STYLE}>
              <span className="text-2xl">📊</span>
              <h3 className="mt-2 font-bold text-white">Montantes</h3>
              <p className="mt-1 text-sm text-white/40">Gestionnaire de montantes</p>
            </Link>
          )}

          {/* 5. Ma Gestion de BK */}
          <Link href={`/${locale}/espace/gestion-bk`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">🏦</span>
            <h3 className="mt-2 font-bold text-white">{t("bk_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("bk_desc")}</p>
          </Link>

          {/* 6. Appli Mobile */}
          <Link href={`/${locale}/espace/app-mobile`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">📱</span>
            <h3 className="mt-2 font-bold text-white">{t("app_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("app_desc")}</p>
          </Link>

          {/* 7. Mon Profil */}
          <Link href={`/${locale}/espace/profil`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">👤</span>
            <h3 className="mt-2 font-bold text-white">{t("profile_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("profile_desc")}</p>
          </Link>

          {/* 8. Réseaux Sociaux */}
          <Link href={`/${locale}/espace/reseaux`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">🌐</span>
            <h3 className="mt-2 font-bold text-white">{t("social_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("social_desc")}</p>
          </Link>

          {/* 9. Notifications */}
          <Link href={`/${locale}/espace/notifications`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">🔔</span>
            <h3 className="mt-2 font-bold text-white">{t("notif_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("notif_desc")}</p>
          </Link>

          {/* 10. Mon Avis */}
          <Link href={`/${locale}/espace/avis`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">⭐</span>
            <h3 className="mt-2 font-bold text-white">{t("review_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("review_desc")}</p>
          </Link>

          {/* 11. Mon Abonnement */}
          <Link href={`/${locale}/espace/abonnement`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">💎</span>
            <h3 className="mt-2 font-bold text-white">{t("sub_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("sub_desc")}</p>
          </Link>

          {/* 12. Administration — admins only */}
          {isAdmin && (
            <Link
              href={`/${locale}/admin`}
              className="overflow-hidden rounded-xl border-2 border-emerald-500 p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
              style={CARD_STYLE}
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