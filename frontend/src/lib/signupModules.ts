import type { UserRole } from "@/contexts/AuthContext";
import { ICON_COLORS } from "@/lib/iconColors";

export const SIGNUP_MODULE_KEYS = [
  "vetbondhu",
  "medibondhu",
  "farm",
  "marketplace",
  "vendor",
  "vet",
  "doctor",
] as const;

export type SignupModule = (typeof SIGNUP_MODULE_KEYS)[number];

export interface SignupModuleDef {
  key: SignupModule;
  icon: string;
  titleKey: `signup.module.${SignupModule}.title`;
  descKey: `signup.module.${SignupModule}.desc`;
  badgeKey: `signup.module.${SignupModule}.badge`;
  primaryRole: UserRole;
  accentColor: string;
  postSignupRoute: string;
  /** Maps to signup_care_path for backward-compatible API payloads. */
  carePath?: "vetbondhu" | "medibondhu";
}

export const SIGNUP_MODULES: SignupModuleDef[] = [
  {
    key: "vetbondhu",
    icon: "🐄",
    titleKey: "signup.module.vetbondhu.title",
    descKey: "signup.module.vetbondhu.desc",
    badgeKey: "signup.module.vetbondhu.badge",
    primaryRole: "farmer",
    accentColor: ICON_COLORS.vetbondhu,
    postSignupRoute: "/vetbondhu",
    carePath: "vetbondhu",
  },
  {
    key: "medibondhu",
    icon: "🩺",
    titleKey: "signup.module.medibondhu.title",
    descKey: "signup.module.medibondhu.desc",
    badgeKey: "signup.module.medibondhu.badge",
    primaryRole: "farmer",
    accentColor: ICON_COLORS.medibondhu,
    postSignupRoute: "/medibondhu",
    carePath: "medibondhu",
  },
  {
    key: "farm",
    icon: "🧑‍🌾",
    titleKey: "signup.module.farm.title",
    descKey: "signup.module.farm.desc",
    badgeKey: "signup.module.farm.badge",
    primaryRole: "farmer",
    accentColor: ICON_COLORS.farm,
    postSignupRoute: "/dashboard",
  },
  {
    key: "marketplace",
    icon: "🛒",
    titleKey: "signup.module.marketplace.title",
    descKey: "signup.module.marketplace.desc",
    badgeKey: "signup.module.marketplace.badge",
    primaryRole: "buyer",
    accentColor: ICON_COLORS.marketplace,
    postSignupRoute: "/marketplace",
  },
  {
    key: "vendor",
    icon: "🏪",
    titleKey: "signup.module.vendor.title",
    descKey: "signup.module.vendor.desc",
    badgeKey: "signup.module.vendor.badge",
    primaryRole: "vendor",
    accentColor: ICON_COLORS.store,
    postSignupRoute: "/seller/onboarding",
  },
  {
    key: "vet",
    icon: "👩‍⚕️",
    titleKey: "signup.module.vet.title",
    descKey: "signup.module.vet.desc",
    badgeKey: "signup.module.vet.badge",
    primaryRole: "vet",
    accentColor: ICON_COLORS.vet,
    postSignupRoute: "/vet/profile",
  },
  {
    key: "doctor",
    icon: "🩺",
    titleKey: "signup.module.doctor.title",
    descKey: "signup.module.doctor.desc",
    badgeKey: "signup.module.doctor.badge",
    primaryRole: "doctor",
    accentColor: ICON_COLORS.medibondhu,
    postSignupRoute: "/medibondhu/profile",
  },
];

const MODULE_BY_KEY = Object.fromEntries(SIGNUP_MODULES.map((m) => [m.key, m])) as Record<
  SignupModule,
  SignupModuleDef
>;

export function isSignupModule(value: string | null | undefined): value is SignupModule {
  return Boolean(value && SIGNUP_MODULE_KEYS.includes(value as SignupModule));
}

export function getSignupModule(key: SignupModule | null | undefined): SignupModuleDef | null {
  if (!key) return null;
  return MODULE_BY_KEY[key] ?? null;
}

export function resolveSignupModuleFromQuery(
  search: string,
  stateModule?: unknown,
): SignupModule | null {
  const params = new URLSearchParams(search);
  const fromQuery = params.get("module");
  if (isSignupModule(fromQuery)) return fromQuery;
  if (isSignupModule(typeof stateModule === "string" ? stateModule : null)) return stateModule;
  return null;
}

/** Infer signup module from an app path (login redirect / register link). */
export function inferModuleFromPath(pathname: string): SignupModule | null {
  const path = pathname.toLowerCase();
  if (path === "/vetbondhu" || path.startsWith("/vetbondhu/")) return "vetbondhu";
  if (path === "/medibondhu" || path.startsWith("/medibondhu/")) return "medibondhu";
  if (
    path === "/marketplace" ||
    path.startsWith("/marketplace/") ||
    path === "/cart" ||
    path.startsWith("/cart/") ||
    path === "/checkout" ||
    path.startsWith("/checkout/") ||
    path === "/orders" ||
    path.startsWith("/orders/")
  ) {
    return "marketplace";
  }
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "farm";
  if (
    path === "/seller" ||
    path.startsWith("/seller/") ||
    path === "/my-shop" ||
    path.startsWith("/my-shop/")
  ) {
    return "vendor";
  }
  if (path === "/vet" || path.startsWith("/vet/")) return "vet";
  return null;
}

export function postSignupRouteForModule(module: SignupModule | null | undefined): string {
  return getSignupModule(module)?.postSignupRoute ?? "/home";
}

export function primaryRoleForModule(module: SignupModule): UserRole {
  return MODULE_BY_KEY[module].primaryRole;
}
