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
    <main className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto max-w-4xl px-2 py-4 sm:px-4 sm:py-6">
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