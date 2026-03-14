import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
  const t = useTranslations("home");

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl">
          {t("hero_title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg opacity-70">
          {t("hero_subtitle")}
        </p>
        <div className="mt-10 flex gap-4">
          <Link
            href="/pronostics"
            className="rounded-lg bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/90"
          >
            {t("cta_free")}
          </Link>
          <Link
            href="/abonnement"
            className="rounded-lg border border-white/20 px-6 py-3 font-semibold transition hover:bg-white/10"
          >
            {t("cta_premium")}
          </Link>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 sm:grid-cols-4">
        {(["stats_roi", "stats_profit", "stats_picks", "stats_winrate"] as const).map(
          (key) => (
            <div
              key={key}
              className="rounded-xl border border-white/10 p-6 text-center"
            >
              <p className="text-sm opacity-60">{t(key)}</p>
              <p className="mt-2 text-3xl font-bold">—</p>
            </div>
          )
        )}
      </section>
    </main>
  );
}
