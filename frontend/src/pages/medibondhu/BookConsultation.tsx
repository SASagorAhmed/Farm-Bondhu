import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { broadcastMediDoctorInboxNewAppointment } from "@/api/client";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalIcon, CheckCircle2 } from "lucide-react";
import { MB } from "@/components/medibondhu/MediChrome";
import { formatDateYMDInDhaka, MEDI_BONDHU_TZ } from "@/lib/mediDhakaTime";

type Slot = { id: string; slot_date: string; slot_start: string; slot_end: string; booked: boolean };

export default function BookConsultation() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [date, setDate] = useState(() => formatDateYMDInDhaka());
  const [slotId, setSlotId] = useState<string | null>(null);
  const [ctype, setCtype] = useState<"online" | "chamber">("online");
  const [complaint, setComplaint] = useState("");

  const { data: doctor } = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorDetail(doctorId),
    enabled: Boolean(doctorId),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Record<string, unknown> }>(`/doctors/${doctorId}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data;
    },
  });

  const { data: slots = [], isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanSlots(doctorId, date),
    enabled: Boolean(doctorId && date),
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Slot[] }>(`/doctors/${doctorId}/slots?date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const selectedSlot = useMemo(() => slots.find((s) => s.id === slotId), [slots, slotId]);

  const slotLabel = useMemo(
    () => (s: Slot) => {
      const start = new Date(s.slot_start);
      const end = new Date(s.slot_end);
      const dateOpts: Intl.DateTimeFormatOptions = {
        timeZone: MEDI_BONDHU_TZ,
        weekday: "short",
        month: "short",
        day: "numeric",
      };
      const timeOpts: Intl.DateTimeFormatOptions = {
        timeZone: MEDI_BONDHU_TZ,
        hour: "2-digit",
        minute: "2-digit",
      };
      return `${start.toLocaleDateString(undefined, dateOpts)} · ${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`;
    },
    [],
  );

  const book = useMutation({
    mutationFn: async () => {
      if (!doctorId || !slotId) throw new Error("Choose a time slot to continue");
      const { res, body } = await mediHumanJson<{ data?: { id?: string; doctor_user_id?: string | null } }>(`/appointments`, {
        method: "POST",
        body: JSON.stringify({
          doctor_id: doctorId,
          slot_id: slotId,
          consultation_type: ctype,
          chief_complaint: complaint.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data;
    },
    onSuccess: (data) => {
      toast.success(ctype === "online" ? "Request sent — wait for your doctor to start the visit" : "Appointment confirmed");
      const apptId = data?.id;
      const doctorUserId = data?.doctor_user_id ? String(data.doctor_user_id) : "";
      if (doctorUserId && apptId) broadcastMediDoctorInboxNewAppointment(doctorUserId, apptId);
      if (apptId) void qc.invalidateQueries({ queryKey: ["medibondhu-human-appt-feed"] });
      if (!apptId) navigate("/medibondhu/consultations");
      else if (ctype === "online") navigate(`/medibondhu/waiting/${apptId}`);
      else navigate(`/medibondhu/appointment/${apptId}`);
    },
    onError: (e: Error) => toast.error(e.message || "Booking failed"),
  });

  const docName = doctor?.full_name ? String(doctor.full_name) : "your doctor";
  const fee = doctor?.consultation_fee != null ? Number(doctor.consultation_fee) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button type="button" variant="ghost" className="gap-2 -ml-2" onClick={() => (doctorId ? navigate(`/medibondhu/doctor/${doctorId}`) : navigate(-1))}>
        <ArrowLeft className="h-4 w-4" /> Doctor profile
      </Button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Book appointment</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mt-1">Schedule with {docName}</h1>
        {fee != null && !Number.isNaN(fee) && <p className="text-muted-foreground text-sm mt-1">Consultation fee: ৳{fee} (as shown on profile)</p>}
      </div>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <div className="h-1 w-full" style={{ backgroundColor: MB }} />
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display">1. Pick a date</CardTitle>
          <CardDescription>
            Dates follow the Bangladesh calendar. Times are Bangladesh time (<span className="font-medium">Asia/Dhaka</span>). Each window stays bookable until
            its end time — multiple patients may share the same window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="appt-date" className="text-muted-foreground">
              Date
            </Label>
            <input
              id="appt-date"
              type="date"
              className="mt-1.5 w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm"
              value={date}
              min={formatDateYMDInDhaka()}
              onChange={(e) => {
                setDate(e.target.value);
                setSlotId(null);
              }}
            />
          </div>

          <Separator />

          <div>
            <Label className="flex items-center gap-2 text-foreground font-medium">
              <CalIcon className="h-4 w-4" style={{ color: MB }} />
              2. Choose a time slot
            </Label>
            {isLoading && <p className="text-sm text-muted-foreground mt-3">Loading available times…</p>}
            {!isLoading && slots.length === 0 && (
              <div className="text-sm text-muted-foreground mt-3 rounded-xl border border-dashed border-border p-4 bg-muted/20 space-y-2">
                <p className="font-medium text-foreground">No open times on this Bangladesh calendar date</p>
                <p>
                  Doctors publish availability windows in Bangladesh time ({MEDI_BONDHU_TZ}). A window stays visible until its end time passes — other patients
                  booking the same window does not hide it.
                </p>
                <p>
                  Try another date, pick a doctor who shows “Open times listed”, or ask the practice to add availability in the doctor schedule.
                </p>
              </div>
            )}
            <RadioGroup value={slotId || ""} onValueChange={setSlotId} className="mt-3 grid gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${slotId === s.id ? "border-cyan-500/50 bg-cyan-500/5" : "border-border hover:bg-muted/40"}`}
                >
                  <RadioGroupItem value={s.id} id={s.id} />
                  <Label htmlFor={s.id} className="cursor-pointer font-normal text-sm flex-1 leading-snug">
                    {slotLabel(s)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          <div>
            <span className="text-sm font-medium text-foreground">3. Visit type</span>
            <RadioGroup value={ctype} onValueChange={(v) => setCtype(v as "online" | "chamber")} className="mt-2 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="online" id="online" />
                <Label htmlFor="online" className="font-normal">
                  Video / online consultation
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="chamber" id="chamber" />
                <Label htmlFor="chamber" className="font-normal">
                  In-person (chamber)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="cc" className="text-muted-foreground">
              4. Reason for visit <span className="text-muted-foreground/70">(optional)</span>
            </Label>
            <Textarea
              id="cc"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              rows={3}
              className="mt-1.5 rounded-xl resize-none"
              placeholder="Symptoms, duration, or questions — helps your doctor prepare."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border bg-muted/20">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4" style={{ color: MB }} />
            Summary
          </div>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>
              <span className="text-foreground/80 font-medium">Doctor:</span> {docName}
            </li>
            <li>
              <span className="text-foreground/80 font-medium">When:</span>{" "}
              {selectedSlot ? slotLabel(selectedSlot) : "Select a slot"}
            </li>
            <li className="capitalize">
              <span className="text-foreground/80 font-medium">Type:</span> {ctype === "online" ? "Online" : "Chamber"}
            </li>
          </ul>
          <Button
            type="button"
            className="w-full h-12 rounded-xl text-base font-semibold text-white mt-2"
            style={{ backgroundColor: MB }}
            disabled={!slotId || book.isPending}
            onClick={() => book.mutate()}
          >
            {book.isPending ? "Confirming…" : "Confirm booking"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
