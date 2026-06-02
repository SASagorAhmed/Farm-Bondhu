import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, FilePlus2, Mail, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { useMediDoctorPreviewActions } from "@/hooks/useMediDoctorPreviewActions";
import MediDoctorPreviewEmpty from "@/components/medibondhu/MediDoctorPreviewEmpty";
import { MB, MediSectionTitle } from "@/components/medibondhu/MediChrome";

type Appointment = {
  id: string;
  patient_user_id?: string | null;
  patient_name?: string | null;
  patient_email?: string | null;
  status?: string | null;
  slot_start?: string | null;
};

type PatientRow = {
  patientId: string;
  name: string;
  email: string;
  totalVisits: number;
  latestVisit?: string | null;
};

export default function MediDoctorPatients() {
  const { user } = useAuth();
  const { readOnly, previewEmptyHint } = useMediDoctorPreviewActions();
  const navigate = useNavigate();
  const doctorAppointmentsKey = queryKeys().medibondhuHumanDoctorAppointments(user?.id, 0);

  const { data = [], isLoading } = useQuery({
    queryKey: [...doctorAppointmentsKey, "patients"],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: { appointments?: Appointment[] } }>(
        "/appointments/bootstrap?view=doctor&limit=120&offset=0"
      );
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data?.appointments || [];
    },
  });

  const patients = useMemo<PatientRow[]>(() => {
    const map = new Map<string, PatientRow>();
    for (const item of data) {
      const patientId = item.patient_user_id ? String(item.patient_user_id) : "";
      if (!patientId) continue;
      const prev = map.get(patientId);
      const currentTime = item.slot_start ? new Date(item.slot_start).getTime() : 0;
      const prevTime = prev?.latestVisit ? new Date(prev.latestVisit).getTime() : 0;
      if (!prev) {
        map.set(patientId, {
          patientId,
          name: item.patient_name || "Patient",
          email: item.patient_email || "",
          totalVisits: 1,
          latestVisit: item.slot_start || null,
        });
      } else {
        prev.totalVisits += 1;
        if (currentTime > prevTime) prev.latestVisit = item.slot_start || prev.latestVisit;
      }
    }
    return [...map.values()].sort((a, b) => {
      const ta = a.latestVisit ? new Date(a.latestVisit).getTime() : 0;
      const tb = b.latestVisit ? new Date(b.latestVisit).getTime() : 0;
      return tb - ta;
    });
  }, [data]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctor panel</p>
        <h1 className="text-3xl font-display font-bold mt-1 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${MB}18` }}>
            <Users className="h-5 w-5" style={{ color: MB }} />
          </span>
          Patients
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Patient directory from your MediBondhu human consultations only.</p>
      </header>

      <MediSectionTitle eyebrow="Unique patients" title={`${patients.length} in your panel`} />

      <div className="space-y-3">
        {!isLoading &&
          patients.map((p) => (
            <Card key={p.patientId} className="rounded-xl border-border overflow-hidden">
              <div className="h-1 w-full" style={{ backgroundColor: MB }} />
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="font-semibold text-foreground">{p.name}</p>
                  {p.email && (
                    <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> {p.email}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono truncate">ID {p.patientId}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {p.latestVisit ? new Date(p.latestVisit).toLocaleString() : "No recent visit"}
                  </p>
                  <span className="text-xs rounded-full border px-2.5 py-1">{p.totalVisits} visit(s)</span>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-lg text-white gap-1.5"
                    style={{ backgroundColor: MB }}
                    disabled={readOnly}
                    onClick={() => navigate(`/medibondhu/doctor/rx/new?patient=${encodeURIComponent(p.patientId)}`)}
                  >
                    <FilePlus2 className="h-4 w-4" />
                    New Rx
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        {isLoading && <p className="text-sm text-muted-foreground">Loading patients...</p>}
        {!isLoading && patients.length === 0 && (
          <MediDoctorPreviewEmpty title="No patients found yet" hint={previewEmptyHint} />
        )}
      </div>
    </div>
  );
}
