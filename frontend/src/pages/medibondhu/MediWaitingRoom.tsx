import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { MB } from "@/components/medibondhu/MediChrome";
import { ArrowLeft, Clock, Stethoscope } from "lucide-react";
import { toast } from "sonner";

const TIPS = [
  "Find a quiet, well-lit place for video",
  "Keep your prescription or reports handy if relevant",
  "Note your symptoms and how long they have lasted",
];

type ApptBrief = {
  id?: string;
  status?: string | null;
  consultation_type?: string | null;
  patient_user_id?: string | null;
  doctor_name?: string | null;
};

export default function MediWaitingRoom() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const navigatedRef = useRef(false);

  useEffect(() => {
    navigatedRef.current = false;
  }, [appointmentId]);

  const goRoom = useCallback(
    (withToast: boolean) => {
      if (!appointmentId || navigatedRef.current) return;
      navigatedRef.current = true;
      if (withToast) toast.success("Doctor is ready — opening video room.");
      navigate(`/medibondhu/room/${appointmentId}`, {
        replace: true,
        state: { from: "medibondhu-waiting", appointmentId },
      });
    },
    [appointmentId, navigate]
  );

  const fetchAppt = useCallback(async (): Promise<ApptBrief | null> => {
    if (!appointmentId) return null;
    const { res, body } = await mediHumanJson<{ data?: ApptBrief }>(`/appointments/${appointmentId}`);
    if (!res.ok) return null;
    return body.data || null;
  }, [appointmentId]);

  const { data: appt, isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanWaitingRoom(appointmentId),
    enabled: Boolean(appointmentId && user?.id),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    refetchInterval: (q) => {
      const st = String((q.state.data as ApptBrief | null | undefined)?.status || "").toLowerCase();
      return st === "pending" || !st ? 3000 : false;
    },
    refetchOnWindowFocus: true,
    queryFn: fetchAppt,
  });

  useEffect(() => {
    if (!appt || navigatedRef.current) return;
    const st = String(appt.status || "").toLowerCase();
    const mine = user?.id && String(appt.patient_user_id || "") === String(user.id);
    if (!mine) return;
    if (st === "in_progress") goRoom(false);
    if (st === "cancelled" || st === "rejected" || st === "completed") {
      navigatedRef.current = true;
      toast.info(st === "completed" ? "This visit already ended." : "This appointment was closed.");
      navigate("/medibondhu/consultations", { replace: true });
    }
  }, [appt, goRoom, navigate, user?.id]);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 5000);
    return () => clearInterval(t);
  }, []);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  if (isLoading && !appt) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center text-muted-foreground text-sm">
        Loading your appointment…
      </div>
    );
  }

  if (!appointmentId || !user?.id) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <p className="text-muted-foreground">Missing appointment.</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate("/medibondhu/consultations")}>
          Back to appointments
        </Button>
      </div>
    );
  }

  if (appt && String(appt.patient_user_id || "") !== String(user.id)) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <p className="font-medium text-foreground">This waiting room isn’t for your account.</p>
        <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate("/medibondhu/consultations")}>
          Back to appointments
        </Button>
      </div>
    );
  }

  if (String(appt?.consultation_type || "").toLowerCase() !== "online") {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <p className="text-muted-foreground text-sm">In-person visits skip the video waiting room.</p>
        <Button type="button" className="rounded-xl text-white" style={{ backgroundColor: MB }} onClick={() => navigate(`/medibondhu/appointment/${appointmentId}`)}>
          View appointment details
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-8">
      <Button type="button" variant="ghost" className="gap-2 -ml-2" onClick={() => navigate("/medibondhu/consultations")}>
        <ArrowLeft className="h-4 w-4" /> Exit waiting room
      </Button>

      <div className="text-center space-y-2">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${MB}22` }}>
          <Stethoscope className="h-8 w-8" style={{ color: MB }} />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">Waiting for your doctor</h1>
        <p className="text-muted-foreground text-sm">
          {appt?.doctor_name ? `You're in line for ${appt.doctor_name}.` : "You've booked an online MediBondhu visit."} We'll open video as soon as they start the
          consult.
        </p>
      </div>

      <Card className="rounded-2xl overflow-hidden border-border">
        <div className="h-1 w-full" style={{ backgroundColor: MB }} />
        <CardContent className="p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-foreground font-mono text-3xl tabular-nums tracking-tight">
            <Clock className="h-7 w-7 text-muted-foreground" /> {formatElapsed(elapsed)}
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Time waiting</p>
          <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground text-left">{TIPS[tipIndex]}</div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">You can safely leave this page — your booking stays confirmed. Returning here will reconnect you automatically.</p>
    </div>
  );
}
