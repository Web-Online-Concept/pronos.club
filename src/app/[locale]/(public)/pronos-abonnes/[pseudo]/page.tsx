// src/app/[locale]/pronos-abonnes/[pseudo]/page.tsx
"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import TipsterPickCard from "@/components/tipster/TipsterPickCard";

export default function TipsterProfilePage({
  params,
}: {
  params: Promise<{ pseudo: string }>;
}) {
  const { pseudo: rawPseudo } = use(params);
  const pseudo = decodeURIComponent(rawPseudo);
  const locale = useLocale();
  const { user } = useAuth();

  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [picks, setPicks] = useState<any[]>([]);
  const [badges, setBadges] = useState<{ week_wins: number; month_wins: number }>({ week_wins: 0, month_wins: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "resolved">("all");

  async function fetchAll() {
    if (!isPremium) { setLoading(false); return; }
    setLoading(true);
    const [statsRes, picksRes] = await Promise.all([
      fetch(`/api/tipster-stats?pseudo=${encodeURIComponent(pseudo)}`),
      fetch(`/api/tipster-picks?filter=pseudo&pseudo=${encodeURIComponent(pseudo)}&limit=100`),
    ]);
    const statsData = await statsRes.json();
    const picksData = await picksRes.json();
    setProfile(statsData.profile);
    setStats(statsData.stats);
    setPicks(picksData.picks || []);

    // Charger les badges si on a l'id
    if (statsData.profile?.id) {
      const badgesRes = await fetch(`/api/tipster-concours?action=badges&user_id=${statsData.profile.id}`);
      const badgesData = await badgesRes.json();
      setBadges({ week_wins: badgesData.week_wins || 0, month_wins: badgesData.month_wins || 0 });
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, [pseudo, isPremium]);

  const filteredPicks = filter === "all"
    ? picks
    : filter === "live"
    ? picks.filter((p) => p.status === "live")
    : picks.filter((p) => p.status === "resolved");

  if (!isPremium) {
    return (
      <main className="min-h-screen bg-white">
        <div
          className="px-4 py-10 text-center text-white"
          style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
        >
          <div className="mx-auto max-w-3xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
              🎯 Profil Tipster
            </p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{pseudo}</h1>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-3xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-white py-16 text-center px-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-black text-neutral-900">Profil tipster réservé aux Premium</h2>
            <p className="mt-3 max-w-md mx-auto text-sm text-neutral-600">
              Pour consulter le profil complet de <strong className="text-emerald-700">{pseudo}</strong> (stats, pronostics en cours, historique détaillé), passe Premium.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/${locale}/abonnement`}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
              >
                💎 Passer Premium
              </Link>
              <Link
                href={`/${locale}/pronos-abonnes/classement`}
                className="rounded-xl border-2 border-neutral-300 bg-white px-6 py-3 text-sm font-bold text-neutral-700 transition hover:border-neutral-900"
              >
                🏆 Voir le classement
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500">Tipster introuvable</p>
          <Link href={`/${locale}/pronos-abonnes`} className="mt-4 inline-block text-emerald-600 font-bold">
            ← Retour
          </Link>
        </div>
      </main>
    );
  }

  const totalUnits = stats.total_units;
  const unitsColor = totalUnits > 0 ? "text-emerald-400" : totalUnits < 0 ? "text-red-400" : "text-white";

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <div
        className="px-4 py-10 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={pseudo}
                className="h-24 w-24 rounded-full object-cover ring-4 ring-emerald-500/30"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-3xl font-black text-white ring-4 ring-emerald-500/30">
                {pseudo.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="mt-4 text-3xl font-black sm:text-4xl">{pseudo}</h1>
            {(badges.week_wins > 0 || badges.month_wins > 0) && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {badges.week_wins > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1 text-xs font-bold text-emerald-300">
                    🏆 Semaine × {badges.week_wins}
                  </span>
                )}
                {badges.month_wins > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/40 px-3 py-1 text-xs font-bold text-amber-300">
                    👑 Mois × {badges.month_wins}
                  </span>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-white/50">
              Membre depuis {new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Pronos</p>
              <p className="mt-1 text-2xl font-extrabold text-white tabular-nums">{stats.total_picks}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Winrate</p>
              <p className="mt-1 text-2xl font-extrabold text-white tabular-nums">{stats.winrate}%</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Total U</p>
              <p className={`mt-1 text-2xl font-extrabold tabular-nums ${unitsColor}`}>
                {totalUnits >= 0 ? "+" : ""}{totalUnits.toFixed(2)}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">ROI</p>
              <p className={`mt-1 text-2xl font-extrabold tabular-nums ${stats.roi > 0 ? "text-emerald-400" : stats.roi < 0 ? "text-red-400" : "text-white"}`}>
                {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Cote moy.</p>
              <p className="mt-1 text-lg font-extrabold text-white tabular-nums">{stats.avg_odds.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Série actuelle</p>
              <p className={`mt-1 text-lg font-extrabold tabular-nums ${stats.current_streak > 0 ? "text-emerald-400" : stats.current_streak < 0 ? "text-red-400" : "text-white"}`}>
                {stats.current_streak > 0 ? `+${stats.current_streak}` : stats.current_streak}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Meilleure</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-400 tabular-nums">+{stats.best_streak}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-neutral-50 border-b border-neutral-200">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex gap-2">
            {[
              { v: "all", label: `Tous (${picks.length})` },
              { v: "live", label: `En cours (${stats.live_picks})` },
              { v: "resolved", label: `Résolus (${stats.resolved_picks})` },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v as any)}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition sm:flex-none ${
                  filter === f.v
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Picks */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {filteredPicks.length === 0 ? (
          <div className="rounded-3xl bg-neutral-50 py-16 text-center">
            <p className="text-neutral-500 text-sm">Aucun pronostic pour ce filtre</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredPicks.map((pick) => (
              <TipsterPickCard
                key={pick.id}
                pick={pick}
                locale={locale}
                showPseudo={false}
                showResult={pick.status === "resolved"}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}