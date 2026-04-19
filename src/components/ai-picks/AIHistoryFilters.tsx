/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIHistoryFilters
 * ═══════════════════════════════════════════════════════════════════
 *
 * Filtres pour la page Historique : type, statut, sport.
 * Client component : met à jour les URL query params.
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";


interface Props {
  currentType: string;
  currentStatus: string;
  currentSport: string;
  locale: string;
}


export default function AIHistoryFilters({
  currentType,
  currentStatus,
  currentSport,
}: Props) {
  const t = useTranslations("ai_picks");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateFilter(key: "type" | "status" | "sport", value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Reset page=1 quand on change de filtre
    params.delete("page");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <div className="mb-8 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Filtre type */}
        <FilterGroup
          label={t("history_filter_type_label")}
          value={currentType}
          onChange={(v) => updateFilter("type", v)}
          options={[
            { value: "all", label: t("history_filter_all") },
            { value: "classic", label: t("tab_classics") },
            { value: "scorer", label: t("tab_scorers") },
          ]}
        />

        {/* Filtre statut */}
        <FilterGroup
          label={t("history_filter_status_label")}
          value={currentStatus}
          onChange={(v) => updateFilter("status", v)}
          options={[
            { value: "all", label: t("history_filter_all") },
            { value: "awaiting", label: t("status_awaiting") },
            { value: "won", label: t("status_won") },
            { value: "lost", label: t("status_lost") },
            { value: "void", label: t("status_void") },
          ]}
        />

        {/* Filtre sport */}
        <FilterGroup
          label={t("history_filter_sport_label")}
          value={currentSport}
          onChange={(v) => updateFilter("sport", v)}
          options={[
            { value: "all", label: t("history_filter_all") },
            { value: "soccer", label: t("sport_soccer") },
            { value: "tennis", label: t("sport_tennis") },
            { value: "basketball", label: t("sport_basketball") },
          ]}
        />
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// SUB-COMPOSANT — FilterGroup (dropdown)
// ═══════════════════════════════════════════════════════════════════

function FilterGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 transition hover:border-neutral-600 focus:border-cyan-500 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}