import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Store,
  Package,
  Palette,
  ClipboardList,
  Boxes,
  DollarSign,
  Star,
  Settings,
  MessageCircle,
  ShieldCheck,
  Receipt,
  MessageSquareText,
  ShoppingCart,
  Users,
} from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

export type OfficialShopNavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  iconColor: string;
};

export const OFFICIAL_SHOP_BASE = "/admin/farmbondhu-shop";

export const OFFICIAL_SHOP_ADMIN_NAV: OfficialShopNavItem[] = [
  { title: "Overview", url: OFFICIAL_SHOP_BASE, icon: ShieldCheck, iconColor: ICON_COLORS.farm },
  { title: "My Shop", url: `${OFFICIAL_SHOP_BASE}/shop`, icon: Store, iconColor: ICON_COLORS.farm },
  { title: "Products", url: `${OFFICIAL_SHOP_BASE}/products`, icon: Package, iconColor: ICON_COLORS.package },
  { title: "Photo Editor", url: `${OFFICIAL_SHOP_BASE}/photo-editor`, icon: Palette, iconColor: ICON_COLORS.marketplace },
  { title: "Orders", url: `${OFFICIAL_SHOP_BASE}/orders`, icon: ClipboardList, iconColor: ICON_COLORS.orders },
  { title: "Inventory", url: `${OFFICIAL_SHOP_BASE}/inventory`, icon: Boxes, iconColor: ICON_COLORS.warehouse },
  { title: "Payouts", url: `${OFFICIAL_SHOP_BASE}/payouts`, icon: DollarSign, iconColor: ICON_COLORS.finance },
  { title: "Reviews", url: `${OFFICIAL_SHOP_BASE}/reviews`, icon: Star, iconColor: ICON_COLORS.bell },
  { title: "Settings", url: `${OFFICIAL_SHOP_BASE}/settings`, icon: Settings, iconColor: ICON_COLORS.profile },
  { title: "Messages", url: `${OFFICIAL_SHOP_BASE}/messages`, icon: MessageCircle, iconColor: ICON_COLORS.admin },
];

export const MARKETPLACE_ADMIN_NAV: OfficialShopNavItem[] = [
  { title: "Marketplace", url: "/admin/marketplace", icon: LayoutDashboard, iconColor: ICON_COLORS.cart },
  { title: "Flash Sale", url: "/admin/marketplace?tab=flash-sale", icon: ShoppingCart, iconColor: MARKETPLACE_THEME.primary },
  { title: "Seller lane approvals", url: "/admin/marketplace/seller-lanes", icon: Store, iconColor: ICON_COLORS.store },
  { title: "Buyers", url: "/admin/marketplace/buyers", icon: Users, iconColor: ICON_COLORS.cart },
  { title: "Sellers", url: "/admin/marketplace/sellers", icon: Store, iconColor: ICON_COLORS.store },
  { title: "Transactions", url: "/admin/marketplace/transactions", icon: Receipt, iconColor: ICON_COLORS.finance },
  { title: "Seller payouts", url: "/admin/marketplace/payouts", icon: DollarSign, iconColor: ICON_COLORS.finance },
  { title: "Reported Messages", url: "/admin/marketplace/messages", icon: MessageCircle, iconColor: ICON_COLORS.admin },
  { title: "Chat Reports", url: "/admin/marketplace/reports", icon: MessageSquareText, iconColor: "#dc2626" },
  { title: "Product Reviews", url: "/admin/marketplace/reviews", icon: Star, iconColor: MARKETPLACE_THEME.primary },
  { title: "Orders", url: "/admin/orders", icon: ClipboardList, iconColor: ICON_COLORS.orders },
];
