import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SOCIAL_ICONS: Record<string, string> = {
  twitter: "𝕏",
  telegram: "✈️",
  instagram: "📸",
  youtube: "▶️",
  tiktok: "🎵",
  discord: "💬",
  facebook: "📘",
  threads: "🧵",
};

export default async function Footer() {
  const { data: socialLinks } = await supabaseAdmin
    .from("social_links")
    .select("platform, url, username")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const socials = socialLinks ?? [];

  return (
    <footer className="border-t border-emerald-900/50 text-neutral-400" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="flex justify-center">
              <Image
                src="/pronos_club.png"
                alt="PRONOS.CLUB"
                width={200}
                height={160}
                className="h-[100px] w-auto"
                style={{ width: "auto", height: "100px" }}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              Pronostics sportifs transparents et vérifiables.
              Chaque pick est publié avec preuve avant le match.
            </p>

            {/* Social icons */}
            {socials.length > 0 && (
              <div className="mt-4 flex justify-center gap-2">
                {socials.map((social) => (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-800 text-sm transition hover:bg-emerald-600"
                    title={social.username}
                  >
                    {SOCIAL_ICONS[social.platform] || "🔗"}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Navigation
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { href: "/fr/pronostics", label: "Pronos" },
                { href: "/fr/historique", label: "Historique" },
                { href: "/fr/statistiques", label: "Stats" },
                { href: "/fr/bilans", label: "Bilans" },
                { href: "/fr/tipster", label: "Tipster" },
                { href: "/fr/bookmakers", label: "Books" },
                { href: "/fr/blog", label: "Blog" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm transition hover:text-emerald-400"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Compte */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Mon compte
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { href: "/fr/login", label: "Connexion" },
                { href: "/fr/abonnement", label: "Abonnement Premium" },
                { href: "/fr/espace", label: "Mon espace" },
                { href: "/fr/espace/notifications", label: "Notifications" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm transition hover:text-emerald-400"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Légal */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Légal
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { href: "/fr/mentions-legales", label: "Mentions légales" },
                { href: "/fr/cgu", label: "CGU" },
                { href: "/fr/cgv", label: "CGV" },
                { href: "/fr/confidentialite", label: "Confidentialité" },
                { href: "/fr/jeu-responsable", label: "Jeu responsable" },
                { href: "/fr/contact", label: "Contact" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm transition hover:text-emerald-400"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-emerald-900/40 pt-6 text-center text-xs text-neutral-600">
          <p>© {new Date().getFullYear()} PRONOS.CLUB — Tous droits réservés</p>
          <p className="mt-1">
            Les paris sportifs comportent des risques. Jouez responsablement. 18+
          </p>
          <p className="mt-1">
            Appelez le 09 74 75 13 13 (appel non surtaxé)
          </p>
        </div>
      </div>
    </footer>
  );
}