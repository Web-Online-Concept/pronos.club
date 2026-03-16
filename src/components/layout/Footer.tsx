"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-lg font-black tracking-tight">
            PRONOS<span className="text-emerald-500">.CLUB</span>
          </p>
          <div className="flex gap-6 text-sm opacity-50">
            <Link href="/" className="transition hover:opacity-100">
              {t("legal")}
            </Link>
            <Link href="/" className="transition hover:opacity-100">
              {t("privacy")}
            </Link>
            <Link href="/" className="transition hover:opacity-100">
              {t("terms")}
            </Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs opacity-40">
          {t("disclaimer")}
        </p>
        <p className="mt-2 text-center text-xs opacity-30">
          © {new Date().getFullYear()} PRONOS.CLUB — {t("rights")}
        </p>
      </div>
    </footer>
  );
}
