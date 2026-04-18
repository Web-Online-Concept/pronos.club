/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIDisclaimer (V2 DESIGN)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Disclaimer légal Pronos IA (adapté au fond blanc).
 * Mode compact (1 ligne) ou complet (plusieurs paragraphes).
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";
import { AlertTriangle, Phone } from "lucide-react";


interface Props {
  locale: string;
  compact?: boolean;
}


export default async function AIDisclaimer({ locale, compact = false }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  if (compact) {
    return (
      <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-amber-900">
          <span className="inline-flex items-center gap-1.5 font-bold">
            <AlertTriangle size={14} strokeWidth={2.5} className="text-amber-600" />
            <span>{t("disclaimer_compact_title")}</span>
          </span>
          <span className="text-amber-700">·</span>
          <span>{t("disclaimer_compact_text")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-300/60 bg-amber-50/80 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
          <AlertTriangle size={20} strokeWidth={2.5} className="text-amber-700" />
        </div>
        <div className="flex-1">
          <h4 className="mb-1.5 text-sm font-bold text-amber-900">
            {t("disclaimer_full_title")}
          </h4>
          <p className="text-xs leading-relaxed text-amber-900/80">
            {t("disclaimer_full_text")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white/60 px-2.5 py-1 font-semibold text-amber-900">
              <span>🔞</span>
              <span>{t("disclaimer_age_restriction")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white/60 px-2.5 py-1 font-semibold text-amber-900">
              <Phone size={12} strokeWidth={2.5} />
              <span>{t("disclaimer_help_line")}</span>
              <span className="font-mono">09 74 75 13 13</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}