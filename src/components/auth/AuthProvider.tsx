"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/supabase/types";
import type { Session } from "@supabase/supabase-js";

const CACHE_KEY = "pronos_user_cache";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes — after this, background refresh

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

// Detect locale from current URL
function detectLocale(): "fr" | "en" | "es" {
  if (typeof window === "undefined") return "fr";
  const match = window.location.pathname.match(/^\/(fr|en|es)(\/|$)/);
  return (match?.[1] as "fr" | "en" | "es") ?? "fr";
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
  // Initialize user from cache IMMEDIATELY — no loading flash
  const [user, setUser] = useState<User | null>(() => getCachedUser());
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(() => getCachedUser() === null);
  const supabaseRef = useRef(createClient());
  const fetchingRef = useRef(false);

  // Wrapper that updates both state and cache
  const updateUser = useCallback((newUser: User | null) => {
    setUser(newUser);
    setCachedUser(newUser);
  }, []);

  // Fetch user profile from DB — auto-create if missing
  const fetchOrCreateUserProfile = useCallback(async (authUser: { id: string; email?: string }) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const supabase = supabaseRef.current;

      // Try to fetch existing profile
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (data) {
        updateUser(data as User);
      } else {
        // Profile doesn't exist — auto-create it
        const locale = detectLocale();
        const displayName = authUser.email?.split("@")[0] ?? "User";

        const { data: newUser } = await supabase
          .from("users")
          .insert({
            id: authUser.id,
            email: authUser.email,
            display_name: displayName,
            locale,
          })
          .select("*")
          .single();

        if (newUser) {
          updateUser(newUser as User);
        }
      }
    } catch {
      // Silent fail — keep cached user
    }

    fetchingRef.current = false;
  }, [updateUser]);

  useEffect(() => {
    const supabase = supabaseRef.current;

    async function initSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(session);

      if (session?.user) {
        // If we have a cached user, show it immediately and refresh in background
        const cached = getCachedUser();
        if (cached && cached.id === session.user.id) {
          // Cache hit — user already displayed, refresh silently
          setLoading(false);
          fetchOrCreateUserProfile(session.user);
        } else {
          // Cache miss or different user — fetch/create and wait
          await fetchOrCreateUserProfile(session.user);
          setLoading(false);
        }
      } else {
        // No session — clear everything
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
        fetchOrCreateUserProfile(session.user);
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
    // Background refresh — never set user to null
    fetchOrCreateUserProfile(currentSession.user);
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