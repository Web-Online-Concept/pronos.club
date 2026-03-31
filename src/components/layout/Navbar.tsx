"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

function FlagFR({ className = "h-5 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="213.3" height="480" fill="#002395" />
      <rect x="213.3" width="213.4" height="480" fill="#fff" />
      <rect x="426.7" width="213.3" height="480" fill="#ed2939" />
    </svg>
  );
}

function FlagGB({ className = "h-5 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <path fill="#012169" d="M0 0h640v480H0z" />
      <path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 64V0z" />
      <path fill="#C8102E" d="m424 281 216 159v40L369 281zm-184 20 6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z" />
      <path fill="#FFF" d="M241 0v480h160V0zM0 160v160h640V160z" />
      <path fill="#C8102E" d="M0 193v96h640v-96zM273 0v480h96V0z" />
    </svg>
  );
}

function FlagES({ className = "h-5 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg">
      <rect width="640" height="480" fill="#c60b1e" />
      <rect y="120" width="640" height="240" fill="#ffc400" />
    </svg>
  );
}

const LOCALES = [
  { code: "fr", label: "FR", Flag: FlagFR },
  { code: "en", label: "EN", Flag: FlagGB },
  { code: "es", label: "ES", Flag: FlagES },
];

export default function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const NAV_LINKS = [
    { href: `/${locale}/pronostics`, label: t("pronos") },
    { href: `/${locale}/historique`, label: t("history_short") },
    { href: `/${locale}/statistiques`, label: t("stats_short") },
    { href: `/${locale}/bilans`, label: t("bilans_short") },
    { href: `/${locale}/tipster`, label: t("tipster_short") },
    { href: `/${locale}/bookmakers`, label: t("books") },
    { href: `/${locale}/blog`, label: t("blog_short") },
  ];

  const currentFlag = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function switchLocale(newLocale: string) {
    const segments = pathname.split("/");
    if (LOCALES.some((l) => l.code === segments[1])) {
      segments[1] = newLocale;
    } else {
      segments.splice(1, 0, newLocale);
    }
    router.push(segments.join("/"));
    setLangOpen(false);
  }

  return (
    <>
      <style jsx global>{`
        .nav-pill-dark {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .nav-pill-dark:hover {
          background: #059669;
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        }
        .cta-emerald {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          background: #059669;
        }
        .cta-emerald:hover {
          background: #10b981;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35);
        }
        .cta-outline {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .cta-outline:hover {
          background: rgba(5, 150, 105, 0.15);
          border-color: #10b981;
          color: #10b981;
          transform: translateY(-1px);
        }
      `}</style>

      <header
        className="sticky top-0 z-50 border-b border-emerald-900/50 shadow-lg shadow-black/20"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <nav className="mx-auto flex h-[70px] max-w-6xl items-center justify-between px-4 lg:h-[100px]">
          {/* Mobile hamburger — LEFT */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-300 transition hover:bg-neutral-800 lg:hidden"
            aria-label="Menu"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center">
            <Image
              src="/pronos_club.png"
              alt="PRONOS.CLUB"
              width={200}
              height={160}
              className="h-[55px] w-auto lg:h-[100px]"
              style={{ width: "auto" }}
              priority
            />
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-2 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-pill-dark rounded-xl px-4 py-2.5 text-base font-semibold text-neutral-300"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA + Lang */}
          <div className="hidden items-center gap-3 lg:flex">
            {authLoading ? (
              <div className="h-11 w-32 animate-pulse rounded-xl bg-white/10" />
            ) : user ? (
              <Link
                href={`/${locale}/espace`}
                className="cta-emerald flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-base font-bold text-white"
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                    {(user.pseudo || user.email || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                {user.pseudo || t("my_space")}
              </Link>
            ) : (
              <Link
                href={`/${locale}/login`}
                className="cta-emerald rounded-xl px-6 py-3 text-base font-bold text-white"
              >
                {t("login_btn")}
              </Link>
            )}

            {/* Language selector */}
            <div className="ml-1" ref={langRef}>
              <div className="relative">
                <button
                  onClick={() => setLangOpen(!langOpen)}
                  className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm cursor-pointer transition hover:border-emerald-600 hover:bg-neutral-800"
                >
                  <currentFlag.Flag className="h-4 w-6 rounded-sm shadow-sm" />
                  <span className="text-xs font-semibold text-neutral-400">{currentFlag.label}</span>
                  <svg
                    className={`h-3 w-3 text-neutral-500 transition-transform ${langOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {langOpen && (
                  <div className="absolute right-0 top-full z-50 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900 shadow-xl shadow-black/30">
                    {LOCALES.map((loc) => (
                      <button
                        key={loc.code}
                        onClick={() => switchLocale(loc.code)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm !cursor-pointer transition hover:bg-neutral-800 ${
                          loc.code === locale ? "bg-neutral-800 font-semibold text-emerald-400" : "text-neutral-300"
                        }`}
                      >
                        <loc.Flag className="h-4 w-6 rounded-sm shadow-sm" />
                        <span>{loc.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile spacer — keeps logo centered */}
          <div className="w-10 lg:hidden" />
        </nav>

        {/* Mobile drawer overlay */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* Mobile drawer — slide from left */}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-[90vw] transform bg-neutral-950 shadow-2xl shadow-black/50 transition-transform duration-300 ease-in-out lg:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4">
              <Image
                src="/pronos_club.png"
                alt="PRONOS.CLUB"
                width={120}
                height={96}
                className="h-[40px] w-auto"
                style={{ width: "auto" }}
              />
              <button
                onClick={() => setMenuOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="flex flex-col gap-0.5">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-emerald-600/20 hover:text-emerald-400"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Drawer footer — lang + CTA */}
            <div className="border-t border-neutral-800 px-4 pb-5 pt-4">
              {/* Lang selector */}
              <div className="flex gap-2">
                {LOCALES.map((loc) => (
                  <button
                    key={loc.code}
                    onClick={() => {
                      switchLocale(loc.code);
                      setMenuOpen(false);
                    }}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                      loc.code === locale
                        ? "border-emerald-600 bg-emerald-600/15 font-semibold text-emerald-400"
                        : "border-neutral-700 text-neutral-400 hover:border-emerald-600 hover:bg-neutral-800"
                    }`}
                  >
                    <loc.Flag className="h-3.5 w-5 rounded-sm" />
                    <span>{loc.label}</span>
                  </button>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-3">
                {authLoading ? (
                  <div className="h-12 animate-pulse rounded-xl bg-white/10" />
                ) : user ? (
                  <Link
                    href={`/${locale}/espace`}
                    onClick={() => setMenuOpen(false)}
                    className="cta-emerald flex items-center justify-center gap-2.5 rounded-xl px-3 py-3 text-sm font-bold text-white"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover ring-2 ring-white/20"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                        {(user.pseudo || user.email || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    {user.pseudo || t("my_space")}
                  </Link>
                ) : (
                  <Link
                    href={`/${locale}/login`}
                    onClick={() => setMenuOpen(false)}
                    className="cta-emerald block rounded-xl px-3 py-3 text-center text-sm font-bold text-white"
                  >
                    {t("login_btn")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}