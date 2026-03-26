import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ReviewsPage() {
  const { data: reviews } = await supabaseAdmin
    .from("reviews")
    .select("id, pseudo, avatar_url, rating, content, created_at")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  const items = reviews ?? [];

  // Average rating
  const avgRating = items.length > 0
    ? (items.reduce((s, r) => s + r.rating, 0) / items.length).toFixed(1)
    : "0";

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
        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-400">Témoignages</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Avis de nos abonnés</h1>
          {items.length > 0 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} className="text-lg" style={{ color: s <= Math.round(parseFloat(avgRating)) ? "#f59e0b" : "#4b5563" }}>★</span>
                ))}
              </div>
              <span className="text-lg font-extrabold text-white">{avgRating}</span>
              <span className="text-sm text-white/30">({items.length} avis)</span>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 pb-16">
        {items.length > 0 ? (
          <div className="mt-8 space-y-4">
            {items.map((review) => (
              <div
                key={review.id}
                className="overflow-hidden rounded-2xl border border-white/[0.06] p-6"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-lg font-bold text-emerald-400">
                    {review.avatar_url ? (
                      <img src={review.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      review.pseudo.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-white">{review.pseudo}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className="text-sm" style={{ color: s <= review.rating ? "#f59e0b" : "#4b5563" }}>★</span>
                        ))}
                      </div>
                      <span className="text-[10px] text-white/20">
                        {new Date(review.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/60">{review.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-4xl">⭐</p>
            <p className="mt-2 text-sm text-neutral-500 font-semibold">Les avis arrivent bientôt</p>
            <p className="mt-1 text-xs text-neutral-400">Nos premiers abonnés Premium pourront bientôt partager leur expérience</p>
          </div>
        )}
      </main>
    </>
  );
}