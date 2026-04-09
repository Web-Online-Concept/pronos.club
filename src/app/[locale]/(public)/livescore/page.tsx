// src/app/[locale]/(public)/livescore/page.tsx
import { getTranslations, getLocale } from "next-intl/server";
import type { Metadata } from "next";
import LivescoreClient from "./LivescoreClient";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "livescore" });
  return {
    title: t("meta_title"),
    description: t("meta_desc"),
  };
}

export default async function LivescorePage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "livescore" });
  return (
    <main className="min-h-screen bg-neutral-100">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-neutral-900 sm:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-neutral-500">{t("subtitle")}</p>
        </div>
        <LivescoreClient
          labels={{
            live: t("live"),
            scheduled: t("scheduled"),
            finished: t("finished"),
            postponed: t("postponed"),
            noMatches: t("no_matches"),
            loading: t("loading"),
            allSports: t("all_sports"),
            refreshing: t("refreshing"),
            liveNow: t("live_now"),
          }}
        />
      </div>
    </main>
  );
}