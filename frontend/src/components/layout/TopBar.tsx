import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { api } from "@/api/client";
import { Bell, Search, Menu, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ICON_COLORS } from "@/lib/iconColors";
import BrandLogo from "@/components/BrandLogo";
import { useLanguage } from "@/contexts/LanguageContext";

function useProfileColor(pathname: string): string {
  if (pathname.startsWith("/learning")) return ICON_COLORS.learning;
  if (pathname.startsWith("/dashboard")) return ICON_COLORS.farmBrand;
  if (pathname.startsWith("/marketplace")) return ICON_COLORS.cart;
  if (pathname.startsWith("/medibondhu")) return ICON_COLORS.medibondhu;
  if (pathname.startsWith("/vet")) return ICON_COLORS.vet;
  if (pathname.startsWith("/buyer")) return ICON_COLORS.cart;
  if (pathname.startsWith("/seller")) return ICON_COLORS.store;
  if (pathname.startsWith("/admin")) return ICON_COLORS.admin || ICON_COLORS.profile;
  return ICON_COLORS.profile;
}

function getContextProfilePath(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "/dashboard/profile";
  if (pathname.startsWith("/marketplace")) return "/marketplace/profile";
  if (pathname.startsWith("/buyer")) return "/buyer/profile";
  if (pathname.startsWith("/seller")) return "/seller/profile";
  if (pathname.startsWith("/vet")) return "/vet/profile";
  if (pathname.startsWith("/medibondhu")) return "/medibondhu/profile";
  if (pathname.startsWith("/learning")) return "/learning/profile";
  if (pathname.startsWith("/admin")) return "/admin/profile";
  return "/profile";
}

function getNotificationPath(pathname: string): string {
  if (pathname.startsWith("/dashboard")) return "/dashboard/notifications";
  if (pathname.startsWith("/marketplace")) return "/marketplace/notifications";
  if (pathname.startsWith("/buyer")) return "/buyer/notifications";
  if (pathname.startsWith("/seller")) return "/seller/notifications";
  if (pathname.startsWith("/vet")) return "/vet/notifications";
  if (pathname.startsWith("/medibondhu")) return "/medibondhu/notifications";
  if (pathname.startsWith("/learning")) return "/learning/notifications";
  if (pathname.startsWith("/admin")) return "/admin/notifications";
  return "/dashboard/notifications";
}

export default function TopBar() {
  const { user, hasRole, hasCapability } = useAuth();
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const profileColor = useProfileColor(location.pathname);
  const isVetUser = hasRole("vet") || hasCapability("can_consult_as_vet");
  const [unreadCount, setUnreadCount] = useState(0);
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const { count } = await api
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      setUnreadCount(count || 0);
    };

    fetchUnread();

    const channel = api
      .channel("topbar-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchUnread())
      .subscribe();

    return () => { api.removeChannel(channel); };
  }, [user]);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-card flex items-center gap-3 px-4">
      <button className="md:hidden p-2 text-foreground" onClick={toggleSidebar}>
        <Menu size={22} />
      </button>

      <BrandLogo size="sm" />

      <div className="hidden md:flex flex-1 max-w-md ml-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("topbar.search")} className="pl-10 h-9 bg-background" />
        </div>
      </div>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <Button variant="ghost" size="icon" className="relative" onClick={() => navigate(getNotificationPath(location.pathname))}>
        <Bell className="h-5 w-5" style={{ color: ICON_COLORS.bell }} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">{unreadCount}</span>
        )}
      </Button>

      <button
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => {
          const target = isVetUser ? "/vet/profile" : getContextProfilePath(location.pathname);
          navigate(target);
        }}
      >
        <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: profileColor }}>
          {user?.name.charAt(0) || "?"}
        </div>
        <div className="hidden md:flex flex-col items-start">
          <span className="text-sm font-medium text-foreground leading-tight">{user?.name}</span>
          <span className="text-[10px] text-muted-foreground leading-tight">{formatUserRoleLabel(user)}</span>
        </div>
      </button>
    </header>
  );
}
