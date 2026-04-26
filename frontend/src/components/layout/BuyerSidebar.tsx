import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  ShoppingCart, ShoppingBag, ClipboardList, LogOut, Menu, PanelLeftClose, LayoutGrid,
  Heart, Grid3X3, Settings, UserCircle, Shield, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

const BUYER_CORE: NavItem[] = [
  { title: "Home", url: "/buyer/home", icon: LayoutGrid, iconColor: ICON_COLORS.cart },
  { title: "Marketplace", url: "/marketplace", icon: ShoppingBag, iconColor: ICON_COLORS.cart },
  { title: "Categories", url: "/buyer/categories", icon: Grid3X3, iconColor: ICON_COLORS.cart },
  { title: "My Cart", url: "/cart", icon: ShoppingCart, iconColor: ICON_COLORS.shopping },
  { title: "My Orders", url: "/orders", icon: ClipboardList, iconColor: ICON_COLORS.orders },
  { title: "Wishlist", url: "/buyer/wishlist", icon: Heart, iconColor: ICON_COLORS.health },
  { title: "Messages", url: "/marketplace/inbox", icon: MessageCircle, iconColor: ICON_COLORS.marketplace },
];

const BUYER_BOTTOM: NavItem[] = [
  { title: "Access Center", url: "/buyer/access-center", icon: Shield, iconColor: "hsl(262, 83%, 58%)" },
  { title: "Profile", url: "/buyer/profile", icon: UserCircle, iconColor: ICON_COLORS.profile },
  { title: "Settings", url: "/buyer/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
];

export default function BuyerSidebar() {
  const { user, logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  if (!user) return null;

  const brandColor = ICON_COLORS.cart;

  const renderItem = (item: NavItem) => {
    const active = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
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
    <Sidebar collapsible="icon" className="buyer-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" style={{ color: brandColor }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: brandColor }}>Marketplace</span>
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
            {BUYER_CORE.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons targets={["farm", "vet", "medibondhu", "learning", "community"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {BUYER_BOTTOM.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: brandColor }}>
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{formatUserRoleLabel(user)}</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size={collapsed ? "icon" : "default"} onClick={logout} className="w-full bg-red-500 text-black hover:bg-red-600 hover:text-black transition-all duration-200">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
