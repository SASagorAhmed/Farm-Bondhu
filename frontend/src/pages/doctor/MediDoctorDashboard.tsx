import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound, Calendar, ClipboardList, FilePlus2, Video } from "lucide-react";
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
};

export default function MediDoctorDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pageSize = 20;

  const q = useInfiniteQuery({
    queryKey: ["medibondhu-human-doctor-feed", user?.id],
    enabled: Boolean(user?.id),
    initialPageParam: 0,
    getNextPageParam: (last) => (typeof last?.page?.nextOffset === "number" ? last.page.nextOffset : undefined),
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

  const rows = q.data?.pages.flatMap((p) => p.appointments || []) || [];

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
            Human-health appointments only. This inbox is isolated from VetBondhu animal consultations. Resolve visits, then issue prescriptions when
            appropriate.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={() => navigate("/medibondhu/doctor/schedule")}>
            <Calendar className="h-4 w-4" />
            Availability
          </Button>
          <Button type="button" className="rounded-xl gap-2 text-white font-semibold" style={{ backgroundColor: MB }} onClick={() => navigate("/medibondhu/doctor/rx/new")}>
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
                        disabled={act.isPending}
                        onClick={async () => {
                          try {
                            const raw = String(a.status || "").toLowerCase();
                            if (raw === "pending" || raw === "confirmed") {
                              const { res, body } = await mediHumanJson(`/appointments/${a.id}`, {
                                method: "PATCH",
                                body: JSON.stringify({ status: "in_progress" }),
                              });
                              if (!res.ok) {
                                toast.error(String((body as { error?: string }).error || res.status));
                                return;
                              }
                            }
                            await qc.invalidateQueries({ queryKey: ["medibondhu-human-doctor-feed"] });
                            navigate(`/medibondhu/room/${a.id}`);
                          } catch (e) {
                            toast.error((e as Error).message || "Unable to open room");
                          }
                        }}
                      >
                        <Video className="h-4 w-4 shrink-0" />
                        Join video consultation
                      </Button>
                    )}
                    <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={terminal || act.isPending} onClick={() => act.mutate({ id: a.id, status: "completed" })}>
                      Mark complete
                    </Button>
                    <Button type="button" variant="destructive" size="sm" className="rounded-lg" disabled={terminal || act.isPending} onClick={() => act.mutate({ id: a.id, status: "rejected" })}>
                      Reject visit
                    </Button>
                    {patientKey && (
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-lg text-white sm:ml-auto"
                        style={{ backgroundColor: MB }}
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
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-12 text-center space-y-3 max-w-md mx-auto">
            <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">No appointments in your queue</p>
            <p className="text-sm text-muted-foreground">When patients book your open slots, they will appear here with visit details.</p>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate("/medibondhu/doctor/schedule")}>
              Manage availability
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
