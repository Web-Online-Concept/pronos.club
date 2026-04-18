/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — PronosIACard
 * ═══════════════════════════════════════════════════════════════════
 *
 * Card sombre réutilisable dans les pages Pronos IA.
 * Même esprit que les cards des pages Calculateurs / Matched Betting
 * mais avec l'accent bleu-violet propre à la section Pronos IA.
 *
 * Utilisation :
 *   <PronosIACard accent="violet">
 *     [contenu]
 *   </PronosIACard>
 *
 * Accent disponibles :
 *   - "violet"  : accent IA par défaut (#8b5cf6)
 *   - "blue"    : accent secondaire (#3b82f6)
 *   - "cyan"    : accent info
 *   - "emerald" : accent succès (won)
 *   - "red"     : accent échec (lost)
 *   - "neutral" : sans accent (void)
 *   - "amber"   : en attente (pending)
 * ═══════════════════════════════════════════════════════════════════
 */

import type { ReactNode } from "react";


export type PronosIAAccent =
  | "violet"
  | "blue"
  | "cyan"
  | "emerald"
  | "red"
  | "neutral"
  | "amber";


const ACCENT_COLORS: Record<PronosIAAccent, string> = {
  violet: "#8b5cf6",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  emerald: "#10b981",
  red: "#ef4444",
  neutral: "#64748b",
  amber: "#f59e0b",
};


interface Props {
  children: ReactNode;
  accent?: PronosIAAccent;
  hoverable?: boolean;
  className?: string;
}


export default function PronosIACard({
  children,
  accent = "violet",
  hoverable = false,
  className = "",
}: Props) {
  const accentColor = ACCENT_COLORS[accent];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] p-5 sm:p-6 ${
        hoverable
          ? "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:border-white/[0.15]"
          : ""
      } ${className}`}
      style={{
        background: `linear-gradient(135deg, #0a0a0a 0%, ${accentColor}0c 100%)`,
      }}
    >
      {/* Barre lumineuse en haut (signature style) */}
      <div
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
        }}
      />

      {/* Glow au hover */}
      {hoverable && (
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${accentColor}15 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Contenu */}
      <div className="relative">{children}</div>
    </div>
  );
}