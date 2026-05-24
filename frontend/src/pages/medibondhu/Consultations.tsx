import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/dashboard/StatCard";
import { CalendarCheck, ChevronRight, Stethoscope, Video, ClipboardList, CheckCircle } from "lucide-react";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { MediStatusBadge, MB, MediSectionTitle } from "@/components/medibondhu/MediChrome";

type ApptRow = {
  id: string;
  status: string;
  chief_complaint: string | null;
  consultation_type: string;
  doctor_name?: string | null;
  specialty_name?: string | null;
  slot_start?: string | null;
};

export default function Consultations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const pageSize = 20;

  const q = useInfiniteQuery({
    queryKey: ["medibondhu-human-appt-feed", user?.id],
    enabled: Boolean(user?.id),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const p = last?.page?.nextOffset;
      return typeof p === "number" ? p : undefined;
    },
    queryFn: async ({ pageParam }) => {
      const offset = pageParam ?? 0;
      const { res, body } = await mediHumanJson<{
        data?: { appointments?: ApptRow[]; page?: { hasMore?: boolean; nextOffset?: number | null } };
      }>(`/appointments/bootstrap?view=patient&limit=${pageSize}&offset=${offset}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return (
        body.data || {
          appointments: [],
          page: { hasMore: false, nextOffset: null },
        }
      );
    },
  });

  const appointments = q.data?.pages.flatMap((p) => p.appointments || []) || [];

  const stats = useMemo(() => {
    const terminal = new Set(["completed", "cancelled", "rejected"]);
    let active = 0;
    let done = 0;
    for (const a of appointments) {
      const s = String(a.status || "").toLowerCase();
      if (terminal.has(s)) done += 1;
      else active += 1;
    }
    return { total: appointments.length, active, done };
  }, [appointments]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your care</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-2 mt-1">
            <CalendarCheck style={{ color: MB }} className="h-9 w-9 shrink-0" />
            Consultations
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            MediBondhu human doctors — waiting room and video behave like VetBondhu: pending until the doctor starts, then join video from here or the appointment
            screen.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="rounded-xl font-semibold text-white shrink-0"
          style={{ backgroundColor: MB }}
          onClick={() => navigate("/medibondhu/doctors")}
        >
          Book a doctor
        </Button>
      </header>

      {!q.isLoading && appointments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="All visits"
            value={stats.total}
            icon={<ClipboardList className="h-5 w-5" style={{ color: MB }} />}
            iconColor={MB}
            gradient="from-background via-background to-muted/40"
            index={0}
          />
          <StatCard
            title="Active / waiting"
            value={stats.active}
            icon={<Video className="h-5 w-5 text-amber-600" />}
            iconColor="#d97706"
            gradient="from-background via-background to-amber-500/10"
            index={1}
          />
          <StatCard
            title="Ended"
            value={stats.done}
            icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
            iconColor="#059669"
            gradient="from-background via-background to-emerald-500/10"
            index={2}
          />
        </div>
      )}

      <MediSectionTitle eyebrow="Timeline" title="Upcoming & recent visits" />

      {q.isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-xl overflow-hidden">
              <Skeleton className="h-1 w-full rounded-none" style={{ backgroundColor: `${MB}55` }} />
              <CardContent className="p-5 flex gap-4">
                <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-full max-w-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {q.isError && (
        <p className="text-destructive text-sm rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">{(q.error as Error).message}</p>
      )}

      <div className="space-y-3">
        {appointments.map((a, i) => (
          <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.35) }}>
            <Card
              className="rounded-xl overflow-hidden cursor-pointer hover:shadow-md border-border transition-shadow group"
              onClick={() => navigate(`/medibondhu/appointment/${a.id}`)}
            >
              <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-muted">
                  <Stethoscope className="h-5 w-5" style={{ color: MB }} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold text-foreground text-base">{a.doctor_name || "Doctor"}</p>
                  {a.specialty_name && <p className="text-sm text-muted-foreground">{a.specialty_name}</p>}
                  {a.slot_start && (
                    <p className="text-sm font-medium text-foreground/90 mt-1">{new Date(a.slot_start).toLocaleString()}</p>
                  )}
                  {a.chief_complaint && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.chief_complaint}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:shrink-0">
                  <Badge variant="outline" className="capitalize rounded-md font-normal">
                    {a.consultation_type}
                  </Badge>
                  <MediStatusBadge status={a.status} />
                  {String(a.consultation_type || "").toLowerCase() === "online" && String(a.status || "").toLowerCase() === "pending" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg gap-1.5 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/medibondhu/waiting/${a.id}`);
                      }}
                    >
                      <Video className="h-3.5 w-3.5" />
                      Waiting room
                    </Button>
                  )}
                  {String(a.consultation_type || "").toLowerCase() === "online" &&
                    ["confirmed", "in_progress"].includes(String(a.status || "").toLowerCase()) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg gap-1.5 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/medibondhu/room/${a.id}`);
                      }}
                    >
                      <Video className="h-3.5 w-3.5" />
                      Join video
                    </Button>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block group-hover:translate-x-0.5 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {q.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button type="button" variant="outline" className="rounded-full px-8" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      {!q.isLoading && appointments.length === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-12 text-center space-y-4 max-w-md mx-auto">
            <div className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: `${MB}18` }}>
              <CalendarCheck className="h-7 w-7" style={{ color: MB }} />
            </div>
            <div>
              <p className="font-display font-bold text-lg text-foreground">No appointments yet</p>
              <p className="text-sm text-muted-foreground mt-2">When you book a doctor, your visits will appear here with status and visit type.</p>
            </div>
            <Button type="button" className="rounded-xl text-white font-semibold" style={{ backgroundColor: MB }} onClick={() => navigate("/medibondhu/doctors")}>
              Find a doctor
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
