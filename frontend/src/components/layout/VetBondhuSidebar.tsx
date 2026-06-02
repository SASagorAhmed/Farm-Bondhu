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
  Shield, Settings, Scale, Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";
import { useLanguage } from "@/contexts/LanguageContext";

const VB = ICON_COLORS.vetbondhu;

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

const VB_BOTTOM: NavItem[] = [
  { title: "Access Center", url: "/vetbondhu/access-center", icon: Shield, iconColor: VB },
  { title: "Profile", url: "/vetbondhu/profile", icon: UserCircle, iconColor: ICON_COLORS.profile },
  { title: "Help & Support", url: "/vetbondhu/support", icon: Headphones, iconColor: VB },
  { title: "Settings", url: "/vetbondhu/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
];

export default function VetBondhuSidebar() {
  const { user, logout, hasRole, hasCapability } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isVetUser = hasRole("vet") || hasCapability("can_consult_as_vet");
  const profilePath = isVetUser ? "/vet/profile" : "/vetbondhu/profile";

  const VETBONDHU_ITEMS: NavItem[] = [
    { title: "Home", url: "/vetbondhu", icon: LayoutGrid, iconColor: VB },
    { title: "Find Vet", url: "/vetbondhu/vets", icon: Search, iconColor: VB },
    { title: "Consultations", url: "/vetbondhu/consultations", icon: CalendarCheck, iconColor: VB },
    { title: "Prescriptions", url: "/vetbondhu/prescriptions", icon: FileText, iconColor: VB },
    { title: t("sidebar.cowWeight"), url: "/vetbondhu/cow-weight", icon: Scale, iconColor: VB },
  ];

  const bottomNav = VB_BOTTOM.map((item) =>
    item.url === "/vetbondhu/profile" ? { ...item, url: profilePath } : item
  );

  if (!user) return null;

  const renderItem = (item: NavItem) => {
    const path = location.pathname;
    const active =
      item.url === "/vetbondhu"
        ? path === "/vetbondhu" || path === "/vetbondhu/"
        : path === item.url || path.startsWith(`${item.url}/`);
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.url} end className="vetbondhu-nav-item transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: VB, color: "white" } : undefined}>
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="vetbondhu-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4" style={{ color: VB }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: VB }}>VetBondhu</span>
              </div>
              <button type="button" onClick={toggleSidebar} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button type="button" onClick={toggleSidebar} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mx-auto">
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <div className="px-2 py-2">
          <SidebarMenu>
            {VETBONDHU_ITEMS.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons currentWorkspace="vetbondhu" collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {bottomNav.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button type="button" onClick={() => navigate(profilePath)} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: VB }}>
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
