import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  const isPremium = user?.subscription_status === "active";

  // ─── Fetch real stats ───
  const { data: allPicks } = await supabaseAdmin
    .from("picks")
    .select("status, profit, stake, odds, event_name, selection, published_at, result_entered_at, sport:sports(icon)")
    .neq("status", "pending")
    .order("result_entered_at", { ascending: false });

  const { count: pendingCount } = await supabaseAdmin
    .from("picks")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .gt("event_date", new Date().toISOString());

  const picks = allPicks ?? [];
  const totalPicks = picks.length;
  const activePronos = pendingCount ?? 0;
  const totalProfit = picks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const wonPicks = picks.filter((p) => p.status === "won" || p.status === "half_won").length;
  const resolvedPicks = picks.filter((p) => p.status !== "void").length;
  const winRate = resolvedPicks > 0 ? Math.round((wonPicks / resolvedPicks) * 100) : 0;
  const totalStaked = picks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const roi = totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 100) : 0;
  const avgOdds = totalPicks > 0 ? (picks.reduce((s, p) => s + p.odds, 0) / totalPicks).toFixed(2) : "0";

  // Current streak
  const sorted = [...picks].sort(
    (a, b) => new Date(a.result_entered_at).getTime() - new Date(b.result_entered_at).getTime()
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

  return (
    <main>
      {/* ═══════════ HERO + STATS = viewport height ═══════════ */}
      <div className="flex min-h-[calc(100vh-100px)] flex-col">
      {/* ═══════════ HERO (DARK) ═══════════ */}
      <section className="relative flex-1 overflow-hidden bg-neutral-950 text-white">
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

        <div className="relative mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          {/* Hero Logo */}
          <div className="mx-auto mb-6 animate-[logoFloat_6s_ease-in-out_infinite]">
            <Image
              src="/pronos_club_hero.png"
              alt="PRONOS.CLUB"
              width={400}
              height={320}
              className="mx-auto h-[140px] w-auto sm:h-[170px] lg:h-[200px]"
              style={{ width: "auto" }}
              priority
            />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {activePronos} prono{activePronos > 1 ? "s" : ""} en cours
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5">
              <span className="text-xs font-semibold text-sky-400">
                {totalPicks} prono{totalPicks > 1 ? "s" : ""} fini{totalPicks > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-5xl">
            <span className="inline-block animate-[textShimmer_10s_linear_infinite] bg-[length:300%_100%] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(105deg, white 0%, white 35%, #6ee7b7 45%, #a7f3d0 50%, #6ee7b7 55%, white 65%, white 100%)" }}>
              Pronostics sportifs
            </span>
            <br />
            <span className="inline-block animate-[textShimmer_10s_linear_infinite] bg-[length:300%_100%] bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(105deg, #34d399 0%, #34d399 35%, #ffffff 45%, #ffffff 50%, #ffffff 55%, #34d399 65%, #34d399 100%)", animationDelay: "0.3s" }}>
              professionnels
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            Recevez nos sélections. Consultez nos résultats. Tout est transparent.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/fr/pronostics"
              className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
            >
              Voir les pronostics
            </Link>
            <Link
              href="/fr/abonnement"
              className="w-full rounded-xl border border-neutral-700 px-8 py-4 text-sm font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-white sm:w-auto"
            >
              Devenir Premium — 20€/mois
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Screenshot de chaque ticket
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Résultats non modifiables
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Sans engagement
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════ STATS BAR (DARK) ═══════════ */}
      {totalPicks > 0 && (
        <section
          className="border-b border-emerald-900/40"
          style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
        >
          <div className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-neutral-800 px-4 py-6 sm:grid-cols-6">
            {[
              { label: "Picks", value: totalPicks },
              { label: "Win rate", value: `${winRate}%`, green: winRate >= 50 },
              { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi}%`, green: roi >= 0 },
              { label: "Profit", value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(1)}U`, green: totalProfit >= 0 },
              { label: "Cote moy.", value: avgOdds },
              { label: "Série", value: currentStreak, green: streakType === "W" },
            ].map((stat) => (
              <div key={stat.label} className="px-2 text-center">
                <p className={`text-lg font-bold sm:text-xl ${
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

      {/* ═══════════ DERNIERS RÉSULTATS (DARK) ═══════════ */}
      {recent.length > 0 && (
        <section className="bg-neutral-50 px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">
                Track record
              </p>
              <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Derniers résultats</h2>
              <p className="mt-2 text-sm text-neutral-500">
                Tous les résultats sont publics et vérifiables
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
                    className={`group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${
                      isWon
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : isVoid
                        ? "border-white/10 bg-white/5"
                        : "border-red-500/20 bg-red-500/5"
                    }`}
                    style={{ background: isWon ? "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" : isVoid ? "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)" : "linear-gradient(135deg, #0a0a0a 0%, #2e0606 100%)" }}
                  >
                    <div className={`absolute inset-y-0 left-0 w-1 ${isWon ? "bg-emerald-500" : isVoid ? "bg-neutral-500" : "bg-red-500"}`} />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 pl-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-lg">{sport?.icon ?? "⚽"}</span>
                        <div>
                          <p className="text-sm font-bold text-white">{pick.event_name}</p>
                          <p className="text-xs text-white/40">{pick.selection} · Cote {pick.odds}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${
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
                            {pick.profit}U
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
                href="/fr/historique"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                Voir tout l&apos;historique
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
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Simple et efficace</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Comment ça marche</h2>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Créez votre compte",
                desc: "Inscription gratuite en 30 secondes. Accédez immédiatement aux pronostics gratuits.",
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "Recevez les alertes",
                desc: "Notification push ou email dès qu'un nouveau pronostic est publié. Ne ratez plus aucun pick.",
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "Suivez les résultats",
                desc: "Historique complet, statistiques détaillées et performances vérifiables en temps réel.",
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
                  Étape {item.step}
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Nos engagements</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Pourquoi nous choisir</h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Transparence totale",
                desc: "Screenshot de chaque ticket publié avant le match. Les résultats sont figés et non modifiables une fois saisis.",
                icon: "📸",
              },
              {
                title: "Statistiques vérifiables",
                desc: "Win rate, ROI, profit : tout est calculé automatiquement et visible publiquement par tous les visiteurs.",
                icon: "📊",
              },
              {
                title: "Notifications instantanées",
                desc: "Recevez une alerte push ou un email dès qu'un pick est publié. Ne ratez jamais une opportunité.",
                icon: "🔔",
              },
              {
                title: "Gestion de bankroll",
                desc: "Configurez votre bankroll et la valeur de votre unité. Mise fixe ou % de bankroll, avec suivi automatique en euros et en unités.",
                icon: "🏦",
              },
              {
                title: "Sans engagement",
                desc: "Abonnement mensuel résiliable en un clic depuis votre espace. Pas de piège, pas de petit texte.",
                icon: "🤝",
              },
              {
                title: "Multi-sport",
                desc: "Football, tennis, basketball, hockey et bien d'autres. Les meilleures opportunités quel que soit le sport.",
                icon: "⚽",
              },
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Espace personnel</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Votre espace, vos règles</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-white/40">
              Un tableau de bord complet pour piloter vos pronostics comme un pro
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "✅",
                title: "Sélectionnez vos pronos",
                desc: "Choisissez les pronostics que vous jouez vraiment. Un clic suffit pour les ajouter à votre suivi personnel.",
              },
              {
                icon: "🏦",
                title: "Gestion de bankroll",
                desc: "Configurez votre bankroll, la valeur de votre unité et votre mode de gestion. Suivez vos profits en euros ou en unités.",
              },
              {
                icon: "📈",
                title: "Vos stats personnelles",
                desc: "Win rate, ROI, profit — en unités et en euros. Basculez d'un clic. Calculées uniquement sur les picks que vous avez suivis.",
              },
              {
                icon: "📋",
                title: "Historique personnalisé",
                desc: "Retrouvez uniquement vos pronos suivis avec les mêmes filtres que l'historique public. Comparez-vous au tipster.",
              },
              {
                icon: "🔔",
                title: "Notifications sur mesure",
                desc: "Push, email, Telegram — configurez vos alertes pour ne jamais rater un nouveau pronostic.",
              },
              {
                icon: "💎",
                title: "Gestion d'abonnement",
                desc: "Passez Premium, gérez votre abonnement, consultez vos factures. Tout en un seul endroit.",
              },
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
              href={isLoggedIn ? "/fr/espace" : "/fr/login"}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
            >
              {isLoggedIn ? "Accéder à mon espace" : "Créer mon espace gratuit"}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Tarifs</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">Les formules disponibles</h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-2xl border border-neutral-700 bg-neutral-900/80 p-6 text-center backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Gratuit</p>
              <p className="mt-2 text-3xl font-extrabold text-white">0€</p>
              <p className="text-sm text-neutral-500">Pour toujours</p>
              <div className="mt-6 flex justify-center"><ul className="space-y-3 text-sm text-neutral-300">
                {[
                  "Pronostics gratuits uniquement",
                  "Historique complet",
                  "Statistiques publiques",
                  "Gestion de bankroll personnalisée",
                  "Stats perso en U et en €",
                  "Notifications standards",
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
                  href="/fr/espace"
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-400"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Votre compte est Premium
                </Link>
              ) : isLoggedIn ? (
                <Link
                  href="/fr/espace"
                  className="mt-6 block rounded-xl border border-neutral-600 px-6 py-3 text-sm font-semibold text-neutral-300 transition hover:border-neutral-400 hover:text-white"
                >
                  Accéder à mon espace
                </Link>
              ) : (
                <Link
                  href="/fr/login"
                  className="mt-6 block rounded-xl border border-neutral-600 px-6 py-3 text-sm font-semibold text-neutral-300 transition hover:border-neutral-400 hover:text-white"
                >
                  Créer mon compte gratuitement
                </Link>
              )}
            </div>

            {/* Premium */}
            <div className="relative rounded-2xl border-2 border-emerald-500 bg-neutral-900/80 p-6 text-center shadow-lg shadow-emerald-500/10 backdrop-blur">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-1 text-xs font-bold text-white">
                Populaire
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Premium</p>
              <p className="mt-2 text-3xl font-extrabold text-white">20€<span className="text-lg font-normal text-neutral-500">/mois</span></p>
              <p className="text-sm text-neutral-500">Sans engagement</p>
              <div className="mt-6 flex justify-center"><ul className="space-y-3 text-sm text-neutral-300">
                {[
                  "Tous les pronostics (gratuits + premium)",
                  "Historique complet",
                  "Statistiques publiques",
                  "Gestion de bankroll personnalisée",
                  "Stats perso en U et en €",
                  "Notifications prioritaires",
                  "Résiliable en 1 clic",
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
                  href="/fr/espace"
                  className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-6 py-3 text-sm font-bold text-emerald-400"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Votre compte est Premium
                </Link>
              ) : isLoggedIn ? (
                <Link
                  href="/fr/espace/abonnement"
                  className="mt-6 block rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
                >
                  Devenir Premium
                </Link>
              ) : (
                <Link
                  href="/fr/login"
                  className="mt-6 block rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
                >
                  Disponible sous votre espace
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">FAQ</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Questions fréquentes</h2>
          </div>

          <div className="mt-10 space-y-3">
            {[
              {
                q: "Est-ce que les résultats sont réels ?",
                a: "Oui. Chaque pronostic est publié avec un screenshot du ticket avant le match. Les résultats sont saisis après le match et ne peuvent pas être modifiés. Tout est vérifiable dans l'historique.",
              },
              {
                q: "Puis-je résilier à tout moment ?",
                a: "Oui. L'abonnement est mensuel et résiliable en un clic depuis votre espace personnel. Aucun engagement, aucun frais caché.",
              },
              {
                q: "Quelle est la stratégie de mise ?",
                a: "Le tipster publie ses picks en unités (1U, 2U...). Vous pouvez suivre en unités uniquement, ou configurer votre propre bankroll dans votre espace : mise fixe par unité ou pourcentage de bankroll. Tout est calculé automatiquement.",
              },
              {
                q: "Comment recevoir les notifications ?",
                a: "Activez les notifications push dans votre navigateur et/ou les alertes email depuis votre espace. Vous recevrez chaque pick dès sa publication.",
              },
              {
                q: "Les pronostics gratuits sont-ils intéressants ?",
                a: "Oui, les picks gratuits sont de vrais pronostics sélectionnés avec le même sérieux. Le Premium donne accès à l'intégralité des sélections et aux analyses détaillées.",
              },
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
            {isPremium ? "Bienvenue dans le club" : "Prêt à rejoindre le club ?"}
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            {isPremium
              ? "Vous avez accès à tous les pronostics premium."
              : isLoggedIn
              ? "Passez Premium pour accéder à toutes nos sélections."
              : "Inscription gratuite. Accédez aux pronostics immédiatement."}
            {monthsActive > 1 && ` Actif depuis ${monthsActive} mois.`}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {isPremium ? (
              <Link
                href="/fr/espace"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Votre compte est Premium
              </Link>
            ) : isLoggedIn ? (
              <Link
                href="/fr/espace/abonnement"
                className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                Devenir Premium
              </Link>
            ) : (
              <Link
                href="/fr/login"
                className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
              >
                Créer mon compte gratuit
              </Link>
            )}
            <Link
              href="/fr/statistiques"
              className="w-full rounded-xl border border-neutral-700 px-8 py-4 text-sm font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-white sm:w-auto"
            >
              Voir les statistiques
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}