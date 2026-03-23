import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

// Brand colors per bookmaker (from their logos)
const BRAND_COLORS: Record<string, { primary: string; gradient: string; shadow: string; glow: string }> = {
  "1xbet":   { primary: "#1a6dcc", gradient: "linear-gradient(135deg, #1456a0, #1a6dcc)", shadow: "rgba(26,109,204,0.35)", glow: "rgba(26,109,204,0.15)" },
  "stake":   { primary: "#2f4553", gradient: "linear-gradient(135deg, #2f4553, #1a2c38)", shadow: "rgba(47,69,83,0.4)", glow: "rgba(47,69,83,0.2)" },
  "ps3838":  { primary: "#8b1a1a", gradient: "linear-gradient(135deg, #6b1414, #8b1a1a)", shadow: "rgba(139,26,26,0.35)", glow: "rgba(139,26,26,0.15)" },
  "betclic": { primary: "#d42a2a", gradient: "linear-gradient(135deg, #b01e1e, #d42a2a)", shadow: "rgba(212,42,42,0.35)", glow: "rgba(212,42,42,0.15)" },
  "unibet":  { primary: "#147b45", gradient: "linear-gradient(135deg, #0f6336, #147b45)", shadow: "rgba(20,123,69,0.35)", glow: "rgba(20,123,69,0.15)" },
  "winamax": { primary: "#c41e1e", gradient: "linear-gradient(135deg, #9a1717, #c41e1e)", shadow: "rgba(196,30,30,0.35)", glow: "rgba(196,30,30,0.15)" },
};

// Bookmaker-specific content
const BOOKMAKER_CONTENT: Record<string, {
  tagline: string;
  vpn: { required: boolean; label: string; countries?: string } | null;
  access_info: string | null;
  code_bonus: string | null;
  badge: { label: string; class: string };
  sections: { title: string; content: string; icon: string }[];
  videos: { title: string; description: string; file: string }[];
  highlights: { label: string; value: string }[];
}> = {
  "1xbet": {
    tagline: "Les meilleures cotes et un immense choix de paris sportifs",
    vpn: { required: true, label: "VPN obligatoire", countries: "Canada, Norvège, Albanie, Singapour" },
    access_info: null,
    code_bonus: "PRONOSCLUB",
    badge: { label: "International", class: "bg-amber-500/20 text-amber-400" },
    highlights: [
      { label: "Fondé en", value: "2007" },
      { label: "Sports", value: "50+" },
      { label: "Marchés", value: "1000+" },
      { label: "Paiement", value: "Crypto" },
    ],
    sections: [
      {
        title: "Pourquoi 1xbet ?",
        icon: "🏆",
        content: "1xbet est un bookmaker international de grande renommée, fondé en 2007, et reconnu pour offrir une gamme exceptionnelle de paris sportifs. Présent dans le monde entier, il s'est hissé parmi les leaders du marché grâce à des cotes parmi les plus élevées du secteur et un catalogue impressionnant de sports : football, tennis, basketball, e-sports, courses hippiques et bien d'autres.",
      },
      {
        title: "Des cotes sans limitation ARJEL",
        icon: "📈",
        content: "Contrairement aux bookmakers français régulés, 1xbet n'impose aucune restriction sur les types de paris, les cotes ou les bonus. Les cotes sont systématiquement plus élevées que celles proposées par les bookmakers ARJEL, ce qui se traduit par des gains potentiels significativement supérieurs pour les parieurs réguliers. C'est l'un des bookmakers les plus utilisés par les tipsters professionnels.",
      },
      {
        title: "Dépôts et retraits en crypto",
        icon: "₿",
        content: "1xbet permet de déposer et retirer des fonds via les cryptomonnaies (Bitcoin, Ethereum, USDT, etc.). Les transactions crypto sont rapides, sécurisées et confidentielles — sans les délais et vérifications des banques traditionnelles. C'est un atout majeur pour les joueurs qui souhaitent gérer leur bankroll efficacement.",
      },
      {
        title: "VPN : Comment accéder à 1xbet",
        icon: "🔒",
        content: "Pour accéder à 1xbet depuis la France, un VPN est nécessaire. Connectez-vous via le Canada, la Norvège, l'Albanie ou Singapour. Une fois inscrit et connecté, vous pourrez placer vos paris normalement. L'utilisation d'un VPN est simple et rapide — de nombreuses solutions gratuites et payantes existent.",
      },
    ],
    videos: [
      {
        title: "Présentation de 1xbet",
        description: "Découvrez l'interface, les fonctionnalités et les avantages de 1xbet dans cette présentation complète.",
        file: "presentation.mp4",
      },
      {
        title: "Installation sur mobile",
        description: "Guide étape par étape pour installer l'application 1xbet sur votre smartphone Android ou iOS.",
        file: "install-mobile.mp4",
      },
      {
        title: "Installation sur PC",
        description: "Installez l'application de bureau 1xbet pour une expérience optimale avec des alertes en temps réel.",
        file: "install-pc.mp4",
      },
      {
        title: "1xbet dans le monde",
        description: "Sponsor de grands clubs et compétitions internationales — découvrez la présence mondiale de 1xbet.",
        file: "pubs.mp4",
      },
    ],
  },
};

