/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /[locale]/pronos-ia/comment-ca-marche (V3.5 light theme)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Refonte complète en page CLAIRE (background blanc, accents violet/emerald).
 *
 * Conserve :
 *   - Système i18n FR/EN/ES via next-intl (namespace ai_picks)
 *   - Toutes les clés de traduction existantes (howitworks_*)
 *   - JSON-LD FAQ Schema pour rich snippets Google
 *   - Composants helpers (PronosIAHero, PronosIAButton, AIDisclaimer)
 *
 * Refondu :
 *   - Sections : fond blanc avec bordure subtile + ombre douce (au lieu
 *     du gradient slate-900/indigo-900/purple-900)
 *   - FAQ : detail/summary style clair
 *   - CTA : gradient violet clair impactant mais lumineux
 *
 * Path : src/app/[locale]/(public)/pronos-ia/comment-ca-marche/page.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import PronosIAButton from "@/components/ai-picks/ui/PronosIAButton";
import { buildPronosIAMetadata } from "@/lib/ai/ai-picks-metadata";

export const revalidate = 3600;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPronosIAMetadata(locale, "howitworks");
}


/**
 * JSON-LD FAQ Schema
 * Les 9 questions/réponses de la FAQ exposées au format structured data
 * pour permettre à Google de les afficher en rich snippets dans les résultats.
 */
async function buildFaqJsonLd(locale: string) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  const questions = Array.from({ length: 9 }, (_, i) => ({
    "@type": "Question",
    name: t(`howitworks_faq_q${i + 1}`),
    acceptedAnswer: {
      "@type": "Answer",
      text: t(`howitworks_faq_a${i + 1}`),
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions,
  };
}


export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });
  const faqJsonLd = await buildFaqJsonLd(locale);

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-zinc-900">

      {/* JSON-LD : FAQ schema pour rich snippets Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* HERO FULL-WIDTH (composant existant, déjà visuellement cohérent) */}
      <PronosIAHero
        locale={locale}
        currentPage="how"
        title={t("howitworks_page_title")}
      />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">

        {/* Sous-titre */}
        <p className="mb-10 text-center text-sm text-zinc-600 sm:text-base">
          {t("howitworks_page_subtitle")}
        </p>

        {/* ALERTE HAUT (déjà claire dans la version originale) */}
        <div className="mb-10 rounded-2xl border border-amber-300/60 bg-amber-50 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
              <AlertTriangle size={20} strokeWidth={2.5} className="text-amber-700" />
            </div>
            <div>
              <h2 className="mb-1.5 text-base font-bold text-amber-900">
                {t("howitworks_alert_title")}
              </h2>
              <p className="text-sm leading-relaxed text-amber-900/90">
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
            <p className="leading-relaxed font-semibold text-violet-700">
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
              <Step number={5} title={t("howitworks_s2_step5_title")}>
                {t("howitworks_s2_step5_text")}
              </Step>
            </ul>
          </Section>

          <Section
            emoji="🎯"
            title={t("howitworks_s3_title")}
            intro={t("howitworks_s3_intro")}
          >
            <div className="grid gap-4 md:grid-cols-2">
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
                title={t("howitworks_s3_valuebet_title")}
                items={[
                  t("howitworks_s3_valuebet_1"),
                  t("howitworks_s3_valuebet_2"),
                  t("howitworks_s3_valuebet_3"),
                  t("howitworks_s3_valuebet_4"),
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
            <ul className="my-4 ml-5 list-disc space-y-2 text-zinc-700">
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
            <p className="leading-relaxed font-semibold text-violet-700">
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

          {/* SECTION FAQ — version claire */}
          <section className="relative overflow-hidden rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-white via-violet-50/40 to-fuchsia-50/30 p-6 shadow-sm sm:p-8">
            <div
              aria-hidden
              className="absolute left-0 top-0 h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #8b5cf6 30%, #d946ef 70%, transparent 100%)",
              }}
            />

            <div className="relative z-10">
              <div className="mb-6">
                <h2 className="flex items-center gap-3 text-2xl font-bold text-zinc-900">
                  <span>🙋</span>
                  <span>{t("howitworks_faq_title")}</span>
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
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

          {/* CTA FINAL — clair lumineux */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 via-fuchsia-50 to-violet-100 p-8 text-center shadow-md">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(168, 85, 247, 0.18) 0%, transparent 60%)",
              }}
            />
            <div
              aria-hidden
              className="absolute left-0 top-0 h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #8b5cf6 30%, #d946ef 70%, transparent 100%)",
              }}
            />

            <div className="relative z-10">
              <div className="mb-3 text-5xl">🤖</div>
              <h2 className="mb-3 text-2xl font-extrabold text-zinc-900">
                {t("howitworks_cta_title")}
              </h2>
              <p className="mx-auto mb-6 max-w-xl text-sm text-zinc-700">
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
// SOUS-COMPOSANTS (refonte light theme)
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
    <section className="relative overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white p-6 shadow-sm sm:p-8 transition hover:border-violet-300 hover:shadow-md">
      {/* Top accent line subtile */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, #8b5cf6 30%, #d946ef 70%, transparent 100%)",
        }}
      />

      <div className="relative z-10">
        <h2 className="mb-3 flex items-center gap-3 text-2xl font-extrabold text-zinc-900">
          <span>{emoji}</span>
          <span>{title}</span>
        </h2>
        <p className="mb-5 text-sm text-zinc-600">{intro}</p>
        <div className="space-y-3 text-sm text-zinc-700">{children}</div>
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
          className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-sm font-bold text-white shadow-sm"
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
          }}
        >
          {number}
        </div>
      </div>
      <div>
        <div className="mb-1 font-semibold text-zinc-900">{title}</div>
        <div className="text-sm text-zinc-600">{children}</div>
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
      ? "border-violet-300 bg-violet-50"
      : "border-fuchsia-300 bg-fuchsia-50";

  const checkColor =
    accent === "violet" ? "text-violet-600" : "text-fuchsia-600";

  return (
    <div className={`rounded-xl border-2 p-5 ${styles}`}>
      <h3 className="mb-3 font-semibold text-zinc-900">{title}</h3>
      <ul className="space-y-2 text-sm text-zinc-700">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-0.5 flex-shrink-0 font-bold ${checkColor}`}>✓</span>
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
      <span className="mt-0.5 flex-shrink-0 text-amber-600 font-bold">•</span>
      <span className="text-sm text-zinc-700">{children}</span>
    </li>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border-2 border-zinc-200 bg-white p-4 transition hover:border-violet-300 hover:shadow-sm">
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <span className="flex-shrink-0 text-violet-500 transition group-open:rotate-180">
          ▼
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700">{a}</p>
    </details>
  );
}