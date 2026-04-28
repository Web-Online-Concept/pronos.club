// src/app/[locale]/(auth)/espace/tipster/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import TipsterPickCard from "@/components/tipster/TipsterPickCard";

export default function TipsterDashboard() {
  const { user } = useAuth();
  const locale = useLocale();
  const t = useTranslations("pronos_abonnes_mon_espace");
  const [stats, setStats] = useState<any>(null);
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    const [statsRes, picksRes] = await Promise.all([
      fetch(`/api/tipster-stats`),
      fetch(`/api/tipster-picks?filter=mine&limit=100`),
    ]);
    const statsData = await statsRes.json();
    const picksData = await picksRes.json();
    setStats(statsData.stats);
    setPicks(picksData.picks || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleDelete(pickId: string) {
    if (!confirm(t("confirm_delete"))) return;
    const res = await fetch(`/api/tipster-picks?id=${pickId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
      return;
    }
    fetchAll();
  }

  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  if (!isPremium) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-black text-neutral-900">{t("locked_title")}</h1>
          <p className="mt-3 text-neutral-500">
            {t("locked_desc")}
          </p>
          <Link
            href={`/${locale}/espace/abonnement`}
            className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-500"
          >
            {t("locked_cta")}
          </Link>
        </div>
      </main>
    );
  }

  const livePicks = picks.filter((p) => p.status === "live");
  const resolvedPicks = picks.filter((p) => p.status === "resolved");

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="px-4 py-10 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            {t("hero_badge")}
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{(user as any)?.pseudo || "Tipster"}</h1>

          {stats && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{t("stat_picks")}</p>
                <p className="mt-1 text-2xl font-extrabold text-white tabular-nums">{stats.total_picks}</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{t("stat_winrate")}</p>
                <p className="mt-1 text-2xl font-extrabold text-white tabular-nums">{stats.winrate}%</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{t("stat_total_units")}</p>
                <p className={`mt-1 text-2xl font-extrabold tabular-nums ${stats.total_units > 0 ? "text-emerald-400" : stats.total_units < 0 ? "text-red-400" : "text-white"}`}>
                  {stats.total_units >= 0 ? "+" : ""}{stats.total_units.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">{t("stat_roi")}</p>
                <p className={`mt-1 text-2xl font-extrabold tabular-nums ${stats.roi > 0 ? "text-emerald-400" : stats.roi < 0 ? "text-red-400" : "text-white"}`}>
                  {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/espace/tipster/nouveau`}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
            >
              {t("cta_new_pick")}
            </Link>
            <Link
              href={`/${locale}/pronos-abonnes/classement`}
              className="rounded-xl bg-white/10 border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
            >
              {t("cta_ranking")}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {livePicks.length > 0 && (
              <div className="mb-12">
                <h2 className="mb-4 text-lg font-extrabold text-neutral-900">
                  {t("section_live", { count: livePicks.length })}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {livePicks.map((pick) => (
                    <TipsterPickCard
                      key={pick.id}
                      pick={pick}
                      locale={locale}
                      showPseudo={false}
                      canDelete
                      onDelete={() => handleDelete(pick.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {resolvedPicks.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-extrabold text-neutral-900">
                  {t("section_resolved", { count: resolvedPicks.length })}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {resolvedPicks.map((pick) => (
                    <TipsterPickCard
                      key={pick.id}
                      pick={pick}
                      locale={locale}
                      showPseudo={false}
                      showResult
                    />
                  ))}
                </div>
              </div>
            )}

            {picks.length === 0 && (
              <div className="rounded-3xl bg-neutral-50 py-16 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
                  <span className="text-4xl">🎯</span>
                </div>
                <p className="text-neutral-500 text-sm">
                  {t("empty_title")}
                </p>
                <Link
                  href={`/${locale}/espace/tipster/nouveau`}
                  className="mt-5 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
                >
                  {t("empty_cta")}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}