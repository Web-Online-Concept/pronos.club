"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import EspaceHero from "@/components/layout/EspaceHero";

export default function MemberDashboard() {
  const { user, signOut } = useAuth();
  const isAdmin = user?.is_admin === true;

  return (
    <>
      <EspaceHero title={user?.pseudo ? `${user.pseudo}` : "Mon espace"} />

    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/fr/espace/stats"
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">📈</span>
          <h3 className="mt-2 font-bold text-white">Mes Stats</h3>
          <p className="mt-1 text-sm text-white/40">Vos performances sur les pronos suivis</p>
        </Link>

        <Link
          href="/fr/espace/historique"
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">📋</span>
          <h3 className="mt-2 font-bold text-white">Mon Historique</h3>
          <p className="mt-1 text-sm text-white/40">Les pronos que vous avez suivis</p>
        </Link>

        <Link
          href="/fr/espace/abonnement"
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">💎</span>
          <h3 className="mt-2 font-bold text-white">Mon Abonnement</h3>
          <p className="mt-1 text-sm text-white/40">Gérer mon abonnement Premium</p>
        </Link>

        <Link
          href="/fr/espace/notifications"
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">🔔</span>
          <h3 className="mt-2 font-bold text-white">Mes Notifications</h3>
          <p className="mt-1 text-sm text-white/40">Push, email, Telegram</p>
        </Link>

        <Link
          href="/fr/espace/gestion-bk"
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">🏦</span>
          <h3 className="mt-2 font-bold text-white">Ma Gestion de BK</h3>
          <p className="mt-1 text-sm text-white/40">Personnalisez votre gestion de bankroll</p>
        </Link>

        <Link
          href="/fr/espace/app-mobile"
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">📱</span>
          <h3 className="mt-2 font-bold text-white">Appli Mobile</h3>
          <p className="mt-1 text-sm text-white/40">Installer l&apos;appli Pronos Club</p>
        </Link>

        <Link
          href="/fr/espace/profil"
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">👤</span>
          <h3 className="mt-2 font-bold text-white">Mon Profil</h3>
          <p className="mt-1 text-sm text-white/40">Avatar, pseudo, préférences</p>
        </Link>

        <div
          className="overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center opacity-80"
          style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
        >
          <span className="text-2xl">⭐</span>
          <h3 className="mt-2 font-bold text-white">Avis Abonné</h3>
          <p className="mt-1 text-sm text-white/40">Donnez votre avis sur le site</p>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Bientôt disponible</p>
        </div>

        {isAdmin && (
          <Link
            href="/fr/admin"
            className="overflow-hidden rounded-xl border-2 border-emerald-500 p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            <span className="text-2xl">⚙️</span>
            <h3 className="mt-2 font-bold text-emerald-400">Administration</h3>
            <p className="mt-1 text-sm text-emerald-400/60">Gérer les picks et le site</p>
          </Link>
        )}
      </div>

      <div className="mt-8 mb-16 text-center">
        <button
          onClick={signOut}
          className="cursor-pointer rounded-xl border border-red-300 px-8 py-3 text-sm font-bold text-red-500 transition hover:bg-red-50"
        >
          Se déconnecter
        </button>
      </div>
    </main>
    </>
  );
}