// src/app/api/tipster-picks/route.ts
// CRUD public picks + filtrage + upload image

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { notifyFollowersOfNewPick } from "@/lib/tipster-notifications";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("id, pseudo, avatar_url, subscription_status")
    .eq("id", user.id)
    .single();

  return profile;
}

function computeUnitsResult(result: string | null, odds: number): number | null {
  if (!result) return null;
  const o = parseFloat(String(odds));
  switch (result) {
    case "won":       return Math.round((o - 1) * 1000) / 1000;
    case "half_won":  return Math.round(((o - 1) / 2) * 1000) / 1000;
    case "refunded":  return 0;
    case "half_lost": return -0.5;
    case "lost":      return -1;
    default: return null;
  }
}

// ── GET — List picks ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "live"; // live | resolved | mine | all | pseudo
  const sport = searchParams.get("sport");
  const pseudo = searchParams.get("pseudo");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  try {
    let query = supabaseAdmin
      .from("tipster_picks")
      .select(`
        *,
        users:user_id (id, pseudo, avatar_url)
      `);

    if (filter === "live") {
      // picks live avec match_date >= maintenant
      query = query
        .eq("status", "live")
        .gte("match_date", new Date().toISOString())
        .order("match_date", { ascending: true });
    } else if (filter === "resolved") {
      query = query
        .eq("status", "resolved")
        .order("resolved_at", { ascending: false });
    } else if (filter === "mine") {
      const user = await getAuthUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      query = query
        .eq("user_id", user.id)
        .in("status", ["live", "resolved"])
        .order("submitted_at", { ascending: false });
    } else if (filter === "pseudo" && pseudo) {
      const { data: targetUser } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("pseudo", pseudo)
        .single();
      if (!targetUser) return NextResponse.json({ picks: [] });
      query = query
        .eq("user_id", targetUser.id)
        .in("status", ["live", "resolved"])
        .order("submitted_at", { ascending: false });
    } else if (filter === "all") {
      query = query
        .in("status", ["live", "resolved"])
        .order("submitted_at", { ascending: false });
    }

    if (sport) {
      query = query.eq("sport", sport);
    }

    query = query.limit(limit);

    const { data: picks, error } = await query;

    if (error) {
      console.error("[tipster-picks] GET error:", error.message);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ picks: picks || [] });

  } catch (err: any) {
    console.error("[tipster-picks] GET error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST — Create pick with image upload ──
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.subscription_status !== "active" && user.subscription_status !== "trialing") {
    return NextResponse.json({ error: "Premium uniquement" }, { status: 403 });
  }

  try {
    const formData = await req.formData();

    const matchDate = formData.get("match_date") as string;
    const sport = formData.get("sport") as string;
    const odds = parseFloat(formData.get("odds") as string);
    const pickType = formData.get("pick_type") as string;
    const imageFile = formData.get("image") as File | null;

    // Validations
    if (!matchDate) return NextResponse.json({ error: "Date du match requise" }, { status: 400 });
    if (!sport) return NextResponse.json({ error: "Sport requis" }, { status: 400 });
    if (!odds || odds <= 1) return NextResponse.json({ error: "Cote invalide (> 1.00)" }, { status: 400 });
    if (odds > 5) return NextResponse.json({ error: "Cote trop élevée (max 5.00)" }, { status: 400 });
    if (!pickType || !["simple", "combiné"].includes(pickType)) {
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }
    if (!imageFile || !(imageFile instanceof File)) {
      return NextResponse.json({ error: "Image requise" }, { status: 400 });
    }
    if (imageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image trop lourde (max 5 Mo)" }, { status: 400 });
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
      return NextResponse.json({ error: "Format image invalide (JPG, PNG, WEBP)" }, { status: 400 });
    }

    // Anti-cheating : match_date doit être >= maintenant + 5 minutes
    const matchTimestamp = new Date(matchDate).getTime();
    const now = Date.now();
    if (matchTimestamp < now + 5 * 60 * 1000) {
      return NextResponse.json({
        error: "Le match doit commencer dans au moins 5 minutes"
      }, { status: 400 });
    }

    // Limite 3 picks/jour
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabaseAdmin
      .from("tipster_picks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("submitted_at", todayStart.toISOString());

    if ((todayCount || 0) >= 3) {
      return NextResponse.json({
        error: "Limite de 3 pronos par jour atteinte"
      }, { status: 429 });
    }

    // Upload image dans Storage
    const ext = imageFile.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("tipster-picks")
      .upload(fileName, buffer, {
        contentType: imageFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[tipster-picks] Upload error:", uploadError.message);
      return NextResponse.json({ error: "Erreur upload image" }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("tipster-picks")
      .getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    // Créer le pick
    const { data: pick, error: insertError } = await supabaseAdmin
      .from("tipster_picks")
      .insert({
        user_id: user.id,
        match_date: matchDate,
        sport,
        odds,
        pick_type: pickType,
        image_url: imageUrl,
        status: "live",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[tipster-picks] Insert error:", insertError.message);
      // Rollback : supprimer l'image uploadée
      await supabaseAdmin.storage.from("tipster-picks").remove([fileName]);
      return NextResponse.json({ error: "Erreur création" }, { status: 500 });
    }

    // Déclencher les notifs aux followers (fire-and-forget, pas d'await pour ne pas bloquer la réponse)
    notifyFollowersOfNewPick(pick, {
      id: user.id,
      pseudo: user.pseudo || "TIPSTER",
      avatar_url: user.avatar_url || null,
    }).catch((err) => {
      console.error("[tipster-picks] notifyFollowersOfNewPick error:", err);
    });

    return NextResponse.json({ pick });

  } catch (err: any) {
    console.error("[tipster-picks] POST error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE — User can delete his own pick if still 'live' and match not started ──
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pickId = searchParams.get("id");
  if (!pickId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const { data: pick } = await supabaseAdmin
      .from("tipster_picks")
      .select("*")
      .eq("id", pickId)
      .single();

    if (!pick) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (pick.user_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // Un user ne peut supprimer que si live
    if (pick.status !== "live") {
      return NextResponse.json({ error: "Impossible de supprimer un pronostic résolu" }, { status: 400 });
    }

    // Fenêtre de 10 minutes après le post pour corriger une erreur
    const submittedAt = new Date(pick.submitted_at).getTime();
    const tenMinutes = 10 * 60 * 1000;
    if (Date.now() > submittedAt + tenMinutes) {
      return NextResponse.json({
        error: "Suppression impossible après 10 minutes. Les followers ont pu le voir — pour corriger, contacte l'admin."
      }, { status: 400 });
    }

    // Match pas encore commencé (sécurité supplémentaire)
    const matchStart = new Date(pick.match_date).getTime();
    if (matchStart < Date.now()) {
      return NextResponse.json({ error: "Le match a déjà commencé" }, { status: 400 });
    }

    // Supprimer l'image du storage
    if (pick.image_url) {
      const pathMatch = pick.image_url.match(/\/tipster-picks\/(.+)$/);
      if (pathMatch) {
        await supabaseAdmin.storage.from("tipster-picks").remove([pathMatch[1]]);
      }
    }

    await supabaseAdmin.from("tipster_picks").delete().eq("id", pickId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[tipster-picks] DELETE error:", err.message);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}