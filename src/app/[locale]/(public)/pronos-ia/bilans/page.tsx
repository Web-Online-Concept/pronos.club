/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /[locale]/pronos-ia/bilans (V3.5 refonte)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page publique liste des bilans IA — 2 onglets :
 *   - Hebdomadaires (par défaut, le plus récent au premier plan)
 *   - Mensuels (comportement existant)
 *
 * Système d'onglets URL-driven :
 *   - /pronos-ia/bilans                → onglet Hebdomadaires
 *   - /pronos-ia/bilans?tab=hebdo      → onglet Hebdomadaires
 *   - /pronos-ia/bilans?tab=mensuel    → onglet Mensuels
 *
 * Hero refondu en CLAIR (cohérent V3.5 — jamais de page sombre).
 *
 * Path : src/app/[locale]/(public)/pronos-ia/bilans/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BilansListClient from "./BilansListClient";
import WeeklyBilansListClient from "./WeeklyBilansListClient";


export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}): Promise<Metadata> {
  await params;
  const sp = await searchParams;
  const tab = sp.tab === "mensuel" ? "mensuel" : "hebdo";

  const title =
    tab === "mensuel"
      ? "Bilans mensuels IA · PRONOS.CLUB"
      : "Bilans hebdomadaires IA · PRONOS.CLUB";

  const description =
    tab === "mensuel"
      ? "Bilans mensuels des performances de notre intelligence artificielle : ROI, profit, winrate par mois."
      : "Bilans hebdomadaires des performances de notre intelligence artificielle : ROI, profit, winrate, CLV par semaine.";

  return { title, description };
}


// ─── Types ─────────────────────────────────────────────────────────

export interface AiBilan {
  id: string;
  pick_type: "classic" | "scorer";
  title: string;
  slug: string;
  month: string;
  summary: string | null;
  cover_image: string | null;
  profit: number;
  roi: number;
  win_rate: number;
  total_picks: number;
  is_published: boolean;
  published_at: string | null;
}

export interface WeeklyBilanRow {
  week_slug: string;
  week_iso: string;
  week_year: number;
  week_number: number;
  week_label: string;
  total_picks: number;
  picks_won: number;
  picks_lost: number;
  picks_void: number;
  total_profit_units: number;
  roi_pct: number;
  winrate_pct: number;
  clv_avg_pct: number | null;
  clv_picks_count: number;
  generated_at: string;
}


// ─── Page ─────────────────────────────────────────────────────────

export default async function PronosIABilansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const activeTab: "hebdo" | "mensuel" = sp.tab === "mensuel" ? "mensuel" : "hebdo";

  // ─── Fetch des 2 sources en parallèle ───
  const [{ data: bilansData }, { data: weeklyData }] = await Promise.all([
    supabaseAdmin
      .from("ai_bilans")
      .select("*")
      .eq("is_published", true)
      .eq("pick_type", "classic")
      .order("month", { ascending: false }),
    supabaseAdmin
      .from("weekly_bilans")
      .select(
        "week_slug, week_iso, week_year, week_number, week_label, total_picks, picks_won, picks_lost, picks_void, total_profit_units, roi_pct, winrate_pct, clv_avg_pct, clv_picks_count, generated_at"
      )
      .order("week_iso", { ascending: false }),
  ]);

  const monthlyBilans = (bilansData ?? []) as AiBilan[];
  const weeklyBilans = (weeklyData ?? []) as WeeklyBilanRow[];

  return (
    <div className="pronos-ia-section min-h-[calc(100vh-100px)] bg-white text-zinc-900">

      {/* HERO clair (refonte V3.5) */}
      <section className="relative overflow-hidden border-b border-zinc-200">
        {/* Top accent line */}
        <div
          aria-hidden
          className="absolute left-0 top-0 h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, #8b5cf6 30%, #d946ef 70%, transparent 100%)",
          }}
        />
        {/* Subtle radial accent */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.08) 0%, transparent 60%)",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-4 py-12 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-600">
            Pronos Club · IA
          </p>
          <h1 className="mt-3 text-3xl font-extrabold text-zinc-900 sm:text-4xl">
            Bilans de performance
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-600">
            Performance de notre IA, mise à jour automatiquement après chaque résolution.
            Aucun chiffre maquillé, aucun pick effacé.
          </p>

          {/* Mini stats globales */}
          {(weeklyBilans.length > 0 || monthlyBilans.length > 0) && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {weeklyBilans.length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5">
                  <span className="text-xs font-semibold text-violet-700">
                    {weeklyBilans.length}{" "}
                    {weeklyBilans.length > 1 ? "bilans hebdo" : "bilan hebdo"}
                  </span>
                </span>
              )}
              {monthlyBilans.length > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5">
                  <span className="text-xs font-semibold text-emerald-700">
                    {monthlyBilans.length}{" "}
                    {monthlyBilans.length > 1 ? "bilans mensuels" : "bilan mensuel"}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* TABS */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-3xl px-4">
          <nav
            className="flex justify-center gap-1"
            role="tablist"
            aria-label="Type de bilan"
          >
            <TabLink
              href={`/${locale}/pronos-ia/bilans?tab=hebdo`}
              isActive={activeTab === "hebdo"}
              count={weeklyBilans.length}
            >
              📅 Hebdomadaires
            </TabLink>
            <TabLink
              href={`/${locale}/pronos-ia/bilans?tab=mensuel`}
              isActive={activeTab === "mensuel"}
              count={monthlyBilans.length}
            >
              📊 Mensuels
            </TabLink>
          </nav>
        </div>
      </div>

      {/* CONTENU des onglets */}
      {activeTab === "hebdo" ? (
        <WeeklyBilansListClient locale={locale} bilans={weeklyBilans} />
      ) : (
        <BilansListClient locale={locale} bilans={monthlyBilans} />
      )}
    </div>
  );
}


// ─── Composant Tab (server-side compatible, juste un Link stylé) ───

function TabLink({
  href,
  isActive,
  count,
  children,
}: {
  href: string;
  isActive: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={isActive}
      className={`relative flex items-center gap-2 px-5 py-4 text-sm font-bold transition ${
        isActive
          ? "text-violet-700"
          : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      <span>{children}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
          isActive
            ? "bg-violet-100 text-violet-700"
            : "bg-zinc-100 text-zinc-500"
        }`}
      >
        {count}
      </span>
      {isActive && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-violet-600"
        />
      )}
    </Link>
  );
}