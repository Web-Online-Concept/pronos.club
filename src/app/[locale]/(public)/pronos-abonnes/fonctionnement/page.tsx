// src/app/[locale]/(public)/pronos-abonnes/fonctionnement/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import PronosAbonnesNav from "@/components/tipster/PronosAbonnesNav";

type Config = {
  week: { prize_amount: number; min_picks: number; active: boolean };
  month: { prize_amount: number; min_picks: number; active: boolean };
};

// Helper pour rendre les balises <strong> et <a href="..."> inline dans les traductions
function renderHTML(text: string) {
  // On split sur <strong>...</strong> et <a href="...">...</a>
  const parts = text.split(/(<strong>.*?<\/strong>|<a [^>]*>.*?<\/a>)/);
  return parts.map((part, i) => {
    const strongMatch = part.match(/^<strong>(.*?)<\/strong>$/);
    if (strongMatch) return <strong key={i}>{strongMatch[1]}</strong>;
    const linkMatch = part.match(/^<a href="([^"]+)">(.*?)<\/a>$/);
    if (linkMatch) return <a key={i} href={linkMatch[1]} className="font-bold underline">{linkMatch[2]}</a>;
    return <span key={i}>{part}</span>;
  });
}

export default function FonctionnementPage() {
  const locale = useLocale();
  const t = useTranslations("pronos_abonnes_fonctionnement");
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

  return (
    <main className="min-h-screen bg-white">
      <div
        className="px-4 py-10 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            {t("hero_badge")}
          </p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">{t("hero_title")}</h1>
          <p className="mt-3 text-base text-white/70">
            {t("hero_subtitle")}
          </p>
        </div>
      </div>

      <PronosAbonnesNav active="fonctionnement" locale={locale} />

      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="space-y-4">

          {/* 1 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50" open>
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">🎯</span>
              <span>{t("s1_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>{renderHTML(t("s1_p1"))}</p>
              <p className="mt-3">{renderHTML(t("s1_p2"))}</p>
            </div>
          </details>

          {/* 2 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">📸</span>
              <span>{t("s2_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>{renderHTML(t("s2_intro"))}</p>
              <ol className="mt-3 space-y-2 pl-5 list-decimal">
                <li>{renderHTML(t("s2_step1"))}</li>
                <li>{renderHTML(t("s2_step2"))}</li>
                <li>{renderHTML(t("s2_step3"))}</li>
                <li>{renderHTML(t("s2_step4"))}</li>
                <li>{renderHTML(t("s2_step5"))}</li>
                <li>{renderHTML(t("s2_step6"))}</li>
                <li>{renderHTML(t("s2_step7"))}</li>
              </ol>
            </div>
          </details>

          {/* 3 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">📊</span>
              <span>{t("s3_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>{renderHTML(t("s3_intro"))}</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                  <span className="font-bold text-emerald-800">{t("s3_won_label")}</span>
                  <span className="font-extrabold text-emerald-800">{t("s3_won_formula")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-emerald-50/50 px-3 py-2">
                  <span className="font-bold text-emerald-700">{t("s3_half_won_label")}</span>
                  <span className="font-extrabold text-emerald-700">{t("s3_half_won_formula")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
                  <span className="font-bold text-blue-800">{t("s3_refunded_label")}</span>
                  <span className="font-extrabold text-blue-800">{t("s3_refunded_formula")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50/50 px-3 py-2">
                  <span className="font-bold text-red-700">{t("s3_half_lost_label")}</span>
                  <span className="font-extrabold text-red-700">{t("s3_half_lost_formula")}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
                  <span className="font-bold text-red-800">{t("s3_lost_label")}</span>
                  <span className="font-extrabold text-red-800">{t("s3_lost_formula")}</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                {renderHTML(t("s3_example"))}
              </p>
            </div>
          </details>

          {/* 4 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">⚠️</span>
              <span>{t("s4_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">📝</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">{t("s4_rule1_title")}</p>
                    <p className="text-xs mt-1">{t("s4_rule1_desc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">🎯</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">{t("s4_rule2_title")}</p>
                    <p className="text-xs mt-1">{t("s4_rule2_desc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">⏰</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">{t("s4_rule3_title")}</p>
                    <p className="text-xs mt-1">{t("s4_rule3_desc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3">
                  <span className="text-xl">🏦</span>
                  <div>
                    <p className="font-extrabold text-neutral-900">{t("s4_rule4_title")}</p>
                    <p className="text-xs mt-1">{t("s4_rule4_desc")}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-3">
                  <span className="text-xl">🚫</span>
                  <div>
                    <p className="font-extrabold text-red-900">{t("s4_rule5_title")}</p>
                    <p className="text-xs mt-1">{renderHTML(t("s4_rule5_desc"))}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <span className="text-xl">🔒</span>
                  <div>
                    <p className="font-extrabold text-amber-900">{t("s4_rule6_title")}</p>
                    <p className="text-xs mt-1">{renderHTML(t("s4_rule6_desc"))}</p>
                  </div>
                </div>
              </div>
            </div>
          </details>

          {/* 5 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">🏆</span>
              <span>{t("s5_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>{renderHTML(t("s5_intro"))}</p>
              <ul className="mt-3 space-y-2 pl-5 list-disc">
                <li>{renderHTML(t("s5_period_week"))}</li>
                <li>{renderHTML(t("s5_period_month"))}</li>
                <li>{renderHTML(t("s5_period_all"))}</li>
              </ul>
              <p className="mt-4">{renderHTML(t("s5_criteria_intro"))}</p>
              <ul className="mt-2 space-y-1 pl-5 list-disc text-xs">
                <li>{renderHTML(t("s5_criteria_total"))}</li>
                <li>{renderHTML(t("s5_criteria_roi"))}</li>
                <li>{renderHTML(t("s5_criteria_winrate"))}</li>
                <li>{renderHTML(t("s5_criteria_avg"))}</li>
                <li>{renderHTML(t("s5_criteria_form"))}</li>
              </ul>
              <p className="mt-4 text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                {renderHTML(t("s5_note"))}
              </p>
            </div>
          </details>

          {/* 6 */}
          <details className="group rounded-2xl border-2 border-amber-300 bg-amber-50/30 open:border-amber-400 open:shadow-lg open:shadow-amber-100">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg">💰</span>
              <span>{t("s6_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-amber-200 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>{renderHTML(t("s6_intro"))}</p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border-2 border-emerald-300 bg-white p-4 text-center">
                  <div className="text-3xl">🏆</div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-emerald-700">{t("s6_week_label")}</p>
                  <p className="text-3xl font-black text-emerald-600">{config.week.prize_amount} €</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{t("s6_week_min", { min: config.week.min_picks })}</p>
                </div>
                <div className="rounded-xl border-2 border-amber-300 bg-white p-4 text-center">
                  <div className="text-3xl">👑</div>
                  <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-700">{t("s6_month_label")}</p>
                  <p className="text-3xl font-black text-amber-600">{config.month.prize_amount} €</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{t("s6_month_min", { min: config.month.min_picks })}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] italic text-neutral-500 text-center">
                {t.rich("s6_amounts_note", {
                  link: (chunks) => (
                    <Link href={`/${locale}/pronos-abonnes/concours`} className="text-amber-700 font-bold underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>

              <div className="mt-5 space-y-2 text-xs">
                <p>{renderHTML(t("s6_schedule_week"))}</p>
                <p>{renderHTML(t("s6_schedule_month"))}</p>
                <p className="mt-3">
                  {renderHTML(t("s6_criteria", { weekMin: config.week.min_picks, monthMin: config.month.min_picks }))}
                </p>
                <p className="mt-3">{renderHTML(t("s6_badges"))}</p>
              </div>
            </div>
          </details>

          {/* 7 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">💳</span>
              <span>{t("s7_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>{renderHTML(t("s7_p1"))}</p>
              <p className="mt-3">
                {renderHTML(t("s7_p2_before"))}
                <Link href={`/${locale}/espace/profil`} className="text-emerald-600 font-bold underline">
                  {t("s7_p2_link")}
                </Link>
                {t("s7_p2_after")}
              </p>
              <p className="mt-3 text-xs">{renderHTML(t("s7_p3"))}</p>
              <p className="mt-3 text-xs italic text-neutral-500">{t("s7_p4")}</p>
            </div>
          </details>

          {/* 8 */}
          <details className="group rounded-2xl border-2 border-neutral-200 open:border-emerald-300 open:shadow-lg open:shadow-emerald-50">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm font-extrabold text-neutral-900 [&::-webkit-details-marker]:hidden">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg">✅</span>
              <span>{t("s8_title")}</span>
              <span className="ml-auto text-neutral-400 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
              <p>{renderHTML(t("s8_p1"))}</p>
              <p className="mt-3">
                {renderHTML(t("s8_p2_before"))}
                <a href="mailto:contact@pronos.club" className="text-emerald-600 font-bold underline">
                  {t("s8_p2_email")}
                </a>
                {t("s8_p2_after")}
              </p>
            </div>
          </details>

        </div>

        <div className="mt-10 text-center">
          <Link
            href={`/${locale}/espace/tipster/nouveau`}
            className="inline-block rounded-xl bg-emerald-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
          >
            {t("cta_post_first")}
          </Link>
        </div>
      </div>
    </main>
  );
}