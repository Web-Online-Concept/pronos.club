"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const NAV_ITEMS = [
  { href: "/pronostics", labelKey: "pronos", icon: "🎯" },
  { href: "/historique", labelKey: "history", icon: "📋" },
  { href: "/statistiques", labelKey: "stats", icon: "📊" },
  { href: "/espace", labelKey: "account", icon: "👤" },
  { href: "/blog", labelKey: "blog", icon: "✍️" },
];

export default function MobileBottomBar() {
  const pathname = usePathname();
  const t = useTranslations("bottombar");

  // Extract locale from pathname (e.g. /fr/pronostics → fr)
  const segments = pathname.split("/").filter(Boolean);
  const locale = segments[0] || "fr";

  // Hide on homepage: pathname is "/" or "/fr" or "/en" or "/es"
  const isHomepage = pathname === "/" || pathname === `/${locale}` || pathname === `/${locale}/`;
  if (isHomepage) return null;

  return (
    <>
      {/* Spacer to prevent content from hiding behind the bar */}
      <div className="h-16 md:hidden" />

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Top border glow */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

        <div
          className="flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
          style={{ background: "rgba(10, 10, 10, 0.92)" }}
        >
          {NAV_ITEMS.map((item) => {
            const fullHref = `/${locale}${item.href}`;
            const isActive = pathname.startsWith(fullHref);

            return (
              <Link
                key={item.href}
                href={fullHref}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  isActive
                    ? "text-emerald-400"
                    : "text-white/80 active:text-white"
                }`}
              >
                <span className={`text-xl leading-none ${isActive ? "scale-110" : ""} transition-transform`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-semibold ${
                  isActive ? "text-emerald-400" : "text-white/80"
                }`}>
                  {t(item.labelKey)}
                </span>
                {isActive && (
                  <span className="mt-0.5 h-0.5 w-4 rounded-full bg-emerald-400" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}