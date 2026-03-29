import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import VideoPlayer from "@/components/ui/VideoPlayer";
import { getTranslations } from "next-intl/server";

// Brand colors per bookmaker (from their logos)
const BRAND_COLORS: Record<string, { primary: string; gradient: string; shadow: string; glow: string }> = {
  "1xbet":   { primary: "#1a6dcc", gradient: "linear-gradient(135deg, #1456a0, #1a6dcc)", shadow: "rgba(26,109,204,0.35)", glow: "rgba(26,109,204,0.15)" },
  "stake":   { primary: "#2f4553", gradient: "linear-gradient(135deg, #2f4553, #1a2c38)", shadow: "rgba(47,69,83,0.4)", glow: "rgba(47,69,83,0.2)" },
  "ps3838":  { primary: "#8b1a1a", gradient: "linear-gradient(135deg, #6b1414, #8b1a1a)", shadow: "rgba(139,26,26,0.35)", glow: "rgba(139,26,26,0.15)" },
  "betclic": { primary: "#d42a2a", gradient: "linear-gradient(135deg, #b01e1e, #d42a2a)", shadow: "rgba(212,42,42,0.35)", glow: "rgba(212,42,42,0.15)" },
  "unibet":  { primary: "#147b45", gradient: "linear-gradient(135deg, #0f6336, #147b45)", shadow: "rgba(20,123,69,0.35)", glow: "rgba(20,123,69,0.15)" },
  "winamax": { primary: "#c41e1e", gradient: "linear-gradient(135deg, #9a1717, #c41e1e)", shadow: "rgba(196,30,30,0.35)", glow: "rgba(196,30,30,0.15)" },
};

// Static structure (non-translatable parts)
const BOOKMAKER_META: Record<string, {
  vpn_required: boolean;
  vpn_countries_key?: string;
  has_access_info: boolean;
  code_bonus: string | null;
  badge_class: string;
  highlight_values: string[];
  section_icons: string[];
  section_images: (string | undefined)[];
  video_files: string[];
}> = {
  "1xbet": {
    vpn_required: true, vpn_countries_key: "1xbet_vpn_countries", has_access_info: false, code_bonus: "PRONOSCLUB",
    badge_class: "bg-amber-500/20 text-amber-400",
    highlight_values: ["2007", "50+", "1000+", "Crypto"],
    section_icons: ["🏆", "📈", "₿", "🔒"], section_images: [undefined, undefined, undefined, undefined],
    video_files: ["presentation.mp4", "install-mobile.mp4", "install-pc.mp4", "pubs.mp4"],
  },
  "stake": {
    vpn_required: true, vpn_countries_key: "stake_vpn_countries", has_access_info: false, code_bonus: "PRONOSCLUB",
    badge_class: "bg-amber-500/20 text-amber-400",
    highlight_values: ["2017", "Crypto", "VIP", "Oui"],
    section_icons: ["🏆", "🔒", "📝", "₿", "💎", "💰"],
    section_images: ["/bookmakers/stake/stake-interface.jpg", "/bookmakers/stake/stake-vpn.jpg", "/bookmakers/stake/stake-signup.jpg", "/bookmakers/stake/stake-coinbase.jpg", "/bookmakers/stake/stake-vip.jpg", "/bookmakers/stake/stake-rakeback.jpg"],
    video_files: ["inscription.mp4"],
  },
  "ps3838": {
    vpn_required: false, has_access_info: true, code_bonus: null,
    badge_class: "bg-amber-500/20 text-amber-400",
    highlight_values: ["Broker", "N°1", "∞", "Skrill"],
    section_icons: ["🏆", "🔗", "📝", "💳", "🎁", "♾️"],
    section_images: ["/bookmakers/ps3838/ps3838-interface.jpg", "/bookmakers/ps3838/ps3838-asianconnect.jpg", "/bookmakers/ps3838/ps3838-signup.jpg", "/bookmakers/ps3838/ps3838-payment.jpg", "/bookmakers/ps3838/ps3838-bonus.jpg", undefined],
    video_files: [],
  },
  "winamax": {
    vpn_required: false, has_access_info: true, code_bonus: "BOLMXT",
    badge_class: "bg-blue-500/20 text-blue-400",
    highlight_values: ["1999", "ARJEL", "100€", "Mobile"],
    section_icons: ["🏆", "📈", "⚡", "🎁", "📱", "👥"],
    section_images: ["/bookmakers/winamax/winamax-interface.jpg", "/bookmakers/winamax/winamax-cotes.jpg", "/bookmakers/winamax/winamax-live.jpg", "/bookmakers/winamax/winamax-bonus.jpg", "/bookmakers/winamax/winamax-app.jpg", undefined],
    video_files: [],
  },
  "betclic": {
    vpn_required: false, has_access_info: true, code_bonus: "BOLLLC1V",
    badge_class: "bg-blue-500/20 text-blue-400",
    highlight_values: ["2005", "ARJEL", "100€", "Mobile"],
    section_icons: ["🏆", "📈", "⚡", "🎁", "📱", "🎯"],
    section_images: ["/bookmakers/betclic/betclic-interface.jpg", "/bookmakers/betclic/betclic-cotes.jpg", "/bookmakers/betclic/betclic-live.jpg", "/bookmakers/betclic/betclic-bonus.jpg", "/bookmakers/betclic/betclic-app.jpg", undefined],
    video_files: [],
  },
  "unibet": {
    vpn_required: false, has_access_info: true, code_bonus: null,
    badge_class: "bg-blue-500/20 text-blue-400",
    highlight_values: ["1997", "ARJEL", "100€", "35 000+"],
    section_icons: ["🏆", "🎁", "📺", "⚡", "📈", "📱"],
    section_images: ["/bookmakers/unibet/unibet-interface.jpg", "/bookmakers/unibet/unibet-bonus.jpg", "/bookmakers/unibet/unibet-tv.jpg", "/bookmakers/unibet/unibet-features.jpg", "/bookmakers/unibet/unibet-cotes.jpg", undefined],
    video_files: [],
  },
};

