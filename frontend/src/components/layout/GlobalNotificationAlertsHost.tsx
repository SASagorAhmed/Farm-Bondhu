import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  resolveNotificationTarget,
  startNotificationsPolling,
  subscribeNotificationsRealtime,
  type NotificationRow,
} from "@/lib/notificationHelpers";

export default function GlobalNotificationAlertsHost() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const shownToastIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      queryClient.removeQueries({ queryKey: ["notifications"] });
      return;
    }

    const showNotificationToast = (notification: NotificationRow) => {
      if (notification.read) return;
      if (shownToastIdsRef.current.has(notification.id)) return;
      shownToastIdsRef.current.add(notification.id);
      const target = notification.action_url || notification.link || "";
      const goToTarget = () => {
        if (!target) return;
        navigate(resolveNotificationTarget(target, hasRole("admin")));
      };

      toast(notification.title || "New notification", {
        description: notification.message || undefined,
        action: target
          ? {
              label: "View",
              onClick: goToTarget,
            }
          : undefined,
        onClick: goToTarget,
      });
    };

    const stopRealtime = subscribeNotificationsRealtime(userId, queryClient, "global-notification-alerts", {
      onInsert: showNotificationToast,
    });
    const stopPolling = startNotificationsPolling(userId, queryClient, {
      intervalMs: 5000,
      onInsert: showNotificationToast,
    });
    return () => {
      stopRealtime();
      stopPolling();
    };
  }, [hasRole, navigate, queryClient, userId]);

  return null;
}