export default async function BookmakerSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  const { data: book } = await supabaseAdmin
    .from("bookmakers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!book) notFound();

  const content = BOOKMAKER_CONTENT[slug];
  if (!content) notFound();

  const affiliateUrl = book.affiliate_url;
  const colors = BRAND_COLORS[slug] ?? BRAND_COLORS["1xbet"];

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
          <Link href="/fr/bookmakers" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
            ← Tous les bookmakers
          </Link>

          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
            {/* Logo */}
            <div className="flex h-24 w-40 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08]">
              <img
                src={book.logo_url || `/bookmakers/${book.slug}.png`}
                alt={book.name}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{book.name}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${content.badge.class}`}>
                  {content.badge.label}
                </span>
                {content.vpn?.required && (
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[9px] font-bold text-red-400">
                    {content.vpn.label}
                  </span>
                )}
                {content.access_info && (
                  <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[9px] font-bold text-blue-400">
                    {content.access_info}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-white/40">{content.tagline}</p>
              {content.vpn?.countries && (
                <p className="mt-1 text-[10px] text-red-400/50">VPN : {content.vpn.countries}</p>
              )}

              {/* Highlights inline */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                {content.highlights.map((h) => (
                  <div key={h.label} className="text-center sm:text-left">
                    <span className="text-sm font-extrabold text-white">{h.value}</span>
                    <span className="ml-1 text-[9px] uppercase tracking-wider text-white/25">{h.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA right */}
            <div className="flex-shrink-0">
              <AffiliateButton text={`S'inscrire`} />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-16">

        {/* ═══════════ CODE BONUS ═══════════ */}
        {content.code_bonus && (
          <section className="mt-10">
            <div
              className="overflow-hidden rounded-2xl border p-6 text-center"
              style={{ borderColor: `${colors.primary}33`, background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">Code bonus</p>
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-2xl font-extrabold tracking-widest text-emerald-400">{content.code_bonus}</p>
              </div>
              <p className="mt-2 text-xs text-white/30">À entrer lors de votre inscription</p>
            </div>

            {/* CTA after bonus */}
            <div className="mt-4">
              <AffiliateButton text={`S'inscrire sur ${book.name} avec le code ${content.code_bonus}`} full />
            </div>
          </section>
        )}

        {/* ═══════════ SECTIONS ═══════════ */}
        {content.sections.map((section, i) => (
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
                <p className="mt-4 text-sm leading-relaxed text-white/50">{section.content}</p>
              </div>
            </section>

            {/* Mid-page CTA after section 2 */}
            {i === 1 && affiliateUrl && (
              <div className="mt-6 rounded-2xl border p-5 text-center" style={{ borderColor: `${colors.primary}30`, background: `${colors.primary}08` }}>
                <p className="text-sm font-bold text-neutral-800">
                  Rejoignez {book.name} maintenant{content.code_bonus ? ` — Code bonus : ` : ""}
                  {content.code_bonus && <span className="text-emerald-600">{content.code_bonus}</span>}
                </p>
                <div className="mt-3">
                  <AffiliateButton text="S'inscrire gratuitement" />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ═══════════ VIDEOS ═══════════ */}
        {content.videos.length > 0 && (
          <section className="mt-14">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Tutoriels</p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Vidéos &amp; guides</h2>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {content.videos.map((video, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-white/[0.06]"
                  style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)" }}
                >
                  <div className="relative aspect-video bg-black">
                    <video
                      src={`/bookmakers/${slug}/${video.file}`}
                      controls
                      preload="metadata"
                      className="h-full w-full object-cover"
                      poster={`/bookmakers/${slug}/${video.file.replace(".mp4", "-thumb.jpg")}`}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-white">{video.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/40">{video.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="mt-14">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-8 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <h3 className="text-xl font-extrabold text-white">Prêt à commencer ?</h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/40">
              Inscrivez-vous sur {book.name}
              {content.code_bonus && <> avec le code <span className="font-bold text-emerald-400">{content.code_bonus}</span></>}
              {" "}et commencez à suivre nos pronostics avec les meilleures cotes du marché.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <AffiliateButton text={`S'inscrire sur ${book.name}`} />
              <Link
                href="/fr/bookmakers"
                className="rounded-xl border border-white/10 px-8 py-3.5 text-sm font-semibold text-white/50 transition hover:border-white/20 hover:text-white/70"
              >
                Voir les autres bookmakers
              </Link>
            </div>

            {!isLoggedIn && (
              <p className="mt-6 text-xs text-white/20">
                Pas encore membre ? <Link href="/fr/login" className="text-emerald-400 transition hover:text-emerald-300">Créez votre compte gratuitement</Link> pour suivre nos pronostics.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}