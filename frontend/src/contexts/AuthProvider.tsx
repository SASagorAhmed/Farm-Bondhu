import React, { useState, useEffect, useCallback } from "react";
import { api, readSession, API_BASE, type AppSession, clearStoredSession } from "@/api/client";
import { AuthContext, type User, type SignupData, type UserRole } from "./auth-context";
import { queryClient } from "@/lib/queryClient";
import { withApiTiming } from "@/lib/perfMetrics";

type MeResult = { ok: true; user: User } | { ok: false; error: string };

function meQueryKey(token?: string) {
  return ["me-profile", token || "anonymous"] as const;
}

const AUTH_PROFILE_STALE_MS = 120 * 1000;

function shellUserFromSession(session: AppSession): User {
  const email = session.user?.email || "";
  const fallbackName = email ? email.split("@")[0] : "User";
  return {
    id: session.user?.id || "",
    name: fallbackName,
    email,
    primaryRole: "farmer",
    roles: ["farmer"],
    capabilities: [],
  };
}

/** Loads app user from Express `GET /api/v1/me` (Bearer = access_token in localStorage). */
async function fetchMe(): Promise<MeResult> {
  const s = readSession();
  if (!s?.access_token) return { ok: false, error: "No session token" };
  try {
    const r = await withApiTiming("/v1/me", () =>
      fetch(`${API_BASE}/v1/me`, {
        headers: { Authorization: `Bearer ${s.access_token}` },
      })
    );
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
  const [hasResolvedSession, setHasResolvedSession] = useState(false);
  const [authzHydrating, setAuthzHydrating] = useState(false);

  function cachedUserForToken(token: string): User | null {
    const cached = queryClient.getQueryData<MeResult>(meQueryKey(token));
    return cached?.ok ? cached.user : null;
  }

  const loadProfile = useCallback(async (opts?: { force?: boolean; keepUserOnError?: boolean }) => {
    const token = readSession()?.access_token;
    if (!token) {
      setUser(null);
      setAuthzHydrating(false);
      return;
    }
    const key = meQueryKey(token);
    const cached = queryClient.getQueryData<MeResult>(key);
    if (cached?.ok) {
      setUser(cached.user);
      if (!opts?.force) {
        // Warm cache gives instant paint; background refresh keeps it fresh.
        setAuthzHydrating(false);
        return;
      }
    }
    const r = await queryClient.fetchQuery({
      queryKey: key,
      staleTime: AUTH_PROFILE_STALE_MS,
      queryFn: fetchMe,
    });
    if (r.ok) {
      setUser(r.user);
    } else if (!opts?.keepUserOnError) {
      setUser(null);
    }
    setAuthzHydrating(false);
  }, []);

  useEffect(() => {
    let initialSessionHandled = false;

    const {
      data: { subscription },
    } = api.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "INITIAL_SESSION") {
        if (initialSessionHandled) return;
        initialSessionHandled = true;
        setHasResolvedSession(true);
      }
      setSession(newSession as AppSession | null);
      if (newSession?.user) {
        setAuthzHydrating(true);
        if (event === "INITIAL_SESSION") {
          void loadProfile({ keepUserOnError: true });
          setIsLoading(false);
          return;
        }
        await loadProfile({ force: true, keepUserOnError: true });
        setIsLoading(false);
      } else {
        setUser(null);
        setAuthzHydrating(false);
        setIsLoading(false);
      }
    });

    api.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (initialSessionHandled) return;
      initialSessionHandled = true;
      setHasResolvedSession(true);
      setSession(initialSession as AppSession | null);
      if (initialSession?.user) {
        setAuthzHydrating(true);
        void loadProfile({ keepUserOnError: true });
        setIsLoading(false);
      } else {
        setAuthzHydrating(false);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    let lastRefreshAt = 0;
    const refreshIfActive = async () => {
      if (!active) return;
      const now = Date.now();
      if (now - lastRefreshAt < AUTH_PROFILE_STALE_MS) return;
      lastRefreshAt = now;
      await loadProfile({ force: true, keepUserOnError: true });
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

    // Instant entry: promote session + cached/safe user shell immediately.
    setSession(s);
    setAuthzHydrating(true);
    const cachedUser = cachedUserForToken(s.access_token);
    setUser((prev) => {
      if (cachedUser) return cachedUser;
      if (prev && prev.id === s.user.id) return prev;
      return shellUserFromSession(s);
    });
    setIsLoading(false);
    void loadProfile({ force: true, keepUserOnError: true });
    return { success: true };
  }, [loadProfile]);

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
    // Instant entry after verification: reconcile profile/capabilities in background.
    setSession(s);
    setAuthzHydrating(true);
    const cachedUser = cachedUserForToken(s.access_token);
    setUser((prev) => {
      if (cachedUser) return cachedUser;
      if (prev && prev.id === s.user.id) return prev;
      return shellUserFromSession(s);
    });
    setIsLoading(false);
    void loadProfile({ force: true, keepUserOnError: true });
    return { success: true };
  }, [loadProfile]);

  const resendSignupOtp = useCallback(async (email: string) => {
    const { error } = await api.auth.resendRegistrationOtp(email);
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await api.auth.signOut();
    setUser(null);
    setSession(null);
    setAuthzHydrating(false);
    queryClient.removeQueries({ queryKey: ["me-profile"] });
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
        hasResolvedSession,
        authzHydrating,
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
