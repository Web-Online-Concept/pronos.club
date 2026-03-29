import { getTranslations } from "next-intl/server";

export default async function CGUPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  const renderItems = (key: string) => t(key).split("|").map((item, i) => (
    <p key={i} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
  ));

  return (
    <>
      <section className="border-b border-emerald-900/50" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("cgu_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">{t("cgu_title")}</h1>
          <p className="mt-2 text-sm text-white/40">{t("updated")}</p>
        </div>
      </section>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s1_title")}</h2><p className="mt-3">{t("cgu_s1")}</p></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s2_title")}</h2><p className="mt-3" dangerouslySetInnerHTML={{ __html: t("cgu_s2_p1") }} /><p className="mt-2">{t("cgu_s2_p2")}</p></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s3_title")}</h2><div className="mt-3 space-y-2">{t("cgu_s3_items").split("|").map((item, i) => <p key={i}>{item}</p>)}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s4_title")}</h2><p className="mt-3" dangerouslySetInnerHTML={{ __html: t("cgu_s4").replace("{locale}", locale) }} /></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s5_title")}</h2><div className="mt-3 space-y-2"><p>{t("cgu_s5_intro")}</p>{renderItems("cgu_s5_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s6_title")}</h2><div className="mt-3 space-y-2"><p>{t("cgu_s6_intro")}</p>{renderItems("cgu_s6_items")}<p className="mt-2 font-semibold text-red-600">{t("cgu_s6_warning")}</p></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s7_title")}</h2><div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-5"><p className="text-red-700" dangerouslySetInnerHTML={{ __html: t("cgu_s7") }} /></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s8_title")}</h2><div className="mt-3 space-y-2"><p>{t("cgu_s8_intro")}</p>{renderItems("cgu_s8_items")}<p className="mt-2">{t("cgu_s8_conclusion")}</p></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s9_title")}</h2><p className="mt-3">{t("cgu_s9")}</p></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("cgu_s10_title")}</h2><p className="mt-3">{t("cgu_s10")}</p></section>
        </article>
      </main>
    </>
  );
}