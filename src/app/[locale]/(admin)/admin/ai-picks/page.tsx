/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE ADMIN — /admin/ai-picks
 * ═══════════════════════════════════════════════════════════════════
 *
 * Admin de gestion des picks IA.
 * - Liste paginée de tous les picks (filtrable par status)
 * - Bouton "Supprimer" (passe en void avec raison)
 * - Affiche audit_reason pour les rejetés automatiquement
 *
 * Auth : email via adminCheck.ts (ADMIN_EMAILS)
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import AdminPickRow from "@/components/admin/AdminPickRow";
import AdminForceResolveButton from "@/components/admin/AdminForceResolveButton";
import AdminGeneratePicksButton from "@/components/admin/AdminGeneratePicksButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — Pronos IA | PRONOS.CLUB",
  robots: { index: false, follow: false },
};


const PER_PAGE = 50;


export default async function AdminAIPicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  // Vérification admin (cohérent avec le layout admin qui utilise user.is_admin)
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/login`);
  }
  if (!user.is_admin) {
    redirect(`/${locale}`);
  }

  const statusFilter = sp.status ?? "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // Query
  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      "id, pick_type, sport, league, event_name, event_date, selection, market, odds, odds_bookmaker, reasoning, ai_confidence, status, final_score, audit_reason, audit_category, audited_at, generation_batch, created_at",
      { count: "exact" },
    )
    .order("event_date", { ascending: false });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) console.error("[admin-ai-picks] Erreur fetch:", error);

  const picks = data ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  // Stats par status (pour les tabs)
  const { data: statsData } = await supabaseAdmin
    .from("ai_picks")
    .select("status");
  const statusCounts: Record<string, number> = {};
  (statsData ?? []).forEach((row) => {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  });
  const total = (statsData ?? []).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">

        {/* HEADER */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">🤖 Admin — Pronos IA</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Gestion manuelle des pronostics générés par l'IA
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <Link
                href={`/${locale}/admin`}
                className="text-sm text-neutral-400 hover:text-neutral-200"
              >
                ← Retour admin
              </Link>
              <AdminGeneratePicksButton adminEmail={user.email ?? ""} />
              <AdminForceResolveButton />
            </div>
          </div>
        </header>

        {/* STATS GLOBALES */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatCard label="Total" count={total} active={statusFilter === "all"} href={`?status=all`} />
          <StatCard label="En attente" count={statusCounts["pending"] ?? 0} active={statusFilter === "pending"} href={`?status=pending`} color="amber" />
          <StatCard label="À auditer" count={statusCounts["pending_review"] ?? 0} active={statusFilter === "pending_review"} href={`?status=pending_review`} color="cyan" />
          <StatCard label="Gagnés" count={statusCounts["won"] ?? 0} active={statusFilter === "won"} href={`?status=won`} color="emerald" />
          <StatCard label="Perdus" count={statusCounts["lost"] ?? 0} active={statusFilter === "lost"} href={`?status=lost`} color="red" />
          <StatCard label="Annulés" count={statusCounts["void"] ?? 0} active={statusFilter === "void"} href={`?status=void`} color="neutral" />
          <StatCard label="Rejetés audit" count={statusCounts["rejected_by_audit"] ?? 0} active={statusFilter === "rejected_by_audit"} href={`?status=rejected_by_audit`} color="purple" />
          <StatCard label="Cotes invalides" count={statusCounts["rejected_by_validation"] ?? 0} active={statusFilter === "rejected_by_validation"} href={`?status=rejected_by_validation`} color="red" />
        </div>

        {/* LISTE */}
        {picks.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-10 text-center text-sm text-neutral-500">
            Aucun pick trouvé avec ce filtre.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950/60 text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Match</th>
                  <th className="px-4 py-3 text-left">Pick</th>
                  <th className="px-4 py-3 text-right">Cote</th>
                  <th className="px-4 py-3 text-center">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {picks.map((pick) => (
                  <AdminPickRow key={pick.id} pick={pick} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`?status=${statusFilter}&page=${page - 1}`}
                className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm hover:bg-neutral-800"
              >
                ← Précédent
              </Link>
            )}
            <span className="px-4 text-sm text-neutral-400">
              Page {page} / {totalPages} — {totalCount} picks
            </span>
            {page < totalPages && (
              <Link
                href={`?status=${statusFilter}&page=${page + 1}`}
                className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm hover:bg-neutral-800"
              >
                Suivant →
              </Link>
            )}
          </div>
        )}

      </main>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// CARD DE STAT (FILTRES)
// ═══════════════════════════════════════════════════════════════════

function StatCard({
  label,
  count,
  active,
  href,
  color = "neutral",
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  color?: "neutral" | "amber" | "cyan" | "emerald" | "red" | "purple";
}) {
  const colorStyles = {
    neutral: active ? "border-neutral-500 bg-neutral-800" : "border-neutral-800 bg-neutral-900/40",
    amber: active ? "border-amber-500 bg-amber-950/40" : "border-neutral-800 bg-neutral-900/40",
    cyan: active ? "border-cyan-500 bg-cyan-950/40" : "border-neutral-800 bg-neutral-900/40",
    emerald: active ? "border-emerald-500 bg-emerald-950/40" : "border-neutral-800 bg-neutral-900/40",
    red: active ? "border-red-500 bg-red-950/40" : "border-neutral-800 bg-neutral-900/40",
    purple: active ? "border-purple-500 bg-purple-950/40" : "border-neutral-800 bg-neutral-900/40",
  };

  return (
    <Link
      href={href}
      className={`rounded-lg border p-3 text-center transition hover:border-neutral-600 ${colorStyles[color]}`}
    >
      <div className="text-2xl font-bold">{count}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </div>
    </Link>
  );
}