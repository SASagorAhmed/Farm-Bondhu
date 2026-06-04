import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Shield,
  Bell,
  Mail,
  TrendingUp,
  Warehouse,
  ScanSearch,
  Stethoscope,
  BookOpen,
  ShoppingCart,
  Store,
  ClipboardList,
  MessageSquareText,
  Receipt,
  Banknote,
  MessageCircle,
  Headphones,
  Star,
} from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import {
  MARKETPLACE_ADMIN_NAV,
  OFFICIAL_SHOP_ADMIN_NAV,
  OFFICIAL_SHOP_BASE,
} from "@/lib/officialShopAdminNav";

export type AdminModuleId =
  | "platform"
  | "farm"
  | "vetbondhu"
  | "medibondhu"
  | "learning"
  | "marketplace"
  | "community";

export interface AdminNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  iconColor: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export interface AdminModule {
  id: AdminModuleId;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  defaultPath: string;
  navItems: AdminNavItem[];
  /** When set, sidebar renders multiple collapsible groups instead of a flat list. */
  navGroups?: AdminNavGroup[];
}

const ADMIN_MODULES: AdminModule[] = [
  {
    id: "platform",
    label: "Platform",
    description: "Users, approvals, broadcasts, and platform-wide reports.",
    icon: LayoutDashboard,
    color: ICON_COLORS.admin,
    defaultPath: "/admin/platform",
    navItems: [
      { title: "Dashboard", url: "/admin/platform", icon: LayoutDashboard, iconColor: ICON_COLORS.admin },
      { title: "Users", url: "/admin/users", icon: Users, iconColor: ICON_COLORS.users },
      { title: "Admin Team", url: "/admin/team", icon: Shield, iconColor: ICON_COLORS.shield },
      { title: "Approvals", url: "/admin/approvals", icon: Shield, iconColor: ICON_COLORS.shield },
      { title: "Seller lane queue", url: "/admin/marketplace/seller-lanes", icon: Store, iconColor: ICON_COLORS.store },
      { title: "Broadcast", url: "/admin/broadcast", icon: Bell, iconColor: ICON_COLORS.heartPulse },
      { title: "Email Audit", url: "/admin/email-audit", icon: Mail, iconColor: ICON_COLORS.admin },
      { title: "Customer Support", url: "/admin/customer-support", icon: Headphones, iconColor: ICON_COLORS.admin },
      { title: "Moderation Reports", url: "/admin/moderation-reports", icon: MessageSquareText, iconColor: "#dc2626" },
      { title: "Analytics", url: "/admin/reports", icon: TrendingUp, iconColor: ICON_COLORS.trending },
    ],
  },
  {
    id: "farm",
    label: "Farm Management",
    description: "Farms, animal records, and cow detection exports.",
    icon: Warehouse,
    color: ICON_COLORS.farm,
    defaultPath: "/admin/farms",
    navItems: [
      { title: "Farms", url: "/admin/farms", icon: Warehouse, iconColor: ICON_COLORS.farm },
      { title: "Cow Detection Export", url: "/admin/cow-detection-export", icon: ScanSearch, iconColor: ICON_COLORS.farm },
    ],
  },
  {
    id: "vetbondhu",
    label: "VetBondhu",
    description: "Vet onboarding, approvals, and payout management.",
    icon: Stethoscope,
    color: ICON_COLORS.vetbondhu,
    defaultPath: "/admin/vet-approvals",
    navItems: [
      { title: "Vet Approvals", url: "/admin/vet-approvals", icon: Stethoscope, iconColor: ICON_COLORS.stethoscope },
      { title: "Access controls", url: "/admin/vetbondhu-access", icon: Shield, iconColor: ICON_COLORS.vetbondhu },
      { title: "Vet Payouts", url: "/admin/vetbondhu-overview", icon: Stethoscope, iconColor: ICON_COLORS.vetbondhu },
    ],
  },
  {
    id: "medibondhu",
    label: "MediBondhu",
    description: "Human care hospitals, doctors, and withdrawals.",
    icon: Stethoscope,
    color: ICON_COLORS.medibondhu,
    defaultPath: "/admin/medibondhu-human",
    navItems: [
      { title: "MediBondhu Human", url: "/admin/medibondhu-human", icon: Stethoscope, iconColor: ICON_COLORS.medibondhu },
      { title: "Access controls", url: "/admin/medibondhu-access", icon: Shield, iconColor: ICON_COLORS.medibondhu },
      { title: "Doctor payouts", url: "/admin/medibondhu-payouts", icon: Banknote, iconColor: ICON_COLORS.medibondhu },
      { title: "Preview doctor portal", url: "/medibondhu/doctor/dashboard", icon: ClipboardList, iconColor: ICON_COLORS.medibondhu },
    ],
  },
  {
    id: "learning",
    label: "Learning",
    description: "Learning guides and educational content.",
    icon: BookOpen,
    color: ICON_COLORS.learning,
    defaultPath: "/admin/learning",
    navItems: [
      { title: "Learning Posts", url: "/admin/learning", icon: BookOpen, iconColor: ICON_COLORS.learning },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Products, shops, banners, orders, and FarmBondhu shop.",
    icon: ShoppingCart,
    color: ICON_COLORS.cart,
    defaultPath: "/admin/marketplace",
    navItems: MARKETPLACE_ADMIN_NAV.map(({ title, url, icon, iconColor }) => ({
      title,
      url,
      icon,
      iconColor,
    })),
    navGroups: [
      {
        label: "Marketplace admin",
        items: MARKETPLACE_ADMIN_NAV.map(({ title, url, icon, iconColor }) => ({
          title,
          url,
          icon,
          iconColor,
        })),
      },
      {
        label: "FarmBondhu official shop",
        items: OFFICIAL_SHOP_ADMIN_NAV.map(({ title, url, icon, iconColor }) => ({
          title,
          url,
          icon,
          iconColor,
        })),
      },
    ],
  },
  {
    id: "community",
    label: "Community",
    description: "Community posts, reports, and moderation.",
    icon: MessageSquareText,
    color: ICON_COLORS.community,
    defaultPath: "/admin/community",
    navItems: [
      { title: "Community", url: "/admin/community", icon: MessageSquareText, iconColor: ICON_COLORS.community },
    ],
  },
];

/** Ordered list for hub cards and module switcher. */
export const ADMIN_MODULE_HUB_ITEMS = ADMIN_MODULES;

const PATH_TO_MODULE: { prefix: string; moduleId: AdminModuleId }[] = [];
for (const mod of ADMIN_MODULES) {
  const items = mod.navGroups?.flatMap((g) => g.items) ?? mod.navItems;
  for (const item of items) {
    PATH_TO_MODULE.push({ prefix: item.url.split("?")[0], moduleId: mod.id });
  }
}
PATH_TO_MODULE.push({ prefix: OFFICIAL_SHOP_BASE, moduleId: "marketplace" });
PATH_TO_MODULE.sort((a, b) => b.prefix.length - a.prefix.length);

const UTILITY_PATHS = new Set(["/admin/profile", "/admin/notifications", "/admin/settings"]);

export function getAdminModuleById(id: AdminModuleId): AdminModule | undefined {
  return ADMIN_MODULES.find((m) => m.id === id);
}

export function getAdminModuleNav(moduleId: AdminModuleId): AdminNavItem[] {
  return getAdminModuleById(moduleId)?.navItems ?? [];
}

export function getAdminModuleNavGroups(moduleId: AdminModuleId): AdminNavGroup[] | null {
  const mod = getAdminModuleById(moduleId);
  if (!mod?.navGroups?.length) return null;
  return mod.navGroups;
}

export function getAdminModuleForPath(pathname: string): AdminModule | null {
  if (pathname === "/admin" || UTILITY_PATHS.has(pathname)) return null;
  if (!pathname.startsWith("/admin/")) return null;

  const match = PATH_TO_MODULE.find(({ prefix }) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (match) return getAdminModuleById(match.moduleId) ?? null;
  return null;
}

export function isAdminHubPath(pathname: string): boolean {
  return pathname === "/admin";
}
