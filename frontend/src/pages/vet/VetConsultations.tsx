import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Clock, CheckCircle, AlertCircle, Video, FileText } from "lucide-react";
import { format } from "date-fns";

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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function formatDateTimeSafe(value: string | null | undefined, fallback = "Unknown time") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : format(date, "MMM dd, yyyy h:mm a");
}

export default function VetConsultations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!user) return;

    const { data } = await api
      .from("consultation_bookings")
      .select("*")
      .eq("vet_user_id", user.id)
      .order("created_at", { ascending: false });

    setBookings((data as Booking[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchBookings();

    const channel = api
      .channel("vet-consultations")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultation_bookings" }, () => fetchBookings())
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [user, fetchBookings]);

  // Polling fallback in case realtime updates are delayed/disconnected.
  useEffect(() => {
    if (!user) return;

    const intervalId = window.setInterval(() => {
      fetchBookings();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, fetchBookings]);

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "pending").length,
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
                const cfg = statusConfig[b.status] || statusConfig.pending;
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
                    {b.status === "in_progress" && (
                      <Button size="sm" onClick={() => navigate(`/vet/room/${b.id}`)}>
                        <Video className="h-4 w-4 mr-1" /> Rejoin
                      </Button>
                    )}
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
