import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/emails";
import { sendAdminAlert } from "@/lib/admin-alerts";
import { NextResponse } from "next/server";

// POST — auto-create user profile if auth user exists but no profile
export async function POST() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser || !authUser.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if profile already exists
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", authUser.id)
    .single();

  if (existing) {
    // Profile exists — fetch and return it
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();
    return NextResponse.json(profile);
  }

  // Detect locale from referer or default to fr
  const referer = new URL(
    (await supabase.auth.getSession()).data.session?.user?.app_metadata?.locale ||
    "https://pronos.club/fr"
  ).pathname;
  const localeMatch = referer.match(/^\/(fr|en|es)(\/|$)/);
  const locale = (localeMatch?.[1] as "fr" | "en" | "es") ?? "fr";

  const displayName = authUser.email.split("@")[0];

  // Create profile with service role (bypasses RLS)
  const { data: newUser, error } = await supabaseAdmin
    .from("users")
    .insert({
      id: authUser.id,
      email: authUser.email,
      display_name: displayName,
      locale,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send welcome email
  await sendWelcomeEmail(authUser.email, displayName, locale).catch(() => {});

  // Alert admins
  sendAdminAlert("new_signup", {
    email: authUser.email,
    name: displayName,
    extra: `Langue : ${locale.toUpperCase()}`,
  }).catch(() => {});

  return NextResponse.json(newUser);
}