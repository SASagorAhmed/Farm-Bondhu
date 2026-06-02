import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useMediDoctorPreviewActions } from "@/hooks/useMediDoctorPreviewActions";
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
  booked?: boolean;
  appointment_id?: string | null;
  consultation_type?: string | null;
  appointment_status?: string | null;
  patient_user_id?: string | null;
  patient_name?: string | null;
  patient_email?: string | null;
  consultation_minutes?: number | null;
  active_appointment_count?: number;
  total_appointment_count?: number;
};

type DoctorProfile = {
  is_available?: boolean;
  online_consultation?: boolean;
  chamber_consultation?: boolean;
};

function invalidateScheduleCaches(qc: ReturnType<typeof useQueryClient>, userId?: string, from?: string, to?: string) {
  void qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorSchedule(userId, from, to) });
  void qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-slots"] });
  void qc.invalidateQueries({ queryKey: ["medibondhu-human-doctors"] });
  void qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorsPreview(userId) });
}

export default function MediDoctorSchedule() {
  const { user } = useAuth();
  const { readOnly } = useMediDoctorPreviewActions();
  const qc = useQueryClient();
  const [from, setFrom] = useState(() => formatDateYMDInDhaka());
  const [to, setTo] = useState(() => addCalendarDaysDhaka(formatDateYMDInDhaka(), 21));
  const [day, setDay] = useState(() => formatDateYMDInDhaka());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");

  const scheduleKey = queryKeys().medibondhuHumanDoctorSchedule(user?.id, from, to);

  const profileQuery = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorProfile(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: DoctorProfile | null }>("/doctor/me");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || null;
    },
  });

  const q = useQuery({
    queryKey: scheduleKey,
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
      const { res, body } = await mediHumanJson<{
        data?: { inserted_count?: number; requested_count?: number; duplicates_skipped?: number; past_skipped?: number };
      }>(`/doctor/time-slots/bulk`, {
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
        toast.success(insertedCount === 1 ? "Availability window added" : `${insertedCount} windows added`);
      } else {
        if (pastSkipped > 0) {
          toast.warning("No new window added. This slot already ended, so it is hidden from patients.");
        } else {
          const duplicateHint =
            duplicatesSkipped > 0 || requestedCount > 0
              ? "This time window already exists or was skipped as a duplicate."
              : "No valid windows were inserted.";
          toast.warning(`No new window added. ${duplicateHint}`);
        }
      }
      invalidateScheduleCaches(qc, user?.id, from, to);
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { res, body } = await mediHumanJson(`/doctor/time-slots/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Availability window removed");
      invalidateScheduleCaches(qc, user?.id, from, to);
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const availabilityMu = useMutation({
    mutationFn: async (patch: DoctorProfile) => {
      const { res, body } = await mediHumanJson<{ data?: DoctorProfile; error?: string }>("/doctor/profile", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(String(body.error || res.status));
      return body.data;
    },
    onSuccess: async () => {
      toast.success("Availability updated");
      await qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorProfile(user?.id) });
      invalidateScheduleCaches(qc, user?.id, from, to);
    },
    onError: (e: Error) => toast.error(e.message || "Could not update availability"),
  });

  const sorted = useMemo(
    () => [...(q.data || [])].sort((a, b) => String(a.slot_start).localeCompare(String(b.slot_start))),
    [q.data],
  );

  const stats = useMemo(() => {
    const now = Date.now();
    let openWindows = 0;
    let activePatients = 0;
    for (const s of sorted) {
      const endMs = new Date(s.slot_end).getTime();
      if (Number.isFinite(endMs) && endMs > now) openWindows += 1;
      activePatients += Number(s.active_appointment_count || 0);
    }
    return { openWindows, activePatients };
  }, [sorted]);

  const profile = profileQuery.data;
  const acceptingPatients = Boolean(profile?.is_available ?? true);
  const onlineEnabled = Boolean(profile?.online_consultation ?? true);
  const chamberEnabled = Boolean(profile?.chamber_consultation ?? true);
  const onlineBookable = acceptingPatients && onlineEnabled && stats.openWindows > 0;
  const availabilitySummary = !acceptingPatients
    ? "Not accepting patients"
    : onlineBookable
      ? "Online booking is available"
      : onlineEnabled
        ? "Online enabled, but no future schedule is open"
        : chamberEnabled
          ? "Chamber only"
          : "Offline";

  const updateAvailability = (patch: DoctorProfile) => {
    if (readOnly || availabilityMu.isPending) return;
    availabilityMu.mutate(patch);
  };

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
          Publish open time windows for MediBondhu patients (Bangladesh time, {MEDI_BONDHU_TZ}). Each window stays bookable until it ends — multiple patients
          can request visits in the same window. Remove a window only when no active appointments remain.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Open windows</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{stats.openWindows}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Not ended yet</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Active bookings</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{stats.activePatients}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pending / in progress</p>
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
          <CardTitle className="text-lg font-display">Availability status</CardTitle>
          <CardDescription>
            Control how patients see you in MediBondhu. Online booking also needs at least one future schedule window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{availabilitySummary}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.openWindows > 0
                ? `${stats.openWindows} future window${stats.openWindows === 1 ? "" : "s"} published.`
                : "No future windows are published, so patients cannot book online or chamber appointments yet."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">Accepting patients</span>
                <span className="block text-xs text-muted-foreground mt-1">Turn off to appear unavailable.</span>
              </span>
              <Switch
                checked={acceptingPatients}
                disabled={readOnly || availabilityMu.isPending || profileQuery.isLoading}
                onCheckedChange={(checked) => updateAvailability({ is_available: checked })}
              />
            </label>
            <label className="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">Online visits</span>
                <span className="block text-xs text-muted-foreground mt-1">Needs future schedule windows.</span>
              </span>
              <Switch
                checked={onlineEnabled}
                disabled={readOnly || availabilityMu.isPending || profileQuery.isLoading}
                onCheckedChange={(checked) => updateAvailability({ online_consultation: checked })}
              />
            </label>
            <label className="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold text-foreground">Chamber visits</span>
                <span className="block text-xs text-muted-foreground mt-1">Allow in-person booking.</span>
              </span>
              <Switch
                checked={chamberEnabled}
                disabled={readOnly || availabilityMu.isPending || profileQuery.isLoading}
                onCheckedChange={(checked) => updateAvailability({ chamber_consultation: checked })}
              />
            </label>
          </div>
        </CardContent>
      </Card>

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
          <CardTitle className="text-lg font-display">Add a window</CardTitle>
          <CardDescription>
            Start/end use Bangladesh local time. Patients see every window until its end time — not one patient per window.
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            If another window already exists at the same start time, it is skipped as a duplicate.
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
            <Button type="button" className="rounded-xl text-white font-semibold px-8" style={{ backgroundColor: MB }} disabled={readOnly || bulk.isPending} onClick={() => bulk.mutate()}>
              {bulk.isPending ? "Saving…" : "Add window"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <MediSectionTitle eyebrow="In selected range" title="Your availability" />
        <Card className="rounded-2xl border-border overflow-hidden">
          <CardContent className="p-0 divide-y">
            {sorted.map((s) => {
              const now = Date.now();
              const endMs = new Date(s.slot_end).getTime();
              const activeCount = Number(s.active_appointment_count || 0);
              const totalCount = Number(s.total_appointment_count || 0);
              const isEnded = Number.isFinite(endMs) && endMs <= now;
              const isOpen = !isEnded;
              const canRemove = isOpen && activeCount === 0;
              const latestStatus = String(s.appointment_status || "").toLowerCase();

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
                      {isEnded ? (
                        <Badge variant="outline" className="rounded-md font-normal text-muted-foreground">
                          Ended
                        </Badge>
                      ) : activeCount > 0 ? (
                        <Badge className="rounded-md font-normal" style={{ backgroundColor: `${MB}22`, color: MB, borderColor: `${MB}55` }}>
                          Open · {activeCount} active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-md font-normal">
                          Open
                        </Badge>
                      )}
                      {totalCount > 0 && (
                        <Badge variant="outline" className="rounded-md font-normal text-xs">
                          {totalCount} visit{totalCount === 1 ? "" : "s"} total
                        </Badge>
                      )}
                    </div>
                    {activeCount > 0 && (s.patient_name || s.patient_email) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Latest: {s.patient_name || s.patient_email}
                        {latestStatus ? ` (${latestStatus.replace("_", " ")})` : ""}
                        {s.patient_email && s.patient_name ? ` · ${s.patient_email}` : ""}
                      </p>
                    )}
                    {activeCount > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activeCount} patients in queue for this window — manage each visit from your inbox.
                      </p>
                    )}
                  </div>
                  {canRemove ? (
                    <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive rounded-lg gap-1" disabled={readOnly || del.isPending} onClick={() => del.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  ) : isEnded ? (
                    <span className="text-xs text-muted-foreground">Ended</span>
                  ) : activeCount > 0 ? (
                    <span className="text-xs text-muted-foreground max-w-[140px] text-right">
                      Cancel or complete active visits before removing
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              );
            })}
            {!sorted.length && <p className="text-sm text-muted-foreground py-10 text-center px-4">No availability in this date range.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
