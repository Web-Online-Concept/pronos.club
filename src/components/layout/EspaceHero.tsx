"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

interface EspaceHeroProps {
  title: string;
}

export default function EspaceHero({ title }: EspaceHeroProps) {
  const { user } = useAuth();

  const isPremium = user?.subscription_status === "active";

  function formatRenewal(end: string | null | undefined) {
    if (!end) return null;
    const d = new Date(end);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (diffDays > 3650) return "Illimité";
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }

  const renewalDate = isPremium ? formatRenewal(user?.subscription_end) : null;

  return (
    <div
      className="border-b border-emerald-700/50"
      style={{ background: "linear-gradient(135deg, #047857 0%, #059669 50%, #047857 100%)" }}
    >
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ring-2 ring-white/30">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/20 text-2xl font-bold text-white">
                {(user?.pseudo || user?.email || "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/60">{user?.email}</p>

          <div className="mt-4">
            {isPremium ? (
              <div className="inline-flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-amber-500/20">
                  ⭐ Membre Premium
                </span>
                {renewalDate && (
                  <span className="text-[10px] text-white/40">
                    {renewalDate === "Illimité" ? "Accès illimité" : `Renouvellement : ${renewalDate}`}
                  </span>
                )}
              </div>
            ) : (
              <Link
                href="/fr/espace/abonnement"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/25"
              >
                Compte gratuit — <span className="font-bold text-amber-300">Passer Premium →</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}