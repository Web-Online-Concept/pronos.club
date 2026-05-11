"use client";

/**
 * ═══════════════════════════════════════════════════════════════════
 * AuthProvider (fix React #418 — 11/05/2026)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Fix React error #418 (hydratation mismatch) :
 *   Avant ce fix, useState lisait localStorage au mount via initializer :
 *     const [user, setUser] = useState(() => getCachedUser());
 *   Côté SSR : localStorage n'existe pas → user=null, loading=true
 *   Côté CSR : cache rempli → user={...}, loading=false
 *   → Mismatch d'hydratation détecté par React sur tous les composants
 *     qui dépendent de useAuth() (Navbar, MobileBottomBar, etc).
 *
 *   Fix : init à null/true (match SSR), puis lecture cache dans useEffect
 *   qui ne tourne que côté client. Le flash entre l'hydratation et la
 *   lecture cache (<10ms) est invisible. Le Navbar gère déjà l'état
 *   transitoire via le skeleton authLoading.
 *
 * Path : src/components/auth/AuthProvider.tsx
 * ═══════════════════════════════════════════════════════════════════
 */

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/supabase/types";
import type { Session } from "@supabase/supabase-js";

const CACHE_KEY = "pronos_user_cache";

interface CachedUser {
  user: User;
  timestamp: number;
}

function getCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedUser = JSON.parse(raw);
    // Cache valid for 24h max (hard limit even without refresh)
    if (Date.now() - cached.timestamp > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.user;
  } catch {
    return null;
  }
}

function setCachedUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ user, timestamp: Date.now() }));
    } else {
      localStorage.removeItem(CACHE_KEY);
    }
  } catch {}
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ═══════════════════════════════════════════════════════════════
  // Fix #418 — Init SSR-safe : on initialise toujours à null/true
  // pour que le rendu serveur corresponde au premier rendu client.
  // La lecture du cache localStorage se fait dans le useEffect ci-dessous.
  // ═══════════════════════════════════════════════════════════════
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef(createClient());
  const fetchingRef = useRef(false);

  // Wrapper that updates both state and cache
  const updateUser = useCallback((newUser: User | null) => {
    setUser(newUser);
    setCachedUser(newUser);
  }, []);

  // Fetch user profile from DB — auto-create via API if missing
  const fetchOrCreateUserProfile = useCallback(async (authUserId: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const supabase = supabaseRef.current;

      // Try to fetch existing profile
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUserId)
        .single();

      if (data) {
        updateUser(data as User);
      } else {
        // Profile doesn't exist — create via API (uses service role, bypasses RLS)
        const res = await fetch("/api/user/ensure-profile", { method: "POST" });
        if (res.ok) {
          const newUser = await res.json();
          if (newUser && newUser.id) {
            updateUser(newUser as User);
          }
        }
      }
    } catch {
      // Silent fail — keep cached user
    }

    fetchingRef.current = false;
  }, [updateUser]);

  useEffect(() => {
    const supabase = supabaseRef.current;

    // ─── Étape 1 : lire le cache localStorage (client uniquement) ───
    // C'est ce qui était fait dans useState initializer auparavant,
    // mais déplacé ici pour éviter le mismatch SSR/CSR (React error #418).
    const cached = getCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    // ─── Étape 2 : init session Supabase ───
    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session?.user) {
        if (cached && cached.id === session.user.id) {
          // Cache hit — user déjà affiché, on refresh en arrière-plan
          setLoading(false);
          fetchOrCreateUserProfile(session.user.id);
        } else {
          // Cache miss ou user différent — fetch et attente
          await fetchOrCreateUserProfile(session.user.id);
          setLoading(false);
        }
      } else {
        // Pas de session — clear tout
        updateUser(null);
        setLoading(false);
      }
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (event === "SIGNED_OUT") {
        updateUser(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        // Don't set loading to true — keep showing cached user
        fetchOrCreateUserProfile(session.user.id);
      } else {
        updateUser(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchOrCreateUserProfile, updateUser]);

  async function signOut() {
    await supabaseRef.current.auth.signOut();
    updateUser(null);
    setSession(null);
    window.location.href = "/fr";
  }

  async function refreshUser() {
    const currentSession = session;
    if (!currentSession?.user) return;
    fetchOrCreateUserProfile(currentSession.user.id);
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}