// src/app/[locale]/(public)/videos/page.tsx
// Page publique Vidéos YouTube — grille + modal embed

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import VideoGrid from "./VideoGrid";
import MobileVideoFilter from "./MobileVideoFilter";
import DesktopChannelSelect from "./DesktopChannelSelect";

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const PER_PAGE = 24;

async function getVideos(category?: string, channelId?: string, page: number = 1) {
  const offset = (page - 1) * PER_PAGE;

  let query = supabaseAdmin
    .from("youtube_videos")
    .select("*, youtube_channels!inner(name, logo_url, category, is_active)", { count: "exact" })
    .eq("youtube_channels.is_active", true)
    .order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);

  if (channelId) query = query.eq("channel_id", channelId);
  if (category) query = query.eq("youtube_channels.category", category);

  const { data, count } = await query;
  return { videos: (data || []) as any[], total: count || 0 };
}

async function getChannels() {
  const { data } = await supabaseAdmin
    .from("youtube_channels")
    .select("channel_id, name, logo_url, category")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data || []) as any[];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const titles: Record<string, string> = {
    fr: "Vidéos Sport & Paris — PRONOS.CLUB",
    en: "Sports & Betting Videos — PRONOS.CLUB",
    es: "Vídeos Deportivos & Apuestas — PRONOS.CLUB",
  };
  const descriptions: Record<string, string> = {
    fr: "Les meilleures vidéos sport et paris sportifs, sélectionnées par PRONOS.CLUB.",
    en: "The best sports and betting videos, curated by PRONOS.CLUB.",
    es: "Los mejores vídeos deportivos y de apuestas, seleccionados por PRONOS.CLUB.",
  };
  return { title: titles[locale] || titles.fr, description: descriptions[locale] || descriptions.fr };
}

export default async function VideosPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ category?: string; channel?: string; page?: string }> }) {
  const { locale } = await params;
  const { category, channel: channelId, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1"));
  const [{ videos, total }, channels] = await Promise.all([getVideos(category, channelId, currentPage), getChannels()]);
  const totalPages = Math.ceil(total / PER_PAGE);

  const headings: Record<string, string> = { fr: "Vidéos", en: "Videos", es: "Vídeos" };
  const subtitles: Record<string, string> = {
    fr: "Le meilleur du sport et des paris en vidéo",
    en: "The best of sports and betting in video",
    es: "Lo mejor del deporte y las apuestas en vídeo",
  };
  const filterLabels = {
    all: locale === "es" ? "Todos" : locale === "en" ? "All" : "Tous",
    tipsters: "Tipsters",
    medias: locale === "es" ? "Medios" : locale === "en" ? "Media" : "Médias",
  };
  const emptyMsg: Record<string, string> = {
    fr: "Aucune vidéo pour le moment",
    en: "No videos yet",
    es: "Sin vídeos por el momento",
  };
  const prevLabel: Record<string, string> = { fr: "← Précédent", en: "← Previous", es: "← Anterior" };
  const nextLabel: Record<string, string> = { fr: "Suivant →", en: "Next →", es: "Siguiente →" };

  const pageUrl = (p: number) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (channelId) params.set("channel", channelId);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/${locale}/videos${qs ? `?${qs}` : ""}`;
  };

  // Trouver le nom de la chaîne active
  const activeChannel = channelId ? channels.find((c: any) => c.channel_id === channelId) : null;

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      {/* ═══════════ HERO ═══════════ */}
      <section
        className="relative overflow-hidden border-b border-emerald-900/50"
        style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #062e1f 50%, #0a0a0a 100%)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[400px] w-[400px] rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="absolute -bottom-20 -right-20 h-[300px] w-[300px] rounded-full bg-emerald-400/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-10 text-center sm:py-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-400">🎬 PRONOS.CLUB</p>
          <h1 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{headings[locale] || headings.fr}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/40">{subtitles[locale] || subtitles.fr}</p>

          {/* Mobile filters (Client Component) */}
          <MobileVideoFilter
            locale={locale}
            category={category}
            channelId={channelId}
            channels={channels}
            labels={filterLabels}
          />

          {/* Desktop: pills catégories + chaînes */}
          <div className="mt-8 hidden flex-col items-center gap-3 sm:flex">
            {/* Catégories */}
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={`/${locale}/videos`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  !category && !channelId
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {filterLabels.all}
              </Link>
              <Link
                href={`/${locale}/videos?category=tipster`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  category === "tipster"
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                🎯 Tipsters
              </Link>
              <Link
                href={`/${locale}/videos?category=media`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  category === "media"
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                📺 {filterLabels.medias}
              </Link>
            </div>

            {/* Chaîne — select dropdown (Client Component) */}
            {channels.length > 0 && (
              <div className="flex justify-center">
                <DesktopChannelSelect
                  locale={locale}
                  channelId={channelId}
                  channels={channels.map((c: any) => ({ channel_id: c.channel_id, name: c.name }))}
                  allLabel={locale === "fr" ? "Toutes les chaînes" : locale === "es" ? "Todos los canales" : "All channels"}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        {videos.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-5xl">🎬</p>
            <p className="mt-4 text-lg text-neutral-400">{emptyMsg[locale] || emptyMsg.fr}</p>
          </div>
        ) : (
          <>
            <VideoGrid videos={videos} locale={locale} />

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {currentPage > 1 ? (
                  <Link href={pageUrl(currentPage - 1)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition">
                    {prevLabel[locale] || prevLabel.fr}
                  </Link>
                ) : (
                  <span className="rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-300">{prevLabel[locale] || prevLabel.fr}</span>
                )}

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={pageUrl(p)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      p === currentPage
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {p}
                  </Link>
                ))}

                {currentPage < totalPages ? (
                  <Link href={pageUrl(currentPage + 1)} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition">
                    {nextLabel[locale] || nextLabel.fr}
                  </Link>
                ) : (
                  <span className="rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-300">{nextLabel[locale] || nextLabel.fr}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}