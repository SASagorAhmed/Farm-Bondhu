import { createContext, useContext } from "react";
import type { AppSession } from "@/api/client";
import type { SignupModule } from "@/lib/signupModules";

export type UserRole = "farmer" | "buyer" | "vendor" | "vet" | "doctor" | "admin";

export type SignupCarePath = "vetbondhu" | "medibondhu";

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
  /** Original signup module (vetbondhu, medibondhu, farm, etc.) for display labels. */
  signupModule?: SignupModule;
  avatar?: string;
  phone?: string;
  location?: string;
  cvUrl?: string;
  cvFilename?: string;
  cvMimeType?: string;
  cvUpdatedAt?: string;
}

const ADMIN_TEAM_LABELS: Record<AdminTeamLevel, string> = {
  super_admin: "Super Admin",
  co_admin: "Co-Admin",
  moderator: "Moderator",
};

type RoleLabelUser = Pick<User, "primaryRole" | "adminLevel" | "signupModule" | "roles" | "capabilities">;

/** Resolve signup module from profile field or care-only capability pattern. */
export function resolveEffectiveSignupModule(
  user: RoleLabelUser | null | undefined,
): SignupModule | undefined {
  if (!user) return undefined;

  const caps = user.capabilities || [];
  const roles = user.roles || [];
  const hasCap = (c: string) => caps.includes(c);
  const hasRole = (r: UserRole) => roles.includes(r);
  const isVet = hasRole("vet") || hasCap("can_consult_as_vet");
  const isDoctor = hasRole("doctor") || hasCap("can_practice_human");

  if (user.signupModule) {
    if (
      (user.signupModule === "medibondhu" || user.signupModule === "vetbondhu") &&
      hasCap("can_manage_farm")
    ) {
      return "farm";
    }
    return user.signupModule;
  }

  if (hasCap("can_book_vet") && !hasCap("can_manage_farm") && !isVet) return "vetbondhu";
  if (hasCap("can_book_human") && !hasCap("can_manage_farm") && !isDoctor && !isVet) return "medibondhu";
  return undefined;
}

/** Sidebar / header label: uses admin team tier when `primaryRole` is `admin`. */
export function formatUserRoleLabel(user: RoleLabelUser | null | undefined): string {
  if (!user?.primaryRole) return "Member";
  if (user.primaryRole === "admin" && user.adminLevel && ADMIN_TEAM_LABELS[user.adminLevel]) {
    return ADMIN_TEAM_LABELS[user.adminLevel];
  }
  const module = resolveEffectiveSignupModule(user);
  if (module === "vetbondhu") return "Vet Patient";
  if (module === "medibondhu") return "Medi Patient";
  return user.primaryRole.charAt(0).toUpperCase() + user.primaryRole.slice(1);
}

/** Badge color class for profile role chips. */
export function getUserRoleBadgeClass(user: RoleLabelUser | null | undefined): string {
  const module = resolveEffectiveSignupModule(user);
  if (module === "vetbondhu") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (module === "medibondhu") return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400";
  const role = user?.primaryRole || "buyer";
  const ROLE_COLORS: Record<string, string> = {
    buyer: "bg-blue-100 text-blue-800",
    farmer: "bg-green-100 text-green-800",
    vendor: "bg-orange-100 text-orange-800",
    vet: "bg-purple-100 text-purple-800",
    doctor: "bg-teal-100 text-teal-800",
    admin: "bg-red-100 text-red-800",
  };
  return ROLE_COLORS[role] || ROLE_COLORS.buyer;
}

/** Capabilities granted to Super Admin while previewing user workspaces. */
export const WORKSPACE_CAPABILITIES = [
  "can_manage_farm",
  "can_buy",
  "can_sell",
  "can_access_learning",
  "can_access_community",
  "can_book_human",
  "can_practice_human",
  "can_book_vet",
  "can_consult_as_vet",
] as const;

export type WorkspaceCapability = (typeof WORKSPACE_CAPABILITIES)[number];

/** Sidebar workspace keys filtered by Access Center capabilities. */
export type WorkspaceKey =
  | "farm"
  | "marketplace"
  | "vet"
  | "medibondhu"
  | "medibondhuDoctor"
  | "vetbondhu"
  | "learning"
  | "community";

export interface WorkspaceAccessContext {
  hasCapability: (capability: string) => boolean;
  hasRole: (role: UserRole) => boolean;
}

/** Whether a workspace link should appear in the sidebar (matches Access Center toggles). */
export function canAccessWorkspace(key: WorkspaceKey, ctx: WorkspaceAccessContext): boolean {
  const { hasCapability, hasRole } = ctx;
  const isVet = hasRole("vet") || hasCapability("can_consult_as_vet");

  switch (key) {
    case "farm":
      return hasCapability("can_manage_farm");
    case "marketplace":
      return (
        hasCapability("can_buy") ||
        hasCapability("can_sell") ||
        hasCapability("can_bulk_buy")
      );
    case "vet":
      return isVet;
    case "medibondhu":
      return (
        hasCapability("can_book_human") ||
        hasCapability("can_practice_human") ||
        hasRole("doctor")
      );
    case "medibondhuDoctor":
      return hasCapability("can_practice_human") || hasRole("doctor");
    case "vetbondhu":
      return hasCapability("can_book_vet");
    case "learning":
      return hasCapability("can_access_learning");
    case "community":
      return hasCapability("can_access_community");
    default:
      return false;
  }
}

/** User-facing app routes admins may preview (not `/admin/*`). */
export const ADMIN_PREVIEW_PATH_PREFIXES = [
  "/dashboard",
  "/marketplace",
  "/cart",
  "/orders",
  "/checkout",
  "/learning",
  "/community",
  "/medibondhu",
  "/vetbondhu",
  "/vet",
  "/seller",
  "/buyer",
] as const;

export function isAdminPreviewPath(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return false;
  return ADMIN_PREVIEW_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isPlatformAdmin(user: Pick<User, "roles" | "capabilities"> | null | undefined): boolean {
  if (!user) return false;
  return user.roles.includes("admin") && user.capabilities.includes("can_manage_platform");
}

export function isSuperAdmin(user: Pick<User, "roles" | "capabilities" | "adminLevel"> | null | undefined): boolean {
  return isPlatformAdmin(user) && user?.adminLevel === "super_admin";
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  /** Selected signup module (farm, marketplace, vetbondhu, etc.). */
  signup_module?: SignupModule;
  /** Patient signup: VetBondhu animal care or MediBondhu human care (registers as farmer + scoped caps). */
  signup_care_path?: SignupCarePath;
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
  refreshProfile: (opts?: { force?: boolean }) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
