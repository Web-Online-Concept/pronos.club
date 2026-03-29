import { getTranslations } from "next-intl/server";

export default async function MentionsLegalesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <>
      <section
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("ml_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">{t("ml_title")}</h1>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s1_title")}</h2>
            <div className="mt-3 rounded-xl bg-neutral-50 p-5">
              <p dangerouslySetInnerHTML={{ __html: t("ml_s1_intro") }} />
              <p className="mt-2" dangerouslySetInnerHTML={{ __html: t("ml_s1_body") }} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s2_title")}</h2>
            <div className="mt-3 rounded-xl bg-neutral-50 p-5">
              <p dangerouslySetInnerHTML={{ __html: t("ml_s2_body") }} />
              <p className="mt-2" dangerouslySetInnerHTML={{ __html: t("ml_s2_body2") }} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s3_title")}</h2>
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5">
                <p className="font-bold text-red-800">{t("ml_s3_warning_title")}</p>
                <p className="mt-2 text-red-700" dangerouslySetInnerHTML={{ __html: t("ml_s3_warning1") }} />
                <p className="mt-2 text-red-700" dangerouslySetInnerHTML={{ __html: t("ml_s3_warning2") }} />
              </div>
              <p dangerouslySetInnerHTML={{ __html: t("ml_s3_p1") }} />
              <p dangerouslySetInnerHTML={{ __html: t("ml_s3_p2") }} />
              <p dangerouslySetInnerHTML={{ __html: t("ml_s3_p3") }} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s4_title")}</h2>
            <p className="mt-3" dangerouslySetInnerHTML={{ __html: t("ml_s4_body") }} />
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s5_title")}</h2>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-amber-800" dangerouslySetInnerHTML={{ __html: t("ml_s5_body") }} />
              <p className="mt-3 text-amber-800" dangerouslySetInnerHTML={{ __html: t("ml_s5_resources") }} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s6_title")}</h2>
            <p className="mt-3" dangerouslySetInnerHTML={{ __html: t("ml_s6_body") }} />
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s7_title")}</h2>
            <p className="mt-3" dangerouslySetInnerHTML={{ __html: t("ml_s7_p1") }} />
            <p className="mt-2" dangerouslySetInnerHTML={{ __html: t("ml_s7_p2") }} />
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s8_title")}</h2>
            <div className="mt-3 space-y-3">
              <p>{t("ml_s8_intro")}</p>
              <p dangerouslySetInnerHTML={{ __html: t("ml_s8_list") }} />
              <p dangerouslySetInnerHTML={{ __html: t("ml_s8_conclusion") }} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s9_title")}</h2>
            <p className="mt-3">{t("ml_s9_body")}</p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("ml_s10_title")}</h2>
            <p className="mt-3">{t("ml_s10_body")}</p>
          </section>

        </article>
      </main>
    </>
  );
}