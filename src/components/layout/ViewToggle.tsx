"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLocale, useTranslations } from "next-intl";

interface ViewToggleProps {
  /**
   * Destination du lien "Mes données" (chemin sans le locale).
   * Exemples : "/espace/historique", "/espace/historique?status=pending", "/espace/stats"
   */
  privateHref: string;
  /**
   * La page actuelle est-elle la vue publique (true) ou la vue perso (false) ?
   * Détermine quel bouton est actif.
   */
  isPublic?: boolean;
}

/**
 * Toggle 2 boutons affiché UNIQUEMENT aux utilisateurs connectés.
 * - Non connecté : ne s'affiche pas (aucun impact visuel pour les visiteurs)
 * - Connecté : affiche [🌐 Vue site] [👤 Mes données]
 *
 * Sécurité : redirige vers les pages /espace/* déjà protégées par le middleware (auth).
 * Aucun fetch de données perso n'est fait côté client.
 */
export default function ViewToggle({ privateHref, isPublic = true }: ViewToggleProps) {
  const t = useTranslations("view_toggle");
  const locale = useLocale();
  const { user, loading } = useAuth();

  // Pendant le loading OU si non connecté : on n'affiche rien
  if (loading || !user) return null;

  const fullPrivateHref = `/${locale}${privateHref}`;

  return (
    <div className="mx-auto mt-4 flex w-full max-w-md items-center justify-center px-4">
      <div className="flex w-full items-center gap-1 rounded-full border border-neutral-200 bg-white p-1 shadow-sm">
        {/* Vue site */}
        <button
          type="button"
          disabled={isPublic}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${
            isPublic
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
          }`}
          aria-pressed={isPublic}
        >
          <span>🌐</span>
          <span className="truncate">{t("site_view")}</span>
        </button>

        {/* Mes données */}
        {isPublic ? (
          <Link
            href={fullPrivateHref}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
          >
            <span>👤</span>
            <span className="truncate">{t("personal_view")}</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-sm"
            aria-pressed={true}
          >
            <span>👤</span>
            <span className="truncate">{t("personal_view")}</span>
          </button>
        )}
      </div>
    </div>
  );
}