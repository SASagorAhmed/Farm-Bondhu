import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Plus, ChevronRight } from "lucide-react";
import { MediSectionTitle, MB } from "@/components/medibondhu/MediChrome";

type Rx = { id: string; chief_complaint?: string; created_at?: string; diagnosis?: string | null };

export default function MediDoctorPrescriptions() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorPrescriptions(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: { prescriptions?: Rx[] } }>("/prescriptions/bootstrap?mode=doctor");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data?.prescriptions || [];
    },
  });

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [rows]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinical records</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-1 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${MB}18` }}>
              <FileText className="h-5 w-5" style={{ color: MB }} />
            </span>
            Prescriptions issued
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">Human MediBondhu prescriptions you have authored. Open any row to review the full regimen.</p>
        </div>
        <Button type="button" className="rounded-xl text-white font-semibold gap-2 shrink-0" style={{ backgroundColor: MB }} onClick={() => navigate("/medibondhu/doctor/rx/new")}>
          <Plus className="h-4 w-4" /> New prescription
        </Button>
      </header>

      <MediSectionTitle eyebrow="Newest first" title={`${sorted.length} in list`} />

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-xl overflow-hidden">
              <Skeleton className="h-1 w-full rounded-none" style={{ backgroundColor: `${MB}40` }} />
              <CardContent className="p-5 flex justify-between gap-4">
                <Skeleton className="h-12 flex-1" />
                <Skeleton className="h-10 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {!isLoading &&
          sorted.map((r) => (
            <Card
              key={r.id}
              className="rounded-xl overflow-hidden border-border hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/medibondhu/prescription/${r.id}`)}
            >
              <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                  </p>
                  {r.diagnosis && <p className="font-medium text-foreground line-clamp-2">{r.diagnosis}</p>}
                  {r.chief_complaint && !r.diagnosis && <p className="text-sm text-muted-foreground line-clamp-2">{r.chief_complaint}</p>}
                  <p className="text-[11px] font-mono text-muted-foreground truncate">ID {r.id}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={(e) => { e.stopPropagation(); navigate(`/medibondhu/prescription/${r.id}`); }}>
                    Open
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block group-hover:translate-x-0.5 transition-transform" />
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {!isLoading && sorted.length === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-12 text-center space-y-4 max-w-md mx-auto">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">No prescriptions yet</p>
            <p className="text-sm text-muted-foreground">When you issue a prescription for a patient, it will be listed here.</p>
            <Button type="button" className="rounded-xl text-white font-semibold" style={{ backgroundColor: MB }} onClick={() => navigate("/medibondhu/doctor/rx/new")}>
              Issue your first Rx
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
