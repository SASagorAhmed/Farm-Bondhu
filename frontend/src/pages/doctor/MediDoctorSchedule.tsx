import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarPlus, Clock, Trash2 } from "lucide-react";
import { MediSectionTitle, MB } from "@/components/medibondhu/MediChrome";
import {
  addCalendarDaysDhaka,
  dhakaSlotRangeToUtcISO,
  formatDateYMDInDhaka,
  MEDI_BONDHU_TZ,
} from "@/lib/mediDhakaTime";

type SlotRow = {
  id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  booked: boolean;
  appointment_id?: string | null;
  consultation_type?: string | null;
  appointment_status?: string | null;
  patient_user_id?: string | null;
  patient_name?: string | null;
  patient_email?: string | null;
  consultation_minutes?: number | null;
};

export default function MediDoctorSchedule() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [from, setFrom] = useState(() => formatDateYMDInDhaka());
  const [to, setTo] = useState(() => addCalendarDaysDhaka(formatDateYMDInDhaka(), 21));
  const [day, setDay] = useState(() => formatDateYMDInDhaka());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");

  const q = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorSchedule(user?.id, from, to),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: SlotRow[] }>(
        `/doctor/time-slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const bulk = useMutation({
    mutationFn: async () => {
      const slot_date = day;
      const { slot_start, slot_end } = dhakaSlotRangeToUtcISO(slot_date, start, end);
      if (!(Date.parse(slot_end) > Date.parse(slot_start))) throw new Error("End time must be after start time");
      if (Date.parse(slot_end) <= Date.now()) {
        throw new Error("This slot already ended in Bangladesh time. Pick a future end time.");
      }
      const { res, body } = await mediHumanJson<{ data?: { inserted_count?: number; requested_count?: number; duplicates_skipped?: number; past_skipped?: number } }>(`/doctor/time-slots/bulk`, {
        method: "POST",
        body: JSON.stringify({
          slots: [{ slot_date, slot_start, slot_end }],
        }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return {
        insertedCount: Number(body.data?.inserted_count || 0),
        requestedCount: Number(body.data?.requested_count || 1),
        duplicatesSkipped: Number(body.data?.duplicates_skipped || 0),
        pastSkipped: Number(body.data?.past_skipped || 0),
      };
    },
    onSuccess: async ({ insertedCount, requestedCount, duplicatesSkipped, pastSkipped }) => {
      if (insertedCount > 0) {
        toast.success(insertedCount === 1 ? "Slot added" : `${insertedCount} slots added`);
      } else {
        if (pastSkipped > 0) {
          toast.warning("No new slot added. This slot already ended, so it is hidden from patients.");
        } else {
          const duplicateHint =
            duplicatesSkipped > 0 || requestedCount > 0
              ? "This time slot already exists or was skipped as duplicate."
              : "No valid slots were inserted.";
          toast.warning(`No new slot added. ${duplicateHint}`);
        }
      }
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-slots"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { res, body } = await mediHumanJson(`/doctor/time-slots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Slot removed");
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-slots"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const sorted = useMemo(() => [...(q.data || [])].sort((a, b) => String(a.slot_start).localeCompare(String(b.slot_start))), [q.data]);

  const openCount = sorted.filter((s) => !s.booked).length;
  const bookedCount = sorted.filter((s) => s.booked).length;

  return (
    <div className="space-y-8 max-w-4xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scheduling</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-1 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${MB}18` }}>
            <Clock className="h-5 w-5" style={{ color: MB }} />
          </span>
          Availability
        </h1>
        <p className="text-muted-foreground mt-2 text-sm max-w-2xl leading-relaxed">
          Define bookable windows for MediBondhu patients. Dates and clocks use Bangladesh time ({MEDI_BONDHU_TZ}). Booked slots cannot be deleted here — cancel
          the appointment from your inbox if the patient needs to reschedule.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Open slots</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{openCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Booked</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{bookedCount}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Range</p>
            <p className="text-sm font-medium mt-2 leading-snug">{from} → {to}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" style={{ color: MB }} />
            Calendar window
          </CardTitle>
          <CardDescription>Adjust the range shown in the list below.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rng-from">From</Label>
            <input id="rng-from" type="date" className="w-full rounded-xl border border-input px-3 py-2.5 text-sm bg-background shadow-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rng-to">To</Label>
            <input id="rng-to" type="date" className="w-full rounded-xl border border-input px-3 py-2.5 text-sm bg-background shadow-sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl overflow-hidden border-border shadow-sm">
        <div className="h-1 w-full shrink-0 opacity-70" style={{ backgroundColor: MB }} />
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display">Add a slot</CardTitle>
          <CardDescription>
            Start/end are interpreted as Bangladesh local time. Patients see unbooked slots until each window ends (Bangladesh time), matching your MediBondhu profile.
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            Note: if another slot already exists at the same start time, it is skipped as a duplicate.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="slot-day">Date</Label>
            <input
              id="slot-day"
              type="date"
              className="max-w-xs w-full rounded-xl border border-input px-3 py-2.5 text-sm bg-background shadow-sm"
              value={day}
              min={formatDateYMDInDhaka()}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-start">Start (Bangladesh)</Label>
            <input id="slot-start" type="time" className="w-full rounded-xl border border-input px-3 py-2.5 text-sm bg-background shadow-sm" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slot-end">End (Bangladesh)</Label>
            <input id="slot-end" type="time" className="w-full rounded-xl border border-input px-3 py-2.5 text-sm bg-background shadow-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button type="button" className="rounded-xl text-white font-semibold px-8" style={{ backgroundColor: MB }} disabled={bulk.isPending} onClick={() => bulk.mutate()}>
              {bulk.isPending ? "Saving…" : "Add slot"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <MediSectionTitle eyebrow="In selected range" title="Your slots" />
        <Card className="rounded-2xl border-border overflow-hidden">
          <CardContent className="p-0 divide-y">
            {sorted.map((s) => {
              const now = Date.now();
              const startMs = new Date(s.slot_start).getTime();
              const endMs = new Date(s.slot_end).getTime();
              const appointmentStatus = String(s.appointment_status || "").toLowerCase();
              const appointmentLabel = appointmentStatus ? appointmentStatus.replace("_", " ") : "booked";
              const isPastBooked = Boolean(s.booked) && Number.isFinite(endMs) && endMs <= now;
              const isCompleted = appointmentStatus === "completed";
              const isCancelled = appointmentStatus === "cancelled";
              const isRejected = appointmentStatus === "rejected";
              const inWindow = !s.booked && Number.isFinite(startMs) && Number.isFinite(endMs) && startMs <= now && endMs > now;
              const isFutureOpen = !s.booked && Number.isFinite(startMs) && startMs > now && endMs > now;
              const isPastUnbooked = !s.booked && Number.isFinite(endMs) && endMs <= now;
              return (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground tabular-nums">
                      {formatDateYMDInDhaka(new Date(s.slot_start))}
                    </span>
                    <Badge variant="outline" className="rounded-md font-normal text-xs">
                      {new Date(s.slot_start).toLocaleTimeString(undefined, {
                        timeZone: MEDI_BONDHU_TZ,
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      —{" "}
                      {new Date(s.slot_end).toLocaleTimeString(undefined, {
                        timeZone: MEDI_BONDHU_TZ,
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Badge>
                    {s.booked ? (
                      isCompleted ? (
                        <Badge className="rounded-md bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border-emerald-500/30">Completed</Badge>
                      ) : isCancelled || isRejected ? (
                        <Badge variant="outline" className="rounded-md font-normal text-xs capitalize">
                          {appointmentLabel}
                        </Badge>
                      ) : isPastBooked ? (
                        <Badge variant="outline" className="rounded-md font-normal text-xs">
                          Ended
                        </Badge>
                      ) : (
                        <Badge className="rounded-md bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30">Booked</Badge>
                      )
                    ) : inWindow ? (
                      <Badge className="rounded-md font-normal" style={{ backgroundColor: `${MB}22`, color: MB, borderColor: `${MB}55` }}>
                        In progress · open
                      </Badge>
                    ) : isPastUnbooked ? (
                      <Badge variant="outline" className="rounded-md font-normal text-muted-foreground border-border">
                        Past · unbooked
                      </Badge>
                    ) : isFutureOpen ? (
                      <Badge variant="secondary" className="rounded-md font-normal">Open</Badge>
                    ) : null}
                    {s.booked && (
                      <>
                        <Badge variant="outline" className="rounded-md font-normal text-xs capitalize">
                          {String(s.consultation_type || "online").toLowerCase() === "offline" ? "Offline" : "Online"}
                        </Badge>
                        {!isCompleted && !isCancelled && !isRejected && (
                          <Badge variant="outline" className="rounded-md font-normal text-xs capitalize">
                            {isPastBooked ? "ended" : appointmentLabel}
                          </Badge>
                        )}
                        <Badge variant="outline" className="rounded-md font-normal text-xs">
                          {Number.isFinite(Number(s.consultation_minutes)) ? `${Number(s.consultation_minutes)} min` : "Duration pending"}
                        </Badge>
                      </>
                    )}
                  </div>
                  {s.booked && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Patient: {s.patient_name || s.patient_email || "Booked patient"}
                      {s.patient_email ? ` (${s.patient_email})` : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono mt-1 truncate max-w-full">{s.id}</p>
                </div>
                {!s.booked && isFutureOpen ? (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive rounded-lg gap-1" disabled={del.isPending} onClick={() => del.mutate(s.id)}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                ) : !s.booked ? (
                  <span className="text-xs text-muted-foreground">Past or active slot</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Booked slot (read-only)</span>
                )}
              </div>
            );
            })}
            {!sorted.length && <p className="text-sm text-muted-foreground py-10 text-center px-4">No slots in this date range.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
