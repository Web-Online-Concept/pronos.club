/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIPickDetailsTrigger
 * ═══════════════════════════════════════════════════════════════════
 *
 * Wrapper client qui affiche un bouton "Détails" et gère l'ouverture
 * de la modale.
 * Utilisé dans les cards (server components) pour porter l'état client.
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import AIPickDetailsModal from "./AIPickDetailsModal";


interface OddsComparisonItem {
  book: string;
  odds: number;
}


interface PickData {
  id: string;
  pick_type: "classic" | "scorer";
  sport: string;
  league: string;
  event_name: string;
  event_date: string;
  selection: string;
  market: string;
  odds: number | null;
  odds_bookmaker: string | null;
  odds_comparison: OddsComparisonItem[] | null;
  reasoning: string;
  ai_confidence: number;
  status: "pending" | "won" | "lost" | "void";
  final_score: string | null;
}


interface Props {
  pick: PickData;
  locale: string;
}


export default function AIPickDetailsTrigger({ pick, locale }: Props) {
  const t = useTranslations("ai_picks");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/btn mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/70 backdrop-blur transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
      >
        <span>{t("modal_trigger_label")}</span>
        <ChevronRight
          size={14}
          strokeWidth={2.5}
          className="transition-transform group-hover/btn:translate-x-0.5"
        />
      </button>

      {open && (
        <AIPickDetailsModal
          pick={pick}
          locale={locale}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}