/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIHistoryFilters (pattern tipster)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 3 pills compactes qui tiennent sur UNE ligne sur mobile.
 * Calqué sur le pattern exact du tipster : max-w-[110px] + truncate
 * + labels courts mobile (isMobile state).
 * ═══════════════════════════════════════════════════════════════════
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";


interface Props {
  currentStatus: string;
  currentSport: string;
  locale: string;
}


export default function AIHistoryFilters({
  currentStatus,
  currentSport,
}: Props) {
  const t = useTranslations("ai_picks");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function updateFilter(key: "status" | "sport", value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }

  return (
    <div className="mb-6 text-center">
      <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">

        {/* Filtre sport */}
        <select
          value={currentSport}
          onChange={(e) => updateFilter("sport", e.target.value)}
          className="max-w-[110px] cursor-pointer truncate rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:max-w-none sm:px-4 sm:py-2 sm:text-xs"
        >
          <option value="all">{isMobile ? t("history_filter_sports_short") : t("history_filter_all_sports")}</option>
          <option value="soccer">{t("sport_soccer")}</option>
          <option value="tennis">{t("sport_tennis")}</option>
          <option value="basketball">{t("sport_basketball")}</option>
        </select>

        {/* Filtre statut */}
        <select
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="max-w-[110px] cursor-pointer truncate rounded-full border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold sm:max-w-none sm:px-4 sm:py-2 sm:text-xs"
        >
          <option value="all">{isMobile ? t("history_filter_statuses_short") : t("history_filter_all_statuses")}</option>
          <option value="awaiting">{t("status_awaiting")}</option>
          <option value="won">{t("status_won")}</option>
          <option value="lost">{t("status_lost")}</option>
          <option value="void">{t("status_void")}</option>
        </select>
      </div>
    </div>
  );
}