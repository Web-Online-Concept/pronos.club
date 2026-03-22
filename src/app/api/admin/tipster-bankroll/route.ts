import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

const CONFIG_KIND = "tipster_bankroll";

const DEFAULT_CONFIG = {
  mode: "units_only",
  initial_bankroll: 0,
  current_bankroll: 0,
  unit_value: 0,
  unit_percent: 0,
  auto_recalc: "none",
  show_on_site: false,
  initial_unit_count: 0,
};

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("configs")
      .select("blob_json")
      .eq("kind", CONFIG_KIND)
      .single();

    if (!data?.blob_json) {
      return NextResponse.json(DEFAULT_CONFIG);
    }

    // Merge with defaults to fill any missing fields
    return NextResponse.json({ ...DEFAULT_CONFIG, ...data.blob_json });
  } catch {
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Merge with defaults so we always have a complete config
  const config = { ...DEFAULT_CONFIG, ...body };

  // Try upsert first
  const { data, error } = await supabaseAdmin
    .from("configs")
    .upsert(
      { kind: CONFIG_KIND, blob_json: config },
      { onConflict: "kind" }
    )
    .select("blob_json")
    .single();

  if (error) {
    // Fallback: try delete + insert if upsert fails (no UNIQUE constraint)
    await supabaseAdmin.from("configs").delete().eq("kind", CONFIG_KIND);
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("configs")
      .insert({ kind: CONFIG_KIND, blob_json: config })
      .select("blob_json")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(inserted.blob_json);
  }

  return NextResponse.json(data.blob_json);
}