// src/components/admin/AdminPronosAbonnesNav.tsx
"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

type Page = "picks" | "gains" | "config";

export default function AdminPronosAbonnesNav({ active }: { active: Page }) {
  const locale = useLocale();

  const linkClass = (isActive: boolean) =>
    `text-sm font-bold transition ${
      isActive
        ? "text-emerald-600"
        : "text-neutral-500 hover:text-neutral-900"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Link
        href={`/${locale}/admin/pronos-abonnes/picks`}
        className={linkClass(active === "picks")}
      >
        🎯 Picks
      </Link>
      <Link
        href={`/${locale}/admin/pronos-abonnes/gains`}
        className={linkClass(active === "gains")}
      >
        💰 Gains
      </Link>
      <Link
        href={`/${locale}/admin/pronos-abonnes/config`}
        className={linkClass(active === "config")}
      >
        ⚙️ Config
      </Link>
      <span className="text-neutral-300">|</span>
      <Link
        href={`/${locale}/admin`}
        className="text-sm font-bold text-neutral-500 hover:text-neutral-900"
      >
        ← Admin
      </Link>
    </div>
  );
}