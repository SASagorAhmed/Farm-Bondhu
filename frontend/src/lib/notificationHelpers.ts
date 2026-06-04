import type { ElementType } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Banknote, Info, Package, ShieldCheck, Stethoscope, Tractor } from "lucide-react";
import { api } from "@/api/client";
import { ICON_COLORS } from "@/lib/iconColors";
import type { QueryClient } from "@tanstack/react-query";

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  context: string;
  priority: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  link?: string | null;
  created_at: string;
};

export const typeIcons: Record<string, ElementType> = {
  approval: ShieldCheck,
  system: Info,
  order: Package,
  vet: Stethoscope,
  farm: Tractor,
  general: Bell,
  seller_withdrawal_submitted: Banknote,
  seller_withdrawal_review: Banknote,
  seller_withdrawal_new: Banknote,
};

export const typeIconColors: Record<string, string> = {
  approval: ICON_COLORS.admin || ICON_COLORS.profile,
  system: ICON_COLORS.dashboard,
  order: ICON_COLORS.marketplace,
  vet: ICON_COLORS.stethoscope,
  farm: ICON_COLORS.farmBrand,
  general: ICON_COLORS.dashboard,
  seller_withdrawal_submitted: ICON_COLORS.finance,
  seller_withdrawal_review: ICON_COLORS.finance,
  seller_withdrawal_new: ICON_COLORS.admin,
};

export const priorityColors: Record<string, { bg: string; color: string }> = {
  high: { bg: `${ICON_COLORS.health}1A`, color: ICON_COLORS.health },
  medium: { bg: `${ICON_COLORS.dashboard}1A`, color: ICON_COLORS.dashboard },
  low: { bg: `${ICON_COLORS.farm}1A`, color: ICON_COLORS.farm },
};

export const ADMIN_ROUTE_MAP: Record<string, string> = {
  "/dashboard": "/admin",
  "/dashboard/access-center": "/admin/approvals",
  "/marketplace": "/admin/marketplace",
  "/learning": "/admin/learning",
  "/seller/dashboard": "/admin/marketplace",
  "/seller/payouts": "/admin/marketplace/payouts",
  "/medibondhu": "/admin/medibondhu-human",
  "/vet/dashboard": "/admin/vetbondhu-overview",
  "/vetbondhu": "/admin/vetbondhu-overview",
  "/orders": "/admin/orders",
  "/dashboard/farms": "/admin/farms",
  "/dashboard/animals": "/admin/farms",
  "/community": "/admin/community",
};

const WORKSPACE_NOTIFICATION_ROUTES = [
  { prefix: "/vetbondhu", path: "/vetbondhu/notifications" },
  { prefix: "/medibondhu", path: "/medibondhu/notifications" },
  { prefix: "/vet", path: "/vet/notifications" },
  { prefix: "/marketplace", path: "/marketplace/notifications" },
  { prefix: "/cart", path: "/marketplace/notifications" },
  { prefix: "/checkout", path: "/marketplace/notifications" },
  { prefix: "/orders", path: "/marketplace/notifications" },
  { prefix: "/my-shop", path: "/seller/notifications" },
  { prefix: "/seller", path: "/seller/notifications" },
  { prefix: "/buyer", path: "/buyer/notifications" },
  { prefix: "/access-center", path: "/buyer/notifications" },
  { prefix: "/learning", path: "/learning/notifications" },
  { prefix: "/community", path: "/community/notifications" },
  { prefix: "/admin", path: "/admin/notifications" },
  { prefix: "/dashboard", path: "/dashboard/notifications" },
] as const;

export function getNotificationPath(pathname: string): string {
  const match = WORKSPACE_NOTIFICATION_ROUTES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return match?.path ?? "/dashboard/notifications";
}

export function resolveNotificationTarget(target: string, isAdmin: boolean): string {
  if (isAdmin && ADMIN_ROUTE_MAP[target]) {
    return ADMIN_ROUTE_MAP[target];
  }
  return target;
}

export function formatNotificationTime(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
}

export function isNotificationForUser(row: Pick<NotificationRow, "user_id"> | null | undefined, userId?: string): boolean {
  return Boolean(userId && row?.user_id && String(row.user_id) === String(userId));
}

export function filterNotificationsForUser(rows: NotificationRow[] | null | undefined, userId?: string): NotificationRow[] {
  if (!userId || !Array.isArray(rows)) return [];
  return rows.filter((row) => isNotificationForUser(row, userId));
}

export async function fetchNotifications(userId?: string): Promise<NotificationRow[]> {
  if (!userId) return [];
  const { data, error } = await api
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return filterNotificationsForUser(data as NotificationRow[], userId);
}

export function notificationsQueryKey(userId?: string) {
  return ["notifications", userId] as const;
}

function notificationChannelName(channelId: string, userId: string): string {
  return `${channelId}-${String(userId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function subscribeNotificationsRealtime(
  userId: string,
  queryClient: QueryClient,
  channelId: string,
  options?: {
    onInsert?: (row: NotificationRow) => void;
  }
) {
  const channel = api
    .channel(notificationChannelName(channelId, userId))
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload: { eventType?: string; new?: NotificationRow }) => {
      const eventType = String(payload?.eventType || "").toUpperCase();
      const key = notificationsQueryKey(userId);

      if (eventType === "INSERT" && payload?.new) {
        if (!isNotificationForUser(payload.new, userId)) return;
        let inserted = false;
        queryClient.setQueryData<NotificationRow[]>(key, (prev = []) => {
          const row = payload.new as NotificationRow;
          if (prev.some((n) => n.id === row.id)) return prev;
          inserted = true;
          return [row, ...prev];
        });
        if (inserted) options?.onInsert?.(payload.new as NotificationRow);
        return;
      }
      if (eventType === "UPDATE" && payload?.new) {
        if (!isNotificationForUser(payload.new, userId)) return;
        queryClient.setQueryData<NotificationRow[]>(key, (prev = []) => {
          const row = payload.new as NotificationRow;
          return filterNotificationsForUser(
            prev.map((n) => (n.id === row.id ? row : n)),
            userId
          );
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: key });
    })
    .subscribe();

  return () => {
    api.removeChannel(channel);
  };
}

export async function markNotificationRead(
  id: string,
  queryClient: QueryClient,
  userId?: string
) {
  if (!userId) return;
  await api.from("notifications").update({ read: true }).eq("id", id);
  queryClient.setQueryData<NotificationRow[]>(notificationsQueryKey(userId), (prev = []) =>
    filterNotificationsForUser(
      prev.map((n) => (n.id === id && isNotificationForUser(n, userId) ? { ...n, read: true } : n)),
      userId
    )
  );
}

export async function markAllNotificationsRead(
  notifications: NotificationRow[],
  queryClient: QueryClient,
  userId?: string
) {
  if (!userId) return;
  const unreadIds = filterNotificationsForUser(notifications, userId).filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length === 0) return;
  await api.from("notifications").update({ read: true }).in("id", unreadIds);
  queryClient.setQueryData<NotificationRow[]>(notificationsQueryKey(userId), (prev = []) =>
    filterNotificationsForUser(prev, userId).map((n) => ({ ...n, read: true }))
  );
}
