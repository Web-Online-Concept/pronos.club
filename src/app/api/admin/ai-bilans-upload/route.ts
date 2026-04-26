import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * ═══════════════════════════════════════════════════════════════════
 * API Admin — /api/admin/ai-bilans-upload
 * ═══════════════════════════════════════════════════════════════════
 *
 * Clone du pattern /api/admin/bilans-upload Tipster, adapté pour le
 * bucket Storage `ai-bilans-covers` (séparé de `bilans` Tipster).
 *
 * POST ?path=<filepath> + FormData (file)
 *   → upload vers ai-bilans-covers
 *   → retourne { url: publicUrl }
 * ═══════════════════════════════════════════════════════════════════
 */

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to Supabase Storage (bucket dédié IA)
  const { error } = await supabaseAdmin.storage
    .from("ai-bilans-covers")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage
    .from("ai-bilans-covers")
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}