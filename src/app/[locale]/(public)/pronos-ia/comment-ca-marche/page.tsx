/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/comment-ca-marche (AVEC HERO COHÉRENT)
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import PronosIAButton from "@/components/ai-picks/ui/PronosIAButton";

export const revalidate = 3600;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return {
    title: t("howitworks_meta_title"),
    description: t("howitworks_meta_description"),
    robots: { index: true, follow: true },
  };
}


export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">

      {/* HERO FULL-WIDTH */}
      <PronosIAHero
        locale={locale}
        currentPage="how"
        title={t("howitworks_page_title")}
      />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">

        {/* Sous-titre */}
        <p className="mb-10 text-center text-sm text-neutral-600 sm:text-base">
          {t("howitworks_page_subtitle")}
        </p>

        {/* ALERTE HAUT */}
        <div className="mb-10 rounded-2xl border border-amber-300/60 bg-amber-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertTriangle size={20} strokeWidth={2.5} className="text-amber-700" />
            </div>
            <div>
              <h2 className="mb-1.5 text-base font-bold text-amber-900">
                {t("howitworks_alert_title")}
              </h2>
              <p className="text-sm leading-relaxed text-amber-900/80">
                {t("howitworks_alert_text")}
              </p>
            </div>
          </div>
        </div>

        {/* SECTIONS */}
        <div className="space-y-8">

          <Section
            emoji="🤖"
            title={t("howitworks_s1_title")}
            intro={t("howitworks_s1_intro")}
          >
            <p className="leading-relaxed">{t("howitworks_s1_p1")}</p>
            <p className="leading-relaxed">{t("howitworks_s1_p2")}</p>
            <p className="leading-relaxed font-semibold text-violet-200">
              {t("howitworks_s1_highlight")}
            </p>
          </Section>

          <Section
            emoji="📊"
            title={t("howitworks_s2_title")}
            intro={t("howitworks_s2_intro")}
          >
            <ul className="space-y-3">
              <Step number={1} title={t("howitworks_s2_step1_title")}>
                {t("howitworks_s2_step1_text")}
              </Step>
              <Step number={2} title={t("howitworks_s2_step2_title")}>
                {t("howitworks_s2_step2_text")}
              </Step>
              <Step number={3} title={t("howitworks_s2_step3_title")}>
                {t("howitworks_s2_step3_text")}
              </Step>
              <Step number={4} title={t("howitworks_s2_step4_title")}>
                {t("howitworks_s2_step4_text")}
              </Step>
            </ul>
          </Section>

          <Section
            emoji="🎯"
            title={t("howitworks_s3_title")}
            intro={t("howitworks_s3_intro")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoBox
                title={t("howitworks_s3_classics_title")}
                items={[
                  t("howitworks_s3_classics_1"),
                  t("howitworks_s3_classics_2"),
                  t("howitworks_s3_classics_3"),
                  t("howitworks_s3_classics_4"),
                ]}
                accent="violet"
              />
              <InfoBox
                title={t("howitworks_s3_scorers_title")}
                items={[
                  t("howitworks_s3_scorers_1"),
                  t("howitworks_s3_scorers_2"),
                  t("howitworks_s3_scorers_3"),
                  t("howitworks_s3_scorers_4"),
                ]}
                accent="fuchsia"
              />
            </div>
          </Section>

          <Section
            emoji="📈"
            title={t("howitworks_s4_title")}
            intro={t("howitworks_s4_intro")}
          >
            <p className="leading-relaxed">{t("howitworks_s4_p1")}</p>
            <ul className="my-4 ml-5 list-disc space-y-2 text-white/80">
              <li>{t("howitworks_s4_item1")}</li>
              <li>{t("howitworks_s4_item2")}</li>
              <li>{t("howitworks_s4_item3")}</li>
              <li>{t("howitworks_s4_item4")}</li>
            </ul>
            <p className="leading-relaxed">{t("howitworks_s4_p2")}</p>
          </Section>

          <Section
            emoji="💶"
            title={t("howitworks_s5_title")}
            intro={t("howitworks_s5_intro")}
          >
            <p className="leading-relaxed">{t("howitworks_s5_p1")}</p>
            <p className="leading-relaxed">{t("howitworks_s5_p2")}</p>
            <p className="leading-relaxed font-semibold text-violet-200">
              {t("howitworks_s5_highlight")}
            </p>
          </Section>

          <Section
            emoji="⚡"
            title={t("howitworks_s6_title")}
            intro={t("howitworks_s6_intro")}
          >
            <ul className="space-y-3">
              <LimitItem>{t("howitworks_s6_limit1")}</LimitItem>
              <LimitItem>{t("howitworks_s6_limit2")}</LimitItem>
              <LimitItem>{t("howitworks_s6_limit3")}</LimitItem>
              <LimitItem>{t("howitworks_s6_limit4")}</LimitItem>
              <LimitItem>{t("howitworks_s6_limit5")}</LimitItem>
              <LimitItem>{t("howitworks_s6_limit6")}</LimitItem>
            </ul>
          </Section>

          {/* SECTION FAQ */}
          <section
            className="relative overflow-hidden rounded-2xl border p-6 shadow-xl sm:p-8"
            style={{
              background:
                "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
              borderColor: "rgba(168, 85, 247, 0.25)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)",
              }}
            />
            <div
              aria-hidden
              className="absolute left-0 top-0 h-[2px] w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
              }}
            />

            <div className="relative z-10">
              <div className="mb-6">
                <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
                  <span>🙋</span>
                  <span>{t("howitworks_faq_title")}</span>
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  {t("howitworks_faq_subtitle")}
                </p>
              </div>

              <div className="space-y-3">
                <FaqItem q={t("howitworks_faq_q1")} a={t("howitworks_faq_a1")} />
                <FaqItem q={t("howitworks_faq_q2")} a={t("howitworks_faq_a2")} />
                <FaqItem q={t("howitworks_faq_q3")} a={t("howitworks_faq_a3")} />
                <FaqItem q={t("howitworks_faq_q4")} a={t("howitworks_faq_a4")} />
                <FaqItem q={t("howitworks_faq_q5")} a={t("howitworks_faq_a5")} />
                <FaqItem q={t("howitworks_faq_q6")} a={t("howitworks_faq_a6")} />
                <FaqItem q={t("howitworks_faq_q7")} a={t("howitworks_faq_a7")} />
                <FaqItem q={t("howitworks_faq_q8")} a={t("howitworks_faq_a8")} />
                <FaqItem q={t("howitworks_faq_q9")} a={t("howitworks_faq_a9")} />
              </div>
            </div>
          </section>

          {/* CTA FINAL */}
          <div
            className="relative overflow-hidden rounded-2xl border p-8 text-center text-white"
            style={{
              background:
                "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
              borderColor: "rgba(168, 85, 247, 0.3)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.4) 0%, transparent 60%)",
              }}
            />
            <div
              aria-hidden
              className="absolute left-0 top-0 h-[2px] w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
              }}
            />

            <div className="relative z-10">
              <div className="mb-3 text-5xl">🤖</div>
              <h2 className="mb-3 text-2xl font-extrabold">
                {t("howitworks_cta_title")}
              </h2>
              <p className="mx-auto mb-6 max-w-xl text-sm text-white/70">
                {t("howitworks_cta_text")}
              </p>
              <div className="flex justify-center">
                <PronosIAButton
                  href={`/${locale}/pronos-ia`}
                  variant="primary"
                  size="md"
                >
                  {t("howitworks_cta_button")}
                  <span>→</span>
                </PronosIAButton>
              </div>
            </div>
          </div>

        </div>

        {/* DISCLAIMER BAS */}
        <div className="mt-16">
          <AIDisclaimer locale={locale} />
        </div>

      </main>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SOUS-COMPOSANTS
