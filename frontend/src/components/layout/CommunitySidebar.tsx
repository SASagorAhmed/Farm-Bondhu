import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  LayoutGrid, PenSquare, HelpCircle, AlertTriangle, Bookmark, User, LogOut, Menu, PanelLeftClose,
  MessageSquareText, UserCircle, Settings, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ICON_COLORS } from "@/lib/iconColors";
import WorkspaceButtons from "./WorkspaceButtons";
import { useLanguage } from "@/contexts/LanguageContext";

const CB = ICON_COLORS.community;

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  iconColor: string;
}

export default function CommunitySidebar() {
  const { user, logout, hasRole, hasCapability } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isVetUser = hasRole("vet") || hasCapability("can_consult_as_vet");
  const profilePath = isVetUser ? "/vet/profile" : "/community/profile";

  if (!user) return null;

  const COMMUNITY_ITEMS: NavItem[] = [
    { title: t("sidebar.feed"), url: "/community", icon: LayoutGrid, iconColor: CB },
    { title: t("sidebar.createPost"), url: "/community/create", icon: PenSquare, iconColor: CB },
    { title: t("sidebar.unanswered"), url: "/community/unanswered", icon: HelpCircle, iconColor: "#F59E0B" },
    { title: t("sidebar.urgent"), url: "/community/urgent", icon: AlertTriangle, iconColor: "#F43F5E" },
    { title: t("sidebar.myPosts"), url: "/community/my-posts", icon: User, iconColor: ICON_COLORS.profile },
    { title: t("sidebar.saved"), url: "/community/saved", icon: Bookmark, iconColor: ICON_COLORS.bell },
    { title: t("sidebar.history"), url: "/community/history", icon: Clock, iconColor: "#8B5CF6" },
  ];

  const COMMUNITY_BOTTOM: NavItem[] = [
    { title: t("sidebar.profile"), url: profilePath, icon: UserCircle, iconColor: ICON_COLORS.profile },
    { title: t("sidebar.settings"), url: "/community/settings", icon: Settings, iconColor: ICON_COLORS.dashboard },
  ];

  const renderItem = (item: NavItem) => {
    const active = item.url === "/community"
      ? location.pathname === "/community"
      : location.pathname === item.url || location.pathname.startsWith(item.url + "/");
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={active}>
          <NavLink to={item.url} end className="transition-all duration-200 rounded-lg" activeClassName="text-white font-medium shadow-sm" style={active ? { backgroundColor: CB, color: "white" } : undefined}>
            <item.icon className="h-4 w-4" style={{ color: active ? "white" : item.iconColor }} />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="community-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center justify-between">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" style={{ color: CB }} />
                <span className="text-sm font-semibold tracking-tight" style={{ color: CB }}>{t("sidebar.community")}</span>
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
            {COMMUNITY_ITEMS.map(renderItem)}
          </SidebarMenu>
        </div>

        <WorkspaceButtons targets={["farm", "marketplace", "vet", "medibondhu", "learning"]} collapsed={collapsed} />

        <div className="px-2 py-1">
          <Separator className="my-2" />
          <SidebarMenu>
            {COMMUNITY_BOTTOM.map(renderItem)}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <button onClick={() => navigate(profilePath)} className="flex items-center gap-2 mb-2 px-1 w-full hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: CB }}>
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
