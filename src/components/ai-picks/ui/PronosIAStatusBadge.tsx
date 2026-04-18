/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — PronosIAStatusBadge
 * ═══════════════════════════════════════════════════════════════════
 *
 * Badge de statut pour un pick.
 * Utilise les icônes lucide-react pour un rendu propre sur fond sombre.
 * ═══════════════════════════════════════════════════════════════════
 */

import { CircleCheck, CircleX, CircleMinus, Clock } from "lucide-react";


type Status = "pending" | "won" | "lost" | "void";


interface Props {
  status: Status;
  label: string;
  size?: "sm" | "md";
}


export default function PronosIAStatusBadge({ status, label, size = "md" }: Props) {
  const config = {
    pending: {
      Icon: Clock,
      bg: "bg-amber-500/15",
      border: "border-amber-400/40",
      text: "text-amber-300",
    },
    won: {
      Icon: CircleCheck,
      bg: "bg-emerald-500/15",
      border: "border-emerald-400/40",
      text: "text-emerald-300",
    },
    lost: {
      Icon: CircleX,
      bg: "bg-red-500/15",
      border: "border-red-400/40",
      text: "text-red-300",
    },
    void: {
      Icon: CircleMinus,
      bg: "bg-neutral-500/15",
      border: "border-neutral-400/40",
      text: "text-neutral-300",
    },
  }[status];

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  const iconSize = size === "sm" ? 12 : 14;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${sizeClasses} ${config.bg} ${config.border} ${config.text}`}
    >
      <config.Icon size={iconSize} strokeWidth={2.5} />
      <span>{label}</span>
    </span>
  );
}