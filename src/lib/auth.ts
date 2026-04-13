import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/supabase/types";

// Emails admin autorisés — seule source de vérité
const ADMIN_EMAILS = ["flotoulouse7@gmail.com", "jeromebollaert@gmail.com"];

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return data as User | null;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  // Vérification par email — jamais par colonne DB manipulable
  if (!ADMIN_EMAILS.includes(user.email)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}