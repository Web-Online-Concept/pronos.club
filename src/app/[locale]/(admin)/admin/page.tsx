import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminDashboard() {
  const { count: totalPicks } = await supabaseAdmin
    .from("picks")
    .select("*", { count: "exact", head: true });

  const { count: pendingPicks } = await supabaseAdmin
    .from("picks")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: totalUsers } = await supabaseAdmin
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: activeSubscribers } = await supabaseAdmin
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("subscription_status", "active");

  const stats = [
    { label: "Picks publiés", value: totalPicks ?? 0, accent: "#10b981" },
    { label: "En attente", value: pendingPicks ?? 0, accent: "#f59e0b" },
    { label: "Utilisateurs", value: totalUsers ?? 0, accent: "#3b82f6" },
    { label: "Abonnés premium", value: activeSubscribers ?? 0, accent: "#a78bfa" },
  ];

  const links = [
    { href: "/admin/picks/new", label: "Publier un pick", icon: "🎯", accent: "#10b981", desc: "Créer et notifier" },
    { href: "/admin/picks/results", label: "Saisir résultats", icon: "✅", accent: "#f59e0b", desc: "Mettre à jour les picks" },
    { href: "/admin/picks", label: "Tous les picks", icon: "📋", accent: "#3b82f6", desc: "Gérer les publications" },
    { href: "/admin/abonnes", label: "Abonnés", icon: "👥", accent: "#a78bfa", desc: "Gestion des membres" },
    { href: "/admin/bookmakers", label: "Bookmakers", icon: "📚", accent: "#3b82f6", desc: "Affiliations & contenu" },
    { href: "/admin/bankroll", label: "Bankroll Tipster", icon: "🏦", accent: "#f59e0b", desc: "Capital & valeur d'unité" },
    { href: "/admin/paiements", label: "Paiements", icon: "💰", accent: "#10b981", desc: "Suivi Stripe" },
    { href: "/admin/comptabilite", label: "Comptabilité", icon: "📊", accent: "#ef4444", desc: "Revenus & stats" },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)" }}
        >
          <span className="text-xl">⚡</span>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-white">Dashboard</h1>
          <p className="text-xs text-white/30">Panneau d&apos;administration PRONOS.CLUB</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl border border-white/[0.06] p-5 text-center"
            style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${stat.accent}10 100%)` }}
          >
            {/* Top accent line */}
            <div
              className="absolute left-0 top-0 h-[3px] w-full"
              style={{ background: `linear-gradient(90deg, transparent 0%, ${stat.accent} 50%, transparent 100%)` }}
            />
            <p
              className="text-3xl font-extrabold"
              style={{ color: stat.accent }}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/20">Actions rapides</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={`/fr${link.href}`}
              className="group relative overflow-hidden rounded-xl border border-white/[0.06] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: `linear-gradient(135deg, #0a0a0a 0%, ${link.accent}08 100%)` }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: `radial-gradient(circle at 50% 50%, ${link.accent}10 0%, transparent 70%)` }}
              />

              <div className="relative flex items-start gap-3">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                  style={{ background: `${link.accent}15` }}
                >
                  <span className="text-lg">{link.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{link.label}</p>
                  <p className="mt-0.5 text-[10px] text-white/30">{link.desc}</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-white/10 transition-all group-hover:translate-x-1 group-hover:text-white/30">
                →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}