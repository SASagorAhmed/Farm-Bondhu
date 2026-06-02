import { ICON_COLORS } from "@/lib/iconColors";

/** Workspace accent for shared profile pages (no purple). */
export function getWorkspaceAccent(pathname: string): string {
  if (pathname.startsWith("/learning")) return ICON_COLORS.learning;
  if (pathname.startsWith("/dashboard")) return ICON_COLORS.farmBrand;
  if (pathname.startsWith("/marketplace") || pathname.startsWith("/buyer") || pathname.startsWith("/cart") || pathname.startsWith("/orders")) {
    return ICON_COLORS.cart;
  }
  if (pathname.startsWith("/vetbondhu")) return ICON_COLORS.vetbondhu;
  if (pathname.startsWith("/medibondhu")) return ICON_COLORS.medibondhu;
  if (pathname.startsWith("/vet")) return ICON_COLORS.vet;
  if (pathname.startsWith("/seller")) return ICON_COLORS.store;
  if (pathname.startsWith("/community")) return ICON_COLORS.community;
  if (pathname.startsWith("/admin")) return ICON_COLORS.admin;
  return ICON_COLORS.profile;
}

export const SUPPORT_PHONE_DISPLAY = "01887490789";
export const SUPPORT_PHONE_TEL = "+8801887490789";

/** Contextual Help & Support base path for the current workspace shell. */
export function getWorkspaceSupportBase(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin/support";
  if (pathname.startsWith("/dashboard")) return "/dashboard/support";
  if (pathname.startsWith("/vetbondhu")) return "/vetbondhu/support";
  if (pathname.startsWith("/medibondhu")) return "/medibondhu/support";
  if (pathname.startsWith("/vet")) return "/vet/support";
  if (pathname.startsWith("/seller")) return "/seller/support";
  if (
    pathname.startsWith("/marketplace") ||
    pathname.startsWith("/buyer") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/my-shop")
  ) {
    return pathname.startsWith("/buyer") ? "/buyer/support" : "/marketplace/support";
  }
  if (pathname.startsWith("/learning")) return "/learning/support";
  if (pathname.startsWith("/community")) return "/community/support";
  return "/buyer/support";
}

export function getSupportChatPath(pathname: string, conversationId: string): string {
  return `${getWorkspaceSupportBase(pathname)}/chat/${conversationId}`;
}
