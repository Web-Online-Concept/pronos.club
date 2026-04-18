/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AITabs (V2 DESIGN)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tabs Classiques / Buteurs.
 * Style : pills sur fond blanc, gradient bleu-violet pour le tab actif.
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


export default function AITabs({
  classicsCount,
  scorersCount,
  classicsContent,
  scorersContent,
}: Props) {
  const t = useTranslations("ai_picks");

  // Default : tab avec le plus de picks
  const [activeTab, setActiveTab] = useState<"classics" | "scorers">(
    classicsCount >= scorersCount ? "classics" : "scorers",
  );

  return (
    <div>
      {/* Tabs */}
      <div
        role="tablist"
        aria-label={t("tabs_aria_label")}
        className="mb-6 flex justify-center"
      >
        <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 p-1 shadow-sm">
          <TabButton
            active={activeTab === "classics"}
            onClick={() => setActiveTab("classics")}
            label={t("tab_classics")}
            count={classicsCount}
          />
          <TabButton
            active={activeTab === "scorers"}
            onClick={() => setActiveTab("scorers")}
            label={t("tab_scorers")}
            count={scorersCount}
          />
        </div>
      </div>

      {/* Contenu */}
      <div
        role="tabpanel"
        aria-label={activeTab === "classics" ? t("tab_classics") : t("tab_scorers")}
      >
        {activeTab === "classics" ? classicsContent : scorersContent}
      </div>
    </div>
  );
}


function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
        active
          ? "text-white shadow-md"
          : "text-neutral-600 hover:text-neutral-900"
      }`}
      style={
        active
          ? {
              background:
                "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
            }
          : undefined
      }
    >
      <span>{label}</span>
      <span
        className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
          active ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}