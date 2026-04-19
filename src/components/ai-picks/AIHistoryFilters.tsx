/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIHistoryFilters (style pill arrondi)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Filtres pour la page Historique : type, sport, statut.
 * Style aligné sur le tipster : 3 pills blanches arrondies.
 * Tient sur une ligne sur mobile (texte compact + padding réduit).
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
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3">

      <FilterPill
        value={currentType}
        onChange={(v) => updateFilter("type", v)}
        options={[
          { value: "all", label: t("history_filter_all_types") },
          { value: "classic", label: t("tab_classics") },
          { value: "scorer", label: t("tab_scorers") },
        ]}
      />

      <FilterPill
        value={currentSport}
        onChange={(v) => updateFilter("sport", v)}
        options={[
          { value: "all", label: t("history_filter_all_sports") },
          { value: "soccer", label: t("sport_soccer") },
          { value: "tennis", label: t("sport_tennis") },
          { value: "basketball", label: t("sport_basketball") },
        ]}
      />

      <FilterPill
        value={currentStatus}
        onChange={(v) => updateFilter("status", v)}
        options={[
          { value: "all", label: t("history_filter_all_statuses") },
          { value: "awaiting", label: t("status_awaiting") },
          { value: "won", label: t("status_won") },
          { value: "lost", label: t("status_lost") },
          { value: "void", label: t("status_void") },
        ]}
      />
    </div>
  );
}


function FilterPill({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer rounded-full border border-neutral-200 bg-white py-2 pl-3 pr-7 text-[11px] font-medium text-neutral-700 shadow-sm transition hover:border-neutral-300 focus:border-violet-500 focus:outline-none sm:pl-4 sm:pr-10 sm:text-sm"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-500 sm:right-3 sm:h-4 sm:w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}