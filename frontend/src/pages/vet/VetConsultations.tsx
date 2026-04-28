import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Clock, CheckCircle, AlertCircle, Video, FileText } from "lucide-react";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { patchBookingList, subscribeConsultationBookings } from "@/lib/consultationRealtime";

interface Booking {
  id: string;
  patient_name: string;
  animal_type: string | null;
  symptoms: string | null;
  status: string;
  consultation_method: string;
  fee: number;
  created_at: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
}
const TERMINAL_STATUSES = new Set(["cancelled", "completed"]);

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  confirmed: { label: "Pending", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  ending: { label: "Ending", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function bookingDisplayStatus(booking: Booking & { leave_deadline_at?: string | null }) {
  if (booking.status === "in_progress" && booking.leave_deadline_at) return "ending";
  return booking.status;
}

function canRejoinNow(booking: Booking & { leave_deadline_at?: string | null; left_user_id?: string | null }, currentUserId?: string) {
  if (booking.status !== "in_progress") return false;
  const hasLeaveDeadline = Boolean(booking.leave_deadline_at);
  if (!hasLeaveDeadline) return true;
  return !!currentUserId && String(booking.left_user_id || "") === String(currentUserId);
}

function canShowJoinButton(
  booking: Booking & { leave_deadline_at?: string | null; left_user_id?: string | null },
  currentUserId?: string
) {
  if (TERMINAL_STATUSES.has(String(booking.status || ""))) return false;
  return canRejoinNow(booking, currentUserId);
}

function formatDateTimeSafe(value: string | null | undefined, fallback = "Unknown time") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : format(date, "MMM dd, yyyy h:mm a");
}

export default function VetConsultations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const consultationsQueryKey = queryKeys().vetConsultations(user?.id);
  const { data: bookings = [], isLoading: loading } = useQuery({
    queryKey: consultationsQueryKey,
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    refetchInterval: 1500,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await api
        .from("consultation_bookings")
        .select("*")
        .eq("vet_user_id", user!.id)
        .order("created_at", { ascending: false });
      return ((data as Booking[]) || []);
    },
  });

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeConsultationBookings({
      channelKey: `vet-consultations-${user.id}`,
      userId: user.id,
      onEvent: (eventType, row) => {
        queryClient.setQueryData<Booking[]>(
          consultationsQueryKey,
          (prev) => patchBookingList(prev || [], eventType, row) as Booking[]
        );
        if (row?.id) {
          queryClient.invalidateQueries({ queryKey: ["consultation-room", row.id] });
        }
      },
    });
    return unsubscribe;
  }, [consultationsQueryKey, queryClient, user]);

  const handleAccept = async (bookingId: string) => {
    setAcceptingId(bookingId);
    const { error } = await api
      .from("consultation_bookings")
      .update({ status: "in_progress" })
      .eq("id", bookingId);
    setAcceptingId(null);
    if (error) return;
    queryClient.invalidateQueries({ queryKey: consultationsQueryKey });
    navigate(`/vet/room/${bookingId}`);
  };

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "pending" || b.status === "confirmed").length,
    inProgress: bookings.filter(b => b.status === "in_progress").length,
    completed: bookings.filter(b => b.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Consultations</h1>
        <p className="text-muted-foreground mt-1">View and manage all your consultations.</p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: stats.total, icon: CalendarCheck, color: "text-primary" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-500" },
          { label: "In Progress", value: stats.inProgress, icon: AlertCircle, color: "text-blue-500" },
          { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-green-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Consultations</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : bookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No consultations yet.</p>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => {
                const displayStatus = bookingDisplayStatus(b as Booking & { leave_deadline_at?: string | null });
                const cfg = statusConfig[displayStatus] || statusConfig.pending;
                return (
                  <div key={b.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{b.patient_name}</p>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {b.animal_type && `${b.animal_type} • `}
                        {b.symptoms ? b.symptoms.substring(0, 60) : "No symptoms listed"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTimeSafe(b.created_at)} • ৳{b.fee}
                      </p>
                    </div>
                    {(b.status === "pending" || b.status === "confirmed") && (
                      <Button
                        size="sm"
                        onClick={() => handleAccept(b.id)}
                        disabled={acceptingId === b.id}
                      >
                        {acceptingId === b.id ? "Joining..." : "Accept"}
                      </Button>
                    )}
                    {canShowJoinButton(
                      b as Booking & { leave_deadline_at?: string | null; left_user_id?: string | null },
                      user?.id
                    ) && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (b.status !== "in_progress") return;
                          navigate(`/vet/room/${b.id}`, {
                            state: { from: "rejoin", bookingId: b.id },
                          });
                        }}
                      >
                        <Video className="h-4 w-4 mr-1" /> Rejoin
                      </Button>
                    )}
                    {b.status === "in_progress" &&
                      !canShowJoinButton(
                        b as Booking & { leave_deadline_at?: string | null; left_user_id?: string | null },
                        user?.id
                      ) && <span className="text-xs text-muted-foreground">Ending...</span>}
                    {b.status === "completed" && (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/vet/prescriptions/create?consultationId=${b.id}`)}>
                        <FileText className="h-4 w-4 mr-1" /> Prescribe
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
