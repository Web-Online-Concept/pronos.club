"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations, useLocale } from "next-intl";
import { isO05Authorized } from "@/lib/over-05-buts-equipes/auth";

export default function MemberDashboard() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { user, signOut } = useAuth();
  const isAdmin = user?.is_admin === true;
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";
  const hasO05Access = isO05Authorized(user?.email);

  const CARD_CLASS =
    "overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg";
  const CARD_STYLE = { background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" };

  // ═══════════════════════════════════════════════════════════════
  // SECTION HEADER COMPONENT — centré, icône au-dessus du titre
  // ═══════════════════════════════════════════════════════════════
  const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
    <div className="mb-6 mt-12 flex flex-col items-center text-center first:mt-0">
      {/* Icône dans un rond emerald affirmé */}
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20"
        style={{ background: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)" }}
      >
        {icon}
      </div>

      {/* Titre sur une seule ligne */}
      <h2 className="mt-4 whitespace-nowrap text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">
        {title}
      </h2>

      {/* Barre dégradée centrée */}
      <div className="mt-3 h-0.5 w-24 rounded-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
    </div>
  );

  return (
    <>
      <EspaceHero title={user?.pseudo ? `${user.pseudo}` : t("hero_default")} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 1 — SUIVI PRONOS.CLUB (tipster Jérôme officiel) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <SectionHeader icon="📊" title={t("section_suivi")} />

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Mes Stats */}
          <Link href={`/${locale}/espace/stats`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">📈</span>
            <h3 className="mt-2 font-bold text-white">{t("stats_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("stats_desc")}</p>
          </Link>

          {/* Mon Historique */}
          <Link href={`/${locale}/espace/historique`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">📋</span>
            <h3 className="mt-2 font-bold text-white">{t("history_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("history_desc")}</p>
          </Link>

          {/* Ma Gestion de BK */}
          <Link href={`/${locale}/espace/gestion-bk`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">🏦</span>
            <h3 className="mt-2 font-bold text-white">{t("bk_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("bk_desc")}</p>
          </Link>

          {/* Mes Notifications */}
          <Link href={`/${locale}/espace/notifications`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">🔔</span>
            <h3 className="mt-2 font-bold text-white">{t("notif_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("notif_desc")}</p>
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 2 — OUTILS PRONOS.CLUB (premium only) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isPremium && (
          <>
            <SectionHeader icon="🛠️" title={t("section_outils")} />

            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Pronos Abonnés — visible par l'admin uniquement pendant le développement */}
              {isAdmin && (
                <Link href={`/${locale}/espace/tipster`} className={CARD_CLASS} style={CARD_STYLE}>
                  <span className="text-2xl">🎯</span>
                  <h3 className="mt-2 font-bold text-white">Pronos Abonnés</h3>
                  <p className="mt-1 text-sm text-white/40">Poste tes pronos et grimpe au classement</p>
                </Link>
              )}

              {/* Abonnés Suivi */}
              <Link href={`/${locale}/espace/abonnes-suivis`} className={CARD_CLASS} style={CARD_STYLE}>
                <span className="text-2xl">👥</span>
                <h3 className="mt-2 font-bold text-white">Abonnés Suivi</h3>
                <p className="mt-1 text-sm text-white/40">Pronos en cours des tipsters que vous suivez</p>
              </Link>

              {/* Calculateurs */}
              <Link href={`/${locale}/espace/calculateurs`} className={CARD_CLASS} style={CARD_STYLE}>
                <span className="text-2xl">🧮</span>
                <h3 className="mt-2 font-bold text-white">{t("calc_title")}</h3>
                <p className="mt-1 text-sm text-white/40">{t("calc_desc")}</p>
              </Link>

              {/* Montantes */}
              <Link href={`/${locale}/espace/montantes`} className={CARD_CLASS} style={CARD_STYLE}>
                <span className="text-2xl">📊</span>
                <h3 className="mt-2 font-bold text-white">{t("montantes_title")}</h3>
                <p className="mt-1 text-sm text-white/40">{t("montantes_desc")}</p>
              </Link>

              {/* Martingales */}
              <Link href={`/${locale}/espace/martingales`} className={CARD_CLASS} style={CARD_STYLE}>
                <span className="text-2xl">🎲</span>
                <h3 className="mt-2 font-bold text-white">Martingales</h3>
                <p className="mt-1 text-sm text-white/40">Gérez vos martingales paris sportifs</p>
              </Link>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 2-bis — OUTILS PRIVÉS (whitelist email uniquement) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {hasO05Access && (
          <>
            <SectionHeader icon="🔐" title="Outils Privés" />

            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Over 0.5 buts Equipes */}
              <Link
                href={`/${locale}/espace/over-05-buts-equipes`}
                className={CARD_CLASS}
                style={CARD_STYLE}
              >
                <span className="text-2xl">⚽</span>
                <h3 className="mt-2 font-bold text-white">Over 0.5 buts Equipes</h3>
                <p className="mt-1 text-sm text-white/40">
                  Détection quotidienne d'opportunités de paris en live
                </p>
              </Link>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 3 — GESTION PRONOS.CLUB */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <SectionHeader icon="⚙️" title={t("section_gestion")} />

        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Réseaux Sociaux */}
          <Link href={`/${locale}/espace/reseaux`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">🌐</span>
            <h3 className="mt-2 font-bold text-white">{t("social_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("social_desc")}</p>
          </Link>

          {/* Appli Mobile */}
          <Link href={`/${locale}/espace/app-mobile`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">📱</span>
            <h3 className="mt-2 font-bold text-white">{t("app_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("app_desc")}</p>
          </Link>

          {/* Mon Profil */}
          <Link href={`/${locale}/espace/profil`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">👤</span>
            <h3 className="mt-2 font-bold text-white">{t("profile_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("profile_desc")}</p>
          </Link>

          {/* Mon Avis */}
          <Link href={`/${locale}/espace/avis`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">⭐</span>
            <h3 className="mt-2 font-bold text-white">{t("review_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("review_desc")}</p>
          </Link>

          {/* Mon Abonnement */}
          <Link href={`/${locale}/espace/abonnement`} className={CARD_CLASS} style={CARD_STYLE}>
            <span className="text-2xl">💎</span>
            <h3 className="mt-2 font-bold text-white">{t("sub_title")}</h3>
            <p className="mt-1 text-sm text-white/40">{t("sub_desc")}</p>
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SECTION 4 — PRIVÉ (admin only) */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isAdmin && (
          <>
            <SectionHeader icon="🔒" title={t("section_prive")} />

            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href={`/${locale}/admin`}
                className="overflow-hidden rounded-xl border-2 border-emerald-500 p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
                style={CARD_STYLE}
              >
                <span className="text-2xl">⚙️</span>
                <h3 className="mt-2 font-bold text-emerald-400">{t("admin_title")}</h3>
                <p className="mt-1 text-sm text-emerald-400/60">{t("admin_desc")}</p>
              </Link>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* LOGOUT */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="mt-14 mb-16 text-center">
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