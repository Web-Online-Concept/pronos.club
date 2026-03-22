import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function BookmakersPage() {
  const supabase = await createClient();

  const { data: bookmakers } = await supabase
    .from("bookmakers")
    .select("*")
    .eq("active", true)
    .order("sort_order");

  const books = bookmakers ?? [];

  return (
    <>
      {/* Hero full-width */}
      <div
        className="border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="mx-auto max-w-2xl px-4 py-10">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Pronos Club</p>
            <h1 className="mt-2 text-3xl font-extrabold text-white">Bookmakers</h1>
            <p className="mt-2 text-sm text-white/40">Les bookmakers utilisés par notre tipster</p>
          </div>
        </div>
      </div>

    <main className="mx-auto max-w-2xl px-4 pb-12 pt-6">

      <div className="mt-8 space-y-4">
        {books.map((book) => (
          <div
            key={book.id}
            className="rounded-xl border border-neutral-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{book.name}</h2>
                {book.bonus_info && (
                  <p className="mt-0.5 text-sm text-emerald-600 font-medium">
                    {book.bonus_info}
                  </p>
                )}
                {book.description_fr && (
                  <p className="mt-2 text-sm opacity-50">{book.description_fr}</p>
                )}
              </div>
              {book.logo_url && (
                <img
                  src={book.logo_url}
                  alt={book.name}
                  className="h-10 w-auto"
                />
              )}
            </div>
            {book.affiliate_url && (
              <Link
                href={book.affiliate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                S'inscrire sur {book.name} →
              </Link>
            )}
          </div>
        ))}
      </div>

      {books.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-4xl">🏦</p>
          <p className="mt-2 text-sm opacity-50">
            Liste des bookmakers bientôt disponible
          </p>
        </div>
      )}
    </main>
    </>
  );
}