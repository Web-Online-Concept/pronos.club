import { getTranslations } from "next-intl/server";

export default async function JeuResponsablePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <>
      <section className="border-b border-emerald-900/50" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">{t("rg_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white">{t("rg_title")}</h1>
          <p className="mt-4 text-sm text-white/40">{t("rg_subtitle")}</p>
        </div>
      </section>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <article className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">

          <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-6 text-center">
            <p className="text-lg font-extrabold text-red-800">{t("rg_warning")}</p>
            <p className="mt-2 text-2xl font-extrabold text-red-600">{t("rg_phone")}</p>
            <p className="mt-1 text-sm text-red-700">{t("rg_phone_label")}</p>
          </div>

          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("rg_commitment_title")}</h2><p className="mt-3">{t("rg_commitment_p1")}</p><p className="mt-2">{t("rg_commitment_p2")}</p></section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("rg_signs_title")}</h2>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-800">{t("rg_signs_intro")}</p>
              <div className="mt-3 space-y-2 text-amber-700">
                {t("rg_signs_items").split("|").map((item, i) => <p key={i}>• {item}</p>)}
              </div>
              <p className="mt-3 font-bold text-amber-800">{t("rg_signs_conclusion")}</p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("rg_tips_title")}</h2>
            <div className="mt-3 space-y-3">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="rounded-xl bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-800">{t(`rg_tip${n}_title`)}</p>
                  <p className="mt-1 text-emerald-700">{t(`rg_tip${n}_desc`)}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("rg_minors_title")}</h2>
            <div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-5">
              <p className="font-bold text-red-800">{t("rg_minors_p1")}</p>
              <p className="mt-2 text-red-700">{t("rg_minors_p2")}</p>
            </div>
          </section>

          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("rg_exclusion_title")}</h2><p className="mt-3" dangerouslySetInnerHTML={{ __html: t("rg_exclusion_p1") }} /><p className="mt-2">{t("rg_exclusion_p2")}</p></section>

          <section>
            <h2 className="text-lg font-extrabold text-neutral-900">{t("rg_resources_title")}</h2>
            <div className="mt-3 space-y-3">
              {[
                { name: t("rg_res1_name"), desc: t("rg_res1_desc"), url: "https://www.joueurs-info-service.fr" },
                { name: t("rg_res2_name"), desc: t("rg_res2_desc"), url: "https://www.addictaide.fr" },
                { name: t("rg_res3_name"), desc: t("rg_res3_desc"), url: "https://www.anj.fr" },
                { name: t("rg_res4_name"), desc: t("rg_res4_desc"), url: "https://www.sosjoueurs.org" },
              ].map(r => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-md">
                  <p className="font-bold text-neutral-900">{r.name}</p>
                  <p className="text-xs text-neutral-500">{r.desc}</p>
                  <p className="text-xs text-emerald-600">{r.url.replace("https://www.", "")} →</p>
                </a>
              ))}
            </div>
          </section>

          <section><h2 className="text-lg font-extrabold text-neutral-900">{t("rg_delete_title")}</h2><p className="mt-3">{t("rg_delete")}</p></section>

          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center">
            <p className="font-bold text-amber-800">{t("rg_footer_warning")}</p>
            <p className="mt-1 text-amber-700" dangerouslySetInnerHTML={{ __html: t("rg_footer_phone") }} />
          </div>
        </article>
      </main>
    </>
  );
}