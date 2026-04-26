/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/historique
 * ═══════════════════════════════════════════════════════════════════
 *
 * Server Component qui rend le PronosIAHero (avec navbar IA)
 * puis délègue le contenu interactif au sub-component client.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PronosIAHero from "@/components/ai-picks/ui/PronosIAHero";
import { buildPronosIAMetadata } from "@/lib/ai/ai-picks-metadata";
import HistoriqueClient from "./HistoriqueClient";


export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPronosIAMetadata(locale, "history");
}


const getCounts = async (): Promise<{ awaiting: number; finished: number }> => {
  const now = new Date().toISOString();

  // Comptage des pronos en attente (status pending et event date passée)
  const { count: awaitingCount } = await supabaseAdmin
    .from("ai_picks")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .is("deleted_at", null)
    .lte("event_date", now);

  // Comptage des pronos terminés (résolus)
  const { count: finishedCount } = await supabaseAdmin
    .from("ai_picks")
    .select("*", { count: "exact", head: true })
    .neq("status", "pending")
    .is("deleted_at", null);

  return {
    awaiting: awaitingCount ?? 0,
    finished: finishedCount ?? 0,
  };
};


export default async function PronosIAHistoriquePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const counts = await getCounts();
  const totalLabel =
    counts.awaiting + counts.finished > 1
      ? `${counts.awaiting + counts.finished} pronos terminés`
      : `${counts.awaiting + counts.finished} prono terminé`;

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">
      <PronosIAHero
        locale={locale}
        currentPage="history"
        title="Historique"
        badgeLabel={totalLabel}
      />

      <HistoriqueClient locale={locale} />
    </div>
  );
}