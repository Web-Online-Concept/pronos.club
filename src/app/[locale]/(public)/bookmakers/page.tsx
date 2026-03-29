import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function BookmakersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookmakers_page" });
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  const isPremium = user?.subscription_status === "active";

  const { data: bookmakers } = await supabaseAdmin
    .from("bookmakers")
    .select("*")
    .eq("is_featured", true)
    .order("sort_order");

  const books = bookmakers ?? [];
  const international = books.filter((b) => !b.is_arjel);
  const anj = books.filter((b) => b.is_arjel);

  // VPN info per bookmaker
  const vpnInfo: Record<string, { label: string; color: string }> = {
    "1xbet": { label: t("vpn_required"), color: "text-red-400" },
    "stake": { label: t("vpn_signup_only"), color: "text-amber-400" },
    "ps3838": { label: t("vpn_not_needed"), color: "text-emerald-400" },
  };

  return (
    <>
      {/* ═══════════ HERO ═══════════ */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full bg-emerald-400/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("hero_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{t("hero_title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/40">
            {t("hero_subtitle")}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-16">

        {/* ═══════════ INTERNATIONAL ═══════════ */}
        {international.length > 0 && (
          <section className="mt-12">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-500">{t("intl_tag")}</p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("intl_title")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{t("intl_subtitle")}</p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {international.map((book) => (
                <BookmakerCard key={book.id} book={book} variant="international" locale={locale} t={t} vpnInfo={vpnInfo} />
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ ARJEL ═══════════ */}
        {anj.length > 0 && (
          <section className="mt-14">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-500">{t("anj_tag")}</p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("anj_title")}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{t("anj_subtitle")}</p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {anj.map((book) => (
                <BookmakerCard key={book.id} book={book} variant="anj" locale={locale} t={t} vpnInfo={vpnInfo} />
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ POURQUOI S'INSCRIRE PARTOUT ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("why_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("why_title")}</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🎯", title: t("why1_title"), desc: t("why1_desc") },
              { icon: "📈", title: t("why2_title"), desc: t("why2_desc") },
              { icon: "💰", title: t("why3_title"), desc: t("why3_desc") },
            ].map((item) => (
              <div
                key={item.title}
                className="group overflow-hidden rounded-2xl border border-white/[0.06] p-6 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">{item.icon}</span>
                <h3 className="mt-4 font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ ALERTE ═══════════ */}
        <section className="mt-10">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-6 py-5 text-center">
            <p className="text-sm font-bold text-red-600">{t("alert_title")}</p>
            <p className="mt-1 text-xs text-red-500/60">{t("alert_desc")}</p>
          </div>
        </section>

        {/* ═══════════ CONSEIL PRO ═══════════ */}
        <section className="mt-14">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-8"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl ring-1 ring-emerald-500/20">🏆</span>
              <h3 className="mt-4 text-lg font-extrabold text-white">{t("pro_title")}</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/40" dangerouslySetInnerHTML={{ __html: t("pro_p1") }} />
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/40">{t("pro_p2")}</p>
              <div className="mt-6">
                <Link
                  href={`/${locale}/pronostics`}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
                >
                  {t("pro_cta")}
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="mt-12 text-center">
          <p className="text-sm font-semibold text-neutral-600">
            {isPremium ? t("cta_premium") : isLoggedIn ? t("cta_logged") : t("cta_guest")}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {isPremium ? t("cta_desc_premium") : isLoggedIn ? t("cta_desc_logged") : t("cta_desc_guest")}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {isPremium ? (
              <Link
                href={`/${locale}/espace`}
                className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                {t("cta_btn_space")}
              </Link>
            ) : isLoggedIn ? (
              <Link
                href={`/${locale}/espace/abonnement`}
                className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                {t("cta_btn_premium")}
              </Link>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                {t("cta_btn_free")}
              </Link>
            )}
            <Link
              href={`/${locale}/pronostics`}
              className="w-full rounded-xl border border-neutral-300 px-8 py-4 text-sm font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 sm:w-auto"
            >
              {t("cta_btn_picks")}
            </Link>
          </div>
        </section>

        {books.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-4xl">🏦</p>
            <p className="mt-2 text-sm opacity-50">{t("empty")}</p>
          </div>
        )}
      </main>
    </>
  );
}

// ─── Bookmaker Card Component ────────────────────────────────

interface BookmakerCardProps {
  book: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    affiliate_url: string | null;
    is_arjel: boolean;
    rating: number | null;
    country: string | null;
    bonus_fr: string | null;
  };
  variant: "international" | "anj";
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  vpnInfo: Record<string, { label: string; color: string }>;
}

function BookmakerCard({ book, variant, locale, t, vpnInfo }: BookmakerCardProps) {
  const accentColor = variant === "anj" ? "#3b82f6" : "#f59e0b";
  const badgeClass = variant === "anj"
    ? "bg-blue-500/20 text-blue-400"
    : "bg-amber-500/20 text-amber-400";
  const badgeLabel = variant === "anj" ? t("card_france") : t("card_intl");

  const accessInfo = variant === "anj"
    ? { label: t("card_anj_access"), color: "text-blue-400" }
    : vpnInfo[book.slug] ?? null;

  return (
    <Link
      href={`/${locale}/bookmakers/${book.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] transition hover:-translate-y-1 hover:shadow-xl hover:border-white/10"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)" }}
    >
      {/* Accent line */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {/* Logo section */}
      <div className="flex flex-col items-center px-6 pt-6">
        <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06]">
          <img
            src={book.logo_url || `/bookmakers/${book.slug}.png`}
            alt={book.name}
            className="h-full w-full object-cover"
          />
        </div>
        <h3 className="mt-3 text-lg font-extrabold text-white">{book.name}</h3>
        <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
        {book.rating && book.rating > 0 && (
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-sm ${i < Math.round(book.rating ?? 0) ? "text-amber-400" : "text-white/10"}`}>★</span>
            ))}
            <span className="ml-1 text-xs font-bold text-white/30">{book.rating}/5</span>
          </div>
        )}

        {book.bonus_fr && (
          <div className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/60">{t("card_bonus")}</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-400">{book.bonus_fr}</p>
          </div>
        )}

        {book.country && (
          <p className="mt-3 text-center text-[10px] text-white/20">{t("card_license")} : {book.country}</p>
        )}

        {/* Access info */}
        {accessInfo && (
          <p className={`mt-3 text-center text-xs font-semibold ${accessInfo.color}`}>
            {accessInfo.label}
          </p>
        )}

        {/* CTA */}
        <div className="mt-auto pt-4">
          <span
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition group-hover:opacity-90"
            style={{
              background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor})`,
              boxShadow: `0 4px 14px ${accentColor}40`,
            }}
          >
            {t("card_discover", { name: book.name })}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}