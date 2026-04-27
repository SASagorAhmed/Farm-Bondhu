import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, ShieldCheck, Package, Stethoscope, Tractor, Info, CheckCheck, Loader2, Layers, ShoppingCart, BookOpen, GraduationCap, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  context: string;
  priority: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
};

const typeIcons: Record<string, React.ElementType> = {
  approval: ShieldCheck,
  system: Info,
  order: Package,
  vet: Stethoscope,
  farm: Tractor,
  general: Bell,
};

const typeIconColors: Record<string, string> = {
  approval: ICON_COLORS.admin || ICON_COLORS.profile,
  system: ICON_COLORS.dashboard,
  order: ICON_COLORS.marketplace,
  vet: ICON_COLORS.stethoscope,
  farm: ICON_COLORS.farmBrand,
  general: ICON_COLORS.dashboard,
};

const priorityColors: Record<string, { bg: string; color: string }> = {
  high: { bg: `${ICON_COLORS.health}1A`, color: ICON_COLORS.health },
  medium: { bg: `${ICON_COLORS.dashboard}1A`, color: ICON_COLORS.dashboard },
  low: { bg: `${ICON_COLORS.farm}1A`, color: ICON_COLORS.farm },
};

// Workspace definitions for tabs
const WORKSPACE_TABS = [
  { value: "all", label: "All", icon: Layers },
  { value: "unread", label: "Unread", icon: Bell },
  { value: "farm", label: "Farm", icon: Tractor, contexts: ["farm"] },
  { value: "marketplace", label: "Marketplace", icon: ShoppingCart, contexts: ["marketplace"] },
  { value: "medibondhu", label: "MediBondhu", icon: Stethoscope, contexts: ["medibondhu", "vet"] },
  { value: "learning", label: "Learning", icon: GraduationCap, contexts: ["learning"] },
  { value: "admin", label: "Admin", icon: ShieldCheck, contexts: ["admin"] },
];

interface NotificationsProps {
  /** Used as the default active tab — does NOT filter data at query level */
  contextFilter?: string[];
}

function getDefaultTab(contextFilter?: string[]): string {
  if (!contextFilter || contextFilter.length === 0) return "all";
  // Map contextFilter to the best matching workspace tab
  if (contextFilter.includes("farm")) return "farm";
  if (contextFilter.includes("marketplace")) return "marketplace";
  if (contextFilter.includes("medibondhu") || contextFilter.includes("vet")) return "medibondhu";
  if (contextFilter.includes("learning")) return "learning";
  if (contextFilter.includes("admin")) return "admin";
  return "all";
}

