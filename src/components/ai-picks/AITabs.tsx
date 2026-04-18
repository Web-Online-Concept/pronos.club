/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AITabs
 * ═══════════════════════════════════════════════════════════════════
 *
 * Onglets Classiques / Buteurs pour la page Pronos IA.
 *
 * Particularité : client component (nécessite state pour l'onglet actif).
 * Les cards sont rendues en SERVER depuis la page parent,
 * puis passées en props via classicsContent / scorersContent.
 * Cela évite de re-hydrater les cards côté client.
 *
 * Usage :
 *   <AITabs
 *     classicsCount={5}
 *     scorersCount={3}
 *     classicsContent={<ServerRenderedCards />}
 *     scorersContent={<ServerRenderedCards />}
 *     locale="fr"
 *   />
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";


interface Props {
  classicsCount: number;
  scorersCount: number;
  classicsContent: ReactNode;
  scorersContent: ReactNode;
  locale: string;
}

type Tab = "classics" | "scorers";


export default function AITabs({
  classicsCount,
  scorersCount,
  classicsContent,
  scorersContent,
}: Props) {
  const t = useTranslations("ai_picks");

  // Tab par défaut : classiques si au moins 1, sinon scorers
  const [activeTab, setActiveTab] = useState<Tab>(
    classicsCount > 0 ? "classics" : "scorers",
  );

  return (
    <div>
      {/* ═══ HEADER ONGLETS ═══ */}
      <div
        role="tablist"
        aria-label={t("tabs_aria_label")}
        className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-1.5"
      >
        <TabButton
          label={t("tab_classics")}
          count={classicsCount}
          active={activeTab === "classics"}
          onClick={() => setActiveTab("classics")}
        />
        <TabButton
          label={t("tab_scorers")}
          count={scorersCount}
          active={activeTab === "scorers"}
          onClick={() => setActiveTab("scorers")}
        />
      </div>

      {/* ═══ CONTENU ONGLET ACTIF ═══ */}
      <div
        role="tabpanel"
        aria-label={activeTab === "classics" ? t("tab_classics") : t("tab_scorers")}
      >
        {activeTab === "classics" ? classicsContent : scorersContent}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// TAB BUTTON — bouton individuel
// ═══════════════════════════════════════════════════════════════════

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
        active
          ? "bg-emerald-500/15 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)]"
          : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
      }`}
    >
      <span>{label}</span>
      <span
        className={`inline-flex min-w-[24px] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
          active
            ? "bg-emerald-500/25 text-emerald-100"
            : "bg-neutral-800 text-neutral-400"
        }`}
      >
        {count}
      </span>
    </button>
  );
}