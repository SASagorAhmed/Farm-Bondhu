import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE, api, readSession, subscribeVetInboxNewBooking } from "@/api/client";
import { CalendarCheck, MessageSquare, Users, DollarSign, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/StatCard";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { patchBookingList, subscribeConsultationBookings } from "@/lib/consultationRealtime";
import { withApiTiming } from "@/lib/perfMetrics";

export default function VetDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState<string | null>(null);
  const [vetParticipantIds, setVetParticipantIds] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const dashboardQueryKey = queryKeys().vetBookingsDashboard(user?.id);
  const consultationsQueryKey = queryKeys().vetConsultations(user?.id);

  const patchAcceptedBooking = (row: any) => ({
    ...(row || {}),
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
      const data = q.state.data as { pendingBookings?: any[]; todayBookings?: any[] } | undefined;
      const pendingCount = Array.isArray(data?.pendingBookings) ? data.pendingBookings.length : 0;
      return pendingCount > 0 ? 1000 : 2000;
    },
    queryFn: async () => {
      const token = readSession()?.access_token;
      const res = await withApiTiming("/v1/medibondhu/vet/dashboard/bootstrap", () =>
        fetch(`${API_BASE}/v1/medibondhu/vet/dashboard/bootstrap?limit=30`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      );
      if (!res.ok || res.status === 304) {
        const prev = queryClient.getQueryData<{ pendingBookings: any[]; todayBookings: any[] }>(dashboardQueryKey);
        return prev || { pendingBookings: [], todayBookings: [] };
      }
      const body = (await res.json().catch(() => ({}))) as {
        data?: { pendingBookings?: any[]; todayBookings?: any[] };
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
    void api
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
        queryClient.setQueryData<{ pendingBookings: any[]; todayBookings: any[] }>(
          dashboardQueryKey,
          (prev) => {
            const current = prev || { pendingBookings: [], todayBookings: [] };
            const nextPending = patchBookingList(current.pendingBookings || [], eventType, row).filter(
              (b) => b.status === "pending" || b.status === "confirmed"
            );
            const nextToday = patchBookingList(current.todayBookings || [], eventType, row).filter(
              (b) => b.status === "in_progress" || b.status === "completed"
            );
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
    return subscribeVetInboxNewBooking(user.id, () => {
      queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
      queryClient.invalidateQueries({ queryKey: consultationsQueryKey });
    });
  }, [consultationsQueryKey, dashboardQueryKey, queryClient, user?.id]);

  const handleAccept = async (bookingId: string) => {
    setAccepting(bookingId);
    const { error } = await api
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
    queryClient.setQueryData<{ pendingBookings: any[]; todayBookings: any[] }>(
      dashboardQueryKey,
      (prev) => {
        const current = prev || { pendingBookings: [], todayBookings: [] };
        const acceptedFromPending = (current.pendingBookings || []).find((b: any) => b.id === bookingId);
        const nextPending = (current.pendingBookings || []).filter((b: any) => b.id !== bookingId);
        const alreadyToday = (current.todayBookings || []).some((b: any) => b.id === bookingId);
        const acceptedRow = acceptedFromPending
          ? patchAcceptedBooking(acceptedFromPending)
          : patchAcceptedBooking({ id: bookingId });
        const nextToday = alreadyToday
          ? (current.todayBookings || []).map((b: any) => (b.id === bookingId ? patchAcceptedBooking(b) : b))
          : [acceptedRow, ...(current.todayBookings || [])];
        return { pendingBookings: nextPending, todayBookings: nextToday };
      }
    );
    queryClient.setQueriesData(
      { queryKey: consultationsQueryKey },
      (prev: any) => {
        if (!prev) return prev;
        if (Array.isArray(prev)) {
          return prev.map((b) => (b?.id === bookingId ? patchAcceptedBooking(b) : b));
        }
        const prevConsultations = Array.isArray(prev.consultations) ? prev.consultations : [];
        return {
          ...prev,
          consultations: prevConsultations.map((b: any) => (b?.id === bookingId ? patchAcceptedBooking(b) : b)),
        };
      }
    );
    queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
    queryClient.invalidateQueries({ queryKey: consultationsQueryKey });
    navigate(`/vet/room/${bookingId}`);
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
