// src/app/[locale]/(public)/videos/DesktopChannelSelect.tsx
"use client";

import { useRouter } from "next/navigation";

interface Props {
  locale: string;
  channelId?: string;
  channels: { channel_id: string; name: string }[];
  allLabel: string;
}

export default function DesktopChannelSelect({ locale, channelId, channels, allLabel }: Props) {
  const router = useRouter();

  return (
    <select
      value={channelId || ""}
      onChange={(e) => {
        const val = e.target.value;
        router.push(val ? `/${locale}/videos?channel=${val}` : `/${locale}/videos`);
      }}
      className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/70 outline-none transition hover:border-white/20"
    >
      <option value="" className="bg-neutral-900 text-white">{allLabel}</option>
      {channels.map((c) => (
        <option key={c.channel_id} value={c.channel_id} className="bg-neutral-900 text-white">
          {c.name}
        </option>
      ))}
    </select>
  );
}