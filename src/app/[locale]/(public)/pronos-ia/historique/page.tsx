/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/historique (AVEC HERO COHÉRENT)
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import AIPickCard, { type AIPickRow } from "@/components/ai-picks/AIPickCard";
import AIScorerCard, { type AIScorerRow } from "@/components/ai-picks/AIScorerCard";
import AIHistoryFilters from "@/components/ai-picks/AIHistoryFilters";
import AIHistoryPagination from "@/components/ai-picks/AIHistoryPagination";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import { buildPronosIAMetadata } from "@/lib/ai/ai-picks-metadata";

export const dynamic = "force-dynamic";


const PER_PAGE = 20;

type FilterType = "all" | "classic" | "scorer";
type FilterStatus = "all" | "awaiting" | "won" | "lost" | "void";
type FilterSport = "all" | "soccer" | "tennis" | "basketball";

const VALID_TYPES: FilterType[] = ["all", "classic", "scorer"];
const VALID_STATUSES: FilterStatus[] = [
  "all",
  "awaiting",
  "won",
  "lost",
  "void",
];
const VALID_SPORTS: FilterSport[] = ["all", "soccer", "tennis", "basketball"];


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPronosIAMetadata(locale, "history");
}


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

  const type: FilterType = VALID_TYPES.includes(sp.type as FilterType)
    ? (sp.type as FilterType)
    : "all";
  const status: FilterStatus = VALID_STATUSES.includes(sp.status as FilterStatus)
    ? (sp.status as FilterStatus)
    : "all";
  const sport: FilterSport = VALID_SPORTS.includes(sp.sport as FilterSport)
    ? (sp.sport as FilterSport)
    : "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const nowISO = new Date().toISOString();

  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      "id, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, odds_comparison, reasoning, ai_confidence, status, final_score",
      { count: "exact" },
    )
    .or(
      `status.in.(won,lost,void),and(status.eq.pending,event_date.lte.${nowISO})`,
    )
    .order("event_date", { ascending: false });

  if (type !== "all") query = query.eq("pick_type", type);
  if (sport !== "all") query = query.eq("sport", sport);

  if (status === "awaiting") {
    query = query.eq("status", "pending").lte("event_date", nowISO);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

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
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">

      {/* HERO FULL-WIDTH */}
      <PronosIAHero
        locale={locale}
        currentPage="history"
        title={t("history_page_title")}
        badgeLabel={
          totalCount > 0
            ? t("history_badge_count", { count: totalCount })
            : null
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">

        {/* Sous-titre */}
        <p className="mb-8 text-center text-sm text-neutral-600 sm:text-base">
          {t("history_page_subtitle_generic")}
        </p>

        {/* FILTRES */}
        <AIHistoryFilters
          currentType={type}
          currentStatus={status}
          currentSport={sport}
          locale={locale}
        />

        {/* RÉSULTATS */}
        {totalCount === 0 ? (
          <EmptyHistory locale={locale} />
        ) : (
          <>
            <div className="my-6 text-center text-xs text-neutral-500">
              {t("history_count_info", {
                count: picks.length,
                total: totalCount,
                page,
                totalPages,
              })}
            </div>

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

        <div className="mt-16">
          <AIDisclaimer locale={locale} />
        </div>
      </main>
    </div>
  );
}


async function EmptyHistory({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <div
      className="relative my-12 overflow-hidden rounded-2xl border p-10 text-center text-white sm:p-14"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
        borderColor: "rgba(168, 85, 247, 0.25)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.35) 0%, transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
        }}
      />
      <div className="relative z-10">
        <div className="mb-4 text-5xl">🕐</div>
        <h3 className="mb-2 text-xl font-extrabold">
          {t("history_empty_title")}
        </h3>
        <p className="mx-auto max-w-md text-sm text-white/70">
          {t("history_empty_description")}
        </p>
      </div>
    </div>
  );
}