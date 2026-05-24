import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { queryKeys } from "@/lib/queryClient";
import { ArrowLeft, FileText } from "lucide-react";
import { MB } from "@/components/medibondhu/MediChrome";

type Item = { id: string; medication_name: string; dosage: string | null; notes: string | null };

export default function PrescriptionDetailHuman() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanPrescriptionDetail(id),
    enabled: Boolean(id),
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: Record<string, unknown> & { items?: Item[] } }>(`/prescriptions/${id}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data;
    },
  });

  if (isLoading) {
    return <p className="text-center py-16 text-muted-foreground text-sm">Loading prescription…</p>;
  }

  if (!data) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <p className="font-medium text-foreground">Prescription not found</p>
        <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={() => navigate("/medibondhu/prescriptions")}>
          Back to list
        </Button>
      </div>
    );
  }

  const items = (data.items || []) as Item[];
  const created = data.created_at ? String(data.created_at) : null;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <Button type="button" variant="ghost" className="gap-2 -ml-2" onClick={() => navigate("/medibondhu/prescriptions")}>
        <ArrowLeft className="h-4 w-4" /> Prescriptions
      </Button>

      <Card className="rounded-2xl overflow-hidden border-border shadow-md print:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 md:px-8 py-6 border-b bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${MB}18` }}>
              <FileText className="h-6 w-6" style={{ color: MB }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">MediBondhu</p>
              <h1 className="text-2xl font-display font-bold text-foreground mt-0.5">Prescription</h1>
              {created && <p className="text-sm text-muted-foreground mt-1">{new Date(created).toLocaleString()}</p>}
            </div>
          </div>
          <div className="text-left sm:text-right text-sm text-muted-foreground">
            <p className="font-mono text-xs break-all opacity-70">Ref: {String(data.id || "").slice(0, 8)}…</p>
          </div>
        </div>

        <CardContent className="p-6 md:p-8 space-y-8">
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinical summary</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Diagnosis</p>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{String(data.diagnosis || "—")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Advice</p>
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{String(data.advice || "—")}</p>
              </div>
            </div>
            {data.follow_up_date && (
              <p className="text-sm">
                <span className="text-muted-foreground">Suggested follow-up: </span>
                <span className="font-medium text-foreground">{String(data.follow_up_date)}</span>
              </p>
            )}
          </section>

          <Separator />

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Medications</h2>
            {items.length > 0 ? (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold">Drug</TableHead>
                      <TableHead className="font-semibold w-[28%]">Dosage</TableHead>
                      <TableHead className="font-semibold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium align-top">{it.medication_name}</TableCell>
                        <TableCell className="text-muted-foreground align-top">{it.dosage || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground align-top">{it.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 bg-muted/10">No medication lines on this prescription.</p>
            )}
          </section>

          <p className="text-xs text-muted-foreground leading-relaxed border-t pt-6">
            This document is generated from your MediBondhu account. For emergencies, contact local emergency services. Always follow your clinician’s instructions
            and verify drug names with your pharmacist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
