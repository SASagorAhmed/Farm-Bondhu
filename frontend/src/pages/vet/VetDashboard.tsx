import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE, vetbondhuApi, readSession, subscribeVetbondhuVetInboxNewBooking, subscribeVetInboxNewBooking } from "@/api/client";
import { CalendarCheck, MessageSquare, Users, DollarSign, Clock, AlertCircle, CheckCircle, Search, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/StatCard";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { patchBookingList, subscribeConsultationBookings } from "@/lib/consultationRealtime";
import { withApiTiming } from "@/lib/perfMetrics";

const PRESCRIPTION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VetDashboardBooking = {
  id: string;
  patient_name?: string | null;
  animal_type?: string | null;
  symptoms?: string | null;
  consultation_method?: string | null;
  booking_type?: string | null;
  status?: string | null;
  leave_deadline_at?: string | null;
  left_user_id?: string | null;
  [key: string]: unknown;
};

type VetDashboardData = {
  pendingBookings: VetDashboardBooking[];
  todayBookings: VetDashboardBooking[];
};

type VetConsultationsCache =
  | VetDashboardBooking[]
  | {
      consultations?: VetDashboardBooking[];
      [key: string]: unknown;
    };

export default function VetDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState<string | null>(null);
  const [prescriptionSearchCode, setPrescriptionSearchCode] = useState("");
  const [searchingPrescription, setSearchingPrescription] = useState(false);
  const [vetParticipantIds, setVetParticipantIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const dashboardQueryKey = queryKeys().vetBookingsDashboard(user?.id);
  const consultationsQueryKey = queryKeys().vetConsultations(user?.id);

  const patchAcceptedBooking = (row: Partial<VetDashboardBooking> | null | undefined): VetDashboardBooking => ({
    ...(row || {}),
    id: String(row?.id || ""),
    status: "in_progress",
    leave_deadline_at: null,
    left_user_id: null,
  });

  const { data: bookingData } = useQuery({
    queryKey: dashboardQueryKey,
    enabled: Boolean(user?.id),
    staleTime: 15 * 1000,
    gcTime: moduleCachePolicy.vet.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: (q) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
      const data = q.state.data as Partial<VetDashboardData> | undefined;
      const pendingCount = Array.isArray(data?.pendingBookings) ? data.pendingBookings.length : 0;
      return pendingCount > 0 ? 1000 : 2000;
    },
    queryFn: async () => {
      const token = readSession()?.access_token;
      const res = await withApiTiming("/v1/vetbondhu/vet/dashboard/bootstrap", () =>
        fetch(`${API_BASE}/v1/vetbondhu/vet/dashboard/bootstrap?limit=30`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      );
      if (!res.ok || res.status === 304) {
        const prev = queryClient.getQueryData<VetDashboardData>(dashboardQueryKey);
        return prev || { pendingBookings: [], todayBookings: [] };
      }
      const body = (await res.json().catch(() => ({}))) as {
        data?: Partial<VetDashboardData>;
      };
      return {
        pendingBookings: body.data?.pendingBookings || [],
        todayBookings: body.data?.todayBookings || [],
      };
    },
  });

  const pendingBookings = bookingData?.pendingBookings || [];
  const todayBookings = bookingData?.todayBookings || [];

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setVetParticipantIds([]);
      return;
    }
    void vetbondhuApi
      .from("vets")
      .select("id,user_id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? data[0] : null;
        const ids = [user.id, row?.id, row?.user_id]
          .map((v) => String(v || "").trim())
          .filter(Boolean);
        setVetParticipantIds(Array.from(new Set(ids)));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Realtime subscription for new/updated bookings
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeConsultationBookings({
      channelKey: `vet-dashboard-bookings-${user.id}`,
      userId: user.id,
      participantIds: vetParticipantIds,
      onEvent: (eventType, row) => {
        queryClient.setQueryData<VetDashboardData>(
          dashboardQueryKey,
          (prev) => {
            const current = prev || { pendingBookings: [], todayBookings: [] };
            const nextPending = patchBookingList(current.pendingBookings || [], eventType, row).filter(
              (b): b is VetDashboardBooking => b.status === "pending" || b.status === "confirmed"
            ) as VetDashboardBooking[];
            const nextToday = patchBookingList(current.todayBookings || [], eventType, row).filter(
              (b): b is VetDashboardBooking => b.status === "in_progress" || b.status === "completed"
            ) as VetDashboardBooking[];
            return { pendingBookings: nextPending, todayBookings: nextToday };
          }
        );
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
        queryClient.invalidateQueries({ queryKey: queryKeys().vetConsultations(user?.id) });
      },
    });

    return unsubscribe;
  }, [dashboardQueryKey, queryClient, user?.id, vetParticipantIds]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubMedi = subscribeVetInboxNewBooking(user.id, () => {
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: consultationsQueryKey });
    });
    const unsubVetbondhu = subscribeVetbondhuVetInboxNewBooking(user.id, () => {
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: consultationsQueryKey });
    });
    return () => {
      unsubMedi();
      unsubVetbondhu();
    };
  }, [consultationsQueryKey, dashboardQueryKey, queryClient, user?.id]);

  const handleAccept = async (bookingId: string) => {
    setAccepting(bookingId);
    const { error } = await vetbondhuApi
      .from("consultation_bookings")
      .update({ status: "in_progress" })
      .eq("id", bookingId);

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to accept consultation.",
        variant: "destructive",
      });
      setAccepting(null);
      return;
    }

    toast({ title: "Consultation accepted!", description: "Joining the room now..." });
    queryClient.setQueryData<VetDashboardData>(
      dashboardQueryKey,
      (prev) => {
        const current = prev || { pendingBookings: [], todayBookings: [] };
        const acceptedFromPending = (current.pendingBookings || []).find((b) => b.id === bookingId);
        const nextPending = (current.pendingBookings || []).filter((b) => b.id !== bookingId);
        const alreadyToday = (current.todayBookings || []).some((b) => b.id === bookingId);
        const acceptedRow = acceptedFromPending
          ? patchAcceptedBooking(acceptedFromPending)
          : patchAcceptedBooking({ id: bookingId });
        const nextToday = alreadyToday
          ? (current.todayBookings || []).map((b) => (b.id === bookingId ? patchAcceptedBooking(b) : b))
          : [acceptedRow, ...(current.todayBookings || [])];
        return { pendingBookings: nextPending, todayBookings: nextToday };
      }
    );
    queryClient.setQueriesData(
      { queryKey: consultationsQueryKey },
      (prev: VetConsultationsCache | undefined) => {
        if (!prev) return prev;
        if (Array.isArray(prev)) {
          return prev.map((b) => (b?.id === bookingId ? patchAcceptedBooking(b) : b));
        }
        const prevConsultations = Array.isArray(prev.consultations) ? prev.consultations : [];
        return {
          ...prev,
          consultations: prevConsultations.map((b) => (b?.id === bookingId ? patchAcceptedBooking(b) : b)),
        };
      }
    );
    queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    queryClient.invalidateQueries({ queryKey: consultationsQueryKey });
    navigate(`/vet/room/${bookingId}`);
  };

  const openPrescriptionByCode = async () => {
    const raw = prescriptionSearchCode.trim();
    const code = PRESCRIPTION_ID_RE.test(raw)
      ? raw
      : raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!PRESCRIPTION_ID_RE.test(code) && !/^[A-Z0-9]{6}$/.test(code)) {
      toast({ title: "Enter a prescription code or ID", variant: "destructive" });
      return;
    }
    const token = readSession()?.access_token;
    setSearchingPrescription(true);
    try {
      const res = await fetch(`${API_BASE}/v1/vetbondhu/prescriptions/search?code=${encodeURIComponent(code)}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { data?: { id?: string }; error?: string };
      if (!res.ok || !body.data?.id) throw new Error(body.error || "Prescription not found");
      navigate(`/vet/prescriptions/${body.data.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prescription not found";
      toast({ title: message, variant: "destructive" });
    } finally {
      setSearchingPrescription(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Welcome, Dr. {user?.name} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Here's your consultation overview for today.</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Pending Requests" value={String(pendingBookings.length)} icon={<MessageSquare className="h-5 w-5" />} iconColor={ICON_COLORS.cart} />
        <StatCard title="Today's Sessions" value={String(todayBookings.length)} icon={<CalendarCheck className="h-5 w-5" />} iconColor={ICON_COLORS.medibondhu} />
        <StatCard title="Total Patients" value="—" icon={<Users className="h-5 w-5" />} iconColor={ICON_COLORS.profile} />
        <StatCard title="Earnings (Month)" value="—" icon={<DollarSign className="h-5 w-5" />} iconColor={ICON_COLORS.dollar} />
      </div>

      <Card className="border-border">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Search VetBondhu prescription</p>
            <p className="text-xs text-muted-foreground">Enter a patient-provided prescription code or ID to open the record.</p>
          </div>
          <div className="flex gap-2 md:w-[380px]">
            <Input
              value={prescriptionSearchCode}
              onChange={(event) => setPrescriptionSearchCode(event.target.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 36))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void openPrescriptionByCode();
              }}
              placeholder="123456 or prescription UUID"
              className="font-mono tracking-widest"
              maxLength={36}
            />
            <Button type="button" className="text-white" style={{ backgroundColor: ICON_COLORS.vetbondhu }} disabled={searchingPrescription} onClick={() => void openPrescriptionByCode()}>
              {searchingPrescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending Requests - Real Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5" style={{ color: ICON_COLORS.cart }} />
              Pending Requests ({pendingBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingBookings.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No pending requests</p>
              )}
              {pendingBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{booking.patient_name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {booking.animal_type || "Unknown"} — {booking.symptoms || "No symptoms noted"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {booking.consultation_method} • {booking.booking_type}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(booking.id)}
                    disabled={accepting === booking.id}
                    className="ml-3 shrink-0"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {accepting === booking.id ? "Joining..." : "Accept"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Today's Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" style={{ color: ICON_COLORS.medibondhu }} />
              Today's Sessions ({todayBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayBookings.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions today</p>
              )}
              {todayBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-foreground">{booking.patient_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.animal_type || "Unknown"} • {booking.consultation_method}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    booking.status === "in_progress"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {booking.status === "in_progress" ? "In Progress" : "Completed"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
