import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Warehouse, PawPrint, Wheat, HeartPulse, BarChart3, Wallet,
  Skull, DollarSign, LogOut, Menu, PanelLeftClose,
  UserCircle, Shield, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

export default function FarmSidebar() {
  const { user, logout, hasRole, hasCapability } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isVetUser = hasRole("vet") || hasCapability("can_consult_as_vet");
  const profilePath = isVetUser ? "/vet/profile" : "/dashboard/profile";

  if (!user) return null;

  const FARM_ITEMS: NavItem[] = [
    { title: t("sidebar.dashboard"), url: "/dashboard", icon: LayoutDashboard, iconColor: ICON_COLORS.dashboard },
    { title: t("sidebar.farms"), url: "/dashboard/farms", icon: Warehouse, iconColor: ICON_COLORS.warehouse },
    { title: t("sidebar.animals"), url: "/dashboard/animals", icon: PawPrint, iconColor: ICON_COLORS.animals },
    { title: t("sidebar.feedManagement"), url: "/dashboard/feed", icon: Wheat, iconColor: ICON_COLORS.wheat },
    { title: t("sidebar.healthRecords"), url: "/dashboard/health", icon: HeartPulse, iconColor: ICON_COLORS.heartPulse },
    { title: t("sidebar.production"), url: "/dashboard/production", icon: BarChart3, iconColor: ICON_COLORS.analytics },
    { title: t("sidebar.mortality"), url: "/dashboard/mortality", icon: Skull, iconColor: ICON_COLORS.mortality },
    { title: t("sidebar.sales"), url: "/dashboard/sales", icon: DollarSign, iconColor: ICON_COLORS.dollar },
    { title: t("sidebar.finances"), url: "/dashboard/finances", icon: Wallet, iconColor: ICON_COLORS.wallet },
  ];

  const FARM_BOTTOM: NavItem[] = [
    { title: t("sidebar.accessCenter"), url: "/dashboard/access-center", icon: Shield, iconColor: "hsl(262, 83%, 58%)" },
    { title: t("sidebar.profile"), url: profilePath, icon: UserCircle, iconColor: ICON_COLORS.profile },
    { title: t("sidebar.settings"), url: "/dashboard/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
  ];

  const renderItem = (item: NavItem) => {
    const active = item.url === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname === item.url || location.pathname.startsWith(item.url + "/");
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.url} end className="farm-nav-item transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: ICON_COLORS.farmBrand, color: "white" } : undefined}>
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="farm-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <Warehouse className="h-4 w-4" style={{ color: ICON_COLORS.farm }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: ICON_COLORS.farm }}>{t("sidebar.farmManagement")}</span>
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
        <div className="px-2 py-1">
          <SidebarMenu>
            {FARM_ITEMS.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons targets={["marketplace", "vet", "medibondhu", "learning", "community"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {FARM_BOTTOM.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button onClick={() => navigate(profilePath)} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: ICON_COLORS.farmBrand }}>
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
