/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/comment-ca-marche
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page pédagogique expliquant le fonctionnement des Pronos IA.
 * 8 sections + FAQ.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AIDisclaimer from "@/components/ai-picks/AIDisclaimer";

export const revalidate = 3600; // Page statique, 1h de cache


// ═══════════════════════════════════════════════════════════════════
// MÉTADONNÉES SEO
// ═══════════════════════════════════════════════════════════════════

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


// ═══════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100">
      <main className="pronos-ia-section mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">

        {/* ═══ HEADER ═══ */}
        <header className="mb-10 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
            <span>❓</span>
            {t("howitworks_badge")}
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            {t("howitworks_page_title")}
          </h1>
          <p className="mx-auto max-w-2xl text-base text-neutral-400">
            {t("howitworks_page_subtitle")}
          </p>
        </header>

        {/* ═══ BACK LINK ═══ */}
        <div className="mb-8">
          <Link
            href={`/${locale}/pronos-ia`}
            className="inline-flex items-center gap-1.5 text-sm text-neutral-400 transition hover:text-neutral-200"
          >
            <span>←</span>
            <span>{t("link_back_to_picks")}</span>
          </Link>
        </div>

        {/* ═══ ALERTE HAUT ═══ */}
        <div className="mb-10 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6">
          <div className="flex items-start gap-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <h2 className="mb-2 text-lg font-bold text-amber-300">
                {t("howitworks_alert_title")}
              </h2>
              <p className="text-sm leading-relaxed text-amber-200/80">
                {t("howitworks_alert_text")}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ SECTIONS ═══ */}
        <div className="space-y-10">

          {/* SECTION 1 — C'est quoi ? */}
          <Section
            emoji="🤖"
            title={t("howitworks_s1_title")}
            intro={t("howitworks_s1_intro")}
          >
            <p className="leading-relaxed">
              {t("howitworks_s1_p1")}
            </p>
            <p className="leading-relaxed">
              {t("howitworks_s1_p2")}
            </p>
            <p className="leading-relaxed font-medium text-cyan-200">
              {t("howitworks_s1_highlight")}
            </p>
          </Section>

          {/* SECTION 2 — Comment l'IA choisit */}
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

          {/* SECTION 3 — Pourquoi 2 sections */}
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
              />
              <InfoBox
                title={t("howitworks_s3_scorers_title")}
                items={[
                  t("howitworks_s3_scorers_1"),
                  t("howitworks_s3_scorers_2"),
                  t("howitworks_s3_scorers_3"),
                  t("howitworks_s3_scorers_4"),
                ]}
              />
            </div>
          </Section>

          {/* SECTION 4 — Suivi des performances */}
          <Section
            emoji="📈"
            title={t("howitworks_s4_title")}
            intro={t("howitworks_s4_intro")}
          >
            <p className="leading-relaxed">
              {t("howitworks_s4_p1")}
            </p>
            <ul className="my-4 ml-6 list-disc space-y-2 text-neutral-300">
              <li>{t("howitworks_s4_item1")}</li>
              <li>{t("howitworks_s4_item2")}</li>
              <li>{t("howitworks_s4_item3")}</li>
              <li>{t("howitworks_s4_item4")}</li>
            </ul>
            <p className="leading-relaxed">
              {t("howitworks_s4_p2")}
            </p>
          </Section>

          {/* SECTION 5 — Pourquoi gratuit */}
          <Section
            emoji="💶"
            title={t("howitworks_s5_title")}
            intro={t("howitworks_s5_intro")}
          >
            <p className="leading-relaxed">
              {t("howitworks_s5_p1")}
            </p>
            <p className="leading-relaxed">
              {t("howitworks_s5_p2")}
            </p>
            <p className="leading-relaxed font-medium text-cyan-200">
              {t("howitworks_s5_highlight")}
            </p>
          </Section>

          {/* SECTION 6 — Les limites */}
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

          {/* ═══ SECTION FAQ ═══ */}
          <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="flex items-center gap-3 text-2xl font-bold text-neutral-100">
                <span>🙋</span>
                <span>{t("howitworks_faq_title")}</span>
              </h2>
              <p className="mt-2 text-sm text-neutral-400">
                {t("howitworks_faq_subtitle")}
              </p>
            </div>

            <div className="space-y-4">
              <FaqItem
                question={t("howitworks_faq_q1")}
                answer={t("howitworks_faq_a1")}
              />
              <FaqItem
                question={t("howitworks_faq_q2")}
                answer={t("howitworks_faq_a2")}
              />
              <FaqItem
                question={t("howitworks_faq_q3")}
                answer={t("howitworks_faq_a3")}
              />
              <FaqItem
                question={t("howitworks_faq_q4")}
                answer={t("howitworks_faq_a4")}
              />
              <FaqItem
                question={t("howitworks_faq_q5")}
                answer={t("howitworks_faq_a5")}
              />
              <FaqItem
                question={t("howitworks_faq_q6")}
                answer={t("howitworks_faq_a6")}
              />
              <FaqItem
                question={t("howitworks_faq_q7")}
                answer={t("howitworks_faq_a7")}
              />
              <FaqItem
                question={t("howitworks_faq_q8")}
                answer={t("howitworks_faq_a8")}
              />
              <FaqItem
                question={t("howitworks_faq_q9")}
                answer={t("howitworks_faq_a9")}
              />
            </div>
          </section>

          {/* ═══ CTA FINAL ═══ */}
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-8 text-center">
            <div className="mb-3 text-4xl">🤖</div>
            <h2 className="mb-3 text-2xl font-bold text-neutral-100">
              {t("howitworks_cta_title")}
            </h2>
            <p className="mx-auto mb-5 max-w-xl text-sm text-neutral-400">
              {t("howitworks_cta_text")}
            </p>
            <Link
              href={`/${locale}/pronos-ia`}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-6 py-3 font-semibold text-white transition hover:bg-cyan-400"
            >
              <span>{t("howitworks_cta_button")}</span>
              <span>→</span>
            </Link>
          </div>

        </div>

        {/* ═══ DISCLAIMER BAS ═══ */}
        <div className="mt-16">
          <AIDisclaimer locale={locale} compact />
        </div>

      </main>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPOSANTS
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
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 sm:p-8">
      <h2 className="mb-3 flex items-center gap-3 text-2xl font-bold text-neutral-100">
        <span>{emoji}</span>
        <span>{title}</span>
      </h2>
      <p className="mb-5 text-sm text-neutral-400">{intro}</p>
      <div className="space-y-3 text-sm text-neutral-300">{children}</div>
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
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/10 font-mono text-sm font-bold text-cyan-300">
          {number}
        </div>
      </div>
      <div>
        <div className="mb-1 font-semibold text-neutral-100">{title}</div>
        <div className="text-sm text-neutral-400">{children}</div>
      </div>
    </li>
  );
}

function InfoBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5">
      <h3 className="mb-3 font-semibold text-neutral-100">{title}</h3>
      <ul className="space-y-2 text-sm text-neutral-400">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0 text-emerald-400">✓</span>
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
      <span className="mt-0.5 flex-shrink-0 text-amber-400">•</span>
      <span className="text-sm text-neutral-300">{children}</span>
    </li>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="group rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 transition hover:border-neutral-700">
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-medium text-neutral-100 [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span className="flex-shrink-0 text-neutral-500 transition group-open:rotate-180">
          ▼
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        {answer}
      </p>
    </details>
  );
}