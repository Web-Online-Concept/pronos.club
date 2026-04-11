// src/app/[locale]/(public)/videos/MobileVideoFilter.tsx
"use client";

import { useRouter } from "next/navigation";

interface Channel {
  channel_id: string;
  name: string;
}

interface Props {
  locale: string;
  channelId?: string;
  channels: Channel[];
  labels: { all: string };
}

export default function MobileVideoFilter({ locale, channelId, channels, labels }: Props) {
  const router = useRouter();

  return (
    <select
      value={channelId || ""}
      onChange={(e) => {
        const val = e.target.value;
        router.push(val ? `/${locale}/videos?channel=${val}` : `/${locale}/videos`);
      }}
      className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 outline-none"
    >
      <option value="" className="bg-neutral-900 text-white">
        {locale === "fr" ? "Toutes les chaînes" : locale === "es" ? "Todos los canales" : "All channels"}
      </option>
      {channels.map((c) => (
        <option key={c.channel_id} value={c.channel_id} className="bg-neutral-900 text-white">
          {c.name}
        </option>
      ))}
    </select>
  );
}