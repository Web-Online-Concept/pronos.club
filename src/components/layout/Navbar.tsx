"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { Link, usePathname } from "@/i18n/navigation";

export function Navbar() {
  const t = useTranslations("nav");
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: "/pronostics" as const, label: t("picks") },
    { href: "/historique" as const, label: t("history") },
    { href: "/statistiques" as const, label: t("stats") },
    { href: "/tipster" as const, label: t("tipster") },
    { href: "/bookmakers" as const, label: t("bookmakers") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-lg font-black tracking-tight">
          PRONOS<span className="text-emerald-500">.CLUB</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition hover:opacity-100 ${
                pathname === link.href ? "font-semibold opacity-100" : "opacity-60"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          ) : user ? (
            <>
              {user.is_admin && (
                <Link
                  href="/admin"
                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800"
                >
                  {t("admin")}
                </Link>
              )}
              <Link
                href="/espace"
                className="text-sm font-medium opacity-70 transition hover:opacity-100"
              >
                {t("dashboard")}
              </Link>
              <button
                onClick={signOut}
                className="text-sm opacity-50 transition hover:opacity-100"
              >
                {t("logout") ?? "Logout"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm opacity-60 transition hover:opacity-100"
              >
                {t("login")}
              </Link>
              <Link
                href="/abonnement"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                {t("subscribe")}
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
