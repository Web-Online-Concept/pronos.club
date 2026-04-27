// src/app/[locale]/pronos-abonnes/en-cours/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import TipsterPickCard from "@/components/tipster/TipsterPickCard";
import PronosAbonnesNav from "@/components/tipster/PronosAbonnesNav";

type Pick = any;

const SPORT_KEYS = [
  "football", "basketball", "tennis", "hockey", "football_us",
  "baseball", "mma", "rugby", "multisports", "autre",
];

export default function PronosAbonnesEnCoursPage() {
  const locale = useLocale();
  const t = useTranslations("pronos_abonnes_en_cours");
  const tSports = useTranslations("pronos_abonnes_sports");
  const { user } = useAuth();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<string>("");

  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  async function fetchPicks() {
    if (!isPremium) { setLoading(false); return; }
    setLoading(true);
    const url = sportFilter
      ? `/api/tipster-picks?filter=live&sport=${encodeURIComponent(sportFilter)}`
      : `/api/tipster-picks?filter=live`;
    const res = await fetch(url);
    const data = await res.json();
    setPicks(data.picks || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchPicks();
  }, [sportFilter, isPremium]);

  return (
    <main className="min-h-screen bg-white">
      {/* Hero compact */}
      <div
        className="px-4 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            {t("hero_badge")}
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{t("hero_title")}</h1>
          <p className="mt-2 text-sm text-white/60">
            {t("hero_subtitle")}
          </p>
        </div>
      </div>

      <PronosAbonnesNav active="en-cours" locale={locale} />

      {/* Filter bar (premium only) */}
      {isPremium && (
        <div className="bg-neutral-50 border-b border-neutral-200">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex justify-center">
              <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-900 outline-none transition hover:border-neutral-400 focus:border-emerald-500"
              >
                <option value="">{t("filter_all_sports")}</option>
                {SPORT_KEYS.map((key) => {
                  const label = tSports(key);
                  return (
                    <option key={key} value={label}>{label}</option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {!isPremium ? (
          <div className="rounded-3xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-white py-16 text-center px-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-black text-neutral-900">{t("locked_title")}</h2>
            <p className="mt-3 max-w-md mx-auto text-sm text-neutral-600">
              {t("locked_desc")}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/${locale}/abonnement`}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
              >
                {t("locked_cta_premium")}
              </Link>
              <Link
                href={`/${locale}/pronos-abonnes/classement`}
                className="rounded-xl border-2 border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-700 transition hover:border-neutral-900"
              >
                {t("locked_cta_ranking")}
              </Link>
            </div>
            <p className="mt-6 text-xs text-neutral-400">
              {t("locked_footer")}
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : picks.length === 0 ? (
          <div className="rounded-3xl bg-neutral-50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
              <span className="text-4xl">🎯</span>
            </div>
            <p className="text-neutral-500 text-sm">
              {t("empty_title")}
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              {t("empty_subtitle")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {picks.map((pick) => (
              <TipsterPickCard key={pick.id} pick={pick} locale={locale} showPseudo />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}