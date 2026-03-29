"use client";

import EspaceHero from "@/components/layout/EspaceHero";
import { useTranslations } from "next-intl";

export default function AppMobilePage() {
  const t = useTranslations("app_mobile");

  const WHY_ICONS = ["🔔", "📱", "⚡", "🚫", "🆓"];

  return (
    <>
      <EspaceHero title={t("hero")} />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <p className="text-sm text-neutral-500">{t("intro")}</p>

        <div className="mt-8 space-y-6">

          {/* Android */}
          <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-5 py-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h2 className="font-bold text-emerald-900">{t("android_title")}</h2>
                <p className="text-[10px] text-emerald-600">{t("android_browsers")}</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">{n}</div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{t(`a${n}`)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{t(`a${n}d`)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-700" dangerouslySetInnerHTML={{ __html: t("android_done") }} />
              </div>
            </div>
          </div>

          {/* iOS */}
          <div className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-5 py-3">
              <span className="text-2xl">🍎</span>
              <div>
                <h2 className="font-bold text-blue-900">{t("ios_title")}</h2>
                <p className="text-[10px] text-blue-600">{t("ios_browsers")}</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4">
                <p className="text-xs text-amber-700" dangerouslySetInnerHTML={{ __html: t("ios_warning") }} />
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">{n}</div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800">{t(`i${n}`)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{t(`i${n}d`)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-700" dangerouslySetInnerHTML={{ __html: t("ios_why") }} />
              </div>
            </div>
          </div>

          {/* PC */}
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white">
            <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-5 py-3">
              <span className="text-2xl">💻</span>
              <div>
                <h2 className="font-bold text-neutral-800">{t("pc_title")}</h2>
                <p className="text-[10px] text-neutral-500">{t("pc_browsers")}</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm text-neutral-600" dangerouslySetInnerHTML={{ __html: t("pc_p1") }} />
              <p className="mt-3 text-xs text-neutral-400">{t("pc_p2")}</p>
            </div>
          </div>

          {/* Avantages */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5">
            <h3 className="font-bold text-emerald-900">{t("why_title")}</h3>
            <div className="mt-3 space-y-2">
              {t("why_items").split("|").map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-sm">{WHY_ICONS[i]}</span>
                  <p className="text-sm text-emerald-800">{item}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  );
}