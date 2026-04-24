// src/app/[locale]/pronos-abonnes/historique/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import TipsterPickCard from "@/components/tipster/TipsterPickCard";
import PronosAbonnesNav from "@/components/tipster/PronosAbonnesNav";

type Pick = any;

const SPORT_KEYS = [
  "football", "basketball", "tennis", "hockey", "football_us",
  "baseball", "mma", "rugby", "multisports", "autre",
];

export default function PronosAbonnesHistoriquePage() {
  const locale = useLocale();
  const t = useTranslations("pronos_abonnes_historique");
  const tSports = useTranslations("pronos_abonnes_sports");

  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<string>("");
  const [resultFilter, setResultFilter] = useState<string>("");

  const RESULTS_FILTER = [
    { value: "", label: t("filter_all_results") },
    { value: "won", label: t("filter_won") },
    { value: "half_won", label: t("filter_half_won") },
    { value: "refunded", label: t("filter_refunded") },
    { value: "half_lost", label: t("filter_half_lost") },
    { value: "lost", label: t("filter_lost") },
  ];

  async function fetchPicks() {
    setLoading(true);
    const params = new URLSearchParams({ filter: "resolved", limit: "100" });
    if (sportFilter) params.append("sport", sportFilter);
    const res = await fetch(`/api/tipster-picks?${params}`);
    const data = await res.json();
    let results = data.picks || [];
    if (resultFilter) {
      results = results.filter((p: Pick) => p.result === resultFilter);
    }
    setPicks(results);
    setLoading(false);
  }

  useEffect(() => {
    fetchPicks();
  }, [sportFilter, resultFilter]);

  return (
    <main className="min-h-screen bg-white">
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

      <PronosAbonnesNav active="historique" locale={locale} />

      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex flex-wrap justify-center gap-3">
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-bold text-neutral-900 outline-none transition hover:border-neutral-400 focus:border-emerald-500"
            >
              {RESULTS_FILTER.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

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

      <div className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : picks.length === 0 ? (
          <div className="rounded-3xl bg-neutral-50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
              <span className="text-4xl">📋</span>
            </div>
            <p className="text-neutral-500 text-sm">
              {t("empty_title")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {picks.map((pick) => (
              <TipsterPickCard key={pick.id} pick={pick} locale={locale} showPseudo showResult />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}