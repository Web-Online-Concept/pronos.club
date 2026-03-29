import { getTranslations } from "next-intl/server";

export default async function ConfidentialitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  const renderItems = (key: string) => t(key).split("|").map((item, i) => (
    <p key={i} dangerouslySetInnerHTML={{ __html: `• ${item}` }} />
  ));

  return (
    <>
      <section className="border-b border-emerald-900/50" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("privacy_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">{t("privacy_title")}</h1>
          <p className="mt-2 text-sm text-white/40">{t("updated")}</p>
        </div>
      </section>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s1_title")}</h2><p className="mt-3" dangerouslySetInnerHTML={{ __html: t("privacy_s1") }} /></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s2_title")}</h2><div className="mt-3 space-y-2"><p>{t("privacy_s2_intro")}</p>{renderItems("privacy_s2_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s3_title")}</h2><div className="mt-3 space-y-2"><p>{t("privacy_s3_intro")}</p>{renderItems("privacy_s3_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s4_title")}</h2><div className="mt-3 space-y-2"><p>{t("privacy_s4_intro")}</p>{renderItems("privacy_s4_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s5_title")}</h2><div className="mt-3 rounded-xl bg-neutral-50 p-5"><p>{t("privacy_s5_intro")}</p><p className="mt-2" dangerouslySetInnerHTML={{ __html: t("privacy_s5_list") }} /><p className="mt-2">{t("privacy_s5_transfer")}</p></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s6_title")}</h2><div className="mt-3 space-y-2">{renderItems("privacy_s6_items")}</div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s7_title")}</h2><div className="mt-3 space-y-2"><p>{t("privacy_s7_intro")}</p>{renderItems("privacy_s7_items")}<p className="mt-2" dangerouslySetInnerHTML={{ __html: t("privacy_s7_contact") }} /><p dangerouslySetInnerHTML={{ __html: t("privacy_s7_cnil") }} /></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s8_title")}</h2><div className="mt-3 space-y-2"><p>{t("privacy_s8_intro")}</p>{renderItems("privacy_s8_items")}<p>{t("privacy_s8_note")}</p><p>{t("privacy_s8_ga")}</p></div></section>
          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("privacy_s9_title")}</h2><p className="mt-3">{t("privacy_s9")}</p></section>
        </article>
      </main>
    </>
  );
}