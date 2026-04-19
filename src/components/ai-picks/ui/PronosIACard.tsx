/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — PronosIACard (V3 PUNCHY)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Card Pronos IA avec fond bleu-violet intense + halos lumineux.
 * Style : tableau de bord crypto/gaming premium.
 *
 * Chaque accent produit une ambiance différente :
 *  - violet  : Pronos IA par défaut (bleu profond → violet intense)
 *  - emerald : pick gagné (vert profond → émeraude)
 *  - red     : pick perdu (rouge profond → écarlate)
 *  - neutral : pick annulé (gris profond → ardoise)
 *  - amber   : pending (bleu-violet comme défaut)
 * ═══════════════════════════════════════════════════════════════════
 */

import type { ReactNode } from "react";


export type PronosIAAccent = "violet" | "fuchsia" | "emerald" | "red" | "neutral" | "amber";


const THEMES: Record<
  PronosIAAccent,
  {
    bgGradient: string;
    glowTopRight: string;
    glowBottomLeft: string;
    topBar: string;
    border: string;
  }
> = {
  violet: {
    bgGradient:
      "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
    glowTopRight:
      "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.35) 0%, transparent 50%)",
    glowBottomLeft:
      "radial-gradient(circle at 0% 100%, rgba(59, 130, 246, 0.25) 0%, transparent 50%)",
    topBar: "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
    border: "rgba(168, 85, 247, 0.25)",
  },
  fuchsia: {
    bgGradient:
      "linear-gradient(135deg, #0f0515 0%, #3b0764 35%, #6b21a8 70%, #a21caf 100%)",
    glowTopRight:
      "radial-gradient(circle at 100% 0%, rgba(232, 121, 249, 0.40) 0%, transparent 50%)",
    glowBottomLeft:
      "radial-gradient(circle at 0% 100%, rgba(168, 85, 247, 0.25) 0%, transparent 50%)",
    topBar: "linear-gradient(90deg, transparent 0%, #e879f9 30%, #c026d3 70%, transparent 100%)",
    border: "rgba(232, 121, 249, 0.3)",
  },
  amber: {
    bgGradient:
      "linear-gradient(135deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #4c1d95 100%)",
    glowTopRight:
      "radial-gradient(circle at 100% 0%, rgba(168, 85, 247, 0.35) 0%, transparent 50%)",
    glowBottomLeft:
      "radial-gradient(circle at 0% 100%, rgba(59, 130, 246, 0.25) 0%, transparent 50%)",
    topBar: "linear-gradient(90deg, transparent 0%, #a855f7 30%, #3b82f6 70%, transparent 100%)",
    border: "rgba(168, 85, 247, 0.25)",
  },
  emerald: {
    bgGradient:
      "linear-gradient(135deg, #022c22 0%, #064e3b 35%, #065f46 70%, #047857 100%)",
    glowTopRight:
      "radial-gradient(circle at 100% 0%, rgba(52, 211, 153, 0.35) 0%, transparent 50%)",
    glowBottomLeft:
      "radial-gradient(circle at 0% 100%, rgba(16, 185, 129, 0.25) 0%, transparent 50%)",
    topBar: "linear-gradient(90deg, transparent 0%, #34d399 30%, #10b981 70%, transparent 100%)",
    border: "rgba(52, 211, 153, 0.3)",
  },
  red: {
    bgGradient:
      "linear-gradient(135deg, #1a0505 0%, #450a0a 35%, #7f1d1d 70%, #991b1b 100%)",
    glowTopRight:
      "radial-gradient(circle at 100% 0%, rgba(248, 113, 113, 0.3) 0%, transparent 50%)",
    glowBottomLeft:
      "radial-gradient(circle at 0% 100%, rgba(239, 68, 68, 0.2) 0%, transparent 50%)",
    topBar: "linear-gradient(90deg, transparent 0%, #f87171 30%, #ef4444 70%, transparent 100%)",
    border: "rgba(248, 113, 113, 0.25)",
  },
  neutral: {
    bgGradient:
      "linear-gradient(135deg, #0a0a0a 0%, #1e293b 35%, #334155 70%, #475569 100%)",
    glowTopRight:
      "radial-gradient(circle at 100% 0%, rgba(148, 163, 184, 0.2) 0%, transparent 50%)",
    glowBottomLeft:
      "radial-gradient(circle at 0% 100%, rgba(100, 116, 139, 0.15) 0%, transparent 50%)",
    topBar: "linear-gradient(90deg, transparent 0%, #94a3b8 30%, #64748b 70%, transparent 100%)",
    border: "rgba(148, 163, 184, 0.2)",
  },
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
  const theme = THEMES[accent];

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-5 sm:p-6 shadow-2xl ${
        hoverable
          ? "transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_60px_-15px_rgba(168,85,247,0.4)]"
          : ""
      } ${className}`}
      style={{
        background: theme.bgGradient,
        borderColor: theme.border,
      }}
    >
      {/* Halo lumineux top-right (ambiance "lumière qui vient d'en haut à droite") */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: theme.glowTopRight }}
      />

      {/* Halo lumineux bottom-left (seconde lumière pour la profondeur) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: theme.glowBottomLeft }}
      />

      {/* Bordure lumineuse en haut (signature) */}
      <div
        aria-hidden
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{ background: theme.topBar }}
      />

      {/* Grain/noise subtil pour texture (optionnel, très léger) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Glow extra au hover */}
      {hoverable && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.15) 0%, transparent 60%)",
          }}
        />
      )}

      {/* Contenu */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}