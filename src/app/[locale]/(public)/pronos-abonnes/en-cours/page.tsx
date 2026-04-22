// src/app/[locale]/pronos-abonnes/en-cours/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import TipsterPickCard from "@/components/tipster/TipsterPickCard";

type Pick = any;

const SPORTS = [
  "⚽ Football",
  "🏀 Basketball",
  "🎾 Tennis",
  "🏒 Hockey",
  "🏈 Football US",
  "⚾ Baseball",
  "🥊 MMA/Boxe",
  "🏉 Rugby",
  "🎯 Autre",
];

export default function PronosAbonnesEnCoursPage() {
  const locale = useLocale();
  const { user } = useAuth();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<string>("");

  const isPremium = (user as any)?.subscription_status === "active" || (user as any)?.subscription_status === "trialing";

  async function fetchPicks() {
    if (!isPremium) { setLoading(false); return; }
    setLoading(true);
    const url = sportFilter
      ? `/api/tipster-picks?filter=live&sport=${encodeURIComponent(sportFilter)}`
      : `/api/tipster-picks?filter=live`;
    const res = await fetch(url);
    const data = await res.json();
    setPicks(data.picks || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchPicks();
  }, [sportFilter, isPremium]);

  return (
    <main className="min-h-screen bg-white">
      {/* Hero compact */}
      <div
        className="px-4 py-8 text-center text-white"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.3em] text-emerald-400">
            🎯 Pronos Abonnés
          </p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Pronos en cours</h1>
          <p className="mt-2 text-sm text-white/60">
            Triés par heure de match
          </p>
        </div>
      </div>

      {/* Subnav */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex gap-1 overflow-x-auto">
            <Link
              href={`/${locale}/pronos-abonnes/en-cours`}
              className="whitespace-nowrap border-b-2 border-emerald-500 px-4 py-3 text-sm font-bold text-emerald-600"
            >
              En cours
            </Link>
            <Link
              href={`/${locale}/pronos-abonnes/historique`}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-bold text-neutral-500 transition hover:text-neutral-900"
            >
              Historique
            </Link>
            <Link
              href={`/${locale}/pronos-abonnes/classement`}
              className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-bold text-neutral-500 transition hover:text-neutral-900"
            >
              Classement
            </Link>
          </div>
        </div>
      </div>

      {/* Filter bar (premium only) */}
      {isPremium && (
        <div className="bg-neutral-50 border-b border-neutral-200">
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setSportFilter("")}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  sportFilter === ""
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400"
                }`}
              >
                Tous les sports
              </button>
              {SPORTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSportFilter(s)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    sportFilter === s
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        {!isPremium ? (
          <div className="rounded-3xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-white py-16 text-center px-6">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-100">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-black text-neutral-900">Pronos en cours réservés aux Premium</h2>
            <p className="mt-3 max-w-md mx-auto text-sm text-neutral-600">
              Pour voir les pronostics postés par les abonnés en temps réel, passe Premium.
              Tu auras accès à tous les pronos live, profils tipsters, et tu pourras poster les tiens.
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
                🏆 Voir le classement (gratuit)
              </Link>
            </div>
            <p className="mt-6 text-xs text-neutral-400">
              Classement et historique restent accessibles librement.
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : picks.length === 0 ? (
          <div className="rounded-3xl bg-neutral-50 py-16 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white">
              <span className="text-4xl">🎯</span>
            </div>
            <p className="text-neutral-500 text-sm">
              Aucun pronostic en cours pour le moment
            </p>
            <p className="mt-2 text-xs text-neutral-400">
              Reviens plus tard ou consulte l&apos;historique.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {picks.map((pick) => (
              <TipsterPickCard key={pick.id} pick={pick} locale={locale} showPseudo />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}