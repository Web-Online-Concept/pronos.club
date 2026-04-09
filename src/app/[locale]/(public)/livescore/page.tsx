// src/app/[locale]/(public)/livescore/page.tsx
import { getTranslations, getLocale } from "next-intl/server";
import type { Metadata } from "next";
import LivescoreClient from "./LivescoreClient";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "livescore" });
  const title = t("meta_title");
  const description = t("meta_desc");
  const url = `https://pronos.club/${locale}/livescore`;
  const ogImage = `https://pronos.club/api/og?title=${encodeURIComponent("Livescore")}&description=${encodeURIComponent("Scores en direct - Tous les sports")}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "PRONOS.CLUB",
      images: [{ url: ogImage, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
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