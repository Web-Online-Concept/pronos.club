// src/app/[locale]/(public)/news/DesktopSportSelect.tsx
"use client";

import { useRouter } from "next/navigation";

interface Props {
  locale: string;
  sport?: string;
  sports: { value: string; icon: string; label: string }[];
  allLabel: string;
}

export default function DesktopSportSelect({ locale, sport, sports, allLabel }: Props) {
  const router = useRouter();

  return (
    <select
      value={sport || ""}
      onChange={(e) => {
        const val = e.target.value;
        router.push(val ? `/${locale}/news?sport=${val}` : `/${locale}/news`);
      }}
      className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 outline-none transition hover:border-white/20"
    >
      <option value="" className="bg-neutral-900 text-white">{allLabel}</option>
      {sports.map((s) => (
        <option key={s.value} value={s.value} className="bg-neutral-900 text-white">
          {s.icon} {s.label}
        </option>
      ))}
    </select>
  );
}