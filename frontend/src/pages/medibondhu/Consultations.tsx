import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { API_BASE, api, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarCheck, Clock, CheckCircle, XCircle, Stethoscope, Plus, Video } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";
import { patchBookingList, subscribeConsultationBookings } from "@/lib/consultationRealtime";

const MB = "#12C2D6";

function StatusBadge({ status }: { status: string }) {
  if (status === "cancelled") return <Badge className="bg-destructive/15 text-destructive flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />{status}</Badge>;
  return <Badge className="flex items-center gap-1" style={{ backgroundColor: `${MB}20`, color: MB }}><Clock className="h-3.5 w-3.5" />{status}</Badge>;
}

export default function Consultations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["medibondhu-consultations", user?.id],
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!user) return { consultations: [], totalSpent: 0 };
      const token = readSession()?.access_token;
      const [consultationsRes, spentRes] = await Promise.all([
        api.from("consultation_bookings").select("*").eq("patient_mock_id", user.id).order("created_at", { ascending: false }),
        fetch(`${API_BASE}/v1/medibondhu/spent-summary`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }),
      ]);
      const spentBody = (await spentRes.json().catch(() => ({}))) as { data?: { total_spent?: number } };
      return {
        consultations: (consultationsRes.data || []) as any[],
        totalSpent: spentRes.ok ? Number(spentBody.data?.total_spent || 0) : 0,
      };
    },
  });

  const consultations = data?.consultations || [];
  const totalSpent = data?.totalSpent || 0;

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeConsultationBookings({
      channelKey: `consultations-live-${user.id}`,
      userId: user.id,
      queryClient,
      onEvent: (eventType, row) => {
        queryClient.setQueryData<{ consultations: any[]; totalSpent: number }>(
          ["medibondhu-consultations", user.id],
          (prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              consultations: patchBookingList(prev.consultations || [], eventType, row),
            };
          }
        );
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
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{c.scheduled_date} • {c.scheduled_time} • {c.animal_type}</p>
                    <p className="text-sm text-foreground"><span className="text-muted-foreground">Symptoms:</span> {c.symptoms}</p>
                    {c.status === "in_progress" && (
                      <div className="pt-1">
                        <Button
                          size="sm"
                          onClick={() => {
                            if (c.status !== "in_progress") return;
                            navigate(`/medibondhu/room/${c.id}`, {
                              state: { from: "rejoin", bookingId: c.id },
                            });
                          }}
                          className="text-white"
                          style={{ backgroundColor: MB }}
                        >
                          <Video className="h-4 w-4 mr-1" />
                          Join Again
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {consultations.length === 0 && <p className="text-center text-muted-foreground py-12">No consultations yet</p>}
      </div>
    </div>
  );
}