// Highlight label keys per bookmaker
const HIGHLIGHT_KEYS: Record<string, string[]> = {
  "1xbet": ["1xbet_h_founded", "1xbet_h_sports", "1xbet_h_markets", "1xbet_h_payment"],
  "stake": ["stake_h_founded", "stake_h_payment", "stake_h_program", "stake_h_rakeback"],
  "ps3838": ["ps3838_h_access", "ps3838_h_odds", "ps3838_h_limits", "ps3838_h_payment"],
  "winamax": ["winamax_h_founded", "winamax_h_license", "winamax_h_bonus", "winamax_h_app"],
  "betclic": ["betclic_h_founded", "betclic_h_license", "betclic_h_bonus", "betclic_h_app"],
  "unibet": ["unibet_h_founded", "unibet_h_license", "unibet_h_bonus", "unibet_h_streaming"],
};

export default async function BookmakerSlugPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookmaker_slug" });
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  const { data: book } = await supabaseAdmin
    .from("bookmakers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!book) notFound();

  const meta = BOOKMAKER_META[slug];
  if (!meta) notFound();

  const affiliateUrl = book.affiliate_url;
  const colors = BRAND_COLORS[slug] ?? BRAND_COLORS["1xbet"];

  // Build translated content
  const tagline = t(`${slug}_tagline`);
  const vpnLabel = meta.vpn_required ? t(`${slug}_vpn_label`) : null;
  const vpnCountries = meta.vpn_countries_key ? t(meta.vpn_countries_key) : null;
  const accessInfo = meta.has_access_info ? t(`${slug}_access`) : null;
  const badgeLabel = meta.badge_class.includes("blue") ? t("code_parrainage").split(" ")[0] === "Code" ? "France" : "Francia" : "International";
  // Actually use the badge from the class
  const badgeLabelFinal = meta.badge_class.includes("blue")
    ? (locale === "en" ? "France" : locale === "es" ? "Francia" : "France")
    : "International";

  const highlights = meta.highlight_values.map((val, i) => ({
    label: t(HIGHLIGHT_KEYS[slug][i]),
    value: val,
  }));

  const sectionCount = meta.section_icons.length;
  const sections = Array.from({ length: sectionCount }, (_, i) => ({
    title: t(`${slug}_s${i + 1}_title`),
    content: t(`${slug}_s${i + 1}`),
    icon: meta.section_icons[i],
    image: meta.section_images[i],
  }));

  const videos = meta.video_files.map((file, i) => ({
    title: t(`${slug}_v${i + 1}_title`),
    description: t(`${slug}_v${i + 1}_desc`),
    file,
  }));

  // Reusable CTA button
  function AffiliateButton({ text, full = false }: { text: string; full?: boolean }) {
    if (!affiliateUrl) return null;
    return (
      <a
        href={affiliateUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition hover:brightness-110 ${full ? "w-full" : ""}`}
        style={{ background: colors.gradient, boxShadow: `0 4px 20px ${colors.shadow}` }}
      >
        {text}
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </a>
    );
  }

  return (
    <>
      {/* ═══════════ HERO — COMPACT ═══════════ */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]" style={{ background: colors.glow }} />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-6">
          <Link href={`/${locale}/bookmakers`} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
            {t("back")}
          </Link>

          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            {/* Logo */}
            {affiliateUrl ? (
              <a href={affiliateUrl} target="_blank" rel="noopener noreferrer" className="flex h-24 w-40 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08] transition hover:bg-white/[0.12]">
                <img src={book.logo_url || `/bookmakers/${book.slug}.png`} alt={book.name} className="h-full w-full object-cover" />
              </a>
            ) : (
              <div className="flex h-24 w-40 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08]">
                <img src={book.logo_url || `/bookmakers/${book.slug}.png`} alt={book.name} className="h-full w-full object-cover" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{book.name}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.badge_class}`}>
                  {badgeLabelFinal}
                </span>
                {vpnLabel && (
                  <span className="rounded-full border border-red-500/50 bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-300">
                    {vpnLabel}
                  </span>
                )}
                {accessInfo && (
                  <span className="rounded-full border border-blue-500/50 bg-blue-500/20 px-3 py-1 text-[10px] font-bold text-blue-300">
                    {accessInfo}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-white/40">{tagline}</p>
              {vpnCountries && (
                <p className="mt-1 text-xs font-semibold text-red-300/70">{t("vpn_label")} : {vpnCountries}</p>
              )}

              {/* Highlights inline */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                {highlights.map((h) => (
                  <div key={h.label} className="text-center sm:text-left">
                    <span className="text-sm font-extrabold text-white">{h.value}</span>
                    <span className="ml-1 text-[9px] uppercase tracking-wider text-white/25">{h.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA right */}
            <div className="flex-shrink-0">
              <AffiliateButton text={t("btn_signup")} />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-16">

        {/* ═══════════ CODE BONUS / PARRAINAGE ═══════════ */}
        {meta.code_bonus && (
          <section className="mt-10">
            <div
              className="overflow-hidden rounded-2xl border p-6 text-center"
              style={{ borderColor: `${colors.primary}33`, background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">
                {slug === "winamax" || slug === "betclic" ? t("code_parrainage") : t("code_bonus")}
              </p>
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-2xl font-extrabold tracking-widest text-emerald-400">{meta.code_bonus}</p>
              </div>
              <p className="mt-2 text-xs text-white/30">
                {slug === "winamax" || slug === "betclic"
                  ? t("code_bonus_extra")
                  : t("code_bonus_simple")}
              </p>
            </div>

            {/* CTA after bonus */}
            <div className="mt-4">
              <AffiliateButton text={t("btn_signup_with_code", { name: book.name, code: meta.code_bonus })} full />
            </div>
          </section>
        )}

        {/* ═══════════ SECTIONS ═══════════ */}
        {sections.map((section, i) => (
          <div key={i}>
            <section className="mt-10">
              <div
                className="overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
                style={{ background: i % 2 === 0 ? "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" : "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">{section.icon}</span>
                  <h2 className="text-lg font-extrabold text-white">{section.title}</h2>
                </div>
                {section.image ? (
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                    <p className="flex-1 text-sm leading-relaxed text-white/50">{section.content}</p>
                    <img src={section.image} alt={section.title} className="w-full rounded-xl sm:w-72" />
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-white/50">{section.content}</p>
                )}
              </div>
            </section>

            {/* Mid-page CTA after section 2 */}
            {i === 1 && affiliateUrl && (
              <div className="mt-6 rounded-2xl border p-5 text-center" style={{ borderColor: `${colors.primary}30`, background: `${colors.primary}08` }}>
                <p className="text-sm font-bold text-neutral-800">
                  {t("join_now", { name: book.name })}{meta.code_bonus ? t("join_code") : ""}
                  {meta.code_bonus && <span className="text-emerald-600">{meta.code_bonus}</span>}
                </p>
                <div className="mt-3">
                  <AffiliateButton text={t("btn_signup_free")} />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ═══════════ VIDEOS ═══════════ */}
        {videos.length > 0 && (
          <section className="mt-14">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("videos_tag")}</p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("videos_title")}</h2>
            </div>

            {/* First video — full width */}
            <div
              className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06]"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)" }}
            >
              <VideoPlayer
                src={`/bookmakers/${slug}/${videos[0].file}`}
                thumbnail={`/bookmakers/${slug}/${videos[0].file.replace(".mp4", "-thumb.jpg")}`}
                title={videos[0].title}
              />
              <div className="p-5">
                <h3 className="text-lg font-bold text-white">{videos[0].title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/40">{videos[0].description}</p>
              </div>
            </div>

            {/* Remaining videos — grid */}
            {videos.length > 1 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {videos.slice(1).map((video, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-2xl border border-white/[0.06]"
                    style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)" }}
                  >
                    <VideoPlayer
                      src={`/bookmakers/${slug}/${video.file}`}
                      thumbnail={`/bookmakers/${slug}/${video.file.replace(".mp4", "-thumb.jpg")}`}
                      title={video.title}
                    />
                    <div className="p-4">
                      <h3 className="font-bold text-white">{video.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-white/40">{video.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="mt-14">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-8 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <h3 className="text-xl font-extrabold text-white">{t("cta_title")}</h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/40"
              dangerouslySetInnerHTML={{
                __html: meta.code_bonus
                  ? t("cta_desc_with_code", { name: book.name, code: meta.code_bonus })
                  : t("cta_desc_no_code", { name: book.name })
              }}
            />

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <AffiliateButton text={t("cta_btn_signup", { name: book.name })} />
              <Link
                href={`/${locale}/bookmakers`}
                className="rounded-xl border border-white/10 px-8 py-3.5 text-sm font-semibold text-white/50 transition hover:border-white/20 hover:text-white/70"
              >
                {t("cta_other_books")}
              </Link>
            </div>

            {!isLoggedIn && (
              <p className="mt-6 text-xs text-white/20">
                {t("cta_not_member")} <Link href={`/${locale}/login`} className="text-emerald-400 transition hover:text-emerald-300">{t("cta_create_account")}</Link> {t("cta_follow")}
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}