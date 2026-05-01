import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { pseudo, avatar_url } = body;

  // Pseudo : trim + validation (espaces parasites = bug que ca a deja cree)
  let cleanPseudo: string | null = null;
  if (pseudo !== null && pseudo !== undefined) {
    if (typeof pseudo !== "string") {
      return NextResponse.json({ error: "Pseudo invalide" }, { status: 400 });
    }
    const trimmed = pseudo.trim();
    if (trimmed.length === 0) {
      cleanPseudo = null;
    } else {
      if (trimmed.length < 2) {
        return NextResponse.json({ error: "Pseudo trop court (2 caracteres minimum)" }, { status: 400 });
      }
      if (trimmed.length > 30) {
        return NextResponse.json({ error: "Pseudo trop long (30 caracteres maximum)" }, { status: 400 });
      }
      cleanPseudo = trimmed;
    }
  }

  const { error } = await supabase
    .from("users")
    .update({
      pseudo: cleanPseudo,
      avatar_url: avatar_url ?? null,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}