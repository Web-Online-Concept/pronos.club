/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/historique
 * ═══════════════════════════════════════════════════════════════════
 *
 * Liste paginée de tous les picks résolus (won/lost/void).
 * Filtres par type, statut, sport via query params.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import AIPickCard, { type AIPickRow } from "@/components/ai-picks/AIPickCard";
import AIScorerCard, { type AIScorerRow } from "@/components/ai-picks/AIScorerCard";
import AIHistoryFilters from "@/components/ai-picks/AIHistoryFilters";
import AIHistoryPagination from "@/components/ai-picks/AIHistoryPagination";

export const dynamic = "force-dynamic"; // Toujours à jour (filtres)


// ═══════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════

const PER_PAGE = 20;

type FilterType = "all" | "classic" | "scorer";
type FilterStatus = "all" | "won" | "lost" | "void";
type FilterSport = "all" | "soccer" | "tennis" | "basketball";

const VALID_TYPES: FilterType[] = ["all", "classic", "scorer"];
const VALID_STATUSES: FilterStatus[] = ["all", "won", "lost", "void"];
const VALID_SPORTS: FilterSport[] = ["all", "soccer", "tennis", "basketball"];


// ═══════════════════════════════════════════════════════════════════
// MÉTADONNÉES SEO
// ═══════════════════════════════════════════════════════════════════

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return {
    title: t("history_meta_title"),
    description: t("history_meta_description"),
    robots: { index: true, follow: true },
  };
}


// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    type?: string;
    status?: string;
    sport?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  // Valider les filtres (fallback sur "all" si invalide)
  const type = VALID_TYPES.includes(sp.type as FilterType)
    ? (sp.type as FilterType)
    : "all";
  const status = VALID_STATUSES.includes(sp.status as FilterStatus)
    ? (sp.status as FilterStatus)
    : "all";
  const sport = VALID_SPORTS.includes(sp.sport as FilterSport)
    ? (sp.sport as FilterSport)
    : "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Construire la query
  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      "id, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, odds_comparison, reasoning, ai_confidence, status, final_score",
      { count: "exact" },
    )
    .neq("status", "pending") // On n'affiche pas les pending dans l'historique
    .order("event_date", { ascending: false });

  if (type !== "all") query = query.eq("pick_type", type);
  if (status !== "all") query = query.eq("status", status);
  if (sport !== "all") query = query.eq("sport", sport);

  // Pagination
  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[history] Erreur fetch picks:", error);
  }

  const picks = data ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
      <main className="pronos-ia-section mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

        {/* ═══ HEADER ═══ */}
        <header className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
            <span>🕐</span>
            {t("history_badge")}
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {t("history_page_title")}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-neutral-400">
            {t("history_page_subtitle", { total: totalCount })}
          </p>
        </header>

        {/* ═══ BACK LINK ═══ */}
        <div className="mb-6">
          <Link
            href={`/${locale}/pronos-ia`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-neutral-200"
          >
            <span>←</span>
            <span>{t("link_back_to_picks")}</span>
          </Link>
        </div>

        {/* ═══ FILTRES ═══ */}
        <AIHistoryFilters
          currentType={type}
          currentStatus={status}
          currentSport={sport}
          locale={locale}
        />

        {/* ═══ RÉSULTATS ═══ */}
        {totalCount === 0 ? (
          <EmptyHistory
            title={t("history_empty_title")}
            description={t("history_empty_description")}
          />
        ) : (
          <>
            {/* Counter */}
            <div className="my-6 text-center text-sm text-neutral-500">
              {t("history_count_info", {
                count: picks.length,
                total: totalCount,
                page,
                totalPages,
              })}
            </div>

            {/* Liste */}
            <div className="space-y-4">
              {picks.map((pick) => {
                const base = pick as unknown;

                if (pick.pick_type === "classic") {
                  return (
                    <AIPickCard
                      key={pick.id}
                      pick={base as AIPickRow}
                      locale={locale}
                    />
                  );
                }
                return (
                  <AIScorerCard
                    key={pick.id}
                    pick={base as AIScorerRow}
                    locale={locale}
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-10">
                <AIHistoryPagination
                  currentPage={page}
                  totalPages={totalPages}
                  type={type}
                  status={status}
                  sport={sport}
                  locale={locale}
                />
              </div>
            )}
          </>
        )}

        {/* ═══ DISCLAIMER BAS ═══ */}
        <div className="mt-16">
          <AIDisclaimer locale={locale} compact />
        </div>

      </main>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════

function EmptyHistory({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="my-16 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-10 text-center">
      <div className="mb-4 text-5xl">🕐</div>
      <h3 className="mb-2 text-xl font-semibold text-neutral-100">{title}</h3>
      <p className="mx-auto max-w-md text-sm text-neutral-400">{description}</p>
    </div>
  );
}