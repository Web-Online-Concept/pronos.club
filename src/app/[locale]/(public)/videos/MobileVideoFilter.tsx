// src/app/[locale]/(public)/videos/MobileVideoFilter.tsx
"use client";

import { useRouter } from "next/navigation";

interface Channel {
  channel_id: string;
  name: string;
}

interface Props {
  locale: string;
  category?: string;
  channelId?: string;
  channels: Channel[];
  labels: { all: string; tipsters: string; medias: string };
}

export default function MobileVideoFilter({ locale, category, channelId, channels, labels }: Props) {
  const router = useRouter();

  const buildUrl = (cat?: string, ch?: string) => {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (ch) params.set("channel", ch);
    const qs = params.toString();
    return `/${locale}/videos${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mt-6 flex flex-col items-center gap-2 sm:hidden">
      {/* Filtre catégorie */}
      <select
        value={category || ""}
        onChange={(e) => router.push(buildUrl(e.target.value || undefined, undefined))}
        className="cursor-pointer rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 outline-none"
      >
        <option value="" className="bg-neutral-900 text-white">{labels.all}</option>
        <option value="tipster" className="bg-neutral-900 text-white">🎯 {labels.tipsters}</option>
        <option value="media" className="bg-neutral-900 text-white">📺 {labels.medias}</option>
      </select>

      {/* Filtre chaîne */}
      {channels.length > 0 && (
        <select
          value={channelId || ""}
          onChange={(e) => router.push(buildUrl(category || undefined, e.target.value || undefined))}
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
      )}
    </div>
  );
}