/**
 * ═══════════════════════════════════════════════════════════════════
 * PAGE — /fr/pronos-ia/bilans/[slug]
 * ═══════════════════════════════════════════════════════════════════
 *
 * Page de détail d'un bilan IA (Server Component).
 * Module Buteurs supprime — on n'expose que les bilans classics.
 * ═══════════════════════════════════════════════════════════════════
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";


const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const { data: bilan } = await supabaseAdmin
    .from("ai_bilans")
    .select("title, summary, month")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("pick_type", "classic")
    .single();

  if (!bilan) {
    return { title: "Bilan introuvable · PRONOS.CLUB" };
  }

  return {
    title: `${bilan.title} · PRONOS.CLUB`,
    description: bilan.summary ?? `Bilan mensuel IA - ${bilan.title}`,
  };
}


export default async function BilanIADetailPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;

  const { data: bilan } = await supabaseAdmin
    .from("ai_bilans")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("pick_type", "classic")
    .single();

  if (!bilan) notFound();

  const [y, m] = bilan.month.split("-");
  const monthLabel = `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
  const paragraphs = (bilan.content ?? "")
    .split("\n")
    .filter((p: string) => p.trim() !== "");

  const accentColor = "#a855f7";

  return (
    <>
      {/* Hero violet IA */}
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

        <div className="relative mx-auto max-w-3xl px-4 py-14">
          <Link
            href={`/${locale}/pronos-ia/bilans`}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60"
          >
            ← Retour aux bilans
          </Link>

          <div className="text-center">
            <p
              className="mt-4 text-[11px] font-bold uppercase tracking-[0.25em]"
              style={{ color: accentColor }}
            >
              {monthLabel}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold text-white">{bilan.title}</h1>

            {/* Stats */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              {[
                {
                  label: "Picks",
                  value: bilan.total_picks.toString(),
                  color: "text-white",
                },
                {
                  label: "Win rate",
                  value: `${Number(bilan.win_rate).toFixed(2)}%`,
                  color: bilan.win_rate >= 50 ? "text-emerald-400" : "text-red-400",
                },
                {
                  label: "ROI",
                  value: `${bilan.roi >= 0 ? "+" : ""}${Number(bilan.roi).toFixed(2)}%`,
                  color: bilan.roi >= 0 ? "text-emerald-400" : "text-red-400",
                },
                {
                  label: "Profit",
                  value: `${bilan.profit >= 0 ? "+" : ""}${Number(bilan.profit).toFixed(3)}U`,
                  color: bilan.profit >= 0 ? "text-emerald-400" : "text-red-400",
                },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        {/* Cover image */}
        {bilan.cover_image && (
          <div className="mt-8 overflow-hidden rounded-2xl">
            <img src={bilan.cover_image} alt={bilan.title} className="w-full" />
          </div>
        )}

        {/* Content */}
        {paragraphs.length > 0 && (
          <article className="mt-8">
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
              style={{
                background: "linear-gradient(135deg, #111111 0%, #1e1b4b 100%)",
              }}
            >
              {paragraphs.map((p: string, i: number) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed text-white/70 ${i > 0 ? "mt-4" : ""}`}
                >
                  {p}
                </p>
              ))}
            </div>
          </article>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Link
            href={`/${locale}/pronos-ia/bilans`}
            className="text-sm font-semibold transition hover:opacity-80"
            style={{ color: accentColor }}
          >
            ← Retour aux bilans
          </Link>
          <Link
            href={`/${locale}/pronos-ia/stats`}
            className="text-sm font-semibold transition hover:opacity-80"
            style={{ color: accentColor }}
          >
            Voir les stats →
          </Link>
        </div>
      </main>
    </>
  );
}