export default function Notifications({ contextFilter }: NotificationsProps) {
  const { user, hasRole, hasCapability } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState(() => getDefaultTab(contextFilter));

  // Filter workspace tabs based on user's actual roles/capabilities
  const visibleTabs = WORKSPACE_TABS.filter(tab => {
    if (tab.value === "all" || tab.value === "unread") return true;
    if (tab.value === "marketplace") return true;
    if (tab.value === "farm") return hasRole("farmer") || hasCapability("can_manage_farm");
    if (tab.value === "medibondhu") return hasRole("vet") || hasCapability("can_book_vet");
    if (tab.value === "learning") return hasCapability("can_access_learning") || hasRole("farmer");
    if (tab.value === "admin") return hasRole("admin");
    return false;
  });

  // Always fetch ALL notifications for the user — no context filtering at query level
  const fetchNotifications = async (): Promise<NotificationRow[]> => {
    if (!user) return [];
    const { data, error } = await api
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as NotificationRow[];
  };

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    enabled: Boolean(user),
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = api
      .channel("notifications-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload: any) => {
        const eventType = String(payload?.eventType || "").toUpperCase();
        if (eventType === "INSERT" && payload?.new) {
          queryClient.setQueryData<NotificationRow[]>(["notifications", user.id], (prev = []) => {
            const row = payload.new as NotificationRow;
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev];
          });
          return;
        }
        if (eventType === "UPDATE" && payload?.new) {
          queryClient.setQueryData<NotificationRow[]>(["notifications", user.id], (prev = []) => {
            const row = payload.new as NotificationRow;
            return prev.map((n) => (n.id === row.id ? row : n));
          });
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  // Filter logic: workspace tabs filter by context, "unread" filters by read state
  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "unread") return notifications.filter(n => !n.read);
    const tab = WORKSPACE_TABS.find(t => t.value === filter);
    if (tab && "contexts" in tab && tab.contexts) {
      return notifications.filter(n => tab.contexts!.includes(n.context) || n.context === "general");
    }
    return notifications;
  }, [filter, notifications]);

  const totalUnread = notifications.filter(n => !n.read).length;

  // Per-tab unread counts
  const getTabUnread = (tabValue: string): number => {
    if (tabValue === "all") return totalUnread;
    if (tabValue === "unread") return totalUnread;
    const tab = WORKSPACE_TABS.find(t => t.value === tabValue);
    if (tab && "contexts" in tab && tab.contexts) {
      return notifications.filter(n => !n.read && (tab.contexts!.includes(n.context) || n.context === "general")).length;
    }
    return 0;
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await api.from("notifications").update({ read: true }).in("id", unreadIds);
    queryClient.setQueryData<NotificationRow[]>(["notifications", user?.id], (prev = []) =>
      prev.map((n) => ({ ...n, read: true }))
    );
  };

  const ADMIN_ROUTE_MAP: Record<string, string> = {
    "/dashboard": "/admin",
    "/dashboard/access-center": "/admin/approvals",
    "/marketplace": "/admin/marketplace",
    "/learning": "/admin/learning",
    "/seller/dashboard": "/admin/marketplace",
    "/medibondhu": "/admin/medibondhu-overview",
    "/vet/dashboard": "/admin/medibondhu-overview",
    "/orders": "/admin/orders",
    "/dashboard/farms": "/admin/farms",
    "/dashboard/animals": "/admin/farms",
    "/community": "/admin/community",
  };

  const handleNotificationClick = async (n: NotificationRow) => {
    // Mark as read
    if (!n.read) {
      await api.from("notifications").update({ read: true }).eq("id", n.id);
      queryClient.setQueryData<NotificationRow[]>(["notifications", user?.id], (prev = []) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
    // Navigate if action_url exists
    if (n.action_url) {
      let targetUrl = n.action_url;
      if (hasRole("admin") && ADMIN_ROUTE_MAP[targetUrl]) {
        targetUrl = ADMIN_ROUTE_MAP[targetUrl];
      }
      navigate(targetUrl);
    }
  };

  const toggleRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id);
    if (!notif) return;
    await api.from("notifications").update({ read: !notif.read }).eq("id", id);
    queryClient.setQueryData<NotificationRow[]>(["notifications", user?.id], (prev = []) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  // Group by date
  const groupByDate = (items: NotificationRow[]) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups: { label: string; items: NotificationRow[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Earlier", items: [] },
    ];
    items.forEach(n => {
      const d = new Date(n.created_at); d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) groups[0].items.push(n);
      else if (d.getTime() === yesterday.getTime()) groups[1].items.push(n);
      else groups[2].items.push(n);
    });
    return groups.filter(g => g.items.length > 0);
  };

  const groups = groupByDate(filtered);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">{totalUnread} unread notification{totalUnread !== 1 ? "s" : ""}</p>
        </div>
        {totalUnread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark All Read
          </Button>
        )}
      </motion.div>

      {/* Workspace filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {visibleTabs.map(tab => {
            const count = getTabUnread(tab.value);
            const TabIcon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs gap-1.5 px-3">
                <TabIcon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px] font-bold ml-0.5">{count}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Grouped notification list */}
      {groups.map(group => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{group.label}</p>
          {group.items.map((n, i) => {
            const Icon = typeIcons[n.type] || Bell;
            const iconColor = typeIconColors[n.type] || ICON_COLORS.dashboard;
            const pc = priorityColors[n.priority] || priorityColors.low;
            // Workspace label
            const wsLabel = WORKSPACE_TABS.find(t => "contexts" in t && t.contexts?.includes(n.context))?.label || (n.context === "general" ? "General" : n.context);
            return (
              <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <Card
                  className={`shadow-card cursor-pointer transition-all duration-200 hover:shadow-elevated ${!n.read ? "border-l-4" : "opacity-70"}`}
                  style={!n.read ? { borderLeftColor: iconColor } : undefined}
                  onClick={() => handleNotificationClick(n)}
                >
                  <CardContent className="p-3.5 flex items-start gap-3">
                    <div
                      className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                      style={!n.read ? { backgroundColor: `${iconColor}1A`, color: iconColor } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className={`text-sm font-medium ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                        {n.action_url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                        <Badge style={{ backgroundColor: pc.bg, color: pc.color }} variant="secondary" className="text-[10px] h-4 px-1.5">{n.priority}</Badge>
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">{wsLabel}</Badge>
                        {!n.read && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: iconColor }} />}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No notifications</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter !== "all" ? "Try switching to \"All\" to see all notifications" : "You're all caught up!"}
          </p>
        </div>
      )}
    </div>
  );
}
