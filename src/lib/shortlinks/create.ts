/**
 * PRONOS.CLUB — Shortlink Creator (V3.5)
 *
 * Crée des shortlinks /r/[code] pour la diffusion Telegram + X.
 *
 * Usage :
 *   const url = await createPickShortLink({
 *     pickSlug: "arsenal-vs-fulham-epl-09-05-2026",
 *     locale: "fr",
 *     source: "telegram_pick",
 *     utmCampaign: "ia_pick_morning",
 *   });
 *   // Retourne : https://pronos.club/r/x7k2m
 *
 * Lors du clic, /r/[code] redirige (302) vers :
 *   https://pronos.club/fr/pronos-ia/match/arsenal-vs-fulham-epl-09-05-2026
 *     ?utm_source=telegram
 *     &utm_medium=channel
 *     &utm_campaign=ia_pick_morning
 *
 * Stockage en BDD : table pick_short_links (cf. migration).
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

// ============================================================================
// CONFIGURATION
// ============================================================================

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";

/** Nombre de tentatives de génération de code en cas de collision */
const MAX_CODE_RETRIES = 5;

/** Longueur du code court (5 caractères = 60 millions de combinaisons) */
const CODE_LENGTH = 5;

/** Charset pour générer les codes (sans caractères ambigus 0/o/1/l) */
const CODE_CHARSET = "abcdefghjkmnpqrstuvwxyz23456789";

// ============================================================================
// TYPES
// ============================================================================

export type ShortLinkSource =
  | "telegram_pick" // pick fraîchement généré → Telegram public
  | "telegram_bilan" // bilan jour → Telegram public
  | "telegram_bilan_hebdo" // bilan hebdo → Telegram public
  | "x_pick" // pick → X
  | "x_bilan" // bilan jour → X
  | "x_bilan_hebdo"; // bilan hebdo → X

export type CreateShortLinkInput = {
  /** Slug du pick (depuis ai_picks.slug) */
  pickSlug: string;
  /** Locale cible : fr/en/es. Par défaut fr. */
  locale?: "fr" | "en" | "es";
  /** Source de la création (utilisé pour stats + UTM) */
  source: ShortLinkSource;
  /** Campaign UTM (par défaut auto-déduit de source) */
  utmCampaign?: string;
};

export type CreateShortLinkResult = {
  /** URL courte complète : https://pronos.club/r/abc12 */
  shortUrl: string;
  /** Code seul : abc12 */
  code: string;
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Génère un code aléatoire de N caractères depuis le charset défini.
 * Ex: "x7k2m"
 */
const generateRandomCode = (length: number = CODE_LENGTH): string => {
  let code = "";
  for (let i = 0; i < length; i++) {
    const idx = Math.floor(Math.random() * CODE_CHARSET.length);
    code += CODE_CHARSET[idx];
  }
  return code;
};

/**
 * Mapping source → utm_source / utm_medium par défaut.
 */
const buildUtmParams = (
  source: ShortLinkSource,
  campaign?: string
): Record<string, string> => {
  const isTelegram = source.startsWith("telegram_");
  const isX = source.startsWith("x_");

  let utmSource = "telegram";
  let utmMedium = "channel";
  if (isX) {
    utmSource = "x";
    utmMedium = "social";
  } else if (!isTelegram) {
    utmSource = "direct";
    utmMedium = "link";
  }

  // Campaign auto-déduit si pas fourni
  let utmCampaign = campaign ?? "";
  if (!utmCampaign) {
    if (source === "telegram_pick") utmCampaign = "ia_pick";
    else if (source === "telegram_bilan") utmCampaign = "ia_bilan_jour";
    else if (source === "telegram_bilan_hebdo") utmCampaign = "ia_bilan_hebdo";
    else if (source === "x_pick") utmCampaign = "ia_pick_x";
    else if (source === "x_bilan") utmCampaign = "ia_bilan_jour_x";
    else if (source === "x_bilan_hebdo") utmCampaign = "ia_bilan_hebdo_x";
  }

  return {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
  };
};

// ============================================================================
// FONCTION PRINCIPALE
// ============================================================================

/**
 * Crée un shortlink pour un pick et retourne l'URL courte.
 *
 * Stratégie :
 *   1. Génère un code aléatoire 5 chars
 *   2. Tente l'INSERT (PRIMARY KEY = code, donc collision → erreur)
 *   3. En cas de collision, régénère un nouveau code (max 5 tentatives)
 *   4. Si échec persistant → fallback en augmentant à 6 chars
 */
export const createPickShortLink = async (
  input: CreateShortLinkInput
): Promise<CreateShortLinkResult> => {
  const { pickSlug, locale = "fr", source, utmCampaign } = input;
  const utmParams = buildUtmParams(source, utmCampaign);

  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const code = generateRandomCode(CODE_LENGTH);

    const { error } = await supabaseAdmin
      .from("pick_short_links")
      .insert({
        code,
        pick_slug: pickSlug,
        locale,
        source,
        utm_params: utmParams,
        click_count: 0,
      });

    // Code unique inséré avec succès
    if (!error) {
      return {
        shortUrl: `${SITE_BASE_URL}/r/${code}`,
        code,
      };
    }

    // Collision PRIMARY KEY ? On retente.
    // (Postgres : code 23505 = unique_violation)
    const isCollision =
      error.code === "23505" ||
      error.message.toLowerCase().includes("duplicate key");

    if (!isCollision) {
      // Erreur autre que collision → bail out
      lastError = error.message;
      break;
    }

    lastError = error.message;
  }

  // Fallback : code 6 caractères pour éviter la collision sur 5 chars
  const fallbackCode = generateRandomCode(CODE_LENGTH + 1);
  const { error: fallbackError } = await supabaseAdmin
    .from("pick_short_links")
    .insert({
      code: fallbackCode,
      pick_slug: pickSlug,
      locale,
      source,
      utm_params: utmParams,
      click_count: 0,
    });

  if (fallbackError) {
    throw new Error(
      `createPickShortLink failed after ${MAX_CODE_RETRIES} retries + fallback: ${fallbackError.message ?? lastError}`
    );
  }

  return {
    shortUrl: `${SITE_BASE_URL}/r/${fallbackCode}`,
    code: fallbackCode,
  };
};

/**
 * Construit l'URL longue (destination) à partir d'un shortlink record.
 * Utilisé par /r/[code]/route.ts pour la redirection.
 */
export const buildLongUrl = (params: {
  pickSlug: string;
  locale: string;
  utmParams: Record<string, string>;
}): string => {
  const { pickSlug, locale, utmParams } = params;
  const baseUrl = `${SITE_BASE_URL}/${locale}/pronos-ia/match/${pickSlug}`;

  const queryString = new URLSearchParams(utmParams).toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
};