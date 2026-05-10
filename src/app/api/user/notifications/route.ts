/**
 * ═══════════════════════════════════════════════════════════════════
 * /api/user/notifications (V3.5 Lot 14 — granularité Tipster/Abonnés)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Endpoint qui sauvegarde les préférences notifications de l'utilisateur.
 *
 * V3.5 Lot 14 (10/05/2026) :
 *   - Ajout 4 toggles granulaires :
 *     · notify_tipster_push, notify_tipster_email
 *     · notify_abonnes_push, notify_abonnes_email
 *   - Conserve les anciens toggles globaux (notify_push, notify_email,
 *     notify_bilan) pour rétrocompat.
 *   - Logique côté backend (cf. /api/notifications/send et tipster-notifications.ts) :
 *     · Pour publier un pick Tipster → vérifier notify_tipster_push/email
 *     · Pour publier un pick Abonnés → vérifier notify_abonnes_push/email
 *
 * Path : src/app/api/user/notifications/route.ts
 * ═══════════════════════════════════════════════════════════════════
 */

import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const updates: Record<string, boolean> = {};

  // ─── Anciens toggles globaux (rétrocompat) ────────────────────
  if ("notify_email" in body) updates.notify_email = Boolean(body.notify_email);
  if ("notify_push" in body) updates.notify_push = Boolean(body.notify_push);
  if ("notify_bilan" in body) updates.notify_bilan = Boolean(body.notify_bilan);

  // ─── V3.5 Lot 14 — Nouveaux toggles granulaires ───────────────
  if ("notify_tipster_push" in body) {
    updates.notify_tipster_push = Boolean(body.notify_tipster_push);
  }
  if ("notify_tipster_email" in body) {
    updates.notify_tipster_email = Boolean(body.notify_tipster_email);
  }
  if ("notify_abonnes_push" in body) {
    updates.notify_abonnes_push = Boolean(body.notify_abonnes_push);
  }
  if ("notify_abonnes_email" in body) {
    updates.notify_abonnes_email = Boolean(body.notify_abonnes_email);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(updates) });
}