import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api/client";
import { CalendarCheck, MessageSquare, Users, DollarSign, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/StatCard";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "@/hooks/use-toast";

export default function VetDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [todayBookings, setTodayBookings] = useState<any[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!user) return;

    // Fetch pending bookings for this vet
    const { data: pending } = await api
      .from("consultation_bookings")
      .select("*")
      .eq("vet_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    setPendingBookings(pending || []);

    // Fetch today's in-progress/completed bookings.
    // We still query by created_at as a coarse backend filter, then enforce scheduled_date client-side.
    const today = new Date().toISOString().split("T")[0];
    const { data: todayData } = await api
      .from("consultation_bookings")
      .select("*")
      .eq("vet_user_id", user.id)
      .in("status", ["in_progress", "completed"])
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false });

    const rows = Array.isArray(todayData) ? todayData : [];
    const filteredToday = rows.filter((row) => {
      const scheduledDate = String(row.scheduled_date || "").slice(0, 10);
      if (scheduledDate) return scheduledDate === today;
      const createdDate = String(row.created_at || "").slice(0, 10);
      return createdDate === today;
    });
    setTodayBookings(filteredToday);
  }, [user]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Realtime subscription for new/updated bookings
  useEffect(() => {
    const channel = api
      .channel("vet-dashboard-bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consultation_bookings",
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      api.removeChannel(channel);
    };
  }, [fetchBookings]);

  // Polling fallback in case realtime updates are delayed/disconnected.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchBookings();
    }, 9000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchBookings]);

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
