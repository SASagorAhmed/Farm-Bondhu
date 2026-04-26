import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, CalendarCheck, Users, FileText, Clock, DollarSign,
  UserCircle, User, LogOut, Menu, PanelLeftClose, Stethoscope, Shield, Settings,
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

const VET_ITEMS: NavItem[] = [
  { title: "Dashboard", url: "/vet/dashboard", icon: LayoutDashboard, iconColor: MB },
  { title: "Consultations", url: "/vet/consultations", icon: CalendarCheck, iconColor: ICON_COLORS.orders },
  { title: "Patients", url: "/vet/patients", icon: Users, iconColor: ICON_COLORS.profile },
  { title: "Prescriptions", url: "/vet/prescriptions", icon: FileText, iconColor: ICON_COLORS.learning },
  { title: "Availability", url: "/vet/availability", icon: Clock, iconColor: ICON_COLORS.bell },
  { title: "Earnings", url: "/vet/earnings", icon: DollarSign, iconColor: ICON_COLORS.dollar },
  { title: "Profile", url: "/vet/profile", icon: UserCircle, iconColor: ICON_COLORS.profile },
];

const VET_BOTTOM: NavItem[] = [
  { title: "Access Center", url: "/vet/access-center", icon: Shield, iconColor: "hsl(262, 83%, 58%)" },
  { title: "Account", url: "/vet/profile", icon: User, iconColor: ICON_COLORS.profile },
  { title: "Settings", url: "/vet/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
];

export default function VetSidebar() {
  const { user, logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) return null;

  const isProfilePath = location.pathname === "/vet/profile" || location.pathname === "/vet/profile-account";

  const renderItem = (item: NavItem) => {
    const active = item.url === "/vet/profile"
      ? isProfilePath
      : location.pathname === item.url || location.pathname.startsWith(item.url + "/");
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.url} end className="transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: MB, color: "white" } : undefined}>
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="vet-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" style={{ color: MB }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: MB }}>Vet Panel</span>
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
            {VET_ITEMS.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons targets={["farm", "marketplace", "learning", "community"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {VET_BOTTOM.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button
            onClick={() => {
              if (!isProfilePath) navigate("/vet/profile");
            }}
            className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer rounded-lg"
            style={isProfilePath ? { backgroundColor: `${MB}20` } : undefined}
          >
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
