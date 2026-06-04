import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  resolveNotificationTarget,
  subscribeNotificationsRealtime,
  type NotificationRow,
} from "@/lib/notificationHelpers";

export default function GlobalNotificationAlertsHost() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      queryClient.removeQueries({ queryKey: ["notifications"] });
      return;
    }

    const showNotificationToast = (notification: NotificationRow) => {
      if (notification.read) return;
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

    return subscribeNotificationsRealtime(userId, queryClient, "global-notification-alerts", {
      onInsert: showNotificationToast,
    });
  }, [hasRole, navigate, queryClient, userId]);

  return null;
}
