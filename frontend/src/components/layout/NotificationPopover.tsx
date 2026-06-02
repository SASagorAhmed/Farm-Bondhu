import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  fetchNotifications,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsQueryKey,
  resolveNotificationTarget,
  subscribeNotificationsRealtime,
  type NotificationRow,
  typeIcons,
  typeIconColors,
} from "@/lib/notificationHelpers";

const PREVIEW_LIMIT = 6;

type NotificationPopoverProps = {
  notificationsPath: string;
};

export default function NotificationPopover({ notificationsPath }: NotificationPopoverProps) {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const userId = user?.id;

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: notificationsQueryKey(userId),
    queryFn: () => fetchNotifications(userId),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!userId) {
      queryClient.removeQueries({ queryKey: ["notifications"] });
      return;
    }
    return subscribeNotificationsRealtime(userId, queryClient, "notifications-popover-realtime");
  }, [queryClient, userId]);

  const preview = useMemo(() => notifications.slice(0, PREVIEW_LIMIT), [notifications]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead(notifications, queryClient, userId);
  };

  const handleItemClick = async (n: NotificationRow) => {
    if (!n.read) {
      await markNotificationRead(n.id, queryClient, userId);
    }
    const target = n.action_url || n.link;
    if (target) {
      navigate(resolveNotificationTarget(target, hasRole("admin")));
    }
    setOpen(false);
  };

  const handleSeeAll = () => {
    setOpen(false);
    navigate(notificationsPath);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" style={{ color: ICON_COLORS.bell }} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(100vw-1rem,380px)] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-display font-semibold text-sm text-foreground truncate">
              {t("notifications.popover.title")}
            </h2>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold shrink-0">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              {t("notifications.popover.markAllRead")}
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : preview.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium text-foreground">{t("notifications.popover.empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("notifications.popover.emptyHint")}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <div className="divide-y divide-border">
              {preview.map((n) => {
                const Icon = typeIcons[n.type] || Bell;
                const iconColor = typeIconColors[n.type] || ICON_COLORS.dashboard;
                return (
                  <button
                    key={n.id}
                    type="button"
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50 ${
                      !n.read ? "bg-muted/40 border-l-2" : "opacity-80"
                    }`}
                    style={!n.read ? { borderLeftColor: iconColor } : undefined}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                        style={
                          !n.read
                            ? { backgroundColor: `${iconColor}1A`, color: iconColor }
                            : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                        }
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm font-medium leading-snug line-clamp-1 ${
                              !n.read ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span
                              className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                              style={{ backgroundColor: iconColor }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[11px] text-muted-foreground/80 mt-1.5">
                          {formatNotificationTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            className="w-full justify-between h-9 text-sm font-medium text-primary hover:text-primary"
            onClick={handleSeeAll}
          >
            {t("notifications.popover.seeAll")}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
