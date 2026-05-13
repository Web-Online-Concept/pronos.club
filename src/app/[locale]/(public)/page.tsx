import Link from "next/link";
import Image from "next/image";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import HomeVideoPlayer from "@/components/ui/VideoPlayer";

// ═══════════════════════════════════════════════════════════════
// ISR : la page est régénérée toutes les 5 minutes côté serveur.
// Économise les requêtes Supabase sur les pics de trafic.
// ═══════════════════════════════════════════════════════════════
export const revalidate = 300;

// ═══════════════════════════════════════════════════════════════
// Cache des picks (stats live) — 5 min, tagué pour invalidation ciblée
// Pour invalider manuellement après ajout d'un pick : revalidateTag("home-picks")
// ═══════════════════════════════════════════════════════════════
const getCachedPicks = unstable_cache(
  async () => {
    const { data } = await supabaseAdmin
      .from("picks")
      .select(
        "status, profit, stake, odds, event_name, selection, published_at, result_entered_at, pick_number, sport:sports(icon)"
      )
      .neq("status", "pending")
      .order("result_entered_at", { ascending: false });
    return data ?? [];
  },
  ["home-all-picks"],
  { revalidate: 300, tags: ["home-picks"] }
);

const getCachedPendingCount = unstable_cache(
  async () => {
    // 1. Récupérer tous les picks pending dont l'event_date est dans le futur
    const { data: pendingPicks } = await supabaseAdmin
      .from("picks")
      .select("id, pick_type")
      .eq("status", "pending")
      .gt("event_date", new Date().toISOString());

    if (!pendingPicks || pendingPicks.length === 0) return 0;

    // 2. Séparer simples vs combinés
    //    - Simples : déjà bons (event_date > now() suffit)
    //    - Combinés : il faut vérifier que TOUTES les jambes ont event_date > now()
    //      (sinon une jambe a déjà commencé, le combiné n'est plus "en cours")
    const simplePicks = pendingPicks.filter((p) => p.pick_type !== "combine");
    const combinePicks = pendingPicks.filter((p) => p.pick_type === "combine");

    let validCombineCount = 0;

    if (combinePicks.length > 0) {
      // Récupérer toutes les jambes des combinés pending en 1 seule query
      const combineIds = combinePicks.map((p) => p.id);
      const { data: legs } = await supabaseAdmin
        .from("pick_legs")
        .select("pick_id, event_date")
        .in("pick_id", combineIds);

      if (legs) {
        const nowIso = new Date().toISOString();
        // Grouper les jambes par pick_id
        const legsByPick = new Map<string, string[]>();
        for (const leg of legs) {
          const arr = legsByPick.get(leg.pick_id) ?? [];
          arr.push(leg.event_date);
          legsByPick.set(leg.pick_id, arr);
        }

        // Un combiné est "en cours" SSI toutes ses jambes ont event_date > now()
        for (const pick of combinePicks) {
          const pickLegs = legsByPick.get(pick.id);
          if (!pickLegs || pickLegs.length === 0) {
            // Combiné sans jambe stockée : fallback sur l'event_date du pick (déjà > now)
            // Mais c'est suspect — on log un warning
            console.warn(
              `[home-pending-count] Combiné ${pick.id} sans jambes en pick_legs, comptage incertain`
            );
            validCombineCount++;
            continue;
          }
          const allFuture = pickLegs.every((d) => d > nowIso);
          if (allFuture) validCombineCount++;
        }
      }
    }

    return simplePicks.length + validCombineCount;
  },
  ["home-pending-count"],
  { revalidate: 300, tags: ["home-picks"] }
);

// ═══════════════════════════════════════════════════════════════════
// Cache compteur Pronos IA en cours (ajout 12/05/2026)
// Source: table ai_picks, mêmes critères que la page /pronos-ia
//         (status='pending' AND event_date > NOW() AND pick_type='classic'
//          AND deleted_at IS NULL)
// ═══════════════════════════════════════════════════════════════════
const getCachedAiPendingCount = unstable_cache(
  async () => {
    const { count } = await supabaseAdmin
      .from("ai_picks")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("pick_type", "classic")
      .is("deleted_at", null)
      .gt("event_date", new Date().toISOString());
    return count ?? 0;
  },
  ["home-ai-pending-count"],
  { revalidate: 300, tags: ["home-picks"] }
);

// ═══════════════════════════════════════════════════════════════════
// Cache compteur Pronos Abonnés en cours (ajout 12/05/2026)
// Source: table tipster_picks, MÊMES critères que /pronos-abonnes/en-cours
//         (status='live' AND match_date >= NOW())
// → Source de vérité unique pour éviter toute incohérence home vs page détail
// ═══════════════════════════════════════════════════════════════════
const getCachedAbonnesPendingCount = unstable_cache(
  async () => {
    const { count } = await supabaseAdmin
      .from("tipster_picks")
      .select("id", { count: "exact", head: true })
      .eq("status", "live")
      .gte("match_date", new Date().toISOString());
    return count ?? 0;
  },
  ["home-abonnes-pending-count"],
  { revalidate: 300, tags: ["home-picks"] }
);

const getCachedReviews = unstable_cache(
  async () => {
    const { data } = await supabaseAdmin
      .from("reviews")
      .select("id, pseudo, avatar_url, rating, content, created_at")
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .limit(6);
    return data ?? [];
  },
  ["home-reviews"],
  { revalidate: 600, tags: ["home-reviews"] }
);

