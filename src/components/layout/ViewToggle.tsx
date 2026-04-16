"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLocale, useTranslations } from "next-intl";

interface ViewToggleProps {
  /**
   * Destination du lien "Mes données" (chemin sans le locale).
   * Utilisé quand isPublic=true. Ex: "/espace/historique"
   */
  privateHref: string;
  /**
   * Destination du lien "Vue site" (chemin sans le locale).
   * Utilisé quand isPublic=false. Ex: "/historique"
   */
  publicHref?: string;
  /**
   * La page actuelle est-elle la vue publique (true) ou la vue perso (false) ?
   */
  isPublic?: boolean;
}

/**
 * Toggle 2 boutons affiché UNIQUEMENT aux utilisateurs connectés.
 * - Non connecté : ne s'affiche pas
 * - Connecté sur page publique : [🌐 Vue site (actif)] [👤 Mes données (lien)]
 * - Connecté sur page privée : [🌐 Vue site (lien)] [👤 Mes données (actif)]
 */
export default function ViewToggle({ privateHref, publicHref, isPublic = true }: ViewToggleProps) {
  const t = useTranslations("view_toggle");
  const locale = useLocale();
  const { user, loading } = useAuth();

  if (loading || !user) return null;

  const fullPrivateHref = `/${locale}${privateHref}`;
  const fullPublicHref = publicHref ? `/${locale}${publicHref}` : null;

  return (
    <div className="mx-auto mt-4 mb-2 flex max-w-2xl items-center justify-center px-4">
      <div className="flex w-72 items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 shadow-sm sm:w-80">
        {/* Vue site */}
        {isPublic ? (
          <button
            type="button"
            disabled
            className="flex flex-1 cursor-default items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-sm"
            aria-pressed={true}
          >
            <span>🌐</span>
            <span>{t("site_view")}</span>
          </button>
        ) : fullPublicHref ? (
          <Link
            href={fullPublicHref}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
          >
            <span>🌐</span>
            <span>{t("site_view")}</span>
          </Link>
        ) : null}

        {/* Mes données */}
        {isPublic ? (
          <Link
            href={fullPrivateHref}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
          >
            <span>👤</span>
            <span>{t("personal_view")}</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="flex flex-1 cursor-default items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-sm"
            aria-pressed={true}
          >
            <span>👤</span>
            <span>{t("personal_view")}</span>
          </button>
        )}
      </div>
    </div>
  );
}