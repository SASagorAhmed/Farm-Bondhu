import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  CalendarCheck, FileText, LogOut, Menu, PanelLeftClose, Search, LayoutGrid, Stethoscope, UserCircle,
  Shield, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";

const MB = ICON_COLORS.medibondhu;

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

const MEDIBONDHU_ITEMS: NavItem[] = [
  { title: "Home", url: "/medibondhu", icon: LayoutGrid, iconColor: MB },
  { title: "Find Doctor", url: "/medibondhu/vets", icon: Search, iconColor: MB },
  { title: "Consultations", url: "/medibondhu/consultations", icon: CalendarCheck, iconColor: MB },
  { title: "Prescriptions", url: "/medibondhu/prescriptions", icon: FileText, iconColor: MB },
];

const MEDI_BOTTOM: NavItem[] = [
  { title: "Access Center", url: "/medibondhu/access-center", icon: Shield, iconColor: "hsl(262, 83%, 58%)" },
  { title: "Profile", url: "/medibondhu/profile", icon: UserCircle, iconColor: ICON_COLORS.profile },
  { title: "Settings", url: "/medibondhu/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
];

export default function MediBondhuSidebar() {
  const { user, logout, hasRole, hasCapability } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isVetUser = hasRole("vet") || hasCapability("can_consult_as_vet");
  const profilePath = isVetUser ? "/vet/profile" : "/medibondhu/profile";
  const mediBottom = MEDI_BOTTOM.map((item) =>
    item.url === "/medibondhu/profile" ? { ...item, url: profilePath } : item
  );

  if (!user) return null;

  const renderItem = (item: NavItem) => {
    const path = location.pathname;
    const active =
      item.url === "/medibondhu"
        ? path === "/medibondhu" || path === "/medibondhu/"
        : path === item.url || path.startsWith(`${item.url}/`);
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.url} end className="medibondhu-nav-item transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: MB, color: "white" } : undefined}>
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="medibondhu-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" style={{ color: MB }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: MB }}>MediBondhu</span>
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
            {MEDIBONDHU_ITEMS.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons targets={["farm", "marketplace", "learning", "community"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {mediBottom.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button onClick={() => navigate(profilePath)} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: MB }}>
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
