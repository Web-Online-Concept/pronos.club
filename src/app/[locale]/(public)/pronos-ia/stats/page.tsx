/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/stats
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
import StatsClient from "./StatsClient";


export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return buildPronosIAMetadata(locale, "stats");
}


const getResolvedCount = async (): Promise<number> => {
  const { count } = await supabaseAdmin
    .from("ai_picks")
    .select("*", { count: "exact", head: true })
    .neq("status", "pending")
    .is("deleted_at", null);
  return count ?? 0;
};


export default async function PronosIAStatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedCount = await getResolvedCount();
  const totalLabel =
    resolvedCount > 1 ? `${resolvedCount} pronos terminés` : `${resolvedCount} prono terminé`;

  return (
    <div className="pronos-ia-section min-h-screen bg-white text-neutral-900">
      <PronosIAHero
        locale={locale}
        currentPage="stats"
        title="Statistiques"
        badgeLabel={totalLabel}
      />

      <StatsClient />
    </div>
  );
}