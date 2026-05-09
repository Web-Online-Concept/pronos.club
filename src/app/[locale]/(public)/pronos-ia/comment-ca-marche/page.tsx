/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /[locale]/pronos-ia/comment-ca-marche (V3.5 refonte complète)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Refonte complète : page CLAIRE avec contenu V3.5 actualisé.
 *
 * Sections (10 + FAQ + CTAs) :
 *   1. Hero (composant existant)
 *   2. Alerte amber (jeu responsable)
 *   3. S1 — IA tipster + validation 2e modèle
 *   4. S2 — Pipeline en 7 étapes
 *   5. S3 — Grille des 9 sports couverts
 *   6. S4 — Système de tier (Lock / Strong / Value / CDC)
 *   7. S5 — Edge math + CLV
 *   8. S6 — Calendrier des drops (matin/soir)
 *   9. S7 — Transparence totale
 *   10. S8 — Bookmakers ARJEL/hors ARJEL
 *   11. S9 — Pourquoi gratuit
 *   12. S10 — Limites du système
 *   13. FAQ 9 Q/A + JSON-LD Schema
 *   14. CTA Pronos IA + CTA Telegram + CTA Tipster Jérôme
 *   15. Disclaimer ANJ
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
 * JSON-LD FAQ Schema — pour rich snippets Google.
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

      {/* HERO FULL-WIDTH */}
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
              <p className="text-sm leading-relaxed text-amber-900/90">
                {t("howitworks_alert_text")}
              </p>
            </div>
          </div>
        </div>

        {/* SECTIONS */}
        <div className="space-y-8">

          {/* S1 — IA tipster + validation 2e modèle */}
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

          {/* S2 — Pipeline en 7 étapes */}
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
              <Step number={6} title={t("howitworks_s2_step6_title")}>
                {t("howitworks_s2_step6_text")}
              </Step>
              <Step number={7} title={t("howitworks_s2_step7_title")}>
                {t("howitworks_s2_step7_text")}
              </Step>
            </ul>
          </Section>

          {/* S3 — 9 sports couverts (grille) */}
          <Section
            emoji="🏆"
            title={t("howitworks_s3_title")}
            intro={t("howitworks_s3_intro")}
          >
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              <SportCard
                emoji="⚽"
                title={t("howitworks_sports_football_title")}
                text={t("howitworks_sports_football_text")}
              />
              <SportCard
                emoji="🎾"
                title={t("howitworks_sports_tennis_title")}
                text={t("howitworks_sports_tennis_text")}
              />
              <SportCard
                emoji="🏀"
                title={t("howitworks_sports_basketball_title")}
                text={t("howitworks_sports_basketball_text")}
              />
              <SportCard
                emoji="🏒"
                title={t("howitworks_sports_hockey_title")}
                text={t("howitworks_sports_hockey_text")}
              />
              <SportCard
                emoji="⚾"
                title={t("howitworks_sports_baseball_title")}
                text={t("howitworks_sports_baseball_text")}
              />
              <SportCard
                emoji="🥊"
                title={t("howitworks_sports_mma_title")}
                text={t("howitworks_sports_mma_text")}
              />
              <SportCard
                emoji="🏈"
                title={t("howitworks_sports_nfl_title")}
                text={t("howitworks_sports_nfl_text")}
              />
              <SportCard
                emoji="🏉"
                title={t("howitworks_sports_rugby_title")}
                text={t("howitworks_sports_rugby_text")}
              />
              <SportCard
                emoji="🤾"
                title={t("howitworks_sports_handball_title")}
                text={t("howitworks_sports_handball_text")}
              />
              <SportCard
                emoji="🏎️"
                title={t("howitworks_sports_f1_title")}
                text={t("howitworks_sports_f1_text")}
              />
            </div>
          </Section>

          {/* S4 — Système de tier */}
          <Section
            emoji="🎯"
            title={t("howitworks_s4_title")}
            intro={t("howitworks_s4_intro")}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TierCard
                title={t("howitworks_tier_lock_title")}
                criteria={t("howitworks_tier_lock_criteria")}
                text={t("howitworks_tier_lock_text")}
                accent="emerald"
              />
              <TierCard
                title={t("howitworks_tier_strong_title")}
                criteria={t("howitworks_tier_strong_criteria")}
                text={t("howitworks_tier_strong_text")}
                accent="blue"
              />
              <TierCard
                title={t("howitworks_tier_value_title")}
                criteria={t("howitworks_tier_value_criteria")}
                text={t("howitworks_tier_value_text")}
                accent="violet"
              />
              <TierCard
                title={t("howitworks_tier_cdc_title")}
                criteria={t("howitworks_tier_cdc_criteria")}
                text={t("howitworks_tier_cdc_text")}
                accent="pink"
              />
            </div>
          </Section>

          {/* S5 — Edge math + CLV */}
          <Section
            emoji="📈"
            title={t("howitworks_s5_title")}
            intro={t("howitworks_s5_intro")}
          >
            <p className="leading-relaxed">{t("howitworks_s5_p1")}</p>
            <p className="leading-relaxed">{t("howitworks_s5_p2")}</p>
            <p className="leading-relaxed font-semibold text-violet-700">
              {t("howitworks_s5_highlight")}
            </p>
          </Section>

          {/* S6 — Calendrier des drops */}
          <Section
            emoji="🕐"
            title={t("howitworks_s6_title")}
            intro={t("howitworks_s6_intro")}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DropCard
                time={t("howitworks_drop_morning_time")}
                label={t("howitworks_drop_morning_label")}
                text={t("howitworks_drop_morning_text")}
                emoji="🌅"
              />
              <DropCard
                time={t("howitworks_drop_evening_time")}
                label={t("howitworks_drop_evening_label")}
                text={t("howitworks_drop_evening_text")}
                emoji="🌙"
              />
            </div>
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠️ {t("howitworks_drop_combine_text")}
            </p>
          </Section>

          {/* S7 — Transparence */}
          <Section
            emoji="🔍"
            title={t("howitworks_s7_title")}
            intro={t("howitworks_s7_intro")}
          >
            <p className="leading-relaxed">{t("howitworks_s7_p1")}</p>
            <p className="leading-relaxed">{t("howitworks_s7_p2")}</p>
            <p className="leading-relaxed font-semibold text-emerald-700">
              ✓ {t("howitworks_s7_highlight")}
            </p>
          </Section>

          {/* S8 — Bookmakers ARJEL/hors ARJEL */}
          <Section
            emoji="💶"
            title={t("howitworks_s8_title")}
            intro={t("howitworks_s8_intro")}
          >
            <p className="leading-relaxed">{t("howitworks_s8_p1")}</p>
            <p className="leading-relaxed">{t("howitworks_s8_p2")}</p>
            <p className="leading-relaxed font-semibold text-violet-700">
              {t("howitworks_s8_highlight")}
            </p>
          </Section>

          {/* S9 — Pourquoi gratuit */}
          <Section
            emoji="🎁"
            title={t("howitworks_s9_title")}
            intro={t("howitworks_s9_intro")}
          >
            <p className="leading-relaxed">{t("howitworks_s9_p1")}</p>
            <p className="leading-relaxed">{t("howitworks_s9_p2")}</p>
          </Section>

          {/* S10 — Limites */}
          <Section
            emoji="⚡"
            title={t("howitworks_s10_title")}
            intro={t("howitworks_s10_intro")}
          >
            <ul className="space-y-3">
              <LimitItem>{t("howitworks_s10_limit1")}</LimitItem>
              <LimitItem>{t("howitworks_s10_limit2")}</LimitItem>
              <LimitItem>{t("howitworks_s10_limit3")}</LimitItem>
              <LimitItem>{t("howitworks_s10_limit4")}</LimitItem>
              <LimitItem>{t("howitworks_s10_limit5")}</LimitItem>
              <LimitItem>{t("howitworks_s10_limit6")}</LimitItem>
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

          {/* CTA PRINCIPAL — Voir Pronos IA */}
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

          {/* CTA secondaires — Telegram + Tipster Jérôme */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Telegram */}
            <a
              href="https://t.me/pronos_club_ia"
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border-2 border-blue-200 bg-blue-50 p-6 transition hover:border-blue-400 hover:bg-blue-100 hover:shadow-md"
            >
              <div className="mb-3 text-4xl">📱</div>
              <h3 className="mb-2 text-lg font-bold text-blue-900">
                {t("howitworks_cta_telegram_title")}
              </h3>
              <p className="text-sm text-blue-800">
                {t("howitworks_cta_telegram_text")}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-blue-700 group-hover:gap-3 transition-all">
                <span>{t("howitworks_cta_telegram_button")}</span>
                <span>→</span>
              </div>
            </a>

            {/* Tipster Jérôme */}
            <a
              href={`/${locale}`}
              className="group rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 transition hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-md"
            >
              <div className="mb-3 text-4xl">🎯</div>
              <h3 className="mb-2 text-lg font-bold text-emerald-900">
                {t("howitworks_cta_tipster_title")}
              </h3>
              <p className="text-sm text-emerald-800">
                {t("howitworks_cta_tipster_text")}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700 group-hover:gap-3 transition-all">
                <span>{t("howitworks_cta_tipster_button")}</span>
                <span>→</span>
              </div>
            </a>
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
// SOUS-COMPOSANTS (light theme V3.5)
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

