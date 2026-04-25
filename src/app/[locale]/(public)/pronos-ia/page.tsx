import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import { buildPronosIAMetadata } from "@/lib/ai/ai-picks-metadata";

export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPronosIAMetadata(locale, "live");
}


export default async function PronosIAPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">
      <PronosIAHero
        locale={locale}
        currentPage="live"
        title={t("page_title_live")}
        badgeLabel={t("badge_live_count", { count: 0 })}
      />

      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mb-6 text-6xl">🔧</div>
        <h2 className="mb-4 text-2xl font-bold text-neutral-900">
          Module en maintenance
        </h2>
        <p className="text-neutral-600">
          Le module Pronos IA est temporairement indisponible.
          <br />
          Merci de votre patience.
        </p>
      </main>
    </div>
  );
}