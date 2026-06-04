import { useCallback, useEffect } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { acceptMediOnlineVisit, mediHumanJson } from "@/lib/medibondhuHuman";
import { subscribeMediHumanAppointments } from "@/lib/medibondhuAppointmentRealtime";
import { subscribeMediDoctorInboxNewAppointment } from "@/api/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useMediDoctorPreviewActions } from "@/hooks/useMediDoctorPreviewActions";
import MediDoctorPreviewEmpty from "@/components/medibondhu/MediDoctorPreviewEmpty";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, Calendar, ClipboardList, FilePlus2, Video, Search, Loader2 } from "lucide-react";
import { MediSectionTitle, MediStatusBadge, MB } from "@/components/medibondhu/MediChrome";
import { queryKeys } from "@/lib/queryClient";

type Appt = {
  id: string;
  status: string;
  consultation_type?: string | null;
  patient_user_id?: string | null;
  patient_name?: string | null;
  patient_email?: string | null;
  chief_complaint?: string | null;
  slot_start?: string | null;
  prescription_id?: string | null;
  prescription_status?: string | null;
};

export default function MediDoctorDashboard() {
  const { user } = useAuth();
  const { readOnly, previewEmptyHint } = useMediDoctorPreviewActions();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [doctorPk, setDoctorPk] = useState<string | null>(null);
  const [prescriptionSearchCode, setPrescriptionSearchCode] = useState("");
  const [searchingPrescription, setSearchingPrescription] = useState(false);
  const pageSize = 20;
  const feedKey = useMemo(() => ["medibondhu-human-doctor-feed", user?.id] as const, [user?.id]);

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

  const invalidateFeed = useCallback(() => {
    void qc.invalidateQueries({ queryKey: feedKey });
    void qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorAppointments(user?.id, 0) });
  }, [feedKey, qc, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const unsubBroadcast = subscribeMediDoctorInboxNewAppointment(user.id, invalidateFeed);
    const unsubPg = subscribeMediHumanAppointments({
      channelKey: `medi-doctor-dashboard-${user.id}`,
      doctorPk,
      onEvent: () => invalidateFeed(),
    });
    return () => {
      unsubBroadcast();
      unsubPg();
    };
  }, [doctorPk, invalidateFeed, user?.id]);

  const q = useInfiniteQuery({
    queryKey: feedKey,
    enabled: Boolean(user?.id),
    initialPageParam: 0,
    getNextPageParam: (last) => (typeof last?.page?.nextOffset === "number" ? last.page.nextOffset : undefined),
    refetchInterval: (query) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
      const pages = query.state.data?.pages || [];
      const all = pages.flatMap((p) => p.appointments || []);
      const hasWaiting = all.some(
        (a) =>
          String(a.consultation_type || "").toLowerCase() === "online" &&
          ["pending", "confirmed"].includes(String(a.status || "").toLowerCase()),
      );
      return hasWaiting ? 1500 : 2000;
    },
    queryFn: async ({ pageParam }) => {
      const offset = pageParam ?? 0;
      const { res, body } = await mediHumanJson<{
        data?: { appointments?: Appt[]; page?: { nextOffset?: number | null } };
      }>(`/appointments/bootstrap?view=doctor&limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return (
        body.data || {
          appointments: [],
          page: { nextOffset: null },
        }
      );
    },
  });

  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.appointments || []) || [], [q.data?.pages]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = a.slot_start ? new Date(a.slot_start).getTime() : 0;
      const tb = b.slot_start ? new Date(b.slot_start).getTime() : 0;
      return tb - ta;
    });
  }, [rows]);

  const actionable = sortedRows.filter((a) => !["completed", "cancelled", "rejected"].includes(String(a.status || "").toLowerCase()));

  const act = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { res, body } = await mediHumanJson(`/appointments/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-feed"] });
      await qc.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorEarnings(user?.id) });
      toast.success("Appointment updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed"),
  });

  const openPrescriptionByCode = async () => {
    const code = prescriptionSearchCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      toast.error("Enter a 6-digit prescription code");
      return;
    }
    setSearchingPrescription(true);
    try {
      const { res, body } = await mediHumanJson<{ data?: { id?: string }; error?: string }>(`/prescriptions/search?code=${encodeURIComponent(code)}`);
      if (!res.ok || !body.data?.id) throw new Error(String(body.error || "Prescription not found"));
      navigate(`/medibondhu/prescription/${body.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Prescription not found");
    } finally {
      setSearchingPrescription(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            MediBondhu doctor panel · Doctor workspace
          </p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-1 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${MB}18` }}>
              <ClipboardList className="h-5 w-5" style={{ color: MB }} />
            </span>
            Inbox
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
            Manage MediBondhu patient appointments, complete visits, and issue prescriptions when appropriate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl gap-2" disabled={readOnly} onClick={() => navigate("/medibondhu/doctor/schedule")}>
            <Calendar className="h-4 w-4" />
            Availability
          </Button>
          <Button type="button" className="rounded-xl gap-2 text-white font-semibold" style={{ backgroundColor: MB }} disabled={readOnly} onClick={() => navigate("/medibondhu/doctor/rx/new")}>
            <FilePlus2 className="h-4 w-4" />
            New prescription
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-xl border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Queue</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{actionable.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Active / pending visits</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Loaded</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{sortedRows.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Appointments in view</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Module</p>
            <p className="text-sm font-semibold mt-2 text-foreground">MediBondhu Human</p>
            <p className="text-xs text-muted-foreground mt-0.5">Not mixed with vet data</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-border">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Search MediBondhu prescription</p>
            <p className="text-xs text-muted-foreground">Enter the 6-digit prescription code to open the record.</p>
          </div>
          <div className="flex gap-2 md:w-[320px]">
            <Input
              value={prescriptionSearchCode}
              onChange={(event) => setPrescriptionSearchCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void openPrescriptionByCode();
              }}
              placeholder="123456"
              className="font-mono tracking-widest"
              maxLength={6}
            />
            <Button type="button" className="text-white" style={{ backgroundColor: MB }} disabled={readOnly || searchingPrescription} onClick={() => void openPrescriptionByCode()}>
              {searchingPrescription ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <MediSectionTitle eyebrow="Sorted by schedule" title="Appointments" />

      {q.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-xl overflow-hidden">
              <Skeleton className="h-1 w-full rounded-none" style={{ backgroundColor: `${MB}45` }} />
              <CardContent className="p-5 flex gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full max-w-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!q.isLoading && (
        <div className="space-y-4">
          {sortedRows.map((a) => {
            const terminal = ["completed", "cancelled", "rejected"].includes(String(a.status || "").toLowerCase());
            const patientKey = a.patient_user_id ? String(a.patient_user_id) : "";
            const hasIssuedPrescription =
              Boolean(a.prescription_id) && String(a.prescription_status || "").toLowerCase() === "issued";
            return (
              <Card key={a.id} className="rounded-xl overflow-hidden border-border hover:shadow-md transition-shadow">
                <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <UserRound className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-lg text-foreground">{a.patient_name || "Patient"}</p>
                        {a.patient_email && <p className="text-sm text-muted-foreground truncate max-w-[280px] sm:max-w-md">{a.patient_email}</p>}
                        {a.slot_start && (
                          <p className="text-sm font-medium text-foreground/90 mt-2 inline-flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                            {new Date(a.slot_start).toLocaleString()}
                          </p>
                        )}
                        {patientKey && (
                          <p className="text-[11px] font-mono text-muted-foreground mt-2 break-all">Patient ID · {patientKey}</p>
                        )}
                      </div>
                    </div>
                    <MediStatusBadge status={String(a.status || "unknown")} />
                  </div>

                  {a.chief_complaint && (
                    <div className="rounded-xl border bg-muted/20 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Chief complaint</p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{a.chief_complaint}</p>
                    </div>
                  )}

                  <Separator />

                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
                    {String(a.consultation_type || "").toLowerCase() === "online" && !terminal && (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg gap-1.5 text-white order-first sm:order-none"
                        style={{ backgroundColor: MB }}
                        disabled={readOnly || act.isPending || joiningId === a.id}
                        onClick={async () => {
                          setJoiningId(a.id);
                          try {
                            const accepted = await acceptMediOnlineVisit(a.id, { currentStatus: a.status });
                            if (!accepted.ok) {
                              toast.error(accepted.error || "Unable to start visit");
                              return;
                            }
                            invalidateFeed();
                            navigate(`/medibondhu/room/${a.id}`);
                          } catch (e) {
                            toast.error((e as Error).message || "Unable to open room");
                          } finally {
                            setJoiningId(null);
                          }
                        }}
                      >
                        <Video className="h-4 w-4 shrink-0" />
                        Join video consultation
                      </Button>
                    )}
                    {!terminal && (
                      <>
                        <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={readOnly || act.isPending} onClick={() => act.mutate({ id: a.id, status: "completed" })}>
                          Mark complete
                        </Button>
                        <Button type="button" variant="destructive" size="sm" className="rounded-lg" disabled={readOnly || act.isPending} onClick={() => act.mutate({ id: a.id, status: "rejected" })}>
                          Reject visit
                        </Button>
                      </>
                    )}
                    {hasIssuedPrescription ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg sm:ml-auto"
                        onClick={() => navigate(`/medibondhu/prescription/${a.prescription_id}`)}
                      >
                        Issued
                      </Button>
                    ) : patientKey && (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg text-white sm:ml-auto"
                        style={{ backgroundColor: MB }}
                        disabled={readOnly}
                        onClick={() => navigate(`/medibondhu/doctor/rx/new?patient=${encodeURIComponent(patientKey)}&appointment=${encodeURIComponent(a.id)}`)}
                      >
                        Issue Rx
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" className="rounded-full px-8" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {!q.isLoading && sortedRows.length === 0 && (
        <MediDoctorPreviewEmpty hint={previewEmptyHint} />
      )}
    </div>
  );
}
