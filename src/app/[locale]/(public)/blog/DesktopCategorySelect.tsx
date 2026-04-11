// src/app/[locale]/(public)/blog/DesktopCategorySelect.tsx
"use client";

import { useRouter } from "next/navigation";

interface Props {
  locale: string;
  category?: string;
  categories: { slug: string; icon: string; label: string }[];
  allLabel: string;
}

export default function DesktopCategorySelect({ locale, category, categories, allLabel }: Props) {
  const router = useRouter();

  return (
    <select
      value={category || ""}
      onChange={(e) => {
        const val = e.target.value;
        router.push(val ? `/${locale}/blog?category=${val}` : `/${locale}/blog`);
      }}
      className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 outline-none transition hover:border-white/20"
    >
      <option value="" className="bg-neutral-900 text-white">{allLabel}</option>
      {categories.map((c) => (
        <option key={c.slug} value={c.slug} className="bg-neutral-900 text-white">
          {c.icon} {c.label}
        </option>
      ))}
    </select>
  );
}