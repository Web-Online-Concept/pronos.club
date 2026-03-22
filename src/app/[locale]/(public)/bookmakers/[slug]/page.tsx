import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

// Bookmaker-specific content
const BOOKMAKER_CONTENT: Record<string, {
  tagline: string;
  vpn: { required: boolean; label: string; countries?: string };
  code_bonus: string;
  sections: { title: string; content: string; icon: string }[];
  videos: { title: string; description: string; file: string }[];
  highlights: { label: string; value: string }[];
}> = {
  "1xbet": {
    tagline: "Les meilleures cotes et un immense choix de paris sportifs",
    vpn: { required: true, label: "VPN obligatoire", countries: "Canada, Norvège, Albanie, Singapour" },
    code_bonus: "PRONOSCLUB",
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

  // Fetch bookmaker from DB
  const { data: book } = await supabaseAdmin
    .from("bookmakers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!book) notFound();

  const content = BOOKMAKER_CONTENT[slug];
  if (!content) notFound();

  const affiliateUrl = book.affiliate_url;

  return (
    <>
      {/* ═══════════ HERO ═══════════ */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-emerald-500/15 blur-[140px]" />
          <div className="absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-amber-500/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-14">
          <Link href="/fr/bookmakers" className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
            ← Tous les bookmakers
          </Link>

          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            {/* Logo */}
            <div className="flex h-28 w-44 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08]">
              <img
                src={book.logo_url || `/bookmakers/${book.slug}.png`}
                alt={book.name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-3xl font-extrabold text-white">{book.name}</h1>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  International
                </span>
              </div>
              <p className="mt-2 text-sm text-white/40">{content.tagline}</p>

              {/* VPN badge */}
              {content.vpn.required && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
                  <span className="text-xs font-bold text-red-400">{content.vpn.label}</span>
                  {content.vpn.countries && (
                    <span className="text-[10px] text-red-400/60">({content.vpn.countries})</span>
                  )}
                </div>
              )}

              {/* Highlights */}
              <div className="mt-4 flex flex-wrap justify-center gap-4 sm:justify-start">
                {content.highlights.map((h) => (
                  <div key={h.label} className="text-center">
                    <p className="text-lg font-extrabold text-white">{h.value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/30">{h.label}</p>
                  </div>
                ))}
              </div>

              {/* Hero CTA */}
              {affiliateUrl && (
                <div className="mt-6 flex justify-center sm:justify-start">
                  <a
                    href={affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition hover:opacity-90"
                    style={{
                      background: "linear-gradient(135deg, #d97706cc, #f59e0b)",
                      boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
                    }}
                  >
                    S&apos;inscrire sur {book.name}
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-16">

        {/* ═══════════ CODE BONUS ═══════════ */}
        <section className="mt-10">
          <div
            className="overflow-hidden rounded-2xl border border-emerald-500/20 p-6 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">Code bonus</p>
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <p className="text-2xl font-extrabold tracking-widest text-emerald-400">{content.code_bonus}</p>
            </div>
            <p className="mt-2 text-xs text-white/30">À entrer lors de votre inscription</p>
          </div>

          {/* CTA inscription */}
          {affiliateUrl && (
            <div className="mt-4">
              <a
                href={affiliateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-bold text-white transition hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, #d97706cc, #f59e0b)",
                  boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
                }}
              >
                S&apos;inscrire sur {book.name} avec le code {content.code_bonus}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
          )}
        </section>

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
              <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-6 py-5 text-center">
                <p className="text-sm font-bold text-neutral-800">
                  Rejoignez {book.name} maintenant — Code bonus : <span className="text-emerald-600">{content.code_bonus}</span>
                </p>
                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #d97706cc, #f59e0b)",
                    boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
                  }}
                >
                  S&apos;inscrire gratuitement →
                </a>
              </div>
            )}
          </div>
        ))}

        {/* ═══════════ VIDEOS ═══════════ */}
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
                {/* Video player */}
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

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="mt-14">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-8 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <h3 className="text-xl font-extrabold text-white">Prêt à commencer ?</h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/40">
              Inscrivez-vous sur {book.name} avec le code <span className="font-bold text-emerald-400">{content.code_bonus}</span> et 
              commencez à suivre nos pronostics avec les meilleures cotes du marché.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {affiliateUrl && (
                <a
                  href={affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-xl px-8 py-4 text-sm font-bold text-white transition hover:opacity-90 sm:w-auto"
                  style={{
                    background: "linear-gradient(135deg, #d97706cc, #f59e0b)",
                    boxShadow: "0 4px 20px rgba(245,158,11,0.3)",
                  }}
                >
                  S&apos;inscrire sur {book.name} →
                </a>
              )}
              <Link
                href="/fr/bookmakers"
                className="w-full rounded-xl border border-white/10 px-8 py-4 text-sm font-semibold text-white/50 transition hover:border-white/20 hover:text-white/70 sm:w-auto"
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