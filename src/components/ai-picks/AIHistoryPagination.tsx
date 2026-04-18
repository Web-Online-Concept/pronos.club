/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIHistoryPagination
 * ═══════════════════════════════════════════════════════════════════
 *
 * Pagination pour la page Historique.
 * Préserve les filtres type/status/sport dans les URLs.
 * ═══════════════════════════════════════════════════════════════════
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";


interface Props {
  currentPage: number;
  totalPages: number;
  type: string;
  status: string;
  sport: string;
  locale: string;
}


export default async function AIHistoryPagination({
  currentPage,
  totalPages,
  type,
  status,
  sport,
  locale,
}: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  /** Construit une URL en préservant les filtres */
  function buildUrl(page: number): string {
    const params = new URLSearchParams();
    if (type !== "all") params.set("type", type);
    if (status !== "all") params.set("status", status);
    if (sport !== "all") params.set("sport", sport);
    if (page > 1) params.set("page", page.toString());
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  // Calculer les pages à afficher (max 5 boutons autour de la page courante)
  const pagesToShow = getPageRange(currentPage, totalPages);

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2"
      aria-label="Pagination"
    >
      {/* Bouton Précédent */}
      <PageLink
        href={currentPage > 1 ? buildUrl(currentPage - 1) : null}
        label={`← ${t("history_pagination_prev")}`}
      />

      {/* Numéros de pages */}
      <div className="flex flex-wrap items-center gap-1">
        {pagesToShow.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-2 text-neutral-600">
              …
            </span>
          ) : (
            <PageNumberLink
              key={p}
              href={buildUrl(p)}
              page={p}
              isActive={p === currentPage}
            />
          ),
        )}
      </div>

      {/* Bouton Suivant */}
      <PageLink
        href={currentPage < totalPages ? buildUrl(currentPage + 1) : null}
        label={`${t("history_pagination_next")} →`}
      />
    </nav>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════

function PageLink({
  href,
  label,
}: {
  href: string | null;
  label: string;
}) {
  if (href === null) {
    return (
      <span className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-2 text-sm text-neutral-600">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-200 transition hover:border-neutral-700 hover:bg-neutral-800"
    >
      {label}
    </Link>
  );
}


function PageNumberLink({
  href,
  page,
  isActive,
}: {
  href: string;
  page: number;
  isActive: boolean;
}) {
  if (isActive) {
    return (
      <span className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-sm font-semibold text-cyan-200">
        {page}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-800"
    >
      {page}
    </Link>
  );
}


// ═══════════════════════════════════════════════════════════════════
// HELPER — range de pages à afficher
// ═══════════════════════════════════════════════════════════════════

/**
 * Calcule les pages à afficher autour de la page courante.
 * Ex: courante=5, total=20 → [1, "...", 3, 4, 5, 6, 7, "...", 20]
 */
function getPageRange(current: number, total: number): Array<number | "..."> {
  if (total <= 7) {
    // Peu de pages : tout afficher
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const range: Array<number | "..."> = [];
  const start = Math.max(2, current - 2);
  const end = Math.min(total - 1, current + 2);

  range.push(1);
  if (start > 2) range.push("...");
  for (let i = start; i <= end; i++) range.push(i);
  if (end < total - 1) range.push("...");
  range.push(total);

  return range;
}