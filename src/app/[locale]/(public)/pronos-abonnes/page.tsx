// src/app/[locale]/(public)/pronos-abonnes/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

type Config = {
  week: { prize_amount: number; min_picks: number; active: boolean };
  month: { prize_amount: number; min_picks: number; active: boolean };
};

export default function PronosAbonnesLanding() {
  const locale = useLocale();
  const t = useTranslations("pronos_abonnes_landing");
  const [config, setConfig] = useState<Config>({
    week: { prize_amount: 10, min_picks: 3, active: true },
    month: { prize_amount: 40, min_picks: 10, active: true },
  });

  useEffect(() => {
    fetch("/api/tipster-concours-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.week && data.month) setConfig(data);
      })
      .catch(() => {});
  }, []);

  const cards = [
    {
      href: `/${locale}/pronos-abonnes/en-cours`,
      icon: "🎯",
      title: t("card_encours_title"),
      desc: t("card_encours_desc"),
    },
    {
      href: `/${locale}/pronos-abonnes/historique`,
      icon: "📋",
      title: t("card_history_title"),
      desc: t("card_history_desc"),
    },
    {
      href: `/${locale}/pronos-abonnes/classement`,
      icon: "🏆",
      title: t("card_classement_title"),
      desc: t("card_classement_desc"),
    },
    {
      href: `/${locale}/pronos-abonnes/concours`,
      icon: "💰",
      title: t("card_concours_title"),
      desc: t("card_concours_desc", { week: config.week.prize_amount, month: config.month.prize_amount }),
      highlight: true,
    },
  ];

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="px-4 py-16 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            {t("hero_badge")}
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{t("hero_title")}</h1>
          <p className="mt-4 text-base text-white/70">
            {t("hero_subtitle_before")}
            <strong className="text-amber-400">{t("hero_subtitle_highlight")}</strong>
            {t("hero_subtitle_after")}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <div className="rounded-xl bg-white/5 border border-emerald-500/30 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">{t("hero_badge_week")}</p>
              <p className="mt-1 text-2xl font-black text-white">{config.week.prize_amount} €</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-amber-500/30 px-5 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400">{t("hero_badge_month")}</p>
              <p className="mt-1 text-2xl font-black text-white">{config.month.prize_amount} €</p>
            </div>
          </div>
          <Link
            href={`/${locale}/pronos-abonnes/fonctionnement`}
            className="mt-6 inline-block text-xs font-bold text-white/60 hover:text-emerald-400 underline"
          >
            {t("hero_link_how")}
          </Link>
        </div>
      </div>

      {/* 4 cards de navigation */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`group relative overflow-hidden rounded-2xl border-2 bg-white p-6 text-center transition hover:-translate-y-1 hover:shadow-xl ${
                card.highlight
                  ? "border-amber-300 hover:border-amber-500 bg-gradient-to-br from-amber-50 to-white"
                  : "border-neutral-200 hover:border-emerald-500"
              }`}
            >
              <div className="mb-3 text-5xl">{card.icon}</div>
              <h3 className={`text-lg font-extrabold ${card.highlight ? "text-amber-900" : "text-neutral-900"}`}>
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-neutral-500">{card.desc}</p>
            </Link>
          ))}
        </div>

        {/* Section gains commercial */}
        <div className="mt-12 rounded-3xl bg-gradient-to-br from-emerald-50 via-amber-50 to-white border-2 border-amber-200 p-8 text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-amber-700">
            {t("concours_badge")}
          </p>
          <h2 className="mt-2 text-2xl font-black text-neutral-900 sm:text-3xl">
            {t("concours_title")}
          </h2>
          <p className="mt-3 text-sm text-neutral-600 max-w-xl mx-auto">
            {t("concours_subtitle_1")}
            <strong className="text-emerald-700">{t("concours_subtitle_2_strong", { week: config.week.prize_amount })}</strong>
            {t("concours_subtitle_3")}
            <strong className="text-amber-700">{t("concours_subtitle_4_strong", { month: config.month.prize_amount })}</strong>
            {t("concours_subtitle_5")}
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="rounded-xl bg-white border-2 border-emerald-300 p-4">
              <div className="text-3xl">🏆</div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-emerald-700">{t("concours_week_label")}</p>
              <p className="text-3xl font-black text-emerald-600">{config.week.prize_amount} €</p>
              <p className="mt-1 text-[11px] text-neutral-500">{t("concours_week_details", { min: config.week.min_picks })}</p>
            </div>
            <div className="rounded-xl bg-white border-2 border-amber-300 p-4">
              <div className="text-3xl">👑</div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-700">{t("concours_month_label")}</p>
              <p className="text-3xl font-black text-amber-600">{config.month.prize_amount} €</p>
              <p className="mt-1 text-[11px] text-neutral-500">{t("concours_month_details", { min: config.month.min_picks })}</p>
            </div>
          </div>
          <Link
            href={`/${locale}/pronos-abonnes/concours`}
            className="mt-6 inline-block rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-600/25 transition hover:bg-amber-500"
          >
            {t("concours_cta")}
          </Link>
        </div>

        {/* Guide résumé */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-black text-neutral-900">{t("guide_title")}</h2>
          <p className="mt-3 text-sm text-neutral-600 max-w-xl mx-auto">
            {t("guide_subtitle_1")}
            <strong className="text-emerald-600">{t("guide_subtitle_2_strong")}</strong>
            {t("guide_subtitle_3")}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/pronos-abonnes/fonctionnement`}
              className="rounded-xl border-2 border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-700 transition hover:border-emerald-500"
            >
              {t("guide_cta_guide")}
            </Link>
            <Link
              href={`/${locale}/abonnement`}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
            >
              {t("guide_cta_premium")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}