import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { toast } from "sonner";
import { Info, Send } from "lucide-react";
import { MB } from "@/components/medibondhu/MediChrome";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MediDoctorPrescriptionNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patientUserId, setPatientUserId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [medName, setMedName] = useState("");
  const [dosage, setDosage] = useState("");

  useEffect(() => {
    const p = searchParams.get("patient");
    const a = searchParams.get("appointment");
    if (p) setPatientUserId(p);
    if (a) setAppointmentId(a);
  }, [searchParams]);

  const save = useMutation({
    mutationFn: async () => {
      const pid = patientUserId.trim();
      if (!UUID_RE.test(pid)) throw new Error("Enter a valid patient user UUID (from inbox or admin tools).");
      const { res, body } = await mediHumanJson(`/prescriptions`, {
        method: "POST",
        body: JSON.stringify({
          patient_user_id: pid,
          appointment_id: appointmentId.trim() && UUID_RE.test(appointmentId.trim()) ? appointmentId.trim() : null,
          diagnosis,
          advice,
          items: medName.trim() ? [{ medication_name: medName.trim(), dosage: dosage.trim() || null }] : [],
        }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return (body as { data?: { id?: string } }).data;
    },
    onSuccess: (d) => {
      toast.success("Prescription issued");
      if (d?.id) navigate(`/medibondhu/prescription/${d.id}`);
      else navigate("/medibondhu/doctor/prescriptions");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">MediBondhu · Doctor</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mt-1">Issue prescription</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Complete clinical fields carefully. Medication lines can be expanded in a future update; for multiple drugs, issue follow-up prescriptions or use your
          clinic protocol.
        </p>
      </header>

      <Alert className="rounded-xl border-cyan-500/25 bg-cyan-500/5">
        <Info className="h-4 w-4" style={{ color: MB }} />
        <AlertTitle>Patient identifier</AlertTitle>
        <AlertDescription>The patient UUID is shown on each appointment card in your inbox. Linking an appointment ID helps audit the visit.</AlertDescription>
      </Alert>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
        <CardHeader>
          <CardTitle className="text-lg font-display">1 · Patient linkage</CardTitle>
          <CardDescription>Required for MediBondhu human records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rx-patient">Patient user UUID</Label>
            <Input id="rx-patient" className="rounded-xl font-mono text-sm" value={patientUserId} onChange={(e) => setPatientUserId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rx-appt">Appointment ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="rx-appt" className="rounded-xl font-mono text-sm" value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} placeholder="Link to MediBondhu visit" autoComplete="off" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg font-display">2 · Clinical note</CardTitle>
          <CardDescription>Visible to the patient on their prescription PDF view.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="rx-dx">Diagnosis / impression</Label>
            <Textarea id="rx-dx" rows={4} className="rounded-xl resize-none" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Primary diagnosis or problem list" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rx-advice">Advice & plan</Label>
            <Textarea id="rx-advice" rows={3} className="rounded-xl resize-none" value={advice} onChange={(e) => setAdvice(e.target.value)} placeholder="Lifestyle, investigations, referrals…" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg font-display">3 · Medication <span className="text-muted-foreground text-base font-normal">(single line)</span></CardTitle>
          <CardDescription>Add at least drug name before issuing, or leave clear for advice-only encounters.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 pt-4">
          <div className="space-y-2 sm:col-span-2 md:col-span-1">
            <Label htmlFor="rx-med">Drug name</Label>
            <Input id="rx-med" className="rounded-xl" value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Generic or brand name" />
          </div>
          <div className="space-y-2 sm:col-span-2 md:col-span-1">
            <Label htmlFor="rx-dose">Dosage / frequency</Label>
            <Input id="rx-dose" className="rounded-xl" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="e.g. 500 mg — 1+0+1 × 7 days" />
          </div>
          <Separator className="sm:col-span-2" />
          <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" className="rounded-xl flex-1" onClick={() => navigate("/medibondhu/doctor/prescriptions")}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl flex-1 gap-2 text-white font-semibold h-11"
              style={{ backgroundColor: MB }}
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              <Send className="h-4 w-4" /> {save.isPending ? "Issuing…" : "Issue prescription"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
