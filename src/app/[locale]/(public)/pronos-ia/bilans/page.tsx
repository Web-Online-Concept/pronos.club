/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/bilans
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page publique liste des bilans IA mensuels.
 * Module Buteurs supprime — on n'expose que les bilans classics.
 * ═══════════════════════════════════════════════════════════════════
 */

import { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import BilansListClient from "./BilansListClient";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Bilans mensuels IA · PRONOS.CLUB",
    description:
      "Bilans mensuels des performances de notre intelligence artificielle.",
  };
}


export interface AiBilan {
  id: string;
  pick_type: "classic" | "scorer";
  title: string;
  slug: string;
  month: string;
  summary: string | null;
  cover_image: string | null;
  profit: number;
  roi: number;
  win_rate: number;
  total_picks: number;
  is_published: boolean;
  published_at: string | null;
}


export default async function PronosIABilansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const { data } = await supabaseAdmin
    .from("ai_bilans")
    .select("*")
    .eq("is_published", true)
    .eq("pick_type", "classic")
    .order("month", { ascending: false });

  const bilans = (data ?? []) as AiBilan[];

  return (
    <div className="pronos-ia-section flex min-h-[calc(100vh-100px)] flex-col bg-white text-neutral-900">
      {/* Hero inline */}
      <section
        className="relative overflow-hidden border-b"
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
          borderColor: "rgba(168, 85, 247, 0.25)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.35) 0%, transparent 50%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 0% 100%, rgba(59, 130, 246, 0.25) 0%, transparent 50%)",
          }}
        />

        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-400">
            Pronos Club · IA
          </p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">
            Bilans mensuels
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/40">
            Performances de notre IA mois par mois
          </p>
          {bilans.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5">
              <span className="text-xs font-semibold text-violet-400">
                {bilans.length > 1 ? `${bilans.length} bilans` : `${bilans.length} bilan`}
              </span>
            </div>
          )}
        </div>
      </section>

      <BilansListClient locale={locale} bilans={bilans} />
    </div>
  );
}