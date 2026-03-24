import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import VideoPlayer from "@/components/ui/VideoPlayer";

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
  sections: { title: string; content: string; icon: string; image?: string }[];
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
  "stake": {
    tagline: "Plateforme crypto de référence pour les paris sportifs et le casino",
    vpn: { required: true, label: "VPN à l'inscription seulement", countries: "Canada, Singapour" },
    access_info: null,
    code_bonus: "PRONOSCLUB",
    badge: { label: "International", class: "bg-amber-500/20 text-amber-400" },
    highlights: [
      { label: "Fondé en", value: "2017" },
      { label: "Paiement", value: "Crypto" },
      { label: "Programme", value: "VIP" },
      { label: "Rakeback", value: "Oui" },
    ],
    sections: [
      {
        title: "Pourquoi Stake ?",
        icon: "🏆",
        image: "/bookmakers/stake/stake-interface.jpg",
        content: "Stake est une plateforme internationale de paris sportifs et de casino en ligne qui s'est imposée comme la référence pour les parieurs crypto. Interface ultra-moderne, cotes compétitives, programme VIP généreux et communauté active — Stake offre une expérience de paris haut de gamme. C'est l'un des bookmakers les plus utilisés par les tipsters professionnels dans le monde.",
      },
      {
        title: "VPN : uniquement à l'inscription",
        icon: "🔒",
        image: "/bookmakers/stake/stake-vpn.jpg",
        content: "Bonne nouvelle : le VPN n'est nécessaire que lors de votre première inscription. Connectez-vous via le Canada ou Singapour pour créer votre compte. Une fois inscrit, vous pouvez vous connecter et parier normalement depuis n'importe où, sans VPN. C'est simple, rapide, et vous ne le faites qu'une seule fois.",
      },
      {
        title: "Comment s'inscrire sur Stake",
        icon: "📝",
        image: "/bookmakers/stake/stake-signup.jpg",
        content: "1. Activez votre VPN sur le Canada ou Singapour. 2. Rendez-vous sur Stake via notre lien d'affiliation. 3. Cliquez sur 'S'inscrire' et remplissez le formulaire (email, pseudo, mot de passe). 4. Entrez le code bonus PRONOSCLUB dans les 24h suivant l'inscription pour débloquer le rakeback immédiat. 5. Validez votre email. 6. Désactivez le VPN — vous n'en aurez plus jamais besoin.",
      },
      {
        title: "Dépôts et retraits en crypto",
        icon: "₿",
        image: "/bookmakers/stake/stake-coinbase.jpg",
        content: "Stake fonctionne exclusivement en cryptomonnaies. Nous recommandons l'USDC via Coinbase : très peu de volatilité, transferts ultra-rapides et frais minimes. Règle importante : vous retirez dans la même crypto que celle utilisée pour déposer. Le processus est simple : achetez de l'USDC sur Coinbase, transférez vers Stake, et inversement pour retirer vers votre compte bancaire.",
      },
      {
        title: "Le programme VIP Stake",
        icon: "💎",
        image: "/bookmakers/stake/stake-vip.jpg",
        content: "Stake propose un programme VIP à 15 niveaux (Bronze à Obsidienne). Chaque niveau débloque des bonus supplémentaires : rakeback, bonus hebdomadaires, bonus mensuels, rechargements, et un hôte VIP dédié à partir du niveau Platine. Les paris sportifs comptent 3× plus que les paris casino pour la progression. En utilisant le code PRONOSCLUB, vous débloquez le rakeback immédiatement sans attendre le niveau Bronze.",
      },
      {
        title: "Rakeback : récupérez sur chaque pari",
        icon: "💰",
        image: "/bookmakers/stake/stake-rakeback.jpg",
        content: "Le rakeback vous permet de récupérer 5% de l'avantage de la maison sur chaque pari, que vous gagniez ou perdiez. C'est un avantage considérable sur le long terme qui réduit vos pertes et augmente votre rentabilité. Normalement réservé aux membres Bronze, le code PRONOSCLUB vous donne un accès immédiat au rakeback dès votre inscription.",
      },
    ],
    videos: [
      {
        title: "Comment s'inscrire sur Stake",
        description: "Tutoriel complet : VPN, inscription, code bonus PRONOSCLUB, et première connexion.",
        file: "inscription.mp4",
      },
    ],
  },
  "ps3838": {
    tagline: "Le bookmaker des parieurs professionnels — les meilleures cotes sans restriction",
    vpn: null,
    access_info: "Pas de VPN nécessaire",
    code_bonus: null,
    badge: { label: "International", class: "bg-amber-500/20 text-amber-400" },
    highlights: [
      { label: "Accès via", value: "Broker" },
      { label: "Cotes", value: "N°1" },
      { label: "Limites", value: "Aucune" },
      { label: "Paiement", value: "Skrill" },
    ],
    sections: [
      {
        title: "Pourquoi PS3838 ?",
        icon: "🏆",
        image: "/bookmakers/ps3838/ps3838-interface.jpg",
        content: "PS3838 (anciennement Pinnacle) est LA référence des parieurs professionnels. Ses cotes sont parmi les plus élevées du marché et surtout, PS3838 ne limite jamais les gagnants. Contrairement aux bookmakers classiques qui ferment les comptes des joueurs rentables, PS3838 accueille tous les profils. C'est le bookmaker utilisé par les tipsters et les parieurs de haut niveau dans le monde entier.",
      },
      {
        title: "Accès via Asian Connect (broker)",
        icon: "🔗",
        image: "/bookmakers/ps3838/ps3838-asianconnect.jpg",
        content: "PS3838 n'est pas accessible directement depuis la France. Pour y accéder, il faut passer par un broker : Asian Connect. C'est une plateforme intermédiaire sécurisée qui vous permet d'ouvrir un compte PS3838 sans VPN, sans restriction. Asian Connect sert de lien entre vous et le bookmaker — vous déposez chez Asian Connect, et vos fonds sont disponibles sur PS3838.",
      },
      {
        title: "Comment s'inscrire",
        icon: "📝",
        image: "/bookmakers/ps3838/ps3838-signup.jpg",
        content: "1. Créez un compte sur Asian Connect via notre lien d'affiliation. 2. Dans votre tableau de bord, sélectionnez PS3838 parmi les bookmakers proposés. 3. Asian Connect crée automatiquement votre compte PS3838. 4. Effectuez votre premier dépôt via Skrill, Neteller ou Bitcoin. 5. Vous recevez vos identifiants PS3838 pour vous connecter directement au site et commencer à parier.",
      },
      {
        title: "Méthodes de paiement",
        icon: "💳",
        image: "/bookmakers/ps3838/ps3838-payment.jpg",
        content: "Asian Connect propose trois méthodes de paiement : Skrill (portefeuille électronique, transferts rapides, pas de frais entre Skrill et Asian Connect, retrait bancaire à 5,50€), Neteller (similaire à Skrill, simple et sécurisé), et Bitcoin (rapide, anonyme, idéal pour les gros montants). Nous recommandons Skrill pour sa simplicité et ses frais réduits.",
      },
      {
        title: "Le bonus Asian Connect",
        icon: "🎁",
        image: "/bookmakers/ps3838/ps3838-bonus.jpg",
        content: "Asian Connect propose un bonus de bienvenue sur votre premier dépôt. Notre conseil : si vous êtes un parieur régulier, acceptez-le — il augmente votre capital de départ. Si vous préférez une flexibilité totale sans conditions de mise, vous pouvez le refuser. Les conditions de validation sont clairement affichées lors de l'inscription.",
      },
      {
        title: "Aucune limite pour les gagnants",
        icon: "♾️",
        content: "C'est le point fort majeur de PS3838 : pas de limitation de compte, pas de réduction de mise maximale, pas de fermeture de compte pour les joueurs gagnants. Là où les bookmakers ARJEL et même certains internationaux limitent ou bannissent les parieurs rentables, PS3838 les accueille à bras ouverts. C'est pour cette raison que c'est LE bookmaker recommandé par les tipsters professionnels.",
      },
    ],
    videos: [],
  },
  "winamax": {
    tagline: "Le leader incontesté des paris sportifs en France",
    vpn: null,
    access_info: "Réservé aux joueurs français",
    code_bonus: null,
    badge: { label: "France", class: "bg-blue-500/20 text-blue-400" },
    highlights: [
      { label: "Fondé en", value: "1999" },
      { label: "Licence", value: "ARJEL" },
      { label: "Bonus", value: "100€" },
      { label: "App", value: "Mobile" },
    ],
    sections: [
      {
        title: "Pourquoi Winamax ?",
        icon: "🏆",
        image: "/bookmakers/winamax/winamax-interface.jpg",
        content: "Winamax est le bookmaker le plus populaire en France. Fondée en 1999, la plateforme propose des paris sportifs et du poker en ligne avec une interface intuitive, des cotes parmi les meilleures du marché ARJEL, et des promotions régulières. C'est le choix naturel pour les parieurs résidant en France qui veulent une plateforme fiable, régulée et complète.",
      },
      {
        title: "Des cotes compétitives en ARJEL",
        icon: "📈",
        image: "/bookmakers/winamax/winamax-cotes.jpg",
        content: "Parmi les bookmakers agréés en France, Winamax propose régulièrement les cotes les plus élevées. Les cotes sont mises à jour en temps réel, et la diversité des marchés est impressionnante : paris simples, combinés, handicap, nombre de buts, performances individuelles, paris long terme. Football, tennis, basketball, rugby, eSport — tout y est.",
      },
      {
        title: "Live betting & Cash-out",
        icon: "⚡",
        image: "/bookmakers/winamax/winamax-live.jpg",
        content: "Winamax excelle dans les paris en direct avec des statistiques temps réel et un tableau de bord complet. La fonctionnalité cash-out vous permet de sécuriser vos gains ou de minimiser vos pertes avant la fin d'un événement. Disponible avant match et en live, c'est un outil stratégique indispensable pour les parieurs réguliers.",
      },
      {
        title: "Bonus de bienvenue",
        icon: "🎁",
        image: "/bookmakers/winamax/winamax-bonus.jpg",
        content: "Winamax offre jusqu'à 100€ remboursés sur votre premier pari. Si votre premier pari est perdant, vous êtes remboursé intégralement sous forme de paris gratuits. En plus du bonus de bienvenue, des promotions régulières sont proposées : cotes boostées, paris gratuits, challenges hebdomadaires et accès au Club VIP pour les parieurs les plus actifs.",
      },
      {
        title: "Application mobile",
        icon: "📱",
        image: "/bookmakers/winamax/winamax-app.jpg",
        content: "L'application Winamax est disponible sur Android et iOS. Fluide, rapide et régulièrement mise à jour, elle donne accès à toutes les fonctionnalités : paris en direct, cash-out, gestion de compte, promotions. Vous pouvez parier où que vous soyez en quelques clics, même lors des gros événements sportifs.",
      },
      {
        title: "Communauté & fonctionnalités sociales",
        icon: "👥",
        content: "Winamax se démarque avec ses fonctionnalités sociales uniques. Le 'Mur des Paris' permet de partager vos paris, d'échanger des conseils et de suivre les mises des meilleurs parieurs. C'est un véritable réseau social du pari sportif qui renforce l'expérience et l'engagement de la communauté.",
      },
    ],
    videos: [],
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
            {affiliateUrl ? (
              <a href={affiliateUrl} target="_blank" rel="noopener noreferrer" className="flex h-24 w-40 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08] transition hover:bg-white/[0.12]">
                <img
                  src={book.logo_url || `/bookmakers/${book.slug}.png`}
                  alt={book.name}
                  className="h-full w-full object-cover"
                />
              </a>
            ) : (
              <div className="flex h-24 w-40 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.08]">
                <img
                  src={book.logo_url || `/bookmakers/${book.slug}.png`}
                  alt={book.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{book.name}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${content.badge.class}`}>
                  {content.badge.label}
                </span>
                {content.vpn?.required && (
                  <span className="rounded-full border border-red-500/50 bg-red-500/20 px-3 py-1 text-[10px] font-bold text-red-300">
                    {content.vpn.label}
                  </span>
                )}
                {content.access_info && (
                  <span className="rounded-full border border-blue-500/50 bg-blue-500/20 px-3 py-1 text-[10px] font-bold text-blue-300">
                    {content.access_info}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-white/40">{content.tagline}</p>
              {content.vpn?.countries && (
                <p className="mt-1 text-xs font-semibold text-red-300/70">VPN : {content.vpn.countries}</p>
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
                {section.image ? (
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                    <p className="flex-1 text-sm leading-relaxed text-white/50">{section.content}</p>
                    <img
                      src={section.image}
                      alt={section.title}
                      className="w-full rounded-xl sm:w-72"
                    />
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

            {/* First video — full width */}
            <div
              className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06]"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)" }}
            >
              <VideoPlayer
                src={`/bookmakers/${slug}/${content.videos[0].file}`}
                thumbnail={`/bookmakers/${slug}/${content.videos[0].file.replace(".mp4", "-thumb.jpg")}`}
                title={content.videos[0].title}
              />
              <div className="p-5">
                <h3 className="text-lg font-bold text-white">{content.videos[0].title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/40">{content.videos[0].description}</p>
              </div>
            </div>

            {/* Remaining videos — grid */}
            {content.videos.length > 1 && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {content.videos.slice(1).map((video, i) => (
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