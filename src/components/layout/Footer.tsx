import Link from "next/link";
import Image from "next/image";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";

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
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "footer" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  const { data: socialLinks } = await supabaseAdmin
    .from("social_links")
    .select("platform, url, username")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const socials = socialLinks ?? [];

  const NAV_LINKS = [
    { href: `/${locale}/pronostics`, label: tn("pronos") },
    { href: `/${locale}/historique`, label: tn("history_short") },
    { href: `/${locale}/statistiques`, label: tn("stats_short") },
    { href: `/${locale}/tipster`, label: tn("tipster_short") },
    { href: `/${locale}/bookmakers`, label: tn("books") },
    { href: `/${locale}/bilans`, label: tn("bilans_short") },
    { href: `/${locale}/blog`, label: tn("blog_short") },
    { href: `/${locale}/livescore`, label: "Scores" },
    { href: `/${locale}/news`, label: "News" },
    { href: `/${locale}/videos`, label: "Vidéos" },
  ];

  return (
    <footer className="border-t border-emerald-900/50 text-neutral-400" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-4 lg:gap-10">
          {/* Brand — full width on mobile */}
          <div className="text-center lg:text-left">
            <div className="flex justify-center lg:justify-start">
              <Image
                src="/pronos_club.png"
                alt="PRONOS.CLUB"
                width={200}
                height={160}
                className="h-[60px] w-auto lg:h-[100px]"
                style={{ width: "auto" }}
              />
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              {t("brand_desc")}
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
                    className={`flex items-center justify-center rounded-lg bg-neutral-800 text-sm transition hover:bg-emerald-600 ${
                      social.platform === "twitter" ? "gap-1.5 px-3 h-9" : "h-9 w-9"
                    }`}
                    title={social.platform === "twitter" ? "Twitter X" : (social.username || social.platform)}
                  >
                    {SOCIAL_ICONS[social.platform] || "🔗"}
                    {social.platform === "twitter" && <span className="text-xs font-semibold text-neutral-300">Twitter</span>}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Navigation / Compte / Légal — 3 colonnes même sur mobile */}
          <div className="col-span-1 grid grid-cols-3 gap-4 lg:col-span-3 lg:gap-10">

          {/* Navigation */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {t("nav_title")}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[11px] transition hover:text-emerald-400 sm:text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Compte */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {t("account_title")}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { href: `/${locale}/login`, label: t("account_login") },
                { href: `/${locale}/abonnement`, label: t("account_premium") },
                { href: `/${locale}/espace`, label: t("account_space") },
                { href: `/${locale}/espace/notifications`, label: t("account_notif") },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[11px] transition hover:text-emerald-400 sm:text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Légal */}
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              {t("legal_title")}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {[
                { href: `/${locale}/mentions-legales`, label: t("legal_mentions") },
                { href: `/${locale}/cgu`, label: t("legal_cgu") },
                { href: `/${locale}/cgv`, label: t("legal_cgv") },
                { href: `/${locale}/confidentialite`, label: t("legal_privacy") },
                { href: `/${locale}/jeu-responsable`, label: t("legal_responsible") },
                { href: `/${locale}/contact`, label: t("legal_contact") },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-[11px] transition hover:text-emerald-400 sm:text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-emerald-900/40 pt-6 text-center text-xs text-neutral-600">
          <p>{t("bottom_copy", { year: new Date().getFullYear() })}</p>
          <p className="mt-1">{t("bottom_risk")}</p>
          <p className="mt-1">{t("bottom_phone")}</p>
        </div>
      </div>
    </footer>
  );
}