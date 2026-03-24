import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import PickCard from "@/components/picks/PickCard";
import Link from "next/link";

export default async function PronosticsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const isPremium = user?.subscription_status === "active";

  const { data: pendingPicks } = await supabase
    .from("picks")
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))")
    .eq("status", "pending")
    .order("event_date", { ascending: true });

  const { data: recentResults } = await supabase
    .from("picks")
    .select("*, sport:sports(*), bookmaker:bookmakers(*), legs:pick_legs(*, sport:sports(*))")
    .neq("status", "pending")
    .order("result_entered_at", { ascending: false })
    .limit(5);

  const now = new Date();
  const allPending = pendingPicks ?? [];

  // Only show picks where match hasn't started yet
  const activePicks = allPending.filter((p) => new Date(p.event_date) > now);
  const results = recentResults ?? [];

  return (
    <>
      {/* Viewport wrapper: hero + picks + historique header fill the screen */}
      <div className="flex min-h-[calc(100vh-100px)] flex-col">

      {/* Hero full-width */}
      <div
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Pronos Club</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white">
              Pronos en cours
            </h1>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-400">
                  {activePicks.length} pick{activePicks.length > 1 ? "s" : ""} disponible{activePicks.length > 1 ? "s" : ""}
                </span>
              </div>
              {activePicks.length > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5">
                  <span className="text-xs font-semibold text-sky-400">
                    {activePicks.filter((p) => p.is_premium).length} premium · {activePicks.filter((p) => !p.is_premium).length} gratuit{activePicks.filter((p) => !p.is_premium).length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-4">

      {/* Active picks */}
      {activePicks.length > 0 ? (
        <div className="mt-4 space-y-4">
          {activePicks.map((pick) => (
            <PickCard
              key={pick.id}
              pick={pick}
              locked={pick.is_premium && !isPremium}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 text-center">
          <div>
            <p className="text-base font-semibold text-neutral-600">Aucun prono en cours pour le moment</p>
            <p className="mt-2 text-sm text-neutral-500">Activez les notifications dans votre espace perso<br />pour être alerté dès la publication d&apos;un nouveau prono</p>
          </div>
        </div>
      )}

      {/* CTA for non-premium */}
      {!isPremium && activePicks.some((p) => p.is_premium) && (
        <div className="mt-8 overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-6 text-center">
          <span className="text-3xl">🔓</span>
          <p className="mt-2 text-lg font-bold text-neutral-900">
            Débloquez tous les pronostics
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Accès complet aux sélections, analyses et screenshots du tipster
          </p>
          <Link
            href="/fr/abonnement"
            className="mt-4 inline-block cursor-pointer rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl hover:-translate-y-0.5"
          >
            Voir les offres Premium
          </Link>
        </div>
      )}
    </div>

      {/* Historique header — always visible at bottom of viewport */}
      {results.length > 0 && (
        <div
          className="border-y border-emerald-900/50 px-4 py-6"
          style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
        >
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">Historique récent</p>
            <h2 className="mt-1 text-xl font-extrabold text-white">Derniers résultats</h2>
            <Link
              href="/fr/historique"
              className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/15 hover:text-white"
            >
              Voir tout →
            </Link>
          </div>
        </div>
      )}

      </div>

      {/* Recent results — below the fold */}
      {results.length > 0 && (
        <main className="mx-auto max-w-2xl px-4 pb-4">
          <div className="mt-4 space-y-4">
            {results.map((pick) => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>
        </main>
      )}
    </>
  );
}