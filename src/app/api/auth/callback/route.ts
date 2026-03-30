import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/emails";
import { NextResponse } from "next/server";

const VALID_LOCALES = ["fr", "en", "es"] as const;

function detectLocale(next: string): "fr" | "en" | "es" {
  // Extract locale from redirect path: /en/espace → "en"
  const match = next.match(/^\/(fr|en|es)(\/|$)/);
  return (match?.[1] as "fr" | "en" | "es") ?? "fr";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/fr";
  const locale = detectLocale(next);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Auto-create user profile if not exists
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: existingUser } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("id", authUser.id)
          .single();

        if (!existingUser) {
          await supabaseAdmin.from("users").insert({
            id: authUser.id,
            email: authUser.email,
            display_name: authUser.email?.split("@")[0] ?? "User",
            locale,
          });

          // Send welcome email in user's locale
          if (authUser.email) {
            const displayName = authUser.email.split("@")[0];
            await sendWelcomeEmail(authUser.email, displayName, locale).catch(() => {});
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/fr?error=auth`);
}