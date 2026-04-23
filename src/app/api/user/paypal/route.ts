// src/app/api/user/paypal/route.ts
// Update paypal_email du user connect\u00e9

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { paypal_email } = body;

  // Validation basique email
  if (paypal_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypal_email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }

  try {
    await supabaseAdmin
      .from("users")
      .update({ paypal_email: paypal_email || null })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[paypal] error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}