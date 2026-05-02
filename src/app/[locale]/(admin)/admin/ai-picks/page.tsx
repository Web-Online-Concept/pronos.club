/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE ADMIN — /admin/ai-picks (v3)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Admin de gestion des picks IA — mis à jour pour le système v3.
 *
 * Changements vs version précédente :
 *   - Suppression des statuts morts (pending_review, rejected_by_audit,
 *     rejected_by_validation, audit_reason, audit_category, audited_at)
 *   - Ajout filtres v3 : generation_version, dossier_status failed
 *   - Ajout champs v3 dans le SELECT : generation_version, consensus_tier,
 *     model_used, dossier_status, odds_comparison
 *   - Filtre "Dossier KO" pour repérer les picks sans analyse
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
    filter?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  if (!user.is_admin) redirect(`/${locale}`);

  // "filter" remplace "status" pour supporter aussi les filtres v3 non-status
  const filter = sp.filter ?? "all";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // ── Construction de la query selon le filtre actif ──────────────
  let query = supabaseAdmin
    .from("ai_picks")
    .select(
      `id, pick_type, sport, league, event_name, event_date, selection,
       market, odds, odds_bookmaker, odds_comparison, reasoning,
       ai_confidence, consensus_tier, status, final_score,
       audit_reason, audit_category,
       generation_version, model_used, dossier_status,
       generation_batch, created_at, slug, classic_number`,
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("event_date", { ascending: false });

  // Filtres status classiques
  if (["pending", "won", "lost", "void"].includes(filter)) {
    query = query.eq("status", filter);
  }
  // Filtre par version de génération
  else if (filter === "v3") {
    query = query.eq("generation_version", "v3");
  } else if (filter === "v2") {
    query = query.eq("generation_version", "v2");
  }
  // Picks v3 dont le dossier a échoué (page sans analyse)
  else if (filter === "dossier_failed") {
    query = query
      .eq("generation_version", "v3")
      .eq("dossier_status", "failed");
  }
  // Picks v3 dont le dossier est en attente / non généré
  else if (filter === "dossier_queued") {
    query = query
      .eq("generation_version", "v3")
      .eq("dossier_status", "queued");
  }

  const from = (page - 1) * PER_PAGE;
  const to = from + PER_PAGE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) console.error("[admin-ai-picks] Erreur fetch:", error);

  const picks = data ?? [];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

  // ── Stats pour les filtres ──────────────────────────────────────
  const { data: statsData } = await supabaseAdmin
    .from("ai_picks")
    .select("status, generation_version, dossier_status")
    .is("deleted_at", null);

  const rows = statsData ?? [];
  const total = rows.length;

  const statusCounts: Record<string, number> = {};
  rows.forEach((r) => {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  });

  const countV3 = rows.filter((r) => r.generation_version === "v3").length;
  const countV2 = rows.filter((r) => r.generation_version === "v2").length;
  const countDossierFailed = rows.filter(
    (r) => r.generation_version === "v3" && r.dossier_status === "failed"
  ).length;
  const countDossierQueued = rows.filter(
    (r) => r.generation_version === "v3" && r.dossier_status === "queued"
  ).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">

        {/* HEADER */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">🤖 Admin — Pronos IA</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Gestion des picks IA — système v3 (Claude Sonnet tipster + GPT-4o validator)
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

        {/* FILTRES STATUT */}
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Statut du pick
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Tous" count={total} active={filter === "all"} href="?filter=all" />
            <StatCard label="En attente" count={statusCounts["pending"] ?? 0} active={filter === "pending"} href="?filter=pending" color="amber" />
            <StatCard label="Gagnés" count={statusCounts["won"] ?? 0} active={filter === "won"} href="?filter=won" color="emerald" />
            <StatCard label="Perdus" count={statusCounts["lost"] ?? 0} active={filter === "lost"} href="?filter=lost" color="red" />
            <StatCard label="Annulés" count={statusCounts["void"] ?? 0} active={filter === "void"} href="?filter=void" color="neutral" />
          </div>
        </div>

        {/* FILTRES V3 */}
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Version du pipeline
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="v3 (nouveau)" count={countV3} active={filter === "v3"} href="?filter=v3" color="violet" />
            <StatCard label="v2 (anciens)" count={countV2} active={filter === "v2"} href="?filter=v2" color="neutral" />
            <StatCard label="Dossier KO" count={countDossierFailed} active={filter === "dossier_failed"} href="?filter=dossier_failed" color="orange" />
            <StatCard label="Dossier en attente" count={countDossierQueued} active={filter === "dossier_queued"} href="?filter=dossier_queued" color="cyan" />
          </div>
        </div>

        {/* INFO DOSSIER KO */}
        {filter === "dossier_failed" && countDossierFailed > 0 && (
          <div className="mb-6 rounded-xl border border-orange-500/30 bg-orange-950/20 px-5 py-4 text-sm text-orange-300">
            ⚠️ Ces picks ont été insérés en BDD mais leur dossier d&apos;analyse n&apos;a pas pu être généré.
            La page <code>/pronos-ia/match/[slug]</code> existe mais affichera une analyse vide.
            Vous pouvez les forcer via le cron ou les supprimer.
          </div>
        )}

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
                  <th className="px-4 py-3 text-center">Version</th>
                  <th className="px-4 py-3 text-center">Dossier</th>
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
                href={`?filter=${filter}&page=${page - 1}`}
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
                href={`?filter=${filter}&page=${page + 1}`}
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
// STAT CARD
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
  color?: "neutral" | "amber" | "cyan" | "emerald" | "red" | "violet" | "orange";
}) {
  const colorStyles: Record<string, string> = {
    neutral: active ? "border-neutral-500 bg-neutral-800" : "border-neutral-800 bg-neutral-900/40",
    amber:   active ? "border-amber-500 bg-amber-950/40"   : "border-neutral-800 bg-neutral-900/40",
    cyan:    active ? "border-cyan-500 bg-cyan-950/40"     : "border-neutral-800 bg-neutral-900/40",
    emerald: active ? "border-emerald-500 bg-emerald-950/40" : "border-neutral-800 bg-neutral-900/40",
    red:     active ? "border-red-500 bg-red-950/40"       : "border-neutral-800 bg-neutral-900/40",
    violet:  active ? "border-violet-500 bg-violet-950/40" : "border-neutral-800 bg-neutral-900/40",
    orange:  active ? "border-orange-500 bg-orange-950/40" : "border-neutral-800 bg-neutral-900/40",
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