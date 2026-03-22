import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function TipsterPage() {
  const { data: allPicks } = await supabaseAdmin
    .from("picks")
    .select("status, profit, stake, odds, published_at")
    .neq("status", "pending");

  const picks = allPicks ?? [];
  const totalPicks = picks.length;
  const totalProfit = picks.reduce((s, p) => s + (p.profit ?? 0), 0);
  const wonPicks = picks.filter((p) => p.status === "won" || p.status === "half_won").length;
  const resolvedPicks = picks.filter((p) => p.status !== "void").length;
  const winRate = resolvedPicks > 0 ? ((wonPicks / resolvedPicks) * 100).toFixed(1) : "0";
  const totalStaked = picks.reduce((s, p) => s + (p.stake ?? 0), 0);
  const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(1) : "0";
  const avgOdds = totalPicks > 0
    ? (picks.reduce((s, p) => s + p.odds, 0) / totalPicks).toFixed(2)
    : "0";

  // Longest win streak
  const sorted = [...picks].sort(
    (a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime()
  );
  let maxStreak = 0;
  let streak = 0;
  sorted.forEach((p) => {
    if (p.status === "won" || p.status === "half_won") {
      streak++;
      if (streak > maxStreak) maxStreak = streak;
    } else if (p.status === "lost" || p.status === "half_lost") {
      streak = 0;
    }
  });

  return (
    <>
      {/* Hero full-width */}
      <div
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Pronos Club</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white">Le Tipster</h1>
            <p className="mt-2 text-sm text-white/40">Analyse, méthodologie et résultats vérifiés</p>
          </div>
        </div>
      </div>

    <main className="mx-auto max-w-2xl px-4 pb-12 pt-8">
      {/* Profile */}
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-3xl">
          🎯
        </div>
        <h2 className="mt-4 text-xl font-bold">Le Tipster</h2>
        <p className="mt-1 text-sm opacity-50">PRONOS.CLUB</p>
      </div>

      {/* Bio */}
      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-bold">À propos</h2>
        <p className="mt-2 text-sm leading-relaxed opacity-60">
          Passionné de sport et d'analyse statistique, je partage mes pronostics
          en toute transparence. Chaque pick est publié avec screenshot du ticket
          avant le début du match. Mon objectif : une rentabilité régulière sur
          le long terme, pas des coups de chance ponctuels.
        </p>
      </div>

      {/* Methodology */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-bold">Méthodologie</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed opacity-60">
          <p>
            📊 <strong className="opacity-100">Analyse data-driven</strong> — Utilisation
            des statistiques avancées, tendances de forme, confrontations directes et
            conditions de match.
          </p>
          <p>
            💰 <strong className="opacity-100">Gestion de bankroll stricte</strong> — Mises
            entre 0.5U et 3U maximum. Pas de mise "all-in", pas de système martingale.
          </p>
          <p>
            🎯 <strong className="opacity-100">Sélectivité</strong> — Qualité plutôt que
            quantité. Je ne publie que quand j'identifie une réelle valeur dans la cote.
          </p>
        </div>
      </div>

      {/* Performance */}
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-bold">Performance</h2>
        {totalPicks === 0 ? (
          <p className="mt-3 text-sm opacity-50">
            Les statistiques seront disponibles après les premiers pronostics.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Picks", value: totalPicks },
              { label: "Win rate", value: `${winRate}%` },
              { label: "ROI", value: `${roi}%` },
              { label: "Profit", value: `${totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(1)}U` },
              { label: "Cote moy.", value: avgOdds },
              { label: "Gagnés", value: wonPicks },
              { label: "Perdus", value: totalPicks - wonPicks - picks.filter((p) => p.status === "void").length },
              { label: "Meilleure série", value: `${maxStreak}W` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-neutral-50 p-3 text-center">
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-xs opacity-40">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        <Link
          href="/fr/pronostics"
          className="inline-block rounded-xl bg-emerald-600 px-8 py-4 text-sm font-bold text-white transition hover:bg-emerald-500"
        >
          Voir les pronostics
        </Link>
      </div>
    </main>
    </>
  );
}