/**
 * ═══════════════════════════════════════════════════════════════════
 * ROUTE API — POST /api/admin/ai-picks/[id]/void
 * ═══════════════════════════════════════════════════════════════════
 *
 * Passe un pick en status='void' avec une raison admin.
 * Réservé aux admins (auth par email via adminCheck.ts).
 * ═══════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth admin (cohérent avec le layout admin qui utilise user.is_admin)
  const user = await getCurrentUser();
  if (!user || !user.is_admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID manquant" }, { status: 400 });
  }

  // Parse body
  let body: { reason?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const reason = body.reason?.trim();
  const category = body.category?.trim() || "other";

  if (!reason) {
    return NextResponse.json(
      { error: "Raison obligatoire" },
      { status: 400 },
    );
  }

  // Update du pick
  const { error } = await supabaseAdmin
    .from("ai_picks")
    .update({
      status: "void",
      audit_reason: `[ADMIN ${user.email}] ${reason}`,
      audit_category: category,
      audited_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("[admin void] Erreur update:", error);
    return NextResponse.json(
      { error: `Erreur Supabase: ${error.message}` },
      { status: 500 },
    );
  }

  console.log(`[admin] Pick ${id} annulé par ${user.email} — ${category}: ${reason}`);

  return NextResponse.json({ success: true });
}