// ═══════════════════════════════════════════════════════════════════

function Section({
  emoji,
  title,
  intro,
  children,
}: {
  emoji: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-6 shadow-xl sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
        borderColor: "rgba(168, 85, 247, 0.25)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.3) 0%, transparent 50%)",
        }}
      />
      <div
        aria-hidden
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
        }}
      />

      <div className="relative z-10">
        <h2 className="mb-3 flex items-center gap-3 text-2xl font-extrabold text-white">
          <span>{emoji}</span>
          <span>{title}</span>
        </h2>
        <p className="mb-5 text-sm text-white/60">{intro}</p>
        <div className="space-y-3 text-sm text-white/80">{children}</div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <div className="flex-shrink-0">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-bold text-white"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
          }}
        >
          {number}
        </div>
      </div>
      <div>
        <div className="mb-1 font-semibold text-white">{title}</div>
        <div className="text-sm text-white/70">{children}</div>
      </div>
    </li>
  );
}

function InfoBox({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "violet" | "fuchsia";
}) {
  const styles =
    accent === "violet"
      ? "border-violet-400/30 bg-violet-500/10"
      : "border-fuchsia-400/30 bg-fuchsia-500/10";

  const checkColor =
    accent === "violet" ? "text-violet-300" : "text-fuchsia-300";

  return (
    <div className={`rounded-xl border p-5 backdrop-blur ${styles}`}>
      <h3 className="mb-3 font-semibold text-white">{title}</h3>
      <ul className="space-y-2 text-sm text-white/80">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-0.5 flex-shrink-0 ${checkColor}`}>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LimitItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex-shrink-0 text-amber-300">•</span>
      <span className="text-sm text-white/80">{children}</span>
    </li>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur transition hover:border-violet-400/30">
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium text-white [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <span className="flex-shrink-0 text-white/50 transition group-open:rotate-180">
          ▼
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{a}</p>
    </details>
  );
}