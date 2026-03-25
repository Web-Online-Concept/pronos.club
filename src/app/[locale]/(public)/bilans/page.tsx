import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatMonth(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

export default async function BilansPage() {
  const { data: bilans } = await supabaseAdmin
    .from("bilans")
    .select("*")
    .eq("is_published", true)
    .order("month", { ascending: false });

  const items = bilans ?? [];

  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full bg-emerald-400/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Transparence</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Bilans mensuels</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/40">
            Chaque mois, notre tipster publie un bilan complet : résultats, analyse, 
            contexte et perspectives. Tout est transparent, les bons mois comme les mauvais.
          </p>
          {items.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
              <span className="text-xs font-semibold text-emerald-400">
                {items.length} bilan{items.length > 1 ? "s" : ""} publié{items.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        {items.length > 0 ? (
          <div className="mt-8 space-y-4">
            {items.map((bilan) => (
              <Link
                key={bilan.id}
                href={`/fr/bilans/${bilan.slug}`}
                className="group flex items-start gap-5 overflow-hidden rounded-2xl border border-white/[0.06] p-5 transition hover:-translate-y-0.5 hover:border-white/10 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                {/* Month badge */}
                <div className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-white/[0.06]">
                  <p className="text-xl font-extrabold text-white">{bilan.month.split("-")[1]}</p>
                  <p className="text-[10px] text-white/30">{bilan.month.split("-")[0]}</p>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h2 className="text-lg font-extrabold text-white group-hover:text-emerald-400 transition">{bilan.title}</h2>
                  
                  {/* Stats bar */}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-white/50">
                      {bilan.total_picks} picks
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold text-white/50">
                      WR {bilan.win_rate}%
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      bilan.roi >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}>
                      ROI {bilan.roi >= 0 ? "+" : ""}{bilan.roi}%
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      bilan.profit >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}>
                      {bilan.profit >= 0 ? "+" : ""}{bilan.profit}U
                    </span>
                  </div>

                  {bilan.summary && (
                    <p className="mt-2 text-sm text-white/40 line-clamp-2">{bilan.summary}</p>
                  )}
                </div>

                <svg className="mt-2 h-5 w-5 flex-shrink-0 text-white/20 transition group-hover:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-4xl">📊</p>
            <p className="mt-2 text-sm text-neutral-500 font-semibold">Les bilans arrivent bientôt</p>
            <p className="mt-1 text-xs text-neutral-400">Le premier bilan sera publié à la fin du mois en cours</p>
          </div>
        )}
      </main>
    </>
  );
}