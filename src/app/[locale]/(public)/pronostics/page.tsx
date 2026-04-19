import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import PickCard from "@/components/picks/PickCard";
import ViewToggle from "@/components/layout/ViewToggle";
import TipsterHero from "@/components/layout/TipsterHero";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function PronosticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pronostics" });
  const supabase = await createClient();
  const user = await getCurrentUser();
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  const { data: pendingPicks } = await supabase
    .from("picks")
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))")
    .eq("status", "pending")
    .order("event_date", { ascending: true });

  const now = new Date();
  const allPending = pendingPicks ?? [];

  const activePicks = allPending.filter((p) => {
    // Use earliest leg date for combinés, event_date for simples
    const legDates = (p.legs ?? [])
      .map((l: any) => l.event_date)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime());

    const earliestDate = legDates.length > 0
      ? new Date(Math.min(...legDates))
      : new Date(p.event_date);

    return earliestDate > now;
  });

  const premiumCount = activePicks.filter((p) => p.is_premium).length;
  const freeCount = activePicks.filter((p) => !p.is_premium).length;

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col">

      {/* Hero full-width avec 4 boutons nav */}
      <TipsterHero
        locale={locale}
        currentPage="pronos"
        tag={t("tag")}
        title={t("title")}
      >
        {/* Badges existants placés APRÈS les 4 boutons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-400">
              {activePicks.length > 1 ? t("badge_many", { count: activePicks.length }) : t("badge_one", { count: activePicks.length })}
            </span>
          </div>
          {activePicks.length > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5">
              <span className="text-xs font-semibold text-sky-400">
                {freeCount > 1
                  ? t("badge_premium_plural", { premium: premiumCount, free: freeCount })
                  : t("badge_premium", { premium: premiumCount, free: freeCount })}
              </span>
            </div>
          )}
        </div>
      </TipsterHero>

      {/* View Toggle — s'affiche uniquement aux connectés */}
      <ViewToggle privateHref="/espace/historique?status=pending" isPublic={true} />

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4">

        {/* Active picks */}
        {activePicks.length > 0 ? (
          <div className="mt-4 space-y-4">
            {activePicks.map((pick) => (
              <PickCard
                key={pick.id}
                pick={pick}
                locked={pick.is_premium && !isPremium}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-white/[0.06] text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #0a1f16 100%)", minHeight: "280px" }}
          >
            <div className="px-6 py-12">
              <span className="text-4xl">⏳</span>
              <p className="mt-4 text-base font-semibold text-white/70">{t("empty_title")}</p>
              <p className="mt-2 text-sm text-white/40">{t("empty_desc")}</p>
              <Link
                href={`/${locale}/historique`}
                className="mt-5 inline-block rounded-full bg-white/10 px-6 py-2 text-xs font-bold text-white/60 transition hover:bg-white/15 hover:text-white"
              >
                {t("recent_see_all")}
              </Link>
            </div>
          </div>
        )}

        {/* CTA for non-premium */}
        {!isPremium && activePicks.some((p) => p.is_premium) && (
          <div className="mt-8 overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 text-center">
            <span className="text-3xl">🔓</span>
            <p className="mt-2 text-lg font-bold text-neutral-900">
              {t("cta_unlock")}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {t("cta_unlock_desc")}
            </p>
            <Link
              href={`/${locale}/abonnement`}
              className="mt-4 inline-block cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl hover:-translate-y-0.5"
            >
              {t("cta_unlock_btn")}
            </Link>
          </div>
        )}

        {/* Link to full history — always visible */}
        <div className="mt-8 mb-2 text-center">
          <Link
            href={`/${locale}/historique`}
            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-8 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-neutral-800 hover:-translate-y-0.5 hover:shadow-xl"
          >
            Consulter l&apos;historique des pronostics →
          </Link>
        </div>
      </div>
    </div>
  );
}