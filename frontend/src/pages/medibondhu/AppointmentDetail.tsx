import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "sonner";
import { ArrowLeft, Calendar, Info, Stethoscope, UserRound, Video } from "lucide-react";
import { MediStatusBadge, MB } from "@/components/medibondhu/MediChrome";

export default function AppointmentDetail() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: appt, isLoading, refetch } = useQuery({
    queryKey: queryKeys().medibondhuHumanAppointmentDetail(appointmentId),
    enabled: Boolean(appointmentId),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Record<string, unknown> }>(`/appointments/${appointmentId}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data;
    },
  });

  const cancelMu = useMutation({
    mutationFn: async () => {
      const { res, body } = await mediHumanJson(`/appointments/${appointmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Appointment cancelled");
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-appt-feed"] });
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-feed"] });
      await qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanAppointmentDetail(appointmentId) });
      await refetch();
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  if (isLoading || !appt) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-9 w-40" />
        <Card className="rounded-xl">
          <Skeleton className="h-2 w-full rounded-none" style={{ backgroundColor: `${MB}50` }} />
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const st = String(appt.status || "").toLowerCase();
  const cancellable = st !== "cancelled" && st !== "completed";
  const waitingEligible =
    String(appt.consultation_type || "").toLowerCase() === "online" && st === "pending" && !["completed", "cancelled", "rejected"].includes(st);
  const videoEligible =
    String(appt.consultation_type || "").toLowerCase() === "online" &&
    ["confirmed", "in_progress"].includes(st) &&
    !["completed", "cancelled", "rejected"].includes(st);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Button type="button" variant="ghost" className="gap-2 -ml-2" onClick={() => navigate("/medibondhu/consultations")}>
        <ArrowLeft className="h-4 w-4" /> All appointments
      </Button>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: MB }} />
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <MediStatusBadge status={String(appt.status || "")} />
            <Badge variant="outline" className="capitalize rounded-md font-normal">
              {String(appt.consultation_type)}
            </Badge>
          </div>

          <div className="flex gap-4 items-start">
            <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Stethoscope className="h-7 w-7" style={{ color: MB }} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground leading-tight">{String(appt.doctor_name || "Doctor")}</h1>
              {Boolean(appt.specialty_name) && <p className="text-muted-foreground mt-1">{String(appt.specialty_name)}</p>}
            </div>
          </div>

          {Boolean(appt.slot_start) && (
            <div className="rounded-xl border bg-muted/30 px-4 py-3 flex items-start gap-3">
              <Calendar className="h-5 w-5 shrink-0 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Scheduled time</p>
                <p className="text-base font-medium text-foreground mt-0.5">{new Date(String(appt.slot_start)).toLocaleString()}</p>
              </div>
            </div>
          )}

          {Boolean(appt.chief_complaint) && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <UserRound className="h-3.5 w-3.5" />
                Reason for visit
              </div>
              <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap rounded-xl border bg-background px-4 py-3">{String(appt.chief_complaint)}</p>
            </div>
          )}

          <Separator />

          <Alert className="rounded-xl border-cyan-500/25 bg-cyan-500/5">
            <Info className="h-4 w-4" style={{ color: MB }} />
            <AlertTitle>How this appointment works</AlertTitle>
            <AlertDescription>
              Online MediBondhu visits use a Medi-only video room (separate namespace from VetBondhu animal teleconsult). In-person chamber visits stay
              coordination-only — no video room. Prescriptions and follow-up use MediBondhu dashboards.
            </AlertDescription>
          </Alert>

          {waitingEligible && appointmentId && (
            <Button
              type="button"
              className="w-full sm:w-auto rounded-xl gap-2 text-white font-semibold"
              style={{ backgroundColor: MB }}
              onClick={() => navigate(`/medibondhu/waiting/${appointmentId}`)}
            >
              <Video className="h-4 w-4 shrink-0" />
              Open waiting room
            </Button>
          )}

          {videoEligible && (
            <Button
              type="button"
              className="w-full sm:w-auto rounded-xl gap-2 text-white font-semibold"
              style={{ backgroundColor: MB }}
              onClick={() => navigate(`/medibondhu/room/${appointmentId}`)}
            >
              <Video className="h-4 w-4 shrink-0" />
              Join video consultation
            </Button>
          )}

          {cancellable && (
            <>
              <Separator />
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">Need to reschedule? Cancel here and choose a new slot from the doctor’s calendar.</p>
                <Button type="button" variant="destructive" className="rounded-xl shrink-0" disabled={cancelMu.isPending} onClick={() => cancelMu.mutate()}>
                  Cancel appointment
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
