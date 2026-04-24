// src/components/tipster/PronosAbonnesNav.tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";

type Page = "en-cours" | "historique" | "classement" | "concours" | "fonctionnement";

export default function PronosAbonnesNav({
  active,
  locale,
}: {
  active: Page;
  locale: string;
}) {
  const t = useTranslations("pronos_abonnes_nav");
  const { user } = useAuth();
  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";
  const isLoggedIn = !!user;

  const linkClass = (isActive: boolean) =>
    `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition ${
      isActive
        ? "border-emerald-500 text-emerald-600"
        : "border-transparent text-neutral-500 hover:text-neutral-900"
    }`;

  let cta: { label: string; href: string; color: "emerald" | "amber" };

  if (!isLoggedIn) {
    cta = {
      label: t("cta_premium"),
      href: `/${locale}/abonnement`,
      color: "amber",
    };
  } else if (isPremium) {
    cta = {
      label: t("cta_new_pick"),
      href: `/${locale}/espace/tipster/nouveau`,
      color: "emerald",
    };
  } else {
    cta = {
      label: t("cta_premium"),
      href: `/${locale}/abonnement`,
      color: "amber",
    };
  }

  const ctaClasses =
    cta.color === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25"
      : "bg-amber-500 hover:bg-amber-400 shadow-amber-500/25";

  return (
    <div className="border-b border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex justify-center items-center gap-1 overflow-x-auto">
          <Link href={`/${locale}/pronos-abonnes/en-cours`} className={linkClass(active === "en-cours")}>
            {t("tab_en_cours")}
          </Link>
          <Link href={`/${locale}/pronos-abonnes/historique`} className={linkClass(active === "historique")}>
            {t("tab_historique")}
          </Link>
          <Link href={`/${locale}/pronos-abonnes/classement`} className={linkClass(active === "classement")}>
            {t("tab_classement")}
          </Link>
          <Link href={`/${locale}/pronos-abonnes/concours`} className={linkClass(active === "concours")}>
            {t("tab_concours")}
          </Link>

          <span className="mx-2 text-neutral-300 hidden sm:inline">|</span>

          <Link
            href={cta.href}
            className={`whitespace-nowrap rounded-lg ${ctaClasses} px-3 py-1.5 my-2 text-xs sm:text-sm font-bold text-white shadow transition`}
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}