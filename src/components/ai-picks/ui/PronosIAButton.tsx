/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — PronosIAButton
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bouton futuriste Pronos IA avec gradient bleu→violet + shimmer animé.
 * Utilisable comme <button> ou <Link>.
 *
 * Variants :
 *   - "primary"   : gradient bleu→violet plein (CTA principal)
 *   - "secondary" : bordure gradient, fond sombre (CTA secondaire)
 *   - "ghost"     : minimal, juste texte (petit lien)
 *
 * Sizes :
 *   - "sm" : compact
 *   - "md" : standard (défaut)
 *   - "lg" : gros CTA
 * ═══════════════════════════════════════════════════════════════════
 */

import Link from "next/link";
import type { ReactNode } from "react";


type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";


interface BaseProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

interface ButtonProps extends BaseProps {
  href?: never;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

interface LinkProps extends BaseProps {
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
}

type Props = ButtonProps | LinkProps;


const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};


export default function PronosIAButton(props: Props) {
  const { children, variant = "primary", size = "md", className = "" } = props;

  const sizeClass = SIZE_CLASSES[size];

  const baseClass =
    "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full font-semibold transition-all duration-200";

  const variantClass =
    variant === "primary"
      ? "text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
      : variant === "secondary"
        ? "text-white border border-white/20 bg-neutral-900/80 backdrop-blur hover:bg-neutral-800 hover:border-white/40"
        : "text-neutral-700 hover:text-neutral-900";

  const primaryStyle = {
    background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #a855f7 100%)",
  };

  const content = (
    <>
      {/* Shimmer animé (variant primary uniquement) */}
      {variant === "primary" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
            animation: "shimmer 3s ease-in-out infinite",
          }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </>
  );

  const mergedClassName = `${baseClass} ${sizeClass} ${variantClass} ${className}`;

  // Variant en mode Link
  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        className={mergedClassName}
        style={variant === "primary" ? primaryStyle : undefined}
      >
        {content}
      </Link>
    );
  }

  // Variant en mode button
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`${mergedClassName} ${props.disabled ? "cursor-not-allowed opacity-50" : ""}`}
      style={variant === "primary" && !props.disabled ? primaryStyle : undefined}
    >
      {content}
    </button>
  );
}