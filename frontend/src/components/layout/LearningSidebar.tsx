import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  LogOut, Menu, PanelLeftClose, BookOpen, LayoutGrid, UserCircle,
  Shield, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";

const LB = ICON_COLORS.learning;

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

const LEARNING_ITEMS: NavItem[] = [
  { title: "Home", url: "/learning", icon: LayoutGrid, iconColor: LB },
];

const LEARNING_BOTTOM: NavItem[] = [
  { title: "Access Center", url: "/learning/access-center", icon: Shield, iconColor: "hsl(262, 83%, 58%)" },
  { title: "Profile", url: "/learning/profile", icon: UserCircle, iconColor: ICON_COLORS.profile },
  { title: "Settings", url: "/learning/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
];

export default function LearningSidebar() {
  const { user, logout, hasRole, hasCapability } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const isVetUser = hasRole("vet") || hasCapability("can_consult_as_vet");
  const profilePath = isVetUser ? "/vet/profile" : "/learning/profile";
  const learningBottom = LEARNING_BOTTOM.map((item) =>
    item.url === "/learning/profile" ? { ...item, url: profilePath } : item
  );

  if (!user) return null;

  const renderItem = (item: NavItem) => {
    const path = location.pathname;
    const active =
      item.url === "/learning"
        ? path === "/learning" || path === "/learning/"
        : path === item.url || path.startsWith(`${item.url}/`);
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.url} end className="learning-nav-item transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: LB, color: "white" } : undefined}>
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="learning-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" style={{ color: LB }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: LB }}>Learning Center</span>
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
            {LEARNING_ITEMS.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons targets={["farm", "marketplace", "vet", "medibondhu", "community"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {learningBottom.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button onClick={() => navigate(profilePath)} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: LB }}>
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
