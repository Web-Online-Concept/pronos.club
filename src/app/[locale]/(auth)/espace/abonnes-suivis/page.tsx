// src/app/[locale]/(auth)/espace/abonnes-suivis/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";
import TipsterPickCard from "@/components/tipster/TipsterPickCard";

type Tipster = {
  id: string;
  pseudo: string;
  avatar_url: string | null;
};

type Follow = {
  tipster_id: string;
  channel_email: boolean;
  channel_telegram: boolean;
  channel_push: boolean;
  created_at: string;
  tipster: Tipster | Tipster[] | null;
};

type Pick = any;

export default function AbonnesSuivisPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  const [follows, setFollows] = useState<Follow[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowing, setUnfollowing] = useState<string | null>(null);

  // Normalise tipster (Supabase peut retourner un array ou un objet selon la cardinalité)
  function getTipster(f: Follow): Tipster | null {
    if (!f.tipster) return null;
    if (Array.isArray(f.tipster)) return f.tipster[0] || null;
    return f.tipster;
  }

  async function fetchData() {
    if (!isPremium) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      // 2 fetches en parallèle
      const [followsRes, picksRes] = await Promise.all([
        fetch("/api/tipster-follows?action=my_follows"),
        fetch("/api/tipster-picks?filter=live"),
      ]);

      const followsData = await followsRes.json();
      const picksData = await picksRes.json();

      const followsList: Follow[] = followsData.follows || [];
      const allPicks: Pick[] = picksData.picks || [];

      // IDs des tipsters suivis
      const followedIds = new Set(followsList.map((f) => f.tipster_id));

      // Filter les picks pour ne garder que ceux des tipsters suivis
      // On supporte plusieurs noms possibles de colonne (tipster_id, user_id, posted_by)
      const filteredPicks = allPicks.filter((p) => {
        const tid = p.tipster_id ?? p.user_id ?? p.posted_by;
        return tid && followedIds.has(tid);
      });

      setFollows(followsList);
      setPicks(filteredPicks);
    } catch (err) {
      console.error("[abonnes-suivis] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [isPremium]);

  async function handleUnfollow(tipsterId: string, pseudo: string) {
    if (!confirm(`Ne plus suivre ${pseudo} ?`)) return;

    setUnfollowing(tipsterId);
    try {
      const res = await fetch(`/api/tipster-follows?tipster_id=${encodeURIComponent(tipsterId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        // Refresh local : retirer le tipster + ses picks
        setFollows((prev) => prev.filter((f) => f.tipster_id !== tipsterId));
        setPicks((prev) =>
          prev.filter((p) => {
            const tid = p.tipster_id ?? p.user_id ?? p.posted_by;
            return tid !== tipsterId;
          })
        );
      } else {
        alert("Erreur : impossible de désabonner pour le moment.");
      }
    } catch {
      alert("Erreur réseau, réessaie dans un instant.");
    } finally {
      setUnfollowing(null);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU — Non premium
  // ═══════════════════════════════════════════════════════════════
  if (!isPremium) {
    return (
      <>
        <EspaceHero title="Tipsters Suivis" />
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-3xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-white py-16 text-center px-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-black text-neutral-900">Réservé aux abonnés Premium</h2>
            <p className="mt-3 max-w-md mx-auto text-sm text-neutral-600">
              Suivez vos tipsters favoris et retrouvez d'un coup d'œil leurs pronos en cours.
            </p>
            <Link
              href={`/${locale}/abonnement`}
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
            >
              Devenir Premium
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RENDU — Premium
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      <EspaceHero title="Tipsters Suivis" />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : follows.length === 0 ? (
          // ─── Empty state : aucun tipster suivi ─────────────────────
          <div className="rounded-3xl bg-neutral-50 py-16 text-center px-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
              <span className="text-4xl">👥</span>
            </div>
            <h2 className="text-xl font-black text-neutral-900">Aucun tipster suivi pour le moment</h2>
            <p className="mt-3 max-w-md mx-auto text-sm text-neutral-500">
              Découvrez les meilleurs tipsters de la communauté et suivez ceux dont vous appréciez la méthode.
            </p>
            <Link
              href={`/${locale}/pronos-abonnes/classement`}
              className="mt-6 inline-block rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
            >
              Voir le classement des tipsters
            </Link>
          </div>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* BLOC 1 — Pronos en cours des tipsters suivis */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">
                  Pronos en cours
                </h2>
                <span className="text-sm text-neutral-500">
                  {picks.length > 0
                    ? `${picks.length} pronostic${picks.length > 1 ? "s" : ""}`
                    : ""}
                </span>
              </div>

              {picks.length === 0 ? (
                <div className="rounded-2xl bg-neutral-50 py-12 text-center">
                  <span className="text-3xl">⏳</span>
                  <p className="mt-3 text-sm text-neutral-500">
                    Aucun prono en cours chez vos tipsters suivis pour le moment.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {picks.map((pick) => (
                    <TipsterPickCard key={pick.id} pick={pick} locale={locale} showPseudo />
                  ))}
                </div>
              )}
            </section>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* BLOC 2 — Liste des tipsters suivis */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <section className="mt-14">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">
                  Mes tipsters
                </h2>
                <span className="text-sm text-neutral-500">
                  {follows.length} suivi{follows.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {follows.map((f) => {
                  const tipster = getTipster(f);
                  if (!tipster) return null;

                  const initial = tipster.pseudo?.charAt(0).toUpperCase() || "?";
                  const isUnfollowing = unfollowing === tipster.id;

                  return (
                    <div
                      key={tipster.id}
                      className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
                    >
                      {/* Avatar */}
                      {tipster.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tipster.avatar_url}
                          alt={tipster.pseudo}
                          className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-black text-white"
                          style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                        >
                          {initial}
                        </div>
                      )}

                      {/* Infos + actions */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-base font-bold text-neutral-900">
                          {tipster.pseudo}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            href={`/${locale}/pronos-abonnes/${encodeURIComponent(tipster.pseudo)}`}
                            className="inline-flex items-center rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-neutral-800"
                          >
                            Voir profil
                          </Link>
                          <button
                            onClick={() => handleUnfollow(tipster.id, tipster.pseudo)}
                            disabled={isUnfollowing}
                            className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {isUnfollowing ? "..." : "Ne plus suivre"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}