import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/api/client";
import { Clock, Stethoscope, Lightbulb, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

const MB = "#12C2D6";

const TIPS = [
  "Have your animal's recent health records ready",
  "Note down all symptoms you've observed",
  "Prepare photos or videos of the affected animal",
  "Keep the animal in a quiet, well-lit area for video consultation",
  "Note any recent changes in diet or environment",
  "Have previous prescriptions ready for reference",
];

export default function WaitingRoom() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [waitingError, setWaitingError] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);
  const queryClient = useQueryClient();

  const handleInProgress = useCallback(
    (showToast = false) => {
      if (!bookingId || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      if (showToast) {
        toast({
          title: "Doctor is ready! 🎉",
          description: "Connecting you to the consultation room...",
        });
      }
      navigate(`/medibondhu/room/${bookingId}`);
    },
    [bookingId, navigate]
  );

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    const { data, error } = await api
      .from("consultation_bookings")
      .select("*")
      .eq("id", bookingId)
      .single();

    if (error) {
      setWaitingError(error.message || "Failed to load consultation.");
      return;
    }
    if (!data) {
      setWaitingError("Consultation not found.");
      return;
    }

    setWaitingError(null);
    if (data.status === "in_progress") {
      handleInProgress(false);
      return;
    }
    if (data.status === "cancelled" || data.status === "completed") {
      hasNavigatedRef.current = true;
      toast({
        title: data.status === "cancelled" ? "Consultation cancelled" : "Consultation already completed",
        description: "Returning to consultations.",
      });
      navigate("/medibondhu/consultations");
    }
    return data;
  }, [bookingId, handleInProgress, navigate]);

  const { data: booking, isLoading: loadingBooking } = useQuery({
    queryKey: queryKeys().waitingRoomBooking(bookingId),
    enabled: Boolean(bookingId),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    queryFn: fetchBooking,
  });

  // Realtime: auto-redirect when vet accepts (status → in_progress)
  useEffect(() => {
    if (!bookingId) return;

    const channel = api
      .channel(`waiting-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "consultation_bookings",
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          if (newStatus === "in_progress") {
            handleInProgress(true);
          } else {
            queryClient.invalidateQueries({ queryKey: queryKeys().waitingRoomBooking(bookingId) });
          }
        }
      )
      .subscribe();

    return () => {
      api.removeChannel(channel);
    };
  }, [bookingId, handleInProgress, queryClient]);

  // Fallback polling: guarantees patient auto-joins even if realtime update is missed.
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;

    const syncStatus = async () => {
      if (cancelled || hasNavigatedRef.current) return;
      if (document.visibilityState !== "visible") return;
      await fetchBooking();
    };

    void syncStatus();
    const interval = setInterval(() => {
      void syncStatus();
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bookingId, fetchBooking]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cycle tips
  useEffect(() => {
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  if (loadingBooking && !booking) {
    return (
      <div className="max-w-lg mx-auto py-8 text-center text-muted-foreground">
        Loading consultation...
      </div>
    );
  }

  if (waitingError && !booking) {
    return (
      <div className="max-w-lg mx-auto py-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">{waitingError}</p>
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" onClick={() => fetchBooking()}>Retry</Button>
          <Button onClick={() => navigate("/medibondhu/consultations")}>Back to Consultations</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 py-8">
      <Button variant="ghost" onClick={() => navigate("/medibondhu/consultations")}>
        <ArrowLeft className="h-4 w-4 mr-2" />Back to Consultations
      </Button>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: MB }} />
          <CardContent className="p-8 text-center space-y-6">
            {/* Animated pulse */}
            <div className="relative mx-auto h-32 w-32">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: `${MB}15` }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-4 rounded-full"
                style={{ backgroundColor: `${MB}25` }}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              />
              <div
                className="absolute inset-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: MB }}
              >
                <Stethoscope className="h-8 w-8 text-white" />
              </div>
            </div>

            <div>
              <h2 className="font-display font-bold text-xl text-foreground">
                Waiting for Doctor
              </h2>
              {booking && (
                <p className="text-sm text-muted-foreground mt-1">
                  {booking.vet_name} • {booking.consultation_method}
                </p>
              )}
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5" style={{ color: MB }} />
              <span className="text-2xl font-mono font-bold text-foreground">
                {formatTime(elapsed)}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              Please wait while the doctor prepares for your consultation. You will be connected automatically.
            </p>
            {waitingError && (
              <p className="text-xs text-amber-600">{waitingError}</p>
            )}

            {/* Tips carousel */}
            <motion.div
              key={tipIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl"
              style={{ backgroundColor: `${MB}08`, border: `1px solid ${MB}20` }}
            >
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" style={{ color: MB }} />
                <p className="text-sm text-foreground text-left">{TIPS[tipIndex]}</p>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
