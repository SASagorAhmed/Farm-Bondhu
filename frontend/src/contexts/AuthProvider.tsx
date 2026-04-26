import React, { useState, useEffect, useCallback } from "react";
import { api, readSession, API_BASE, type AppSession, clearStoredSession } from "@/api/client";
import { AuthContext, type User, type SignupData, type UserRole } from "./auth-context";

type MeResult = { ok: true; user: User } | { ok: false; error: string };

/** Loads app user from Express `GET /api/v1/me` (Bearer = access_token in localStorage). */
async function fetchMe(): Promise<MeResult> {
  const s = readSession();
  if (!s?.access_token) return { ok: false, error: "No session token" };
  try {
    const r = await fetch(`${API_BASE}/v1/me`, {
      headers: { Authorization: `Bearer ${s.access_token}` },
    });
    const text = await r.text();
    let body: { user?: User; error?: string } = {};
    try {
      body = text ? (JSON.parse(text) as { user?: User; error?: string }) : {};
    } catch {
      body = { error: text?.slice(0, 200) || `HTTP ${r.status}` };
    }
    if (r.status === 401 || r.status === 403) {
      clearStoredSession();
      return { ok: false, error: body.error || "Session expired or invalid. Please sign in again." };
    }
    if (!r.ok) return { ok: false, error: body.error || `Profile request failed (${r.status})` };
    if (!body.user) return { ok: false, error: "Profile not found for this account" };
    return { ok: true, user: body.user };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error — is the API running?" };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const r = await fetchMe();
    if (r.ok) setUser(r.user);
    else setUser(null);
  }, []);

  useEffect(() => {
    let initialSessionHandled = false;

    const {
      data: { subscription },
    } = api.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession as AppSession | null);
      if (newSession?.user) {
        setTimeout(async () => {
          await loadProfile();
          if (event === "INITIAL_SESSION") {
            setIsLoading(false);
          }
        }, 0);
      } else {
        setUser(null);
        if (event === "INITIAL_SESSION") {
          setIsLoading(false);
        }
      }
    });

    api.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSessionHandled) return;
      initialSessionHandled = true;
      setSession(initialSession as AppSession | null);
      if (initialSession?.user) {
        loadProfile().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    const refreshIfActive = async () => {
      if (!active) return;
      await loadProfile();
    };
    const onFocus = () => {
      void refreshIfActive();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshIfActive();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [session?.access_token, loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await api.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    const s = readSession();
    if (!s?.access_token) {
      return { success: false, error: "No session returned. Check backend /api/v1/auth/sign-in and VITE_API_URL." };
    }
    setSession(s);
    const me = await fetchMe();
    if (!me.ok) {
      await api.auth.signOut();
      setSession(null);
      setUser(null);
      return { success: false, error: me.error };
    }
    setUser(me.user);
    return { success: true };
  }, []);

  const sendSignupOtp = useCallback(async (data: SignupData) => {
    const { error } = await api.auth.sendRegistrationOtp({
      email: data.email,
      password: data.password,
      data: {
        name: data.name,
        primary_role: data.role,
        phone: data.phone || null,
        location: data.location || null,
        district: data.district || data.location || null,
        address: data.address || null,
        specialization: data.specialization || null,
        experience_years:
          typeof data.experience_years === "number" && Number.isFinite(data.experience_years)
            ? data.experience_years
            : null,
        consultation_fee:
          typeof data.consultation_fee === "number" && Number.isFinite(data.consultation_fee)
            ? data.consultation_fee
            : null,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const completeSignupWithOtp = useCallback(async (email: string, otp: string) => {
    const { error } = await api.auth.verifyRegistrationOtp({ email, otp });
    if (error) return { success: false, error: error.message };
    const s = readSession();
    if (!s?.access_token) {
      return { success: false, error: "No session after verification. Try signing in." };
    }
    setSession(s);
    const me = await fetchMe();
    if (!me.ok) {
      await api.auth.signOut();
      setSession(null);
      setUser(null);
      return { success: false, error: me.error };
    }
    setUser(me.user);
    return { success: true };
  }, []);

  const resendSignupOtp = useCallback(async (email: string) => {
    const { error } = await api.auth.resendRegistrationOtp(email);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await api.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const hasRole = useCallback((role: UserRole) => {
    return user?.roles.includes(role) ?? false;
  }, [user]);

  const hasCapability = useCallback((capability: string) => {
    return user?.capabilities.includes(capability) ?? false;
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) await loadProfile();
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user && !!session,
        isLoading,
        login,
        sendSignupOtp,
        completeSignupWithOtp,
        resendSignupOtp,
        logout,
        hasRole,
        hasCapability,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
