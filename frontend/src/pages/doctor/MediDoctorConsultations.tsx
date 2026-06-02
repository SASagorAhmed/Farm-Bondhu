import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, FilePlus2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { acceptMediOnlineVisit, mediHumanJson } from "@/lib/medibondhuHuman";
import { subscribeMediHumanAppointments } from "@/lib/medibondhuAppointmentRealtime";
import { subscribeMediDoctorInboxNewAppointment } from "@/api/client";
import { queryKeys } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useMediDoctorPreviewActions } from "@/hooks/useMediDoctorPreviewActions";
import { MB, MediSectionTitle, MediStatusBadge } from "@/components/medibondhu/MediChrome";

type Appointment = {
  id: string;
  status: string;
  consultation_type?: string | null;
  patient_user_id?: string | null;
  patient_name?: string | null;
  patient_email?: string | null;
  slot_start?: string | null;
  chief_complaint?: string | null;
};

export default function MediDoctorConsultations() {
  const { user } = useAuth();
  const { readOnly } = useMediDoctorPreviewActions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [doctorPk, setDoctorPk] = useState<string | null>(null);
  const doctorAppointmentsKey = queryKeys().medibondhuHumanDoctorAppointments(user?.id, 0);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setDoctorPk(null);
      return;
    }
    void mediHumanJson<{ data?: { id?: string } | null }>("/doctor/me").then(({ res, body }) => {
      if (cancelled || !res.ok) return;
      const id = body.data?.id;
      setDoctorPk(id ? String(id) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const invalidateDoctorLists = () => {
    void queryClient.invalidateQueries({ queryKey: doctorAppointmentsKey });
    void queryClient.invalidateQueries({ queryKey: ["medibondhu-human-doctor-feed"] });
  };

  useEffect(() => {
    if (!user?.id) return;
    const unsubBroadcast = subscribeMediDoctorInboxNewAppointment(user.id, invalidateDoctorLists);
    const unsubPg = subscribeMediHumanAppointments({
      channelKey: `medi-doctor-consultations-${user.id}`,
      doctorPk,
      onEvent: () => invalidateDoctorLists(),
    });
    return () => {
      unsubBroadcast();
      unsubPg();
    };
  }, [doctorPk, user?.id]);

  const { data = [], isLoading } = useQuery({
    queryKey: doctorAppointmentsKey,
    enabled: Boolean(user?.id),
    refetchInterval: (q) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
      const list = q.state.data as Appointment[] | undefined;
      const hasWaiting = (list || []).some(
        (a) =>
          String(a.consultation_type || "").toLowerCase() === "online" &&
          ["pending", "confirmed"].includes(String(a.status || "").toLowerCase()),
      );
      return hasWaiting ? 1500 : false;
    },
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: { appointments?: Appointment[] } }>(
        "/appointments/bootstrap?view=doctor&limit=80&offset=0"
      );
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data?.appointments || [];
    },
  });

  const rows = useMemo(() => {
    return [...data].sort((a, b) => {
      const ta = a.slot_start ? new Date(a.slot_start).getTime() : 0;
      const tb = b.slot_start ? new Date(b.slot_start).getTime() : 0;
      return tb - ta;
    });
  }, [data]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { res, body } = await mediHumanJson(`/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: doctorAppointmentsKey });
      toast.success("Consultation updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update consultation"),
  });

  const handleJoinVideo = async (item: Appointment) => {
    setJoiningId(item.id);
    try {
      const accepted = await acceptMediOnlineVisit(item.id, { currentStatus: item.status });
      if (!accepted.ok) {
        toast.error(accepted.error || "Unable to start visit");
        return;
      }
      invalidateDoctorLists();
      navigate(`/medibondhu/room/${item.id}`);
    } catch (e) {
      toast.error((e as Error).message || "Unable to open room");
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctor panel</p>
          <h1 className="text-3xl font-display font-bold mt-1 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${MB}18` }}>
              <CalendarCheck className="h-5 w-5" style={{ color: MB }} />
            </span>
            Consultations
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Track all human MediBondhu consultations and update visit status.</p>
        </div>
        <Button type="button" className="rounded-xl text-white gap-2" style={{ backgroundColor: MB }} disabled={readOnly} onClick={() => navigate("/medibondhu/doctor/rx/new")}>
          <FilePlus2 className="h-4 w-4" />
          New prescription
        </Button>
      </header>

      <MediSectionTitle eyebrow="Newest first" title={`${rows.length} consultations`} />

      <div className="space-y-3">
        {!isLoading &&
          rows.map((item) => {
            const done = ["completed", "cancelled", "rejected"].includes(String(item.status || "").toLowerCase());
            const canJoin = String(item.consultation_type || "").toLowerCase() === "online" && !done;
            const patientId = item.patient_user_id ? String(item.patient_user_id) : "";
            return (
              <Card key={item.id} className="rounded-xl border-border overflow-hidden">
                <div className="h-1 w-full" style={{ backgroundColor: MB }} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{item.patient_name || "Patient"}</p>
                      {item.patient_email && <p className="text-xs text-muted-foreground">{item.patient_email}</p>}
                      {item.slot_start && <p className="text-xs text-muted-foreground mt-1">{new Date(item.slot_start).toLocaleString()}</p>}
                    </div>
                    <MediStatusBadge status={String(item.status || "unknown")} />
                  </div>
                  {item.chief_complaint && <p className="text-sm text-muted-foreground">{item.chief_complaint}</p>}
                  <div className="flex flex-wrap gap-2">
                    {canJoin && (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg text-white gap-1.5"
                        style={{ backgroundColor: MB }}
                        disabled={readOnly || joiningId === item.id || setStatus.isPending}
                        onClick={() => void handleJoinVideo(item)}
                      >
                        <Video className="h-4 w-4" /> {joiningId === item.id ? "Joining…" : "Join video"}
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={readOnly || done || setStatus.isPending} onClick={() => setStatus.mutate({ id: item.id, status: "completed" })}>
                      Mark complete
                    </Button>
                    {patientId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={readOnly}
                        onClick={() => navigate(`/medibondhu/doctor/rx/new?patient=${encodeURIComponent(patientId)}&appointment=${encodeURIComponent(item.id)}`)}
                      >
                        Issue Rx
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        {isLoading && <p className="text-sm text-muted-foreground">Loading consultations...</p>}
        {!isLoading && rows.length === 0 && <p className="text-sm text-muted-foreground">No consultations available yet.</p>}
      </div>
    </div>
  );
}
