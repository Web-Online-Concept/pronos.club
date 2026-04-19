/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — TipsterHero (client component)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Hero full-width pour les 4 pages tipster.
 * Client component → compatible server ET client pages.
 *
 * Props :
 *   - locale          : langue courante
 *   - currentPage     : "pronos" | "history" | "stats" | "tipster"
 *   - title           : titre spécifique
 *   - tag             : optionnel, libellé du tag
 *   - children        : slot AVANT les 4 boutons (badges/stats)
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Target, BarChart3, History, User } from "lucide-react";


type CurrentPage = "pronos" | "history" | "stats" | "tipster";


interface Props {
  locale: string;
  currentPage: CurrentPage;
  title: string;
  tag?: string | null;
  children?: React.ReactNode;
}


export default function TipsterHero({
  locale,
  currentPage,
  title,
  tag,
  children,
}: Props) {
  const t = useTranslations("tipster_hero");
  const displayTag = tag ?? t("tag");

  return (
    <div
      className="relative border-b border-emerald-900/50"
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)",
      }}
    >
      {/* Halo lumineux décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(16, 185, 129, 0.2) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-4 py-10">
        <div className="text-center">

          {/* Tag */}
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">
            {displayTag}
          </p>

          {/* Titre */}
          <h1 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
            {title}
          </h1>

          {/* Slot children : badges/stats custom par page (AVANT les boutons) */}
          {children && <div className="mt-4">{children}</div>}

          {/* Nav buttons (4 boutons, un par page) */}
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <NavButton
              href={`/${locale}/pronostics`}
              label={t("nav_pronos")}
              shortLabel={t("nav_pronos_short")}
              Icon={Target}
              active={currentPage === "pronos"}
            />
            <NavButton
              href={`/${locale}/historique`}
              label={t("nav_history")}
              shortLabel={t("nav_history_short")}
              Icon={History}
              active={currentPage === "history"}
            />
            <NavButton
              href={`/${locale}/statistiques`}
              label={t("nav_stats")}
              shortLabel={t("nav_stats_short")}
              Icon={BarChart3}
              active={currentPage === "stats"}
            />
            <NavButton
              href={`/${locale}/tipster`}
              label={t("nav_tipster")}
              shortLabel={t("nav_tipster_short")}
              Icon={User}
              active={currentPage === "tipster"}
            />
          </nav>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANT — Bouton de navigation (actif ou inactif)
// ═══════════════════════════════════════════════════════════════════

function NavButton({
  href,
  label,
  shortLabel,
  Icon,
  active,
}: {
  href: string;
  label: string;
  shortLabel: string;
  Icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
  active: boolean;
}) {
  if (active) {
    return (
      <span
        className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-4 py-2 text-xs font-semibold text-white shadow-md"
        style={{
          background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
        }}
        aria-current="page"
      >
        <Icon size={14} strokeWidth={2.5} />
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur transition hover:border-emerald-400/40 hover:bg-white/10 hover:text-white"
    >
      <Icon size={14} strokeWidth={2.5} />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}