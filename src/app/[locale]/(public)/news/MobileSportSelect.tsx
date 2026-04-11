// src/app/[locale]/(public)/news/MobileSportSelect.tsx
"use client";

import { useRouter } from "next/navigation";

interface Props {
  locale: string;
  sport?: string;
  sports: { value: string; icon: string; label: string }[];
  filterAllLabel: string;
}

export default function MobileSportSelect({ locale, sport, sports, filterAllLabel }: Props) {
  const router = useRouter();

  return (
    <select
      value={sport || ""}
      onChange={(e) => {
        const val = e.target.value;
        router.push(val ? `/${locale}/news?sport=${val}` : `/${locale}/news`);
      }}
      className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 outline-none"
    >
      <option value="" className="bg-neutral-900 text-white">{filterAllLabel}</option>
      {sports.map((s) => (
        <option key={s.value} value={s.value} className="bg-neutral-900 text-white">
          {s.icon} {s.label}
        </option>
      ))}
    </select>
  );
}