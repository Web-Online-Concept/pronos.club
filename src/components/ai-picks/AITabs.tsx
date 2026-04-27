/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AITabs (V2 DESIGN, simplifie)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Le module Buteurs ayant ete retire, ce composant rend simplement
 * le contenu des picks classiques sans onglets.
 *
 * Les props scorersCount et scorersContent sont conservees pour
 * retrocompatibilite avec les imports existants, mais ne sont plus
 * utilisees.
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import type { ReactNode } from "react";


interface Props {
  classicsCount: number;
  scorersCount: number;
  classicsContent: ReactNode;
  scorersContent: ReactNode;
  locale: string;
}


export default function AITabs({
  classicsContent,
}: Props) {
  return <div>{classicsContent}</div>;
}