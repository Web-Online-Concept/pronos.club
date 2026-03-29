import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function TipsterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tipster" });
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
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{t("hero_tag")}</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{t("hero_title")}</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/40">
            {t("hero_subtitle")}
          </p>

          {/* Live stats */}
          {totalPicks > 0 && (
            <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-6">
              {[
                { label: t("kpi_picks"), value: totalPicks.toString() },
                { label: t("kpi_winrate"), value: `${winRate}%`, green: winRate >= 50 },
                { label: t("kpi_roi"), value: `${roi >= 0 ? "+" : ""}${roi}%`, green: roi >= 0 },
                { label: t("kpi_profit"), value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(1)}U`, green: totalProfit >= 0 },
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("team_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("team_title")}</h2>
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
                  <h3 className="text-lg font-extrabold text-white">{t("jerome_name")} <span className="text-sm font-semibold text-white/40">({t("jerome_alias")})</span></h3>
                  <p className="text-xs text-emerald-400">{t("jerome_role")}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                {t("jerome_desc")}
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
                  <h3 className="text-lg font-extrabold text-white">{t("platform_title")}</h3>
                  <p className="text-xs text-emerald-400">{t("platform_role")}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                {t("platform_desc")}
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
                <h3 className="text-sm font-extrabold text-white">{t("dashboard_title")}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[10px] font-semibold text-emerald-400">{t("dashboard_active", { count: activePronos })}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("dashboard_total"), value: totalPicks.toString(), color: "text-white" },
                { label: t("dashboard_won"), value: wonPicks.toString(), color: "text-emerald-400" },
                { label: t("dashboard_lost"), value: lostPicks.toString(), color: "text-red-400" },
                { label: t("dashboard_void"), value: voidPicks.toString(), color: "text-neutral-400" },
                { label: t("dashboard_winrate"), value: `${winRate}%`, color: winRate >= 50 ? "text-emerald-400" : "text-red-400" },
                { label: t("dashboard_roi"), value: `${roi >= 0 ? "+" : ""}${roi}%`, color: roi >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: t("dashboard_profit"), value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(1)}U`, color: totalProfit >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: t("dashboard_avg_odds"), value: avgOdds, color: "text-white" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/[0.04] px-3 py-3 text-center">
                  <p className={`text-lg font-extrabold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[9px] uppercase tracking-wider text-white/25">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 text-center">
              <Link href={`/${locale}/statistiques`} className="text-xs font-semibold text-emerald-400 transition hover:text-emerald-300">
                {t("dashboard_see_stats")}
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════ NOTRE PHILOSOPHIE ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("philo_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("philo_title")}</h2>
          </div>

          <div
            className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <div className="space-y-6">
              {[
                { icon: "❌", bg: "bg-red-500/20", title: t("philo1_title"), desc: t("philo1_desc") },
                { icon: "❌", bg: "bg-red-500/20", title: t("philo2_title"), desc: t("philo2_desc") },
                { icon: "✅", bg: "bg-emerald-500/20", title: t("philo3_title"), desc: t("philo3_desc") },
                { icon: "✅", bg: "bg-emerald-500/20", title: t("philo4_title"), desc: t("philo4_desc") },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <span className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${item.bg} text-sm`}>{item.icon}</span>
                  <div>
                    <h3 className="font-bold text-white">{item.title}</h3>
                    <p className="mt-1 text-sm text-white/40">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════ LA MÉTHODE ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("method_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("method_title")}</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { icon: "📊", title: t("method1_title"), desc: t("method1_desc") },
              { icon: "💎", title: t("method2_title"), desc: t("method2_desc") },
              { icon: "📈", title: t("method3_title"), desc: t("method3_desc") },
              { icon: "🎯", title: t("method4_title"), desc: t("method4_desc") },
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("format_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("format_title")}</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
              style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sm font-bold text-sky-400">1</span>
                <div>
                  <h3 className="font-extrabold text-white">{t("format_simple")}</h3>
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-sky-400">{t("format_simple_label")}</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                {t("format_simple_desc")}
              </p>
              <div className="mt-4 rounded-lg bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/25">{t("format_example")}</p>
                <p className="mt-1 text-sm text-white/60">{t("format_simple_example")}</p>
              </div>
            </div>

            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-sm font-bold text-purple-400">2</span>
                <div>
                  <h3 className="font-extrabold text-white">{t("format_combi")}</h3>
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-purple-400">{t("format_combi_label")}</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50" dangerouslySetInnerHTML={{ __html: t("format_combi_desc") }} />
              <div className="mt-4 rounded-lg bg-white/[0.04] px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-white/25">{t("format_example")}</p>
                <p className="mt-1 text-sm text-white/60">{t("format_combi_example")}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-6 py-4 text-center">
            <p className="text-sm font-semibold text-amber-700">
              {t("format_combi_warning")}
            </p>
          </div>
        </section>

        {/* ═══════════ COMMENT SUIVRE NOS PRONOS ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("guide_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("guide_title")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              {t("guide_subtitle")}
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {/* Step 1 */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] p-6" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-400">1</span>
                <h3 className="font-extrabold text-white">{t("guide1_title")}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/50">{t("guide1_desc")}</p>
            </div>

            {/* Step 2 */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] p-6" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-xs font-bold text-amber-400">2</span>
                <h3 className="font-extrabold text-white">{t("guide2_title")}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/50" dangerouslySetInnerHTML={{ __html: t("guide2_desc") }} />
              <div className="mt-3 rounded-lg bg-amber-500/10 px-4 py-3">
                <p className="text-xs text-amber-400/80" dangerouslySetInnerHTML={{ __html: t("guide2_example") }} />
              </div>
            </div>

            {/* Step 3 */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] p-6" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-400">3</span>
                <h3 className="font-extrabold text-white">{t("guide3_title")}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/50" dangerouslySetInnerHTML={{ __html: t("guide3_desc") }} />
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  { u: "0.5U", label: t("guide3_prudent"), color: "bg-sky-500/15 text-sky-400" },
                  { u: "1U", label: t("guide3_standard"), color: "bg-emerald-500/15 text-emerald-400" },
                  { u: "2U", label: t("guide3_confiance"), color: "bg-amber-500/15 text-amber-400" },
                  { u: "3U", label: t("guide3_max"), color: "bg-red-500/15 text-red-400" },
                ].map((m) => (
                  <div key={m.u} className={`rounded-lg px-2 py-2 ${m.color}`}>
                    <p className="text-sm font-extrabold">{m.u}</p>
                    <p className="text-[9px] opacity-60">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 4 */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] p-6" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-400">4</span>
                <h3 className="font-extrabold text-white">{t("guide4_title")}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/50">{t("guide4_desc")}</p>
              <div className="mt-3 space-y-2">
                {[
                  { icon: "🏦", text: t("guide4_f1") },
                  { icon: "✅", text: t("guide4_f2") },
                  { icon: "📈", text: t("guide4_f3") },
                  { icon: "🔔", text: t("guide4_f4") },
                  { icon: "📊", text: t("guide4_f5") },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2">
                    <span className="mt-0.5 text-sm">{item.icon}</span>
                    <p className="text-xs text-white/50">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 5 */}
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] p-6" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-xs font-bold text-emerald-400">5</span>
                <h3 className="font-extrabold text-white">{t("guide5_title")}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/50">{t("guide5_desc")}</p>
              <div className="mt-3 text-center">
                <Link href={`/${locale}/bookmakers`} className="text-xs font-semibold text-emerald-400 transition hover:text-emerald-300">
                  {t("guide5_link")}
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════ VOLUME + GRATUIT VS PREMIUM ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("volume_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("volume_title")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{t("volume_subtitle")}</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] p-6" style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}>
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-white">{t("volume_free_title")}</h3>
                <span className="rounded-full bg-neutral-500/20 px-3 py-0.5 text-[10px] font-bold text-neutral-400">{t("volume_free_price")}</span>
              </div>
              <p className="mt-3 text-sm text-white/50">{t("volume_free_desc")}</p>
              <div className="mt-4 space-y-1.5">
                {[t("volume_free_f1"), t("volume_free_f2"), t("volume_free_f3"), t("volume_free_f4"), t("volume_free_f5")].map((f) => (
                  <p key={f} className="flex items-center gap-2 text-xs text-white/40">
                    <span className="text-emerald-400/60">✓</span> {f}
                  </p>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 p-6" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}>
              <div className="absolute -top-px left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-white">{t("volume_premium_title")}</h3>
                <span className="rounded-full bg-emerald-500/20 px-3 py-0.5 text-[10px] font-bold text-emerald-400">{t("volume_premium_price")}</span>
              </div>
              <p className="mt-3 text-sm text-white/50">{t("volume_premium_desc")}</p>
              <div className="mt-4 space-y-1.5">
                {[t("volume_premium_f1"), t("volume_premium_f2"), t("volume_premium_f3"), t("volume_premium_f4"), t("volume_premium_f5")].map((f) => (
                  <p key={f} className="flex items-center gap-2 text-xs text-white/50">
                    <span className="text-emerald-400">✓</span> {f}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-neutral-400">{t("volume_disclaimer")}</p>
        </section>

        {/* ═══════════ COMPRENDRE LA VARIANCE ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("variance_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("variance_title")}</h2>
          </div>

          <div
            className="mt-8 overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex-1">
                <h3 className="text-lg font-extrabold text-white">{t("variance_q")}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{t("variance_p1")}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{t("variance_p2")}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{t("variance_p3")}</p>
              </div>
              <img
                src="/tipster/variance-graph.jpg"
                alt={t("variance_img_alt")}
                className="w-full rounded-xl sm:w-72"
              />
            </div>
          </div>
        </section>

        {/* ═══════════ GESTION DE BANKROLL ═══════════ */}
        <section className="mt-14">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("bankroll_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("bankroll_title")}</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: "🏦", title: t("bk1_title"), desc: t("bk1_desc") },
              { icon: "📐", title: t("bk2_title"), desc: t("bk2_desc") },
              { icon: "🔄", title: t("bk3_title"), desc: t("bk3_desc") },
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
              <h3 className="mt-4 text-lg font-extrabold text-white">{t("audience_title")}</h3>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-500/10 p-5">
                <p className="text-sm font-bold text-emerald-400">{t("audience_for")}</p>
                <div className="mt-3 space-y-2">
                  {[t("audience_for_1"), t("audience_for_2"), t("audience_for_3"), t("audience_for_4"), t("audience_for_5")].map((item) => (
                    <p key={item} className="flex items-start gap-2 text-xs text-emerald-300/70">
                      <span className="mt-0.5 text-emerald-400">✓</span> {item}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-red-500/10 p-5">
                <p className="text-sm font-bold text-red-400">{t("audience_not")}</p>
                <div className="mt-3 space-y-2">
                  {[t("audience_not_1"), t("audience_not_2"), t("audience_not_3"), t("audience_not_4"), t("audience_not_5")].map((item) => (
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
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">{t("bookmakers_tag")}</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">{t("bookmakers_title")}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">{t("bookmakers_subtitle")}</p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href={`/${locale}/bookmakers`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40"
            >
              {t("bookmakers_cta")}
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
              {isPremium ? t("cta_premium") : t("cta_guest")}
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/40">
              {isPremium
                ? t("cta_desc_premium")
                : isLoggedIn
                ? t("cta_desc_logged")
                : t("cta_desc_guest")}
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {isPremium ? (
                <Link
                  href={`/${locale}/espace`}
                  className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                >
                  {t("cta_btn_space")}
                </Link>
              ) : isLoggedIn ? (
                <Link
                  href={`/${locale}/espace/abonnement`}
                  className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                >
                  {t("cta_btn_premium")}
                </Link>
              ) : (
                <Link
                  href={`/${locale}/login`}
                  className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
                >
                  {t("cta_btn_free")}
                </Link>
              )}
              <Link
                href={`/${locale}/statistiques`}
                className="w-full rounded-xl border border-white/10 px-8 py-4 text-sm font-semibold text-white/50 transition hover:border-white/20 hover:text-white/70 sm:w-auto"
              >
                {t("cta_btn_stats")}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}