import { supabaseAdmin } from "@/lib/supabase/admin";
import Link from "next/link";
import Image from "next/image";

export default async function BookmakersPage() {
  const { data: bookmakers } = await supabaseAdmin
    .from("bookmakers")
    .select("*")
    .eq("is_featured", true)
    .order("sort_order");

  const books = bookmakers ?? [];
  const international = books.filter((b) => !b.is_arjel);
  const anj = books.filter((b) => b.is_arjel);

  return (
    <>
      {/* ═══════════ HERO ═══════════ */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full bg-emerald-400/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">Nos partenaires</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">Bookmakers</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/40">
            Nous travaillons avec les meilleurs bookmakers du marché.
            Des plateformes fiables, des cotes compétitives et des retraits rapides.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-4 pb-16">

        {/* ═══════════ POURQUOI CES BOOKMAKERS ═══════════ */}
        <section className="mt-12">
          <div className="text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-600">Transparence</p>
            <h2 className="mt-2 text-2xl font-extrabold text-neutral-900">Pourquoi ces bookmakers ?</h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: "📊",
                title: "Meilleures cotes",
                desc: "Nous sélectionnons les bookmakers qui offrent les cotes les plus élevées sur les marchés que nous ciblons.",
              },
              {
                icon: "⚡",
                title: "Fiabilité & rapidité",
                desc: "Plateformes stables, retraits rapides, service client réactif. Nous ne recommandons que ce que nous utilisons.",
              },
              {
                icon: "🌍",
                title: "Accessibilité mondiale",
                desc: "Des options pour les joueurs français (ANJ) et internationaux. Chacun peut trouver la plateforme adaptée à son pays.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group overflow-hidden rounded-2xl border border-white/[0.06] p-6 text-center transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #111111 0%, #0a3d2a 100%)" }}
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-2xl">{item.icon}</span>
                <h3 className="mt-4 font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ INTERNATIONAL (HORS ANJ) ═══════════ */}
        {international.length > 0 && (
          <section className="mt-16">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-56rem)/2+1rem)] sm:px-[calc((100vw-56rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-amber-300">International</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">Bookmakers hors ANJ</h2>
                <p className="mx-auto mt-2 max-w-md text-xs text-white/30">
                  Accessibles depuis la plupart des pays. Cotes souvent plus élevées, marchés plus variés.
                  Idéal pour les joueurs hors France, au Canada, en Espagne et dans le monde entier.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {international.map((book) => (
                <BookmakerCard key={book.id} book={book} variant="international" />
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ ANJ (FRANCE) ═══════════ */}
        {anj.length > 0 && (
          <section className="mt-16">
            <div
              className="-mx-4 border-y border-emerald-900/50 px-4 py-6 sm:-mx-[calc((100vw-56rem)/2+1rem)] sm:px-[calc((100vw-56rem)/2+1rem)]"
              style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
            >
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-blue-300">France — ANJ</p>
                <h2 className="mt-1 text-xl font-extrabold text-white">Bookmakers régulés ANJ</h2>
                <p className="mx-auto mt-2 max-w-md text-xs text-white/30">
                  Agréés par l&apos;Autorité Nationale des Jeux. Obligatoires pour les joueurs résidant en France.
                  Sécurité maximale, fonds protégés.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {anj.map((book) => (
                <BookmakerCard key={book.id} book={book} variant="anj" />
              ))}
            </div>
          </section>
        )}

        {/* ═══════════ INFO SECTION ═══════════ */}
        <section className="mt-16">
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.06] p-8"
            style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 100%)" }}
          >
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-2xl ring-1 ring-emerald-500/20">💡</span>
              <h3 className="mt-4 text-lg font-extrabold text-white">Comment choisir son bookmaker ?</h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/40">
                Si vous résidez en France, vous devez utiliser un bookmaker agréé ANJ (Betclic, Unibet, Winamax).
                Si vous êtes au Canada, en Espagne ou dans un autre pays, les bookmakers internationaux offrent 
                généralement de meilleures cotes et plus de marchés disponibles.
              </p>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/40">
                Notre conseil : inscrivez-vous sur au moins 2 bookmakers pour toujours profiter de la meilleure cote 
                sur chaque pronostic. C&apos;est la base d&apos;une gestion de bankroll efficace.
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════ CTA ═══════════ */}
        <section className="mt-12 text-center">
          <p className="text-sm text-neutral-500">
            Tous les bookmakers présentés sont utilisés quotidiennement par notre tipster.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/fr/pronostics"
              className="w-full rounded-xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 hover:shadow-emerald-500/40 sm:w-auto"
            >
              Voir les pronostics
            </Link>
            <Link
              href="/fr/statistiques"
              className="w-full rounded-xl border border-neutral-300 px-8 py-4 text-sm font-semibold text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 sm:w-auto"
            >
              Consulter les statistiques
            </Link>
          </div>
        </section>

        {books.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-4xl">🏦</p>
            <p className="mt-2 text-sm opacity-50">Liste des bookmakers bientôt disponible</p>
          </div>
        )}
      </main>
    </>
  );
}

// ─── Bookmaker Card Component ────────────────────────────────

interface BookmakerCardProps {
  book: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    affiliate_url: string | null;
    is_arjel: boolean;
    rating: number | null;
    country: string | null;
    bonus_fr: string | null;
  };
  variant: "international" | "anj";
}

function BookmakerCard({ book, variant }: BookmakerCardProps) {
  const accentColor = variant === "anj" ? "#3b82f6" : "#f59e0b";
  const badgeClass = variant === "anj"
    ? "bg-blue-500/20 text-blue-400"
    : "bg-amber-500/20 text-amber-400";
  const badgeLabel = variant === "anj" ? "ANJ 🇫🇷" : "International 🌍";

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] transition hover:-translate-y-1 hover:shadow-xl"
      style={{ background: "linear-gradient(135deg, #111111 0%, #0a0a0a 100%)" }}
    >
      {/* Accent line */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />

      {/* Logo section */}
      <div className="flex flex-col items-center px-6 pt-6">
        <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.06]">
          <img
            src={book.logo_url || `/bookmakers/${book.slug}.png`}
            alt={book.name}
            className="h-full w-full object-cover"
          />
        </div>
        <h3 className="mt-3 text-lg font-extrabold text-white">{book.name}</h3>
        <span className={`mt-1.5 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col px-6 pb-6 pt-4">
        {book.rating && book.rating > 0 && (
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`text-sm ${i < Math.round(book.rating ?? 0) ? "text-amber-400" : "text-white/10"}`}>★</span>
            ))}
            <span className="ml-1 text-xs font-bold text-white/30">{book.rating}/5</span>
          </div>
        )}

        {book.bonus_fr && (
          <div className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/60">Bonus</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-400">{book.bonus_fr}</p>
          </div>
        )}

        {book.country && (
          <p className="mt-3 text-center text-[10px] text-white/20">Licence : {book.country}</p>
        )}

        {/* CTA */}
        <div className="mt-auto pt-4">
          {book.affiliate_url ? (
            <a
              href={book.affiliate_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
              style={{
                background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor})`,
                boxShadow: `0 4px 14px ${accentColor}40`,
              }}
            >
              S&apos;inscrire
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          ) : (
            <Link
              href={`/fr/bookmakers/${book.slug}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/50 transition hover:border-white/20 hover:text-white/70"
            >
              En savoir plus
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}