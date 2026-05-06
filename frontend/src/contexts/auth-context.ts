import { createContext, useContext } from "react";
import type { AppSession } from "@/api/client";

export type UserRole = "farmer" | "buyer" | "vendor" | "vet" | "doctor" | "admin";

/** Row in `admin_team` for platform admins (granular UI vs `primaryRole` = app role `admin`). */
export type AdminTeamLevel = "super_admin" | "co_admin" | "moderator";

export interface User {
  id: string;
  name: string;
  email: string;
  primaryRole: UserRole;
  roles: UserRole[];
  /** From `admin_team` when the user is on the admin team; null otherwise. */
  adminLevel?: AdminTeamLevel | null;
  capabilities: string[];
  /** When true, farmers with MediBondhu access land on /medibondhu after sign-in. Toggle in Access Center. */
  farmerOpenMedibondhu?: boolean;
  avatar?: string;
  phone?: string;
  location?: string;
}

const ADMIN_TEAM_LABELS: Record<AdminTeamLevel, string> = {
  super_admin: "Super Admin",
  co_admin: "Co-Admin",
  moderator: "Moderator",
};

/** Sidebar / header label: uses admin team tier when `primaryRole` is `admin`. */
export function formatUserRoleLabel(user: Pick<User, "primaryRole" | "adminLevel"> | null | undefined): string {
  if (!user?.primaryRole) return "Member";
  if (user.primaryRole === "admin" && user.adminLevel && ADMIN_TEAM_LABELS[user.adminLevel]) {
    return ADMIN_TEAM_LABELS[user.adminLevel];
  }
  return user.primaryRole.charAt(0).toUpperCase() + user.primaryRole.slice(1);
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  location?: string;
  district?: string;
  address?: string;
  specialization?: string;
  /** Human physician (MediBondhu) — degree / diplomas as text (e.g. MBBS, FCPS). */
  qualification?: string;
  medical_reg_number?: string;
  registration_body?: string;
  experience_years?: number;
  consultation_fee?: number;
}

export interface AuthContextType {
  user: User | null;
  session: AppSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasResolvedSession: boolean;
  authzHydrating: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  sendSignupOtp: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  completeSignupWithOtp: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  resendSignupOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasCapability: (capability: string) => boolean;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
