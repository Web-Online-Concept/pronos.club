/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPOSANT — AIDisclaimer
 * ═══════════════════════════════════════════════════════════════════
 *
 * Bloc disclaimer permanent affiché sur les pages Pronos IA.
 *
 * 2 modes :
 *  - Mode complet (haut de page) : message complet + 18+ + aide joueurs
 *  - Mode compact (bas de page)  : simple rappel court
 *
 * Couleur amber (jaune-orangé) pour signaler un avertissement
 * sans être anxiogène.
 *
 * Server component.
 * ═══════════════════════════════════════════════════════════════════
 */

import { getTranslations } from "next-intl/server";


interface Props {
  locale: string;
  /** Mode compact = simple rappel en bas de page */
  compact?: boolean;
}


export default async function AIDisclaimer({ locale, compact = false }: Props) {
  const t = await getTranslations({ locale, namespace: "ai_picks" });

  if (compact) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-4 text-center text-xs text-amber-200/70">
        <span className="font-semibold text-amber-300">⚠️ {t("disclaimer_compact_title")}</span>
        <span className="mx-2">·</span>
        <span>{t("disclaimer_compact_text")}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-xl">⚠️</div>
        <div className="flex-1 space-y-2">
          <div className="text-sm font-semibold text-amber-300">
            {t("disclaimer_full_title")}
          </div>
          <p className="text-sm leading-relaxed text-amber-200/80">
            {t("disclaimer_full_text")}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-amber-200/60">
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold text-amber-300">18+</span>
              <span>{t("disclaimer_age_restriction")}</span>
            </span>
            <span className="text-amber-500/40">•</span>
            <span>
              {t("disclaimer_help_line")}{" "}
              <a
                href="https://www.joueurs-info-service.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-200 underline decoration-amber-500/40 hover:decoration-amber-300"
              >
                09 74 75 13 13
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}