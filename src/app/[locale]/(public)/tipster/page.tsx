import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";

export default async function TipsterPage() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  const isPremium = user?.subscription_status === "active";

  // Fetch real stats
  const { data: allPicks } = await supabaseAdmin
    .from("picks")
    .select("status, profit, stake, odds")
    .neq("status", "pending");

  const { count: pendingCount } = await supabaseAdmin
    .from("picks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const picks = allPicks ?? [];
  const totalPicks = picks.length;
  const totalProfit = picks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const wonPicks = picks.filter((p) => p.status === "won" || p.status === "half_won").length;
  const lostPicks = picks.filter((p) => p.status === "lost" || p.status === "half_lost").length;
  const voidPicks = picks.filter((p) => p.status === "void").length;
  const resolvedPicks = picks.filter((p) => p.status !== "void").length;
  const winRate = resolvedPicks > 0 ? Math.round((wonPicks / resolvedPicks) * 100) : 0;
  const totalStaked = picks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const roi = totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 100) : 0;
  const avgOdds = totalPicks > 0 ? (picks.reduce((s, p) => s + (p.odds ?? 0), 0) / totalPicks).toFixed(2) : "0";
  const activePronos = pendingCount ?? 0;

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
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Notre approche</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Le tipster &amp; la méthode</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/40">
            Pas de promesses. Pas de rêves. Une méthode rigoureuse, des analyses sérieuses, 
            et un objectif clair : la rentabilité sur le moyen et long terme.
          </p>

          {/* Live stats */}
          {totalPicks > 0 && (
            <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-6">
              {[
                { label: "Picks", value: totalPicks.toString() },
                { label: "Win rate", value: `${winRate}%`, green: winRate >= 50 },
                { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi}%`, green: roi >= 0 },
                { label: "Profit", value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(1)}U`, green: totalProfit >= 0 },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className={`text-xl font-extrabold ${
                    "green" in stat && stat.green !== undefined
                      ? stat.green ? "text-emerald-400" : "text-red-400"
                      : "text-white"
                  }`}>{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-16">

        {/* ═══════════ QUI SOMMES-NOUS ═══════════ */}
        <section className="mt-12">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">L&apos;équipe</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Qui sommes-nous ?</h2>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {/* Jérôme */}
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">🎯</div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">Jérôme <span className="text-sm font-semibold text-white/40">(Bollaert)</span></h3>
                  <p className="text-xs text-emerald-400">Tipster — Analyste sportif</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                Parieur professionnel depuis plus de 10 ans. Jérôme analyse chaque événement sportif avec rigueur, 
                en croisant les données statistiques, les compositions d&apos;équipes, les dynamiques et les cotes du marché. 
                Il ne publie un pronostic que lorsqu&apos;il identifie une vraie valeur — pas pour publier pour publier.
              </p>
            </div>

            {/* La plateforme */}
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-2xl">💻</div>
                <div>
                  <h3 className="text-lg font-extrabold text-white">La plateforme</h3>
                  <p className="text-xs text-emerald-400">Développée sur mesure</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                PRONOS.CLUB n&apos;est pas un simple blog ou un canal Telegram. C&apos;est une plateforme web complète 
                développée sur mesure : suivi de chaque pronostic en temps réel, statistiques détaillées, gestion de bankroll 
                personnalisée, historique vérifiable et transparent. Chaque ticket est screenshoté, chaque résultat est figé. 
                Rien n&apos;est modifiable après coup. La technologie est au service de la transparence.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════ DASHBOARD LIVE ═══════════ */}
        <section className="mt-10">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">📊</span>
                <h3 className="text-sm font-extrabold text-white">Tableau de bord — Données en temps réel</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-semibold text-emerald-400">{activePronos} en cours</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total picks", value: totalPicks.toString(), color: "text-white" },
                { label: "Gagnés", value: wonPicks.toString(), color: "text-emerald-400" },
                { label: "Perdus", value: lostPicks.toString(), color: "text-red-400" },
                { label: "Void", value: voidPicks.toString(), color: "text-neutral-400" },
                { label: "Win rate", value: `${winRate}%`, color: winRate >= 50 ? "text-emerald-400" : "text-red-400" },
                { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi}%`, color: roi >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Profit", value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(1)}U`, color: totalProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Cote moyenne", value: avgOdds, color: "text-white" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/[0.04] px-3 py-3 text-center">
                  <p className={`text-lg font-extrabold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[9px] uppercase tracking-wider text-white/25">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <Link href="/fr/statistiques" className="text-xs font-semibold text-emerald-400 transition hover:text-emerald-300">
                Voir les statistiques détaillées →
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════ NOTRE PHILOSOPHIE ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Notre ADN</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Ce qui nous définit</h2>
          </div>

          <div
            className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-sm">❌</span>
                <div>
                  <h3 className="font-bold text-white">On ne promet pas de gagner à chaque pronostic</h3>
                  <p className="mt-1 text-sm text-white/40">
                    Aucun tipster au monde ne gagne 100% de ses paris. Quiconque vous promet ça vous ment. 
                    Notre objectif est un taux de réussite régulier et une rentabilité prouvée sur le long terme, 
                    pas un sprint de victoires éphémères.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-sm">❌</span>
                <div>
                  <h3 className="font-bold text-white">On ne vend pas du rêve</h3>
                  <p className="mt-1 text-sm text-white/40">
                    Si vous cherchez un tipster qui annonce &quot;+50 unités par mois&quot; ou &quot;devenez riche en 3 mois&quot;, 
                    vous êtes au mauvais endroit. Les paris sportifs sont un investissement à variance — il y a des hauts et des bas. 
                    La différence entre un parieur rentable et un perdant, c&apos;est la discipline et la méthode sur la durée.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">✅</span>
                <div>
                  <h3 className="font-bold text-white">On mise sur la transparence totale</h3>
                  <p className="mt-1 text-sm text-white/40">
                    Chaque pronostic est publié avec un screenshot du ticket avant le match. Les résultats sont publics, 
                    les statistiques calculées automatiquement, et rien n&apos;est modifiable après coup. Vous pouvez vérifier 
                    chaque pick dans l&apos;historique. C&apos;est la base de notre crédibilité.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-sm">✅</span>
                <div>
                  <h3 className="font-bold text-white">On vise la rentabilité régulière</h3>
                  <p className="mt-1 text-sm text-white/40">
                    Notre objectif est d&apos;envoyer les meilleures sélections avec un ROI positif mois après mois. 
                    Pas de mise &quot;all-in&quot;, pas de martingale, pas de prise de risque inconsidérée. 
                    Une gestion de bankroll saine et une sélection rigoureuse — c&apos;est ce qui fait la différence.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ LA MÉTHODE ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Méthode</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Comment Jérôme sélectionne ses picks</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: "📊",
                title: "Analyse statistique",
                desc: "Chaque sélection repose sur une analyse approfondie : forme des équipes, confrontations directes, statistiques avancées, compositions probables. Rien n'est laissé au hasard.",
              },
              {
                icon: "💎",
                title: "Value betting",
                desc: "Jérôme ne parie que lorsqu'il identifie une valeur — c'est-à-dire quand la cote proposée par le bookmaker est supérieure à la probabilité réelle de l'événement. C'est la clé de la rentabilité long terme.",
              },
              {
                icon: "📈",
                title: "Multi-bookmakers",
                desc: "Les pronostics sont placés sur le bookmaker qui offre la meilleure cote à l'instant T. C'est pour ça qu'il est essentiel d'être inscrit sur les 6 bookmakers que nous recommandons.",
              },
              {
                icon: "🎯",
                title: "Sélection stricte",
                desc: "Qualité plutôt que quantité. Jérôme ne publie que les picks dans lesquels il a une vraie conviction. Pas de remplissage, pas de paris pour faire du volume. Chaque pick compte.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group overflow-hidden rounded-2xl border border-white/[0.06] p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">{item.icon}</span>
                <h3 className="mt-4 font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ TYPES DE PRONOS ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Format</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Les types de pronostics</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sm font-bold text-sky-400">1</span>
                <div>
                  <h3 className="font-extrabold text-white">Pari simple</h3>
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-400">Simple</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                Un seul événement, une seule sélection. C&apos;est le format le plus sûr et le plus fréquent. 
                Le risque est maîtrisé, le gain est proportionnel à la cote. C&apos;est la base d&apos;une gestion 
                de bankroll saine.
              </p>
              <div className="mt-4 rounded-lg bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/25">Exemple</p>
                <p className="mt-1 text-sm text-white/60">PSG — Victoire · Cote 1.85 · Mise 1U</p>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-sm font-bold text-purple-400">2</span>
                <div>
                  <h3 className="font-extrabold text-white">Pari combiné</h3>
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-purple-400">Combiné</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                Deux sélections combinées en un seul pari. Les cotes se multiplient, ce qui augmente 
                le gain potentiel. Nous nous limitons à <strong className="text-white/70">2 sélections maximum</strong> pour 
                garder un niveau de risque raisonnable. Pas de combinés à 5, 10 ou 15 sélections chez nous.
              </p>
              <div className="mt-4 rounded-lg bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/25">Exemple</p>
                <p className="mt-1 text-sm text-white/60">Real Madrid ML + Over 2.5 · Cote 2.70 · Mise 1U</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-6 py-4 text-center">
            <p className="text-sm font-semibold text-amber-700">
              Maximum 2 sélections par combiné — jamais plus. La discipline, c&apos;est aussi savoir limiter le risque.
            </p>
          </div>
        </section>

        {/* ═══════════ VOLUME DE PRONOS ═══════════ */}
        <section className="mt-14">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/20">
                <span className="text-3xl font-extrabold text-emerald-400">100+</span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Plus de 100 pronostics par mois</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">
                  Jérôme publie en moyenne plus de 100 pronostics par mois, répartis sur tous les sports et 
                  toutes les compétitions. Le volume est important pour lisser la variance et maximiser les 
                  opportunités. Chaque jour, de nouvelles sélections sont publiées — il y a toujours quelque 
                  chose à suivre.
                </p>
                <p className="mt-2 text-xs text-white/30">
                  Ce chiffre peut varier selon le calendrier sportif. En période creuse (été, trêve), 
                  le volume peut baisser. Nous préférons ne rien publier plutôt que de publier un mauvais pick.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ COMPRENDRE LA VARIANCE ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Comprendre</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">La variance dans les paris sportifs</h2>
          </div>

          <div
            className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-white">Qu&apos;est-ce que la variance ?</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">
                  La variance, c&apos;est la fluctuation naturelle des résultats à court terme. Même avec une stratégie 
                  gagnante, vous traverserez des périodes de pertes — c&apos;est mathématiquement inévitable.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">
                  Un tipster avec 60% de réussite peut enchaîner 5 ou 6 paris perdants d&apos;affilée. 
                  Ce n&apos;est pas un signe d&apos;échec — c&apos;est la réalité statistique des paris sportifs.
                  Ce qui compte, c&apos;est le bilan sur 100, 200, 500 paris.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">
                  C&apos;est exactement pour ça que nous insistons sur la gestion de bankroll : ne jamais miser plus 
                  qu&apos;une fraction de votre capital sur un seul pari, pour pouvoir absorber les mauvaises passes 
                  et profiter des bonnes.
                </p>
              </div>
              <img
                src="/tipster/variance-graph.jpg"
                alt="Exemple de courbe de variance"
                className="w-full rounded-xl sm:w-72"
              />
            </div>
          </div>
        </section>

        {/* ═══════════ GESTION DE BANKROLL ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Bankroll</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">La gestion de bankroll, c&apos;est la clé</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: "🏦",
                title: "Configurez votre BK",
                desc: "Définissez votre bankroll de départ et la valeur de votre unité. Notre outil calcule automatiquement vos mises en euros ou en unités.",
              },
              {
                icon: "📐",
                title: "Mises calibrées",
                desc: "Les pronostics sont publiés en unités (0.5U à 3U). Le tipster adapte la mise en fonction de sa conviction. Pas de mise all-in, jamais.",
              },
              {
                icon: "🔄",
                title: "Suivi automatique",
                desc: "Votre bankroll se met à jour automatiquement après chaque résultat. Vous voyez en temps réel l'évolution de votre capital en euros et en unités.",
              },
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

        {/* ═══════════ À QUI S'ADRESSE PRONOS.CLUB ═══════════ */}
        <section className="mt-14">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl ring-1 ring-emerald-500/20">🤔</span>
              <h3 className="mt-4 text-lg font-extrabold text-white">À qui s&apos;adresse PRONOS.CLUB ?</h3>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-500/10 p-5">
                <p className="text-sm font-bold text-emerald-400">C&apos;est pour vous si :</p>
                <div className="mt-3 space-y-2">
                  {[
                    "Vous voulez une approche sérieuse et disciplinée",
                    "Vous comprenez que la rentabilité se mesure sur le long terme",
                    "Vous êtes prêt à suivre une gestion de bankroll stricte",
                    "Vous cherchez la transparence et les résultats vérifiables",
                    "Vous voulez un outil complet, pas juste un canal Telegram",
                  ].map((item) => (
                    <p key={item} className="flex items-start gap-2 text-xs text-emerald-300/70">
                      <span className="mt-0.5 text-emerald-400">✓</span> {item}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-red-500/10 p-5">
                <p className="text-sm font-bold text-red-400">Ce n&apos;est PAS pour vous si :</p>
                <div className="mt-3 space-y-2">
                  {[
                    "Vous voulez devenir riche en une semaine",
                    "Vous attendez 100% de victoires",
                    "Vous misez plus que ce que vous pouvez perdre",
                    "Vous cherchez des tips sur des cotes à 10+",
                    "Vous pensez que les paris sont un jeu de chance",
                  ].map((item) => (
                    <p key={item} className="flex items-start gap-2 text-xs text-red-300/70">
                      <span className="mt-0.5 text-red-400">✗</span> {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ LES BOOKMAKERS ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Essentiel</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Nos bookmakers</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              Nos pronostics sont placés sur 6 bookmakers différents pour toujours obtenir la meilleure cote. 
              Pour suivre tous nos picks, inscrivez-vous sur chacun d&apos;entre eux.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/fr/bookmakers"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
            >
              Voir les 6 bookmakers
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* ═══════════ CTA FINAL ═══════════ */}
        <section className="mt-14">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-8 text-center"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <h3 className="text-xl font-extrabold text-white">
              {isPremium ? "Merci pour votre confiance" : "Prêt à nous rejoindre ?"}
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/40">
              {isPremium
                ? "Vous avez accès à tous nos pronostics premium et au groupe Telegram exclusif."
                : isLoggedIn
                ? "Passez Premium pour accéder à toutes nos sélections et rejoindre le groupe Telegram exclusif."
                : "Inscription gratuite. Consultez nos résultats, vérifiez notre transparence, puis décidez."}
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {isPremium ? (
                <Link
                  href="/fr/espace"
                  className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                >
                  Accéder à mon espace
                </Link>
              ) : isLoggedIn ? (
                <Link
                  href="/fr/espace/abonnement"
                  className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                >
                  Devenir Premium — 20€/mois
                </Link>
              ) : (
                <Link
                  href="/fr/login"
                  className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                >
                  Créer mon compte gratuit
                </Link>
              )}
              <Link
                href="/fr/statistiques"
                className="w-full rounded-xl border border-white/10 px-8 py-4 text-sm font-semibold text-white/50 transition hover:border-white/20 hover:text-white/70 sm:w-auto"
              >
                Voir les statistiques
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}