function SportCard({
  emoji,
  title,
  text,
}: {
  emoji: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border-2 border-zinc-200 bg-white p-4 transition hover:border-violet-300 hover:shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <h3 className="font-bold text-zinc-900">{title}</h3>
      </div>
      <p className="text-xs leading-relaxed text-zinc-600">{text}</p>
    </div>
  );
}

function TierCard({
  title,
  criteria,
  text,
  accent,
}: {
  title: string;
  criteria: string;
  text: string;
  accent: "emerald" | "blue" | "violet" | "pink";
}) {
  const styles = {
    emerald: {
      border: "border-emerald-300",
      bg: "bg-emerald-50",
      titleColor: "text-emerald-900",
      criteriaColor: "text-emerald-700",
    },
    blue: {
      border: "border-blue-300",
      bg: "bg-blue-50",
      titleColor: "text-blue-900",
      criteriaColor: "text-blue-700",
    },
    violet: {
      border: "border-violet-300",
      bg: "bg-violet-50",
      titleColor: "text-violet-900",
      criteriaColor: "text-violet-700",
    },
    pink: {
      border: "border-pink-300",
      bg: "bg-pink-50",
      titleColor: "text-pink-900",
      criteriaColor: "text-pink-700",
    },
  };

  const s = styles[accent];

  return (
    <div className={`rounded-xl border-2 p-5 ${s.border} ${s.bg}`}>
      <h3 className={`mb-2 text-lg font-extrabold ${s.titleColor}`}>{title}</h3>
      <div className={`mb-3 inline-block rounded-md bg-white/60 px-2.5 py-1 text-xs font-mono font-bold ${s.criteriaColor}`}>
        {criteria}
      </div>
      <p className="text-sm leading-relaxed text-zinc-700">{text}</p>
    </div>
  );
}

function DropCard({
  time,
  label,
  text,
  emoji,
}: {
  time: string;
  label: string;
  text: string;
  emoji: string;
}) {
  return (
    <div className="rounded-xl border-2 border-violet-200 bg-violet-50 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-3xl">{emoji}</span>
        <div>
          <div className="font-mono text-2xl font-extrabold text-violet-900">
            {time}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-violet-700">
            {label}
          </div>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-zinc-700">{text}</p>
    </div>
  );
}

function LimitItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex-shrink-0 font-bold text-amber-600">•</span>
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