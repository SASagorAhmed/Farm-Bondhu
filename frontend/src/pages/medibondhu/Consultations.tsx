import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { API_BASE, api, readSession } from "@/api/client";
import { withApiTiming } from "@/lib/perfMetrics";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarCheck, Clock, CheckCircle, XCircle, Stethoscope, Plus, Video } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";
import { patchBookingList, subscribeConsultationBookings } from "@/lib/consultationRealtime";

const MB = "#12C2D6";
const TERMINAL_STATUSES = new Set(["cancelled", "completed"]);
type JoinableBooking = {
  id: string;
  status?: string | null;
  leave_deadline_at?: string | null;
  left_user_id?: string | null;
};

function StatusBadge({ status }: { status: string }) {
  if (status === "cancelled") return <Badge className="bg-destructive/15 text-destructive flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />{status}</Badge>;
  return <Badge className="flex items-center gap-1" style={{ backgroundColor: `${MB}20`, color: MB }}><Clock className="h-3.5 w-3.5" />{status}</Badge>;
}

function bookingDisplayStatus(booking: any): string {
  if (booking?.status === "in_progress" && booking?.leave_deadline_at) return "ending";
  return String(booking?.status || "pending");
}

function canRejoinNow(booking: any, currentUserId?: string) {
  if (booking?.status !== "in_progress") return false;
  const leftUserId = String(booking?.left_user_id || "");
  const hasLeaveDeadline = Boolean(booking?.leave_deadline_at);
  if (!hasLeaveDeadline) return true;
  return !!currentUserId && leftUserId === String(currentUserId);
}

function canShowJoinButton(booking: JoinableBooking, currentUserId?: string) {
  const status = String(booking?.status || "");
  if (status === "pending" || status === "confirmed") return true;
  if (TERMINAL_STATUSES.has(status)) return false;
  return canRejoinNow(booking, currentUserId);
}

function resolveJoinDestination(booking: JoinableBooking, currentUserId?: string): string | null {
  const status = String(booking?.status || "");
  if (status === "pending" || status === "confirmed") {
    return `/medibondhu/waiting/${booking.id}`;
  }
  if (canRejoinNow(booking, currentUserId)) {
    return `/medibondhu/room/${booking.id}`;
  }
  return null;
}

export default function Consultations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [offset, setOffset] = useState(0);
  const [rejoiningId, setRejoiningId] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState<{ hasMore: boolean; nextOffset: number | null }>({ hasMore: false, nextOffset: null });
  const { data } = useQuery({
    queryKey: ["medibondhu-consultations", user?.id, offset],
    enabled: Boolean(user?.id),
    staleTime: 20 * 1000,
    gcTime: moduleCachePolicy.vet.gcTime,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!user) return { consultations: [], totalSpent: 0 };
      const token = readSession()?.access_token;
      const res = await withApiTiming("/v1/medibondhu/bookings/bootstrap", () =>
        fetch(`${API_BASE}/v1/medibondhu/bookings/bootstrap?view=patient&limit=50&offset=${offset}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      );
      if (!res.ok || res.status === 304) {
        const prev = queryClient.getQueryData<{
          consultations?: any[];
          totalSpent?: number;
          page?: { hasMore?: boolean; nextOffset?: number | null };
        }>(["medibondhu-consultations", user.id, offset]);
        return {
          consultations: prev?.consultations || (offset === 0 ? rows : []),
          totalSpent: Number(prev?.totalSpent || 0),
          page: {
            hasMore: Boolean(prev?.page?.hasMore),
            nextOffset: prev?.page?.nextOffset ?? null,
          },
        };
      }
      const body = (await res.json().catch(() => ({}))) as {
        data?: {
          consultations?: any[];
          totalSpent?: number;
          page?: { hasMore?: boolean; nextOffset?: number | null };
        };
      };
      return {
        consultations: (body.data?.consultations || []) as any[],
        totalSpent: Number(body.data?.totalSpent || 0),
        page: {
          hasMore: Boolean(body.data?.page?.hasMore),
          nextOffset: body.data?.page?.nextOffset ?? null,
        },
      };
    },
  });
  useEffect(() => {
    if (!data) return;
    setRows((prev) => {
      if (offset === 0) return data.consultations || [];
      const seen = new Set(prev.map((r) => r.id));
      const incoming = (data.consultations || []).filter((r: any) => !seen.has(r.id));
      return [...prev, ...incoming];
    });
    setPage(data.page || { hasMore: false, nextOffset: null });
  }, [data, offset]);

  useEffect(() => {
    setOffset(0);
    setRows([]);
    setPage({ hasMore: false, nextOffset: null });
    setRejoiningId(null);
  }, [user?.id]);

  const consultations = offset === 0 ? (data?.consultations || rows) : rows;
  const totalSpent = data?.totalSpent || 0;

  useEffect(() => {
    if (!rejoiningId) return;
    if (consultations.some((c) => c.id === rejoiningId && TERMINAL_STATUSES.has(String(c.status || "")))) {
      setRejoiningId(null);
    }
  }, [consultations, rejoiningId]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeConsultationBookings({
      channelKey: `consultations-live-${user.id}`,
      userId: user.id,
      queryClient,
      onEvent: (eventType, row) => {
        queryClient.setQueriesData(
          { queryKey: ["medibondhu-consultations", user.id] },
          (prev: any) => {
            if (!prev) return prev;
            if (Array.isArray(prev)) {
              return patchBookingList(prev, eventType, row);
            }
            const prevConsultations = Array.isArray(prev.consultations) ? prev.consultations : [];
            return {
              ...prev,
              consultations: patchBookingList(prevConsultations, eventType, row),
            };
          }
        );
        if (row?.id) {
          queryClient.invalidateQueries({ queryKey: ["consultation-room", row.id] });
        }
        queryClient.invalidateQueries({
          queryKey: ["medibondhu-consultations", user.id],
          exact: false,
        });
      },
    });
    return unsubscribe;
  }, [queryClient, user]);

  const scheduled = consultations.filter(c => c.status === "confirmed" || c.status === "pending").length;
  const completed = consultations.filter(c => c.status === "completed").length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Consultations</h1><p className="text-muted-foreground mt-1">Manage your veterinary consultations</p></div>
        <Dialog><DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: MB }}><Plus className="h-4 w-4 mr-1" />Book New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Book Consultation</DialogTitle>
              <DialogDescription className="py-1">Visit the Vet Directory to book a consultation with a specialist.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total" value={consultations.length} icon={<Stethoscope className="h-5 w-5" />} iconColor={MB} index={0} />
        <StatCard title="Scheduled" value={scheduled} icon={<CalendarCheck className="h-5 w-5" />} iconColor={MB} index={1} />
        <StatCard title="Completed" value={completed} icon={<CheckCircle className="h-5 w-5" />} iconColor={MB} index={2} />
        <StatCard title="Total Spent" value={`৳${totalSpent}`} icon={<Stethoscope className="h-5 w-5" />} iconColor={MB} index={3} />
      </div>

      <div className="space-y-4">
        {consultations.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-xl shrink-0" style={{ backgroundColor: MB }}>🩺</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-display font-bold text-foreground">{c.vet_name}</h3>
                      <StatusBadge status={bookingDisplayStatus(c)} />
                    </div>
                    <p className="text-sm text-muted-foreground">{c.scheduled_date} • {c.scheduled_time} • {c.animal_type}</p>
                    <p className="text-sm text-foreground"><span className="text-muted-foreground">Symptoms:</span> {c.symptoms}</p>
                    {canShowJoinButton(c, user?.id) && (
                      <div className="pt-1">
                        <Button
                          size="sm"
                          disabled={rejoiningId === c.id}
                          onClick={() => {
                            const destination = resolveJoinDestination(c, user?.id);
                            if (!destination) return;
                            setRejoiningId(c.id);
                            const targetIntent = destination.includes("/waiting/")
                              ? "waiting_entry"
                              : "room_entry";
                            navigate(destination, {
                              replace: true,
                              state: { from: "rejoin", bookingId: c.id, intent: targetIntent },
                            });
                          }}
                          className="text-white"
                          style={{ backgroundColor: MB }}
                        >
                          <Video className="h-4 w-4 mr-1" />
                          {rejoiningId === c.id ? "Joining..." : "Join Again"}
                        </Button>
                      </div>
                    )}
                    {c.status === "in_progress" && !canShowJoinButton(c, user?.id) && (
                      <div className="pt-1 text-xs text-muted-foreground">Ending...</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {page.hasMore && (
          <div className="pt-2 flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                if (page.nextOffset == null) return;
                setOffset(page.nextOffset);
              }}
            >
              Load older consultations
            </Button>
          </div>
        )}
        {consultations.length === 0 && <p className="text-center text-muted-foreground py-12">No consultations yet</p>}
      </div>
    </div>
  );
}
