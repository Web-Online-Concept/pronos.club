"use client";

import { useState, useEffect } from "react";
import EspaceHero from "@/components/layout/EspaceHero";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  username: string;
}

const PLATFORM_STYLES: Record<string, { icon: string; label: string; color: string; hoverBg: string; borderColor: string; bgGradient: string }> = {
  twitter: {
    icon: "𝕏",
    label: "X / Twitter",
    color: "#000000",
    hoverBg: "hover:bg-black hover:text-white",
    borderColor: "border-neutral-300",
    bgGradient: "from-neutral-50 to-neutral-100/50",
  },
  telegram: {
    icon: "✈️",
    label: "Telegram",
    color: "#2AABEE",
    hoverBg: "hover:bg-[#2AABEE] hover:text-white",
    borderColor: "border-sky-200",
    bgGradient: "from-sky-50 to-sky-100/50",
  },
  instagram: {
    icon: "📸",
    label: "Instagram",
    color: "#E4405F",
    hoverBg: "hover:bg-[#E4405F] hover:text-white",
    borderColor: "border-pink-200",
    bgGradient: "from-pink-50 to-pink-100/50",
  },
  youtube: {
    icon: "▶️",
    label: "YouTube",
    color: "#FF0000",
    hoverBg: "hover:bg-[#FF0000] hover:text-white",
    borderColor: "border-red-200",
    bgGradient: "from-red-50 to-red-100/50",
  },
  tiktok: {
    icon: "🎵",
    label: "TikTok",
    color: "#000000",
    hoverBg: "hover:bg-black hover:text-white",
    borderColor: "border-neutral-300",
    bgGradient: "from-neutral-50 to-neutral-100/50",
  },
  discord: {
    icon: "💬",
    label: "Discord",
    color: "#5865F2",
    hoverBg: "hover:bg-[#5865F2] hover:text-white",
    borderColor: "border-indigo-200",
    bgGradient: "from-indigo-50 to-indigo-100/50",
  },
  facebook: {
    icon: "📘",
    label: "Facebook",
    color: "#1877F2",
    hoverBg: "hover:bg-[#1877F2] hover:text-white",
    borderColor: "border-blue-200",
    bgGradient: "from-blue-50 to-blue-100/50",
  },
  threads: {
    icon: "🧵",
    label: "Threads",
    color: "#000000",
    hoverBg: "hover:bg-black hover:text-white",
    borderColor: "border-neutral-300",
    bgGradient: "from-neutral-50 to-neutral-100/50",
  },
};

const DEFAULT_STYLE = {
  icon: "🔗",
  label: "Lien",
  color: "#059669",
  hoverBg: "hover:bg-emerald-500 hover:text-white",
  borderColor: "border-emerald-200",
  bgGradient: "from-emerald-50 to-emerald-100/50",
};

export default function ReseauxPage() {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/social")
      .then((r) => r.json())
      .then((data) => {
        setLinks(Array.isArray(data) ? data.filter((l: SocialLink & { is_active?: boolean }) => l.is_active !== false) : []);
      })
      .catch(() => {});
    setLoading(false);
  }, []);

  return (
    <>
      <EspaceHero title="Nos Réseaux" />

      <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
        <p className="text-sm text-neutral-500">
          Suivez-nous sur les réseaux sociaux pour ne rien manquer de l&apos;actualité PRONOS.CLUB.
        </p>

        {loading ? (
          <div className="mt-8 flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : links.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-4xl">🌐</p>
            <p className="mt-2 text-sm text-neutral-500 font-semibold">Nos réseaux arrivent bientôt</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {links.map((link) => {
              const style = PLATFORM_STYLES[link.platform] || DEFAULT_STYLE;
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center gap-4 rounded-xl border ${style.borderColor} bg-gradient-to-r ${style.bgGradient} p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${style.hoverBg}`}
                >
                  <span className="text-3xl transition group-hover:scale-110">{style.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-neutral-800 group-hover:text-inherit">{style.label}</p>
                    <p className="text-xs text-neutral-500 group-hover:text-inherit/70">{link.username}</p>
                  </div>
                  <svg className="h-5 w-5 text-neutral-300 transition group-hover:translate-x-1 group-hover:text-inherit" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              );
            })}
          </div>
        )}

        {/* Info */}
        <div className="mt-10 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <p className="text-sm font-semibold text-emerald-800">Restez informé</p>
          <p className="mt-1 text-xs text-emerald-600">
            Suivez-nous sur les réseaux pour les annonces, les résultats en direct et les coulisses de PRONOS.CLUB.
            Activez aussi les notifications dans votre espace pour ne rater aucun pronostic.
          </p>
        </div>
      </main>
    </>
  );
}