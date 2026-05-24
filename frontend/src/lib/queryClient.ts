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
    /** VetBondhu patient room / waiting bootstrap (isolated from MediBondhu React Query cache). */
    vetbondhuWaitingRoomBooking: (bookingId?: string) => ["vetbondhu-waiting-room-booking", bookingId || "unknown"] as const,
    vetbondhuConsultationRoom: (bookingId?: string) => ["vetbondhu-consultation-room", bookingId || "unknown"] as const,
    vetEarnings: (userId?: string) => ["vet-earnings", userId || "anonymous"] as const,
    vetById: (vetId?: string) => ["vet-profile", vetId || "unknown"] as const,
    vetSlots: (vetId?: string, date?: string) => ["vet-slots", vetId || "unknown", date || "none"] as const,
    orders: (userId?: string) => ["orders", userId || "anonymous"] as const,
    notifications: (userId?: string) => ["notifications", userId || "anonymous"] as const,
    approvalQueue: (filter: string) => ["approval-requests", filter] as const,
    prescriptions: (userId?: string) => ["medibondhu-prescriptions", userId || "anonymous"] as const,
    vetbondhuPrescriptions: (userId?: string) => ["vetbondhu-prescriptions", userId || "anonymous"] as const,
    /** MediBondhu human (physician appointments) — never share cache keys with vet flows. */
    medibondhuHumanSpecialties: () => ["medibondhu-human-specialties"] as const,
    medibondhuHumanDoctorsPreview: (userId?: string) => ["medibondhu-human-doctors-preview", userId || "anon"] as const,
    medibondhuHumanDoctors: (userId?: string, q?: string, spec?: string) =>
      ["medibondhu-human-doctors", userId || "anon", q || "", spec || ""] as const,
    medibondhuHumanDoctorDetail: (doctorId?: string) => ["medibondhu-human-doctor", doctorId || "x"] as const,
    medibondhuHumanSlots: (doctorId?: string, date?: string) =>
      ["medibondhu-human-slots", doctorId || "x", date || ""] as const,
    medibondhuHumanPatientAppointments: (userId?: string, offset?: number) =>
      ["medibondhu-human-appt-patient", userId || "anon", offset ?? 0] as const,
    medibondhuHumanDoctorAppointments: (userId?: string, offset?: number) =>
      ["medibondhu-human-appt-doctor", userId || "anon", offset ?? 0] as const,
    medibondhuHumanAppointmentDetail: (id?: string) => ["medibondhu-human-appt-detail", id || "x"] as const,
    medibondhuHumanWaitingRoom: (appointmentId?: string) =>
      ["medibondhu-human-waiting-room", appointmentId || "unknown"] as const,
    /** MediBondhu teleconsult room (Zego uses `medi-human-{id}` namespace; never VetBondhu keys). */
    medibondhuHumanConsultationRoom: (appointmentId?: string) =>
      ["medibondhu-human-consultation-room", appointmentId || "unknown"] as const,
    medibondhuHumanPatientPrescriptions: (userId?: string) => ["medibondhu-human-rx-patient", userId || "anon"] as const,
    medibondhuHumanPrescriptionDetail: (rxId?: string) => ["medibondhu-human-rx-detail", rxId || "x"] as const,
    medibondhuHumanDoctorPrescriptions: (userId?: string) => ["medibondhu-human-rx-doctor", userId || "anon"] as const,
    medibondhuHumanDoctorSchedule: (userId?: string, from?: string, to?: string) =>
      ["medibondhu-human-doctor-slots", userId || "anon", from || "", to || ""] as const,
    medibondhuHumanDoctorProfile: (userId?: string) => ["medibondhu-human-doctor-profile", userId || "anon"] as const,
    medibondhuHumanDoctorEarnings: (userId?: string) => ["medibondhu-human-doctor-earnings", userId || "anon"] as const,
    medibondhuHumanAdminDoctorWithdrawals: (status?: string) => ["medibondhu-human-admin-doctor-withdrawals", status || "all"] as const,
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
    buster: "v2-medibondhu-opening-slots",
  });
}

