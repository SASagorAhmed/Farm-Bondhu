import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Store, Package, ClipboardList, Boxes, DollarSign, Star, Settings,
  LogOut, Menu, PanelLeftClose, UserCircle, Shield, ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_COLORS } from "@/lib/iconColors";
import { VENDOR_THEME } from "@/lib/vendorTheme";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import WorkspaceButtons from "./WorkspaceButtons";

const VC = VENDOR_THEME.primary;

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

const VENDOR_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/seller/dashboard", icon: LayoutDashboard, iconColor: VC },
  { title: "My Store", url: "/seller/my-shop", icon: Store, iconColor: VC },
  { title: "Products", url: "/seller/products", icon: Package, iconColor: ICON_COLORS.package },
  { title: "Orders", url: "/seller/orders", icon: ClipboardList, iconColor: ICON_COLORS.orders },
  { title: "Inventory", url: "/seller/inventory", icon: Boxes, iconColor: ICON_COLORS.warehouse },
  { title: "Payouts", url: "/seller/payouts", icon: DollarSign, iconColor: ICON_COLORS.dollar },
  { title: "Reviews", url: "/seller/reviews", icon: Star, iconColor: ICON_COLORS.bell },
  { title: "Settings", url: "/seller/settings", icon: Settings, iconColor: ICON_COLORS.profile },
];

const BUYER_ITEMS: NavItem[] = [
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag, iconColor: MARKETPLACE_THEME.primary },
];

const VENDOR_BOTTOM: NavItem[] = [
  { title: "Access Center", url: "/seller/access-center", icon: Shield, iconColor: VENDOR_THEME.primaryDark },
  { title: "Profile", url: "/seller/profile", icon: UserCircle, iconColor: ICON_COLORS.profile },
];

export default function VendorSidebar() {
  const { user, logout, hasCapability } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const showBuyerSection = hasCapability("can_buy");

  const renderItem = (item: NavItem, activeColor: string) => {
    const itemPath = item.url.split("?")[0];
    const active =
      location.pathname === itemPath ||
      (itemPath !== "/marketplace" && location.pathname.startsWith(itemPath + "/"));
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink
            to={item.url}
            end
            className="transition-all duration-200 rounded-lg"
            activeClassName="text-white font-medium shadow-sm"
            style={active ? { backgroundColor: activeColor, color: "white" } : undefined}
          >
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="vendor-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4" style={{ color: VC }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: VC }}>Vendor Panel</span>
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
        {!collapsed && (
          <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: VC }}>
            Seller tools
          </p>
        )}
        <div className="px-2 py-1">
          <SidebarMenu>
            {VENDOR_ITEMS.map((item) => renderItem(item, VC))}
          </SidebarMenu>
        </div>

        {showBuyerSection && (
          <>
            <Separator className="my-2 mx-2" />
            {!collapsed && (
              <p className="px-4 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: MARKETPLACE_THEME.primary }}>
                Buyer tools
              </p>
            )}
            <div className="px-2 py-1">
              <SidebarMenu>
                {BUYER_ITEMS.map((item) => renderItem(item, MARKETPLACE_THEME.primary))}
              </SidebarMenu>
            </div>
          </>
        )}

        <WorkspaceButtons targets={["farm", "vetbondhu", "medibondhu", "learning", "community"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {VENDOR_BOTTOM.map((item) => renderItem(item, VC))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button onClick={() => navigate("/seller/profile")} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: VC }}>
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
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
