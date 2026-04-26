import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  ShoppingCart, Store, ClipboardList, ShoppingBag, Package, LogOut, Menu,
  PanelLeftClose, Truck, UserCircle, Shield, Settings, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
  capability?: string;
}

export default function MarketplaceSidebar() {
  const { user, logout, hasCapability, hasRole } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!user) return null;

  const brandColor = ICON_COLORS.cart;
  const isVetUser = hasRole("vet") || hasCapability("can_consult_as_vet");
  const profilePath = isVetUser ? "/vet/profile" : "/marketplace/profile";

  const MARKETPLACE_CORE: NavItem[] = [
    { title: t("sidebar.browseProducts"), url: "/marketplace", icon: ShoppingCart, iconColor: ICON_COLORS.cart, capability: "can_buy" },
    { title: t("sidebar.myCart"), url: "/cart", icon: ShoppingBag, iconColor: ICON_COLORS.shopping, capability: "can_buy" },
    { title: t("sidebar.myOrders"), url: "/orders", icon: ClipboardList, iconColor: ICON_COLORS.orders, capability: "can_buy" },
    { title: t("sidebar.messages"), url: "/marketplace/inbox", icon: MessageCircle, iconColor: ICON_COLORS.marketplace, capability: "can_buy" },
    { title: t("sidebar.myShop"), url: "/my-shop", icon: Store, iconColor: ICON_COLORS.store },
    { title: t("sidebar.sellerDashboard"), url: "/seller/dashboard", icon: Package, iconColor: ICON_COLORS.package, capability: "can_sell" },
    { title: t("sidebar.manageOrders"), url: "/seller/orders", icon: Truck, iconColor: ICON_COLORS.farm, capability: "can_manage_orders" },
  ];

  const MARKETPLACE_BOTTOM: NavItem[] = [
    { title: t("sidebar.accessCenter"), url: "/marketplace/access-center", icon: Shield, iconColor: "hsl(262, 83%, 58%)" },
    { title: t("sidebar.profile"), url: profilePath, icon: UserCircle, iconColor: ICON_COLORS.profile },
    { title: t("sidebar.settings"), url: "/marketplace/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
  ];

  const coreWithSmartShop = MARKETPLACE_CORE.map((item) =>
    item.url === "/my-shop" && !hasCapability("can_sell")
      ? { ...item, url: "/marketplace/access-center?request=seller_access" }
      : item
  );
  const visibleCore = coreWithSmartShop.filter((item) => !item.capability || hasCapability(item.capability));

  const renderItem = (item: NavItem) => {
    const itemPath = item.url.split("?")[0];
    const active = location.pathname === itemPath || (itemPath !== "/marketplace" && location.pathname.startsWith(itemPath + "/"));
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.url} end className="transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: brandColor, color: "white" } : undefined}>
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="marketplace-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" style={{ color: brandColor }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: brandColor }}>{t("sidebar.marketplace")}</span>
              </div>
              <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mx-auto">
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-2 py-2">
          <SidebarMenu>
            {visibleCore.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons targets={["farm", "vet", "medibondhu", "learning", "community"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {MARKETPLACE_BOTTOM.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button onClick={() => navigate(profilePath)} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brandColor }}>
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{formatUserRoleLabel(user)}</p>
            </div>
          </button>
        )}
        <Button variant="ghost" size={collapsed ? "icon" : "default"} onClick={logout} className="w-full bg-red-500 text-black hover:bg-red-600 hover:text-black transition-all duration-200">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">{t("sidebar.logout")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