// Dernier pick gratuit pour le teaser home (pending prioritaire, sinon résolu récent)
const getCachedTeaserPick = unstable_cache(
  async () => {
    // 1. Chercher d'abord un pick GRATUIT actuellement en cours
    const { data: pendingFree } = await supabaseAdmin
      .from("picks")
      .select(
        "id, event_name, selection, odds, stake, analysis_fr, analysis_en, analysis_es, event_date, status, sport:sports(name_fr, name_en, name_es, icon)"
      )
      .eq("is_premium", false)
      .eq("status", "pending")
      .gt("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pendingFree) return pendingFree;

    // 2. Fallback : dernier pick GRATUIT gagné (pour preuve de performance)
    const { data: lastWon } = await supabaseAdmin
      .from("picks")
      .select(
        "id, event_name, selection, odds, stake, analysis_fr, analysis_en, analysis_es, event_date, status, sport:sports(name_fr, name_en, name_es, icon)"
      )
      .eq("is_premium", false)
      .in("status", ["won", "half_won"])
      .order("result_entered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return lastWon ?? null;
  },
  ["home-teaser-pick"],
  { revalidate: 300, tags: ["home-picks"] }
);

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  // ─── Fetch real stats (cached) ───
  const [allPicks, pendingCount, aiPendingCount, abonnesPendingCount, reviewsData, teaserPick] = await Promise.all([
    getCachedPicks(),
    getCachedPendingCount(),
    getCachedAiPendingCount(),
    getCachedAbonnesPendingCount(),
    getCachedReviews(),
    isPremium ? Promise.resolve(null) : getCachedTeaserPick(),
  ]);

  const picks = allPicks ?? [];
  const totalPicks = picks.length;
  const activePronos = pendingCount ?? 0;
  const activeAiPronos = aiPendingCount ?? 0;
  const activeAbonnesPronos = abonnesPendingCount ?? 0;
  const totalProfit = picks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const wonPicks = picks.filter((p) => p.status === "won" || p.status === "half_won").length;
  const resolvedPicks = picks.filter((p) => p.status !== "void").length;
  const winRate = resolvedPicks > 0 ? Math.round((wonPicks / resolvedPicks) * 10000) / 100 : 0;
  const totalStaked = picks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const roi = totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 10000) / 100 : 0;
  const avgOdds = resolvedPicks > 0 ? (picks.filter((p) => p.status !== "void").reduce((s, p) => s + (p.odds ?? 0), 0) / resolvedPicks).toFixed(3) : "0";

  // Current streak
  const sorted = [...picks].sort(
    (a, b) => (a.pick_number ?? 0) - (b.pick_number ?? 0)
  );
  let streakType = "";
  let streakCount = 0;
  sorted.forEach((p) => {
    if (p.status === "won" || p.status === "half_won") {
      if (streakType === "W") streakCount++;
      else { streakType = "W"; streakCount = 1; }
    } else if (p.status === "lost" || p.status === "half_lost") {
      if (streakType === "L") streakCount++;
      else { streakType = "L"; streakCount = 1; }
    }
  });
  const currentStreak = streakType ? `${streakCount}${streakType}` : "-";

  // Last 5 resolved picks
  const recent = picks.slice(0, 5);

  // Months active
  const monthSet = new Set(picks.map((p) => (p.result_entered_at ?? "").slice(0, 7)));
  const monthsActive = monthSet.size;

  const reviews = reviewsData ?? [];

  // ═══════════════════════════════════════════════════════════════
  // JSON-LD : Schema.org pour rich snippets Google
  // Génère FAQPage (questions/réponses en résultats de recherche)
  // + AggregateRating (étoiles visibles en SERP)
  // ═══════════════════════════════════════════════════════════════
  const faqItems = [
    { q: t("faq_q1"), a: t("faq_a1") },
    { q: t("faq_q2"), a: t("faq_a2") },
    { q: t("faq_q3"), a: t("faq_a3") },
    { q: t("faq_q4"), a: t("faq_a4") },
    { q: t("faq_q5"), a: t("faq_a5") },
    { q: t("faq_q6"), a: t("faq_a6") },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PRONOS.CLUB",
    url: "https://pronos.club",
    logo: "https://pronos.club/pronos_club_hero.png",
    description: t("hero_subtitle"),
    ...(reviews.length > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: avgRating.toFixed(1),
        reviewCount: reviews.length,
        bestRating: "5",
        worstRating: "1",
      },
    }),
  };

  return (
    <>
      {/* ═══════════ JSON-LD Schema.org pour SEO ═══════════ */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />

    <main className="bg-neutral-950">
      {/* ═══════════ HERO + STATS = viewport height ═══════════ */}
      <div className="flex min-h-[calc(100vh-70px)] flex-col supports-[min-height:100svh]:min-h-[calc(100svh-70px)] lg:min-h-[calc(100vh-100px)] lg:supports-[min-height:100svh]:min-h-[calc(100svh-100px)]">
      {/* ═══════════ HERO (DARK) ═══════════ */}
      <section className="relative flex flex-1 flex-col justify-center overflow-hidden bg-neutral-950 text-white">
        {/* Glow effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[140px]" />
          <div className="absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-emerald-400/15 blur-[120px]" />
          <div className="absolute left-1/2 top-1/3 h-[200px] w-[200px] -translate-x-1/2 rounded-full bg-emerald-600/10 blur-[80px]" />
        </div>

        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center justify-center px-4 py-4 text-center sm:py-8">
          {/* Titre + sous-titre (déplacés au-dessus des cartes le 12/05/2026) */}
          <h1 className="text-2xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
            <span className="inline-block animate-[textShimmer_10s_linear_infinite] bg-[length:300%_100%] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(105deg, white 0%, white 35%, #6ee7b7 45%, #a7f3d0 50%, #6ee7b7 55%, white 65%, white 100%)" }}>
              {t("hero_title_line1")}
            </span>
            <br />
            <span className="inline-block animate-[textShimmer_10s_linear_infinite] bg-[length:300%_100%] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(105deg, #34d399 0%, #34d399 35%, #ffffff 45%, #ffffff 50%, #ffffff 55%, #34d399 65%, #34d399 100%)", animationDelay: "0.3s" }}>
              {t("hero_title_line2")}
            </span>
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400 sm:mt-5 sm:text-lg">
            {t("hero_subtitle")}
          </p>

          {/* Hero — 3 cartes médaillons (Tipster / IA / Abonnés) */}
          {/* Remplace l'ancien logo pronos_club_hero. Chaque carte est cliquable :
              - badge "X en cours" → page des pronos en cours de la catégorie
              - bouton "Historique" → page historique de la catégorie
              Les 3 compteurs viennent de caches taggés "home-picks" donc actualisés
              automatiquement à chaque résolution de pick (cf. revalidateTag dans
              picks/[id]/result/route.ts). */}
          <div className="mx-auto mt-6 mb-3 grid w-full max-w-3xl grid-cols-3 gap-3 sm:mt-8 sm:mb-6 sm:gap-6">
            {(
              [
                {
                  href_pending: `/${locale}/pronostics`,
                  href_history: `/${locale}/historique`,
                  count: activePronos,
                  img:
                    locale === "en"
                      ? "/pronos_tipster_en.png"
                      : locale === "es"
                      ? "/pronos_tipster_es.png"
                      : "/pronos_tipster.png",
                  alt: t("hero_card_tipster"),
                },
                {
                  href_pending: `/${locale}/pronos-ia`,
                  href_history: `/${locale}/pronos-ia/historique`,
                  count: activeAiPronos,
                  img:
                    locale === "en"
                      ? "/pronos_IA_en.png"
                      : locale === "es"
                      ? "/pronos_IA_es.png"
                      : "/pronos_IA.png",
                  alt: t("hero_card_ia"),
                },
                {
                  href_pending: `/${locale}/pronos-abonnes/en-cours`,
                  href_history: `/${locale}/pronos-abonnes/historique`,
                  count: activeAbonnesPronos,
                  img:
                    locale === "en"
                      ? "/pronos_abonnes_en.png"
                      : locale === "es"
                      ? "/pronos_abonnes_es.png"
                      : "/pronos_abonnes.png",
                  alt: t("hero_card_abonnes"),
                },
              ] as const
            ).map((card) => (
              <div
                key={card.alt}
                className="flex flex-col items-center gap-2 sm:gap-3"
              >
                {/* Médaillon image — cliquable vers la page des pronos en cours */}
                <Link
                  href={card.href_pending}
                  className="block transition hover:scale-105"
                >
                  <Image
                    src={card.img}
                    alt={card.alt}
                    width={200}
                    height={200}
                    className="h-[90px] w-[90px] object-contain sm:h-[160px] sm:w-[160px] lg:h-[200px] lg:w-[200px]"
                    priority
                  />
                </Link>

                {/* Badge "X en cours" cliquable */}
                <Link
                  href={card.href_pending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 transition hover:border-emerald-500/60 hover:bg-emerald-500/20 sm:px-4 sm:py-1.5"
                >
                  <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 sm:h-2 sm:w-2" />
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-400 sm:text-xs">
                    {t("hero_card_pending", { count: card.count })}
                  </span>
                </Link>

                {/* Bouton Historique cliquable */}
                <Link
                  href={card.href_history}
                  className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-semibold text-sky-400 transition hover:border-sky-500/60 hover:bg-sky-500/20 sm:px-4 sm:py-1.5 sm:text-xs"
                >
                  {t("hero_card_history")}
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-col items-center gap-2 sm:mt-8 sm:justify-center">
            {isPremium ? (
              <>
                {/* PREMIUM : Accéder à mon espace */}
                <Link
                  href={`/${locale}/espace`}
                  className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-400 sm:w-auto sm:px-8 sm:py-4"
                >
                  ✅ {t("cta_my_space")}
                </Link>
              </>
            ) : (
              <>
                {/* NON-PREMIUM : Essai 7j gratuits */}
                <Link
                  href={isLoggedIn ? `/${locale}/espace/abonnement` : `/${locale}/login`}
                  className="group relative w-full overflow-hidden rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto sm:px-8 sm:py-4"
                >
                  {/* Shimmer effect on hover */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                  <span className="relative flex items-center justify-center gap-2">
                    🎁{" "}
                    {locale === "en"
                      ? "Try 7 days free"
                      : locale === "es"
                      ? "Prueba 7 días gratis"
                      : "Essayer 7 jours gratuits"}
                  </span>
                </Link>
              </>
            )}
          </div>

          {/* Sous-CTA : code promo + sans engagement (uniquement non-premium) */}
          {!isPremium && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 sm:mt-4 sm:text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                {locale === "en"
                  ? "Code"
                  : locale === "es"
                  ? "Código"
                  : "Avec le code"}{" "}
                <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[11px] font-extrabold text-amber-400 ring-1 ring-amber-500/30">
                  PRONOS7
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                {t("trust_immutable")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                {locale === "en"
                  ? "Cancel anytime"
                  : locale === "es"
                  ? "Cancela cuando quieras"
                  : "Résiliable à tout moment"}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════ STATS BAR (DARK) ═══════════ */}
      {totalPicks > 0 && (
        <section
          className="border-t border-emerald-900/40"
          style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
        >
          <div className="mx-auto grid max-w-4xl grid-cols-3 gap-y-2 px-2 py-3 sm:grid-cols-6 sm:gap-y-0 sm:divide-x sm:divide-neutral-800 sm:px-4 sm:py-6">
            {[
              { label: t("stats_picks"), value: totalPicks },
              { label: t("stats_winrate"), value: `${Number(winRate).toFixed(2)}%`, green: winRate >= 50 },
              { label: t("stats_roi"), value: `${roi >= 0 ? "+" : ""}${Number(roi).toFixed(2)}%`, green: roi >= 0 },
              { label: t("stats_profit"), value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(3)}U`, green: totalProfit >= 0 },
              { label: t("stats_avg_odds"), value: avgOdds },
              { label: t("stats_streak"), value: currentStreak, green: streakType === "W" },
            ].map((stat) => (
              <div key={stat.label} className="px-1 text-center sm:px-2">
                <p className={`text-base font-bold sm:text-xl ${
                  "green" in stat && stat.green !== undefined
                    ? stat.green ? "text-emerald-400" : "text-red-400"
                    : "text-white"
                }`}>
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>

      {/* ═══════════ TEASER PICK GRATUIT (DARK) — non-premium uniquement ═══════════ */}
      {!isPremium && teaserPick && (
        <section className="relative overflow-hidden bg-neutral-950 px-4 py-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-3xl">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                🎁{" "}
                {locale === "en"
                  ? "Free pick sample"
                  : locale === "es"
                  ? "Pronóstico gratuito"
                  : "Pronostic offert"}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
                {teaserPick.status === "pending"
                  ? locale === "en"
                    ? "See what you're missing"
                    : locale === "es"
                    ? "Descubre lo que te pierdes"
                    : "Découvrez un de nos pronostics"
                  : locale === "en"
                  ? "Recent winning pick"
                  : locale === "es"
                  ? "Pronóstico ganador reciente"
                  : "Pronostic gagnant récent"}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-400">
                {teaserPick.status === "pending"
                  ? locale === "en"
                    ? "A taste of what Premium members receive every day, with full analysis."
                    : locale === "es"
                    ? "Un anticipo de lo que los miembros Premium reciben cada día, con análisis completo."
                    : "Un aperçu de ce que nos membres Premium reçoivent chaque jour, avec l'analyse complète."
                  : locale === "en"
                  ? "One of our latest winning picks — transparent and verifiable."
                  : locale === "es"
                  ? "Uno de nuestros últimos pronósticos ganadores — transparente y verificable."
                  : "L'un de nos derniers pronos gagnants — transparent et vérifiable."}
              </p>
            </div>

            <div
              className="mt-10 overflow-hidden rounded-3xl border border-emerald-500/20 shadow-2xl shadow-emerald-500/10"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              {/* Badge status */}
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 sm:px-6">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-xl">
                    {(() => {
                      const sport = Array.isArray(teaserPick.sport) ? teaserPick.sport[0] : teaserPick.sport;
                      return sport?.icon ?? "⚽";
                    })()}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-white">
                      {(() => {
                        const sport = Array.isArray(teaserPick.sport) ? teaserPick.sport[0] : teaserPick.sport;
                        if (!sport) return "Sport";
                        return (locale === "en" ? sport.name_en : locale === "es" ? sport.name_es : sport.name_fr) ?? "Sport";
                      })()}
                    </p>
                    <p className="text-[10px] text-white/40">
                      {new Date(teaserPick.event_date).toLocaleDateString(
                        locale === "es" ? "es-ES" : locale === "en" ? "en-US" : "fr-FR",
                        { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
                      )}
                    </p>
                  </div>
                </div>
                {teaserPick.status === "pending" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    {locale === "en" ? "Live" : locale === "es" ? "En vivo" : "En cours"}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    ✅ {locale === "en" ? "Won" : locale === "es" ? "Ganado" : "Gagné"}
                  </span>
                )}
              </div>

              {/* Event + selection */}
              <div className="px-5 py-6 sm:px-6">
                <p className="text-lg font-extrabold text-white sm:text-xl">{teaserPick.event_name}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                      {locale === "en" ? "Selection" : locale === "es" ? "Selección" : "Sélection"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-400">{teaserPick.selection}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                      {locale === "en" ? "Odds" : locale === "es" ? "Cuota" : "Cote"}
                    </p>
                    <p className="mt-1 font-mono text-sm font-black text-white">{Number(teaserPick.odds).toFixed(3)}</p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:col-span-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                      {locale === "en" ? "Stake" : locale === "es" ? "Apuesta" : "Mise"}
                    </p>
                    <p className="mt-1 font-mono text-sm font-black text-white">
                      {Number(teaserPick.stake).toFixed(1)}U
                    </p>
                  </div>
                </div>

                {/* Analysis teaser (blur effect) */}
                {(() => {
                  const analysis = locale === "en"
                    ? teaserPick.analysis_en
                    : locale === "es"
                    ? teaserPick.analysis_es
                    : teaserPick.analysis_fr;
                  if (!analysis) return null;
                  return (
                    <div className="relative mt-5 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                        📊 {locale === "en" ? "Expert analysis" : locale === "es" ? "Análisis experto" : "Analyse de l'expert"}
                      </p>
                      <p className="text-sm leading-relaxed text-white/60 line-clamp-3">
                        {analysis}
                      </p>
                      {/* Fade overlay (gradient noir vers transparent) */}
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
                        style={{
                          background: "linear-gradient(to top, #0a1a15 10%, transparent)",
                        }}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* CTA débloquer */}
              <div className="border-t border-white/[0.06] px-5 py-5 text-center sm:px-6">
                <p className="text-xs text-white/50">
                  {locale === "en"
                    ? "Want full analysis + all premium picks?"
                    : locale === "es"
                    ? "¿Quieres el análisis completo + todos los pronósticos premium?"
                    : "Envie de l'analyse complète + tous les pronos premium ?"}
                </p>
                <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
                  <Link
                    href={isLoggedIn ? `/${locale}/espace/abonnement` : `/${locale}/login`}
                    className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto sm:px-8"
                  >
                    🎁{" "}
                    {locale === "en"
                      ? "Try 7 days free"
                      : locale === "es"
                      ? "Prueba 7 días gratis"
                      : "Essayer 7 jours gratuits"}
                  </Link>
                  <Link
                    href={`/${locale}/pronostics`}
                    className="w-full rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white sm:w-auto sm:px-8"
                  >
                    {locale === "en"
                      ? "See all picks"
                      : locale === "es"
                      ? "Ver todos los pronósticos"
                      : "Voir tous les pronos"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ VIDÉO PRÉSENTATION ═══════════ */}
      <section
        className="flex flex-col items-center justify-center bg-neutral-950 px-4 py-8 lg:min-h-[calc(100vh-100px)]"
      >
        <div className="w-full max-w-5xl overflow-hidden rounded-2xl shadow-2xl shadow-emerald-500/10">
          <HomeVideoPlayer
            src={`/video_accueil_${locale}.mp4`}
            thumbnail={`/video_accueil_${locale}-thumb.jpg`}
            title={t("video_title")}
          />
        </div>
      </section>

      {/* ═══════════ DERNIERS RÉSULTATS (LIGHT) ═══════════ */}
      {recent.length > 0 && (
        <section className="bg-neutral-50 px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">
                {t("results_tag")}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("results_title")}</h2>
              <p className="mt-2 text-sm text-neutral-500">
                {t("results_subtitle")}
              </p>
            </div>

            <div className="mt-10 space-y-3">
              {recent.map((pick, i) => {
                const isWon = pick.status === "won" || pick.status === "half_won";
                const isVoid = pick.status === "void";
                const sport = Array.isArray(pick.sport) ? pick.sport[0] : pick.sport;
                return (
                  <div
                    key={i}
                    className={`group relative overflow-hidden rounded-2xl border p-3 sm:p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                      isWon
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : isVoid
                        ? "border-white/10 bg-white/5"
                        : "border-red-500/20 bg-red-500/5"
                    }`}
                    style={{ background: isWon ? "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" : isVoid ? "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)" : "linear-gradient(135deg, #0a0a0a 0%, #2e0606 100%)" }}
                  >
                    <div className={`absolute inset-y-0 left-0 w-1 ${isWon ? "bg-emerald-500" : isVoid ? "bg-neutral-500" : "bg-red-500"}`} />
                    <div className="flex items-center justify-between gap-2 pl-2 sm:pl-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-base sm:text-lg">{sport?.icon ?? "⚽"}</span>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-white truncate">{pick.event_name}</p>
                          <p className="text-[10px] sm:text-xs text-white/40 truncate">{pick.selection} · {t("results_odds")} {pick.odds}</p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold ${
                          isWon
                            ? "bg-emerald-500/20 text-emerald-400"
                            : isVoid
                            ? "bg-white/10 text-white/50"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {isWon ? "✅" : isVoid ? "↩️" : "❌"}{" "}
                        {pick.profit !== null && (
                          <span>
                            {(pick.profit ?? 0) >= 0 ? "+" : ""}
                            {Number(pick.profit).toFixed((pick.status === "lost" || pick.status === "half_lost") ? 1 : 3)}U
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Link
                href={`/${locale}/historique`}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                {t("results_see_history")}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ COMMENT ÇA MARCHE (DARK) ═══════════ */}
      <section
        className="relative overflow-hidden px-4 py-16"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{t("how_tag")}</p>
            <h2 className="mt-2 text-2xl font-bold text-white">{t("how_title")}</h2>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: t("how_step1_title"),
                desc: t("how_step1_desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
              },
              {
                step: "02",
                title: t("how_step2_title"),
                desc: t("how_step2_desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                ),
              },
              {
                step: "03",
                title: t("how_step3_title"),
                desc: t("how_step3_desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20">
                  {item.icon}
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-emerald-400">
                  {t("how_step")} {item.step}
                </p>
                <h3 className="mt-2 text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ POURQUOI PRONOS.CLUB (LIGHT) ═══════════ */}
      <section className="bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("why_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("why_title")}</h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              { title: t("why_transparency_title"), desc: t("why_transparency_desc"), icon: "📸" },
              { title: t("why_stats_title"), desc: t("why_stats_desc"), icon: "📊" },
              { title: t("why_notif_title"), desc: t("why_notif_desc"), icon: "🔔" },
              { title: t("why_bankroll_title"), desc: t("why_bankroll_desc"), icon: "🏦" },
              { title: t("why_no_commitment_title"), desc: t("why_no_commitment_desc"), icon: "🤝" },
              { title: t("why_multisport_title"), desc: t("why_multisport_desc"), icon: "⚽" },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group overflow-hidden rounded-2xl border border-white/[0.06] p-6 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">{feature.icon}</span>
                <h3 className="mt-4 font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ VOTRE ESPACE PERSONNEL (DARK) ═══════════ */}
      <section
        className="relative overflow-hidden px-4 py-16"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
          <div className="absolute -right-20 bottom-1/4 h-48 w-48 rounded-full bg-emerald-400/8 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("space_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{t("space_title")}</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/40">
              {t("space_subtitle")}
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "✅", title: t("space_select_title"), desc: t("space_select_desc") },
              { icon: "🏦", title: t("space_bankroll_title"), desc: t("space_bankroll_desc") },
              { icon: "📈", title: t("space_stats_title"), desc: t("space_stats_desc") },
              { icon: "📋", title: t("space_history_title"), desc: t("space_history_desc") },
              { icon: "🔔", title: t("space_notif_title"), desc: t("space_notif_desc") },
              { icon: "💬", title: t("space_telegram_title"), desc: t("space_telegram_desc") },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 text-center transition hover:-translate-y-0.5 hover:border-emerald-500/20 hover:bg-white/[0.06]"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl ring-1 ring-emerald-500/20">{feature.icon}</span>
                <h3 className="mt-4 font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{feature.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href={isLoggedIn ? `/${locale}/espace` : `/${locale}/login`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
            >
              {isLoggedIn ? t("space_cta_logged") : t("space_cta_guest")}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ ARSENAL OUTILS (LIGHT) ═══════════ */}
      <section className="bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">
              {locale === "en" ? "Premium tools" : locale === "es" ? "Herramientas premium" : "Outils premium"}
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
              {locale === "en"
                ? "The complete arsenal of the savvy bettor"
                : locale === "es"
                ? "El arsenal completo del apostador experto"
                : "L'arsenal complet du parieur averti"}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-neutral-500">
              {locale === "en" ? (
                <>Professional tools. <strong className="text-neutral-700">Each comes with its own built-in tutorial.</strong></>
              ) : locale === "es" ? (
                <>Herramientas profesionales. <strong className="text-neutral-700">Cada una con su tutorial integrado.</strong></>
              ) : (
                <>Des outils professionnels. <strong className="text-neutral-700">Chacun avec son tutoriel intégré.</strong></>
              )}
            </p>
          </div>

          {(() => {
            // Destination selon statut utilisateur
            const ctaHref = isPremium
              ? `/${locale}/espace/calculateurs`
              : isLoggedIn
              ? `/${locale}/espace/abonnement`
              : `/${locale}/login`;
            // Pour les liens individuels : si pas premium, on renvoie vers l'abonnement
            const toolHref = (slug: string, type: "calc" | "mont" | "mart") => {
              if (!isPremium) return ctaHref;
              if (type === "calc") return `/${locale}/espace/calculateurs/${slug}`;
              if (type === "mont") return `/${locale}/espace/montantes`;
              return `/${locale}/espace/martingales`;
            };

            // Gradients dark emerald variés pour chaque card (6 variations subtiles)
            const gradients = [
              "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
              "linear-gradient(135deg, #065f46 0%, #064e3b 100%)",
              "linear-gradient(135deg, #047857 0%, #065f46 100%)",
              "linear-gradient(135deg, #0f3e2d 0%, #064e3b 100%)",
              "linear-gradient(135deg, #064e3b 0%, #0a3d2a 100%)",
              "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
            ];

            const groups: Array<{
              icon: string;
              title: { fr: string; en: string; es: string };
              tools: Array<{ icon: string; name: { fr: string; en: string; es: string }; slug: string; type: "calc" | "mont" | "mart" }>;
            }> = [
              {
                icon: "📊",
                title: { fr: "Calcul de base", en: "Basic calculation", es: "Cálculo básico" },
                tools: [
                  { icon: "💹", name: { fr: "ROI", en: "ROI", es: "ROI" }, slug: "roi", type: "calc" },
                  { icon: "📈", name: { fr: "TRJ", en: "TRJ", es: "TRJ" }, slug: "trj", type: "calc" },
                  { icon: "🎲", name: { fr: "Probabilités ↔ Cotes", en: "Probability ↔ Odds", es: "Probabilidad ↔ Cuotas" }, slug: "probabilites-cotes", type: "calc" },
                  { icon: "⚖️", name: { fr: "Répartiteur de mises", en: "Stake splitter", es: "Distribuidor de apuestas" }, slug: "repartiteur-mises", type: "calc" },
                ],
              },
              {
                icon: "🧠",
                title: { fr: "Stratégies de mise", en: "Betting strategies", es: "Estrategias de apuesta" },
                tools: [
                  { icon: "⬆️", name: { fr: "Montantes", en: "Parlays", es: "Montantes" }, slug: "montantes", type: "mont" },
                  { icon: "🔁", name: { fr: "Martingales", en: "Martingales", es: "Martingalas" }, slug: "martingales", type: "mart" },
                  { icon: "🧮", name: { fr: "Kelly", en: "Kelly", es: "Kelly" }, slug: "kelly", type: "calc" },
                ],
              },
              {
                icon: "⚡",
                title: { fr: "Stratégies avancées", en: "Advanced strategies", es: "Estrategias avanzadas" },
                tools: [
                  { icon: "🔀", name: { fr: "Dutching", en: "Dutching", es: "Dutching" }, slug: "dutching", type: "calc" },
                  { icon: "💎", name: { fr: "Value Bet", en: "Value Bet", es: "Value Bet" }, slug: "value-bet", type: "calc" },
                  { icon: "🎁", name: { fr: "Matched Betting", en: "Matched Betting", es: "Matched Betting" }, slug: "matched-betting", type: "calc" },
                  { icon: "🔒", name: { fr: "Surebet", en: "Surebet", es: "Surebet" }, slug: "surebet", type: "calc" },
                ],
              },
              {
                icon: "🎯",
                title: { fr: "Couverture live", en: "Live hedging", es: "Cobertura en vivo" },
                tools: [
                  { icon: "⏱️", name: { fr: "Cote live à couvrir", en: "Live odds to cover", es: "Cuota live a cubrir" }, slug: "cote-live-couvrir", type: "calc" },
                  { icon: "💰", name: { fr: "Bénéfice à acquérir", en: "Profit to acquire", es: "Beneficio a adquirir" }, slug: "benefice-acquerir", type: "calc" },
                ],
              },
            ];

            let gradientIndex = 0;

            return (
              <>
                <div className="mt-10 space-y-8">
                  {groups.map((group) => (
                    <div key={group.title.fr}>
                      <div className="mb-4 flex items-center gap-2">
                        <span className="text-xl">{group.icon}</span>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-700">
                          {locale === "en" ? group.title.en : locale === "es" ? group.title.es : group.title.fr}
                        </h3>
                        <div className="h-px flex-1 bg-gradient-to-r from-neutral-300 to-transparent" />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {group.tools.map((tool) => {
                          const currentGradient = gradients[gradientIndex % gradients.length];
                          gradientIndex++;
                          return (
                            <Link
                              key={tool.slug}
                              href={toolHref(tool.slug, tool.type)}
                              className="group relative overflow-hidden rounded-xl border border-emerald-900/40 px-4 py-4 shadow-md shadow-emerald-900/10 transition hover:-translate-y-1 hover:border-emerald-400/60 hover:shadow-xl hover:shadow-emerald-500/20"
                              style={{ background: currentGradient }}
                            >
                              {/* Halo emerald au hover */}
                              <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-emerald-400/0 blur-2xl transition-all duration-500 group-hover:bg-emerald-400/30" />
                              {/* Barre accent top */}
                              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                              <div className="relative flex items-center gap-3">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xl ring-1 ring-white/20 backdrop-blur-sm transition group-hover:bg-white/15 group-hover:ring-emerald-400/40">
                                  {tool.icon}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-white">
                                    {locale === "en" ? tool.name.en : locale === "es" ? tool.name.es : tool.name.fr}
                                  </p>
                                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                    {locale === "en" ? "With tutorial" : locale === "es" ? "Con tutorial" : "Avec tutoriel"}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA global */}
                <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href={ctaHref}
                    className="group relative w-full overflow-hidden rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative flex items-center justify-center gap-2">
                      {isPremium
                        ? locale === "en"
                          ? "Access my tools"
                          : locale === "es"
                          ? "Acceder a mis herramientas"
                          : "Accéder à mes outils"
                        : locale === "en"
                        ? "🎁 Unlock all tools"
                        : locale === "es"
                        ? "🎁 Desbloquear todas las herramientas"
                        : "🎁 Débloquer tous les outils"}
                    </span>
                  </Link>
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* ═══════════ PRONOS IA (DARK — emerald + accent violet) ═══════════ */}
      <section
        className="relative overflow-hidden px-4 py-16"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        {/* Halo violet subtil (accent IA) */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[100px]" />
          <div className="absolute -right-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          {/* En-tête */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/5 px-4 py-1.5">
              <span className="text-base">🤖</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-300">
                {t("ai_tag")}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">
              {t("ai_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/50">
              {t("ai_subtitle")}
            </p>
          </div>

          {/* 3 points-clés */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🎯", title: t("ai_feature1_title"), desc: t("ai_feature1_desc") },
              { icon: "🔍", title: t("ai_feature2_title"), desc: t("ai_feature2_desc") },
              { icon: "📊", title: t("ai_feature3_title"), desc: t("ai_feature3_desc") },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/[0.06] p-5 text-center transition hover:border-violet-400/30"
                style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 100%)" }}
              >
                <span className="text-2xl">{item.icon}</span>
                <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/pronos-ia`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 sm:w-auto"
              style={{ background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)" }}
            >
              {t("ai_cta_main")}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href={`/${locale}/pronos-ia/comment-ca-marche`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-8 py-4 text-sm font-semibold text-white/70 transition hover:border-violet-400/40 hover:text-white sm:w-auto"
            >
              {t("ai_cta_secondary")}
            </Link>
          </div>

          {/* Note différenciation */}
          <p className="mx-auto mt-6 max-w-md text-center text-xs text-white/30">
            {t("ai_note")}
          </p>
        </div>
      </section>

      {/* ═══════════ PRONOS ABONNÉS (LIGHT — amber + accent cyan) ═══════════ */}
      {/* Modif 12/05/2026 : passage en fond clair (bg-neutral-50) pour respecter
          l'alternance dark/light de la page. Accents amber+cyan conservés. */}
      <section className="relative overflow-hidden bg-neutral-50 px-4 py-16">
        {/* Halos accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-amber-500/15 blur-[100px]" />
          <div className="absolute -right-24 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-cyan-500/15 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-5xl">
          {/* En-tête */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
              <span className="text-base">🏆</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-700">
                {t("abonnes_tag")}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
              {t("abonnes_title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-neutral-600">
              {t("abonnes_subtitle")}
            </p>
          </div>

          {/* 3 points-clés */}
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "👥", title: t("abonnes_feature1_title"), desc: t("abonnes_feature1_desc") },
              { icon: "🏆", title: t("abonnes_feature2_title"), desc: t("abonnes_feature2_desc") },
              { icon: "👑", title: t("abonnes_feature3_title"), desc: t("abonnes_feature3_desc") },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-emerald-600 bg-emerald-500 p-5 text-center shadow-md shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-emerald-500/30"
              >
                <span className="text-2xl">{item.icon}</span>
                <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/90">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href={`/${locale}/pronos-abonnes`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-4 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 sm:w-auto"
              style={{ background: "linear-gradient(135deg, #f59e0b 0%, #06b6d4 100%)" }}
            >
              {t("abonnes_cta_main")}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href={`/${locale}/pronos-abonnes/classement`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-emerald-500/40 sm:w-auto"
            >
              {t("abonnes_cta_secondary")}
            </Link>
          </div>

          {/* Note */}
          <p className="mx-auto mt-6 max-w-md text-center text-xs text-neutral-500">
            {t("abonnes_note")}
          </p>
        </div>
      </section>

      {/* ═══════════ PRICING (DARK) ═══════════ */}
      <section
        className="relative overflow-hidden px-4 py-16"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("pricing_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{t("pricing_title")}</h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-neutral-700 bg-neutral-900/80 p-6 text-center backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">{t("pricing_free")}</p>
              <p className="mt-2 text-3xl font-extrabold text-white">{t("pricing_free_price")}</p>
              <p className="text-sm text-neutral-500">{t("pricing_free_period")}</p>
              <div className="mt-6 flex justify-center"><ul className="space-y-3 text-sm text-neutral-300">
                {[
                  t("pricing_free_f1"),
                  t("pricing_free_f2"),
                  t("pricing_free_f3"),
                  t("pricing_free_f4"),
                  t("pricing_free_f5"),
                  t("pricing_free_f6"),
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul></div>
              {isPremium ? (
                <Link
                  href={`/${locale}/espace`}
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-400"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t("pricing_free_cta_premium")}
                </Link>
              ) : isLoggedIn ? (
                <Link
                  href={`/${locale}/espace`}
                  className="mt-6 block rounded-xl border border-neutral-600 px-6 py-3 text-sm font-semibold text-neutral-300 transition hover:border-neutral-400 hover:text-white"
                >
                  {t("pricing_free_cta_logged")}
                </Link>
              ) : (
                <Link
                  href={`/${locale}/login`}
                  className="mt-6 block rounded-xl border border-neutral-600 px-6 py-3 text-sm font-semibold text-neutral-300 transition hover:border-neutral-400 hover:text-white"
                >
                  {t("pricing_free_cta_guest")}
                </Link>
              )}
            </div>

            {/* Premium */}
            <div className="relative rounded-2xl border-2 border-emerald-500 bg-neutral-900/80 p-6 text-center shadow-lg shadow-emerald-500/10 backdrop-blur">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold text-white">
                {t("pricing_popular")}
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{t("pricing_premium")}</p>
              <p className="mt-2 text-3xl font-extrabold text-white">{t("pricing_premium_price")}<span className="text-lg font-normal text-neutral-500">{t("pricing_premium_period")}</span></p>
              <p className="text-sm text-neutral-500">{t("pricing_premium_commitment")}</p>
              <div className="mt-6 flex justify-center"><ul className="space-y-3 text-sm text-neutral-300">
                {[
                  t("pricing_premium_f1"),
                  t("pricing_premium_f2"),
                  t("pricing_premium_f3"),
                  t("pricing_premium_f4"),
                  t("pricing_premium_f5"),
                  t("pricing_premium_f6"),
                  t("pricing_premium_f7"),
                  t("pricing_premium_f8"),
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul></div>
              {isPremium ? (
                <Link
                  href={`/${locale}/espace`}
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-6 py-3 text-sm font-bold text-emerald-400"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {t("pricing_premium_cta_premium")}
                </Link>
              ) : isLoggedIn ? (
                <Link
                  href={`/${locale}/espace/abonnement`}
                  className="mt-6 block rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
                >
                  {t("pricing_premium_cta_logged")}
                </Link>
              ) : (
                <Link
                  href={`/${locale}/login`}
                  className="mt-6 block rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
                >
                  {t("pricing_premium_cta_guest")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FAQ (LIGHT) ═══════════ */}
      <section className="bg-neutral-50 px-4 py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("faq_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("faq_title")}</h2>
          </div>

          <div className="mt-10 space-y-3">
            {[
              { q: t("faq_q1"), a: t("faq_a1") },
              { q: t("faq_q2"), a: t("faq_a2") },
              { q: t("faq_q3"), a: t("faq_a3") },
              { q: t("faq_q4"), a: t("faq_a4") },
              { q: t("faq_q5"), a: t("faq_a5") },
              { q: t("faq_q6"), a: t("faq_a6") },
            ].map((faq) => (
              <details
                key={faq.q}
                className="group overflow-hidden rounded-2xl transition"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-5 text-sm font-bold text-white">
                  {faq.q}
                  <svg
                    className="h-5 w-5 shrink-0 text-emerald-400 transition group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="border-t border-white/10 px-6 pb-5 pt-4 text-sm leading-relaxed text-white/60">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ AVIS (DARK) — style Google Reviews ═══════════ */}
      {reviews.length > 0 && (
        <section
          className="relative overflow-hidden px-4 py-16 text-white"
          style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-32 top-0 h-[300px] w-[300px] rounded-full bg-amber-500/10 blur-[120px]" />
          </div>

          <div className="relative mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">⭐ {t("reviews_tag")}</p>
              <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">{t("reviews_title")}</h2>

              {/* Average rating */}
              <div className="mt-4 flex items-center justify-center gap-3">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s} className="text-xl" style={{ color: s <= Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) ? "#f59e0b" : "#4b5563" }}>★</span>
                  ))}
                </div>
                <span className="text-xl font-extrabold">{(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}</span>
                <span className="text-sm text-white/30">({reviews.length} {t("reviews_count")})</span>
              </div>
            </div>

            {/* Reviews grid */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="overflow-hidden rounded-2xl border border-white/[0.06] p-5"
                  style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-400">
                      {review.avatar_url ? (
                        <img src={review.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        review.pseudo.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{review.pseudo}</p>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className="text-xs" style={{ color: s <= review.rating ? "#f59e0b" : "#4b5563" }}>★</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-white/50">{review.content}</p>
                  <p className="mt-3 text-[10px] text-white/20">
                    {new Date(review.created_at).toLocaleDateString(locale === "es" ? "es-ES" : locale === "en" ? "en-US" : "fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>

            {/* Link to all reviews */}
            <div className="mt-8 text-center">
              <Link
                href={`/${locale}/avis`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
              >
                {t("reviews_see_all")} →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ BLOG / NEWS / VIDÉOS (WHITE) ═══════════ */}
      <section className="px-4 py-16 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">📚 {locale === "en" ? "CONTENT" : locale === "es" ? "CONTENIDO" : "CONTENU"}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900 sm:text-3xl">
              {locale === "en" ? "Stay informed, stay ahead" : locale === "es" ? "Mantente informado, mantente adelante" : "Restez informé, gardez l'avantage"}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-neutral-500">
              {locale === "en"
                ? "Articles, breaking news, and sports videos — everything you need to make better bets."
                : locale === "es"
                ? "Artículos, noticias de última hora y vídeos deportivos — todo lo que necesitas para apostar mejor."
                : "Articles, actualités en temps réel et vidéos sportives — tout ce qu'il faut pour parier mieux."}
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {/* Blog */}
            <Link
              href={`/${locale}/blog`}
              className="group overflow-hidden rounded-2xl border border-emerald-900/30 p-6 text-center transition hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl">✍️</div>
              <h3 className="mt-4 text-lg font-bold text-white">Blog</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {locale === "en"
                  ? "In-depth guides, bookmaker reviews, and expert analysis to sharpen your betting strategy."
                  : locale === "es"
                  ? "Guías detalladas, reseñas de casas de apuestas y análisis experto para mejorar tu estrategia."
                  : "Guides approfondis, analyses de bookmakers et stratégies pour affûter vos paris."}
              </p>
              <p className="mt-4 text-xs font-semibold text-emerald-400">
                {locale === "en" ? "Read articles →" : locale === "es" ? "Leer artículos →" : "Lire les articles →"}
              </p>
            </Link>

            {/* News */}
            <Link
              href={`/${locale}/news`}
              className="group overflow-hidden rounded-2xl border border-emerald-900/30 p-6 text-center transition hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl">📰</div>
              <h3 className="mt-4 text-lg font-bold text-white">News</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {locale === "en"
                  ? "Breaking sports news rewritten with a betting angle. Updated every hour, in 3 languages."
                  : locale === "es"
                  ? "Noticias deportivas de última hora con enfoque en apuestas. Actualizadas cada hora, en 3 idiomas."
                  : "L'actualité sportive décryptée avec un angle paris. Mise à jour toutes les heures, en 3 langues."}
              </p>
              <p className="mt-4 text-xs font-semibold text-emerald-400">
                {locale === "en" ? "See latest news →" : locale === "es" ? "Ver últimas noticias →" : "Voir les actus →"}
              </p>
            </Link>

            {/* Vidéos */}
            <Link
              href={`/${locale}/videos`}
              className="group overflow-hidden rounded-2xl border border-emerald-900/30 p-6 text-center transition hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/10"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl">🎬</div>
              <h3 className="mt-4 text-lg font-bold text-white">{locale === "es" ? "Vídeos" : "Vidéos"}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/50">
                {locale === "en"
                  ? "The best sports videos from top media channels, curated and watchable right here."
                  : locale === "es"
                  ? "Los mejores vídeos deportivos de los principales medios, seleccionados y visibles aquí."
                  : "Les meilleures vidéos sport des grandes chaînes média, à regarder directement sur le site."}
              </p>
              <p className="mt-4 text-xs font-semibold text-emerald-400">
                {locale === "en" ? "Watch videos →" : locale === "es" ? "Ver vídeos →" : "Regarder les vidéos →"}
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ CTA FINAL (DARK) ═══════════ */}
      <section
        className="relative overflow-hidden px-4 py-16 text-center text-white sm:py-20"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/15 blur-[100px]" />
          <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-[80px]" />
        </div>
        <div className="relative mx-auto max-w-xl">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            {isPremium ? t("cta_tag_premium") : t("cta_tag_guest")}
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            {isPremium
              ? t("cta_desc_premium")
              : isLoggedIn
              ? t("cta_desc_logged")
              : t("cta_desc_guest")}
            {monthsActive > 1 && ` ${t("cta_active_since", { count: monthsActive })}`}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {isPremium ? (
              <Link
                href={`/${locale}/espace`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t("cta_premium_btn")}
              </Link>
            ) : isLoggedIn ? (
              <Link
                href={`/${locale}/espace/abonnement`}
                className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                {t("cta_logged_btn")}
              </Link>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                {t("cta_guest_btn")}
              </Link>
            )}
            <Link
              href={`/${locale}/statistiques`}
              className="w-full rounded-xl border border-neutral-700 px-8 py-4 text-sm font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-white sm:w-auto"
            >
              {t("cta_see_stats")}
            </Link>
          </div>
        </div>
      </section>
    </main>
    </>
  );
}