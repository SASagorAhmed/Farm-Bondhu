import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const moduleCachePolicy = {
  auth: { staleTime: 30 * 1000, gcTime: 8 * 60 * 60 * 1000 },
  dashboard: { staleTime: 3 * 60 * 1000, gcTime: 8 * 60 * 60 * 1000 },
  marketplace: { staleTime: 5 * 60 * 1000, gcTime: 8 * 60 * 60 * 1000 },
  vet: { staleTime: 60 * 1000, gcTime: 8 * 60 * 60 * 1000 },
  admin: { staleTime: 2 * 60 * 1000, gcTime: 8 * 60 * 60 * 1000 },
} as const;

export function queryKeys() {
  return {
    me: (token?: string) => ["me-profile", token || "anonymous"] as const,
    dashboardOverview: (userId?: string) => ["dashboard-overview", userId || "anonymous"] as const,
    animals: (userId?: string) => ["animals", userId || "anonymous"] as const,
    farms: (userId?: string) => ["farms", userId || "anonymous"] as const,
    products: () => ["marketplace-products"] as const,
    adminOrders: () => ["admin-orders"] as const,
    vetApprovals: () => ["admin-vet-approvals"] as const,
    adminMarketplaceProducts: () => ["admin-marketplace-products"] as const,
    adminMarketplaceShops: () => ["admin-marketplace-shops"] as const,
    adminTeam: () => ["admin-team-members"] as const,
    officialShopProducts: () => ["official-shop-products"] as const,
    vetBookingsDashboard: (userId?: string) => ["vet-dashboard-bookings", userId || "anonymous"] as const,
    vetConsultations: (userId?: string) => ["vet-consultations", userId || "anonymous"] as const,
    adminDashboardStats: () => ["admin-dashboard-stats"] as const,
    adminReportsSummary: () => ["admin-reports-summary"] as const,
    adminFarmsOverview: () => ["admin-farms-overview"] as const,
    shopApprovals: () => ["shop-approvals"] as const,
    adminUserManagement: () => ["admin-user-management"] as const,
    waitingRoomBooking: (bookingId?: string) => ["waiting-room-booking", bookingId || "unknown"] as const,
    consultationRoom: (bookingId?: string) => ["consultation-room", bookingId || "unknown"] as const,
    vetEarnings: (userId?: string) => ["vet-earnings", userId || "anonymous"] as const,
    vetById: (vetId?: string) => ["vet-profile", vetId || "unknown"] as const,
    vetSlots: (vetId?: string, date?: string) => ["vet-slots", vetId || "unknown", date || "none"] as const,
    orders: (userId?: string) => ["orders", userId || "anonymous"] as const,
    notifications: (userId?: string) => ["notifications", userId || "anonymous"] as const,
    approvalQueue: (filter: string) => ["approval-requests", filter] as const,
    prescriptions: (userId?: string) => ["medibondhu-prescriptions", userId || "anonymous"] as const,
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 8 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

const isBrowser = typeof window !== "undefined";
if (isBrowser) {
  const persister = createSyncStoragePersister({
    storage: window.sessionStorage,
    key: "farmbondhu-query-cache",
  });
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 12 * 60 * 60 * 1000,
    buster: "v1",
  });
}

