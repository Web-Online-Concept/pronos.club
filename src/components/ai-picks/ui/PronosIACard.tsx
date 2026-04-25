import type { ReactNode } from "react";


export type PronosIAAccent =
  | "violet"
  | "fuchsia"
  | "emerald"
  | "red"
  | "neutral"
  | "amber";


const THEMES: Record<
  PronosIAAccent,
  {
    bgGradient: string;
    topBar: string;
    border: string;
    hoverShadow: string;
  }
> = {
  violet: {
    bgGradient:
      "linear-gradient(180deg, #1a1432 0%, #0f0a24 100%)",
    topBar:
      "linear-gradient(90deg, transparent 0%, #a855f7 30%, #a855f7 70%, transparent 100%)",
    border: "rgba(168, 85, 247, 0.20)",
    hoverShadow: "0 8px 32px -8px rgba(168, 85, 247, 0.4)",
  },
  fuchsia: {
    bgGradient:
      "linear-gradient(180deg, #1f0d24 0%, #14081a 100%)",
    topBar:
      "linear-gradient(90deg, transparent 0%, #e879f9 30%, #e879f9 70%, transparent 100%)",
    border: "rgba(232, 121, 249, 0.20)",
    hoverShadow: "0 8px 32px -8px rgba(232, 121, 249, 0.4)",
  },
  amber: {
    bgGradient:
      "linear-gradient(180deg, #1a1432 0%, #0f0a24 100%)",
    topBar:
      "linear-gradient(90deg, transparent 0%, #fbbf24 30%, #fbbf24 70%, transparent 100%)",
    border: "rgba(251, 191, 36, 0.20)",
    hoverShadow: "0 8px 32px -8px rgba(251, 191, 36, 0.4)",
  },
  emerald: {
    bgGradient:
      "linear-gradient(180deg, #0a1f17 0%, #061410 100%)",
    topBar:
      "linear-gradient(90deg, transparent 0%, #34d399 30%, #34d399 70%, transparent 100%)",
    border: "rgba(52, 211, 153, 0.25)",
    hoverShadow: "0 8px 32px -8px rgba(52, 211, 153, 0.4)",
  },
  red: {
    bgGradient:
      "linear-gradient(180deg, #1f0a0a 0%, #140505 100%)",
    topBar:
      "linear-gradient(90deg, transparent 0%, #f87171 30%, #f87171 70%, transparent 100%)",
    border: "rgba(248, 113, 113, 0.22)",
    hoverShadow: "0 8px 32px -8px rgba(248, 113, 113, 0.4)",
  },
  neutral: {
    bgGradient:
      "linear-gradient(180deg, #1a1a1f 0%, #0f0f14 100%)",
    topBar:
      "linear-gradient(90deg, transparent 0%, #94a3b8 30%, #94a3b8 70%, transparent 100%)",
    border: "rgba(148, 163, 184, 0.18)",
    hoverShadow: "0 8px 32px -8px rgba(148, 163, 184, 0.3)",
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
      className={`group relative overflow-hidden rounded-2xl border shadow-lg ${
        hoverable
          ? "transition-all duration-300 hover:-translate-y-0.5"
          : ""
      } ${className}`}
      style={{
        background: theme.bgGradient,
        borderColor: theme.border,
        boxShadow: hoverable
          ? `0 4px 16px rgba(0, 0, 0, 0.25), inset 0 0 0 1px ${theme.border}`
          : `0 4px 16px rgba(0, 0, 0, 0.25), inset 0 0 0 1px ${theme.border}`,
      }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 h-[2px] w-full"
        style={{ background: theme.topBar }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}