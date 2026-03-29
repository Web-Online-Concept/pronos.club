import { getTranslations } from "next-intl/server";

export default async function CGVPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  const renderItems = (key: string) => t(key).split("|").map((item, i) => (
    <p key={i} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
  ));

  return (
    <>
      <section className="border-b border-emerald-900/50" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("cgv_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">{t("cgv_title")}</h1>
          <p className="mt-2 text-sm text-white/40">{t("updated")}</p>
        </div>
      </section>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s1_title")}</h2><p className="mt-3">{t("cgv_s1_p1")}</p><p className="mt-2">{t("cgv_s1_p2")}</p></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s2_title")}</h2><div className="mt-3 space-y-2"><p>{t("cgv_s2_intro")}</p>{renderItems("cgv_s2_items")}</div><div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-5"><p className="text-red-700" dangerouslySetInnerHTML={{ __html: t("cgv_s2_warning") }} /></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s3_title")}</h2><div className="mt-3 space-y-2">{renderItems("cgv_s3_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s4_title")}</h2><div className="mt-3 space-y-2">{renderItems("cgv_s4_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s5_title")}</h2><p className="mt-3">{t("cgv_s5")}</p></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s6_title")}</h2><div className="mt-3 space-y-2">{renderItems("cgv_s6_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s7_title")}</h2><div className="mt-3 space-y-2">{renderItems("cgv_s7_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s8_title")}</h2><div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5"><p className="text-amber-800" dangerouslySetInnerHTML={{ __html: t("cgv_s8_p1") }} /><p className="mt-2 text-amber-800" dangerouslySetInnerHTML={{ __html: t("cgv_s8_p2") }} /></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s9_title")}</h2><div className="mt-3 space-y-2"><p>{t("cgv_s9_intro")}</p>{renderItems("cgv_s9_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s10_title")}</h2><div className="mt-3 space-y-2"><p dangerouslySetInnerHTML={{ __html: t("cgv_s10_intro") }} /><p>{t("cgv_s10_user_intro")}</p>{renderItems("cgv_s10_items")}<p className="mt-2" dangerouslySetInnerHTML={{ __html: t("cgv_s10_conclusion") }} /></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s11_title")}</h2><p className="mt-3">{t("cgv_s11")}</p></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s12_title")}</h2><div className="mt-3 space-y-2"><p dangerouslySetInnerHTML={{ __html: t("cgv_s12_p1") }} /><p dangerouslySetInnerHTML={{ __html: t("cgv_s12_mediator") }} /><p dangerouslySetInnerHTML={{ __html: t("cgv_s12_odr") }} /></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgv_s13_title")}</h2><p className="mt-3">{t("cgv_s13")}</p></section>
        </article>
      </main>
    </>
  );
}