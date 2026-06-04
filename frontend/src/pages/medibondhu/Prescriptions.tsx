import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { MediSectionTitle, MB } from "@/components/medibondhu/MediChrome";

type Rx = { id: string; status?: string; created_at?: string; doctor_name?: string; diagnosis?: string | null };

export default function Prescriptions() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanPatientPrescriptions(user?.id),
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{
        data?: { prescriptions?: Rx[] };
      }>("/prescriptions/bootstrap?mode=patient");
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
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Records</p>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3 mt-1">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${MB}18` }}>
            <FileText className="h-5 w-5" style={{ color: MB }} />
          </span>
          Prescriptions
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-base">
          Digital prescriptions issued by your MediBondhu doctors. Bring this summary to pharmacies or save for your personal health record.
        </p>
      </header>

      <MediSectionTitle eyebrow="Newest first" title="Issued prescriptions" />

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Card key={i} className="rounded-xl">
              <Skeleton className="h-1 rounded-none w-full" style={{ backgroundColor: `${MB}50` }} />
              <CardContent className="p-5 flex justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-full max-w-lg" />
                </div>
                <Skeleton className="h-9 w-20 shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}>
            <Card
              className="rounded-xl overflow-hidden cursor-pointer hover:shadow-md border-border transition-all group"
              onClick={() => navigate(`/medibondhu/prescription/${p.id}`)}
            >
              <div className="h-1 w-full shrink-0" style={{ backgroundColor: MB }} />
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { dateStyle: "long" }) : "Date unknown"}
                  </p>
                  <p className="font-semibold text-foreground text-lg">{p.doctor_name || "Prescribing doctor"}</p>
                  {p.diagnosis && <p className="text-sm text-muted-foreground line-clamp-2">{p.diagnosis}</p>}
                  {p.status && (
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      Status: <span className="font-medium text-foreground">{p.status}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg" style={{ borderColor: MB, color: MB }} onClick={(e) => { e.stopPropagation(); navigate(`/medibondhu/prescription/${p.id}?preview=1`); }}>
                    Preview prescription
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {!isLoading && sorted.length === 0 && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-12 text-center space-y-3 max-w-md mx-auto">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-semibold text-foreground">No prescriptions yet</p>
            <p className="text-sm text-muted-foreground">After a visit, your doctor can issue a prescription — it will show up here automatically.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
