/**
 * PRONOS.CLUB — Shortlink Resolver /r/[code] (V3.5)
 *
 * Endpoint de redirection pour les liens courts utilisés dans les posts
 * Telegram public + X.
 *
 * Flow :
 *   1. GET /r/[code]
 *   2. Lookup en BDD : récupère pick_slug + locale + utm_params
 *   3. Increment click_count + last_clicked_at
 *   4. Construit l'URL longue avec UTM injectés
 *   5. Redirect 302 vers la page dossier
 *
 * Cas d'erreur :
 *   - Code inconnu → redirect 302 vers /fr/pronos-ia (page liste)
 *   - Erreur BDD → log + redirect 302 vers /fr/pronos-ia (fallback gracieux)
 *
 * Path : src/app/r/[code]/route.ts
 *
 * IMPORTANT : Ce fichier est en dehors du dossier [locale] car les liens
 * courts sont language-agnostic. Le locale destination est stocké en BDD
 * dans pick_short_links.locale.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildLongUrl } from "@/lib/shortlinks/create";

// ============================================================================
// CONFIGURATION NEXT.JS
// ============================================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pronos.club";

/** URL fallback en cas de code inconnu ou erreur BDD */
const FALLBACK_URL = `${SITE_BASE_URL}/fr/pronos-ia`;

// ============================================================================
// TYPES
// ============================================================================

type RouteParams = {
  params: Promise<{ code: string }>;
};

// ============================================================================
// GET HANDLER
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { code } = await params;

  if (!code || typeof code !== "string" || code.length < 4 || code.length > 12) {
    console.warn(`[shortlink] Code invalide reçu : "${code}"`);
    return NextResponse.redirect(FALLBACK_URL, 302);
  }

  try {
    // ─── STEP 1 : Lookup du shortlink
    const { data, error } = await supabaseAdmin
      .from("pick_short_links")
      .select("pick_slug, locale, utm_params, click_count")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error(`[shortlink] DB error for code "${code}":`, error.message);
      return NextResponse.redirect(FALLBACK_URL, 302);
    }

    if (!data) {
      console.warn(`[shortlink] Code "${code}" introuvable, redirect fallback`);
      return NextResponse.redirect(FALLBACK_URL, 302);
    }

    // ─── STEP 2 : Increment click_count + last_clicked_at
    // Note : pas atomique côté Postgres (on lit puis on update). Acceptable
    // pour notre volume (quelques clics par minute max). Si besoin d'atomicité
    // plus tard, on pourra utiliser une RPC Postgres ou la fonction increment().
    const newClickCount = (data.click_count ?? 0) + 1;
    const updatePromise = supabaseAdmin
      .from("pick_short_links")
      .update({
        click_count: newClickCount,
        last_clicked_at: new Date().toISOString(),
      })
      .eq("code", code);

    // On ne await pas le update : on redirige tout de suite, l'update se fait
    // en arrière-plan. Si ça échoue on perd 1 clic dans les stats, pas grave.
    updatePromise.then(({ error: updErr }) => {
      if (updErr) {
        console.warn(
          `[shortlink] Increment failed for code "${code}":`,
          updErr.message
        );
      }
    });

    // ─── STEP 3 : Construction URL longue + redirect
    const utmParams =
      typeof data.utm_params === "object" && data.utm_params !== null
        ? (data.utm_params as Record<string, string>)
        : {};

    const longUrl = buildLongUrl({
      pickSlug: data.pick_slug,
      locale: data.locale ?? "fr",
      utmParams,
    });

    return NextResponse.redirect(longUrl, 302);
  } catch (err) {
    console.error(
      `[shortlink] Exception pour code "${code}":`,
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.redirect(FALLBACK_URL, 302);
  }
}