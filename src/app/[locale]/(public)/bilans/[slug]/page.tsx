import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export default async function BilanSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  const { data: bilan } = await supabaseAdmin
    .from("bilans")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (!bilan) notFound();

  const paragraphs = bilan.content.split("\n").filter((p: string) => p.trim() !== "");

  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 py-14">
          <Link href="/fr/bilans" className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-white/30 transition hover:text-white/60">
            ← Tous les bilans
          </Link>

          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">{formatMonth(bilan.month)}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-white">{bilan.title}</h1>

            {/* Stats */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              {[
                { label: "Picks", value: bilan.total_picks.toString(), color: "text-white" },
                { label: "Win rate", value: `${bilan.win_rate}%`, color: bilan.win_rate >= 50 ? "text-emerald-400" : "text-red-400" },
                { label: "ROI", value: `${bilan.roi >= 0 ? "+" : ""}${bilan.roi}%`, color: bilan.roi >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Profit", value: `${bilan.profit >= 0 ? "+" : ""}${bilan.profit}U`, color: bilan.profit >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{stat.label}</p>
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
        <article className="mt-8">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-6 sm:p-8"
            style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
          >
            {paragraphs.map((p: string, i: number) => (
              <p key={i} className={`text-sm leading-relaxed text-white/60 ${i > 0 ? "mt-4" : ""}`}>
                {p}
              </p>
            ))}
          </div>
        </article>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <Link href="/fr/bilans" className="text-sm font-semibold text-emerald-500 transition hover:text-emerald-400">
            ← Tous les bilans
          </Link>
          <Link href="/fr/statistiques" className="text-sm font-semibold text-emerald-500 transition hover:text-emerald-400">
            Statistiques détaillées →
          </Link>
        </div>

        {/* CTA */}
        {!isLoggedIn && (
          <div className="mt-12 text-center">
            <p className="text-sm font-semibold text-neutral-600">Envie de suivre nos pronostics ?</p>
            <Link
              href="/fr/login"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
            >
              Créer mon compte gratuit
            </Link>
          </div>
        )}
      </main>
    </>
  );
}