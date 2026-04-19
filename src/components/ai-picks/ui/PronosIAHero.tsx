/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — PronosIAHero
 * ═══════════════════════════════════════════════════════════════════
 *
 * Hero full-width réutilisé dans les 4 pages Pronos IA.
 * Structure calquée sur le hero tipster (/pronos) pour cohérence,
 * mais avec les couleurs IA (gradient bleu-violet au lieu d'emerald).
 *
 * Props :
 *   - locale          : langue courante
 *   - currentPage     : "live" | "how" | "stats" | "history"
 *                       → le bouton correspondant est en mode actif (gradient)
 *   - title           : titre spécifique à la page
 *   - badgeCount      : nombre à afficher dans le badge (si défini)
 *   - badgeLabel      : libellé custom du badge (ex: "X en cours" sur /pronos-ia)
 *
 * Si badgeCount/badgeLabel sont null, le badge n'est pas affiché.
 * ═══════════════════════════════════════════════════════════════════
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HelpCircle, BarChart3, History, Radio } from "lucide-react";


type CurrentPage = "live" | "how" | "stats" | "history";


interface Props {
  locale: string;
  currentPage: CurrentPage;
  title: string;
  badgeCount?: number | null;
  badgeLabel?: string | null;
}


export default async function PronosIAHero({
  locale,
  currentPage,
  title,
  badgeCount = null,
  badgeLabel = null,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <div
      className="relative border-b border-violet-900/50"
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1e1b4b 50%, #0a0a0a 100%)",
      }}
    >
      {/* Halo lumineux décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(168, 85, 247, 0.25) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-2xl px-4 py-10">
        <div className="text-center">
          {/* Tag (style tipster) */}
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-400">
            {t("hero_tag")}
          </p>

          {/* Titre */}
          <h1
            className="mt-2 text-3xl font-extrabold sm:text-4xl"
            style={{
              background:
                "linear-gradient(135deg, #ffffff 0%, #e9d5ff 50%, #c4b5fd 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {title}
          </h1>

          {/* Badge (si défini) */}
          {badgeLabel !== null && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                </span>
                <span className="text-xs font-semibold text-violet-300">
                  {badgeLabel}
                </span>
              </div>
            </div>
          )}

          {/* Nav buttons (4 boutons, un par page) */}
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <NavButton
              href={`/${locale}/pronos-ia`}
              label={t("nav_live")}
              shortLabel={t("nav_live_short")}
              Icon={Radio}
              active={currentPage === "live"}
            />
            <NavButton
              href={`/${locale}/pronos-ia/stats`}
              label={t("nav_stats")}
              shortLabel={t("nav_stats_short")}
              Icon={BarChart3}
              active={currentPage === "stats"}
            />
            <NavButton
              href={`/${locale}/pronos-ia/historique`}
              label={t("nav_history")}
              shortLabel={t("nav_history_short")}
              Icon={History}
              active={currentPage === "history"}
            />
            <NavButton
              href={`/${locale}/pronos-ia/comment-ca-marche`}
              label={t("nav_how")}
              shortLabel={t("nav_how_short")}
              Icon={HelpCircle}
              active={currentPage === "how"}
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
    // Bouton actif : gradient bleu-violet plein
    return (
      <span
        className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full px-4 py-2 text-xs font-semibold text-white shadow-md"
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
        }}
        aria-current="page"
      >
        <Icon size={14} strokeWidth={2.5} />
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    );
  }

  // Bouton inactif : bordure fine, fond sombre translucide
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur transition hover:border-violet-400/40 hover:bg-white/10 hover:text-white"
    >
      <Icon size={14} strokeWidth={2.5} />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}