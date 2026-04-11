import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import HomeVideoPlayer from "@/components/ui/VideoPlayer";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const user = await getCurrentUser();
  const isLoggedIn = !!user;
  const isPremium = user?.subscription_status === "active" || user?.subscription_status === "trialing";

  // ─── Fetch real stats ───
  const { data: allPicks } = await supabaseAdmin
    .from("picks")
    .select("status, profit, stake, odds, event_name, selection, published_at, result_entered_at, pick_number, sport:sports(icon)")
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

  // Fetch approved reviews for homepage
  const { data: reviewsData } = await supabaseAdmin
    .from("reviews")
    .select("id, pseudo, avatar_url, rating, content, created_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(6);
  const reviews = reviewsData ?? [];

  return (
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
          {/* Hero Logo */}
          <div className="mx-auto mb-3 animate-[logoFloat_6s_ease-in-out_infinite] sm:mb-6">
            <Image
              src="/pronos_club_hero.png"
              alt="PRONOS.CLUB"
              width={400}
              height={320}
              className="mx-auto h-[90px] w-auto sm:h-[170px] lg:h-[200px]"
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
                {activePronos > 1 ? t("badge_active_many", { count: activePronos }) : t("badge_active_one", { count: activePronos })}
              </span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5">
              <span className="text-xs font-semibold text-sky-400">
                {totalPicks > 1 ? t("badge_finished_many", { count: totalPicks }) : t("badge_finished_one", { count: totalPicks })}
              </span>
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-extrabold leading-[1.1] tracking-tight sm:mt-6 sm:text-4xl lg:text-5xl">
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

          <div className="mt-5 flex flex-col items-center gap-2 sm:mt-8 sm:flex-row sm:gap-3 sm:justify-center">
            <Link
              href={`/${locale}/pronostics`}
              className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto sm:px-8 sm:py-4"
            >
              {t("cta_see_picks")}
            </Link>
            {isPremium ? (
              <Link
                href={`/${locale}/espace`}
                className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-400 sm:w-auto sm:px-8 sm:py-4"
              >
                ✅ {t("cta_my_space")}
              </Link>
            ) : isLoggedIn ? (
              <Link
                href={`/${locale}/espace/abonnement`}
                className="w-full rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-white sm:w-auto sm:px-8 sm:py-4"
              >
                {t("cta_go_premium")}
              </Link>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="w-full rounded-xl border border-neutral-700 px-6 py-3 text-sm font-semibold text-neutral-300 transition hover:border-neutral-500 hover:text-white sm:w-auto sm:px-8 sm:py-4"
              >
                {t("cta_go_premium")}
              </Link>
            )}
          </div>

          {/* Promo badge */}
          {!isPremium && (
            <div className="mt-4 flex justify-center sm:mt-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
                <span className="text-xs">🎁</span>
                <span className="text-xs font-semibold text-amber-400">Code <span className="font-mono font-extrabold">PRONOS7</span> = 7 jours d&apos;essai gratuit</span>
              </div>
            </div>
          )}

          {/* Trust indicators */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-neutral-500 sm:mt-10 sm:gap-x-6 sm:gap-y-2 sm:text-xs">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              {t("trust_screenshot")}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              {t("trust_immutable")}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              {t("trust_no_commitment")}
            </span>
          </div>
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
              className="group overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center transition hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">✍️</div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">Blog</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {locale === "en"
                  ? "In-depth guides, bookmaker reviews, and expert analysis to sharpen your betting strategy."
                  : locale === "es"
                  ? "Guías detalladas, reseñas de casas de apuestas y análisis experto para mejorar tu estrategia."
                  : "Guides approfondis, analyses de bookmakers et stratégies pour affûter vos paris."}
              </p>
              <p className="mt-4 text-xs font-semibold text-emerald-600">
                {locale === "en" ? "Read articles →" : locale === "es" ? "Leer artículos →" : "Lire les articles →"}
              </p>
            </Link>

            {/* News */}
            <Link
              href={`/${locale}/news`}
              className="group overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center transition hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">📰</div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">News</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {locale === "en"
                  ? "Breaking sports news rewritten with a betting angle. Updated every hour, in 3 languages."
                  : locale === "es"
                  ? "Noticias deportivas de última hora con enfoque en apuestas. Actualizadas cada hora, en 3 idiomas."
                  : "L'actualité sportive décryptée avec un angle paris. Mise à jour toutes les heures, en 3 langues."}
              </p>
              <p className="mt-4 text-xs font-semibold text-emerald-600">
                {locale === "en" ? "See latest news →" : locale === "es" ? "Ver últimas noticias →" : "Voir les actus →"}
              </p>
            </Link>

            {/* Vidéos */}
            <Link
              href={`/${locale}/videos`}
              className="group overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-center transition hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl">🎬</div>
              <h3 className="mt-4 text-lg font-bold text-neutral-900">{locale === "es" ? "Vídeos" : "Vidéos"}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {locale === "en"
                  ? "The best sports videos from top media channels, curated and watchable right here."
                  : locale === "es"
                  ? "Los mejores vídeos deportivos de los principales medios, seleccionados y visibles aquí."
                  : "Les meilleures vidéos sport des grandes chaînes média, à regarder directement sur le site."}
              </p>
              <p className="mt-4 text-xs font-semibold text-emerald-600">
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
  );
}