import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_BASE, vetbondhuApi, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Pill, Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { buildPrescriptionPdfBlob, downloadPrescriptionPdf } from "@/lib/prescriptionPdf";
import { withApiTiming } from "@/lib/perfMetrics";
import { ICON_COLORS } from "@/lib/iconColors";

const VB = ICON_COLORS.vetbondhu;

type EPrescriptionRow = {
  id: string;
  vet_name?: string;
  advice?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  prescription_id?: string | null;
};

type PrescriptionDetailRow = {
  id: string;
  [key: string]: unknown;
};

type PrescriptionItemRow = {
  id: string;
  [key: string]: unknown;
};

function displayValue(value: unknown, fallback = "—") {
  const text = value == null ? "" : String(value).trim();
  return text || fallback;
}

function displayNA(value: unknown) {
  return displayValue(value, "N/A");
}

function formatDateValue(value: unknown) {
  const text = displayValue(value, "");
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString();
}

function getPrescriptionId(p: Record<string, unknown>) {
  const metadata = p.metadata && typeof p.metadata === "object" ? (p.metadata as Record<string, unknown>) : {};
  const fromMeta = metadata.prescription_id;
  const fromFlat = p.prescription_id;
  const id = fromMeta || fromFlat;
  return typeof id === "string" ? id : "";
}

function SummaryField({ label, value }: { label: string; value: unknown }) {
  const text = displayValue(value, "");
  if (!text) return null;
  return (
    <div className="rounded-lg bg-background p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function SummaryTextBlock({ label, value }: { label: string; value: unknown }) {
  const text = displayValue(value, "");
  if (!text) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="mb-1 text-xs font-semibold" style={{ color: VB }}>{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function WarningTextBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-red-600 bg-red-50 p-3 text-red-800">
      <p className="mb-1 text-xs font-semibold">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{displayNA(value)}</p>
    </div>
  );
}

function PatientPrescriptionSummary({
  detail,
  items,
}: {
  detail: PrescriptionDetailRow;
  items: PrescriptionItemRow[];
}) {
  const careBlocks = [
    ["Feeding Advice", detail.feeding_advice],
    ["Hydration Note", detail.hydration_note],
    ["Isolation Advice", detail.isolation_advice],
    ["Vet Advice / General Care", detail.care_instructions],
  ].filter(([, value]) => displayValue(value, ""));
  const shouldShowFollowUp = Boolean(detail.follow_up_required || detail.follow_up_date || detail.warning_signs || detail.follow_up_notes);

  return (
    <div className="h-full overflow-y-auto border-r bg-background p-4">
      <div className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Prescription Details</h3>
          <p className="text-xs text-muted-foreground">All doctor-entered instructions for this prescription.</p>
        </div>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Animal Information</p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryField label="Type" value={detail.animal_type} />
            <SummaryField label="Breed" value={detail.breed} />
            <SummaryField label="Gender" value={detail.animal_gender} />
            <SummaryField label="Age" value={detail.animal_age} />
            <SummaryField label="Weight" value={detail.animal_weight} />
            <SummaryField label="Farm" value={detail.farm_name} />
            <SummaryField label="Shed / Pen" value={detail.shed_or_pen} />
            <SummaryField label="Batch ID" value={detail.batch_id} />
            <SummaryField label="Animal ID" value={detail.animal_id} />
            <SummaryField label="Affected" value={detail.affected_count} />
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disease Summary</p>
          <SummaryTextBlock label="Disease / Condition" value={detail.diagnosis} />
          <SummaryTextBlock label="Short Description / Symptoms" value={detail.symptoms} />
          <SummaryTextBlock label="Clinical Findings" value={detail.clinical_findings} />
          <SummaryField label="Severity" value={detail.severity} />
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medicines</p>
          {items.length ? (
            items.map((item, index) => (
              <div key={item.id || index} className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{index + 1}. {displayValue(item.medicine_name || item.label)}</p>
                    <p className="text-xs text-muted-foreground">{displayValue(item.medicine_type, "")}</p>
                  </div>
                  <Badge variant="outline" style={{ borderColor: `${VB}40`, color: VB }}>
                    {displayValue(item.dose_pattern || item.frequency)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <SummaryField label="Dosage" value={`${displayValue(item.dosage)} ${displayValue(item.dosage_unit, "")}`.trim()} />
                  <SummaryField label="Frequency" value={item.frequency} />
                  <SummaryField label="Timing" value={item.timing} />
                  <SummaryField label="Route" value={item.route} />
                  <SummaryField label="Duration" value={item.duration_days ? `${item.duration_days} days` : ""} />
                  <SummaryField label="Purpose" value={item.purpose} />
                </div>
                <SummaryTextBlock label="Notes" value={item.notes} />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No medicine rows were added.</p>
          )}
        </section>

        {careBlocks.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Care Instructions</p>
            {careBlocks.map(([label, value]) => <SummaryTextBlock key={label} label={String(label)} value={value} />)}
          </section>
        )}

        {shouldShowFollowUp && (
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-up</p>
            <SummaryTextBlock label="Follow-up Required" value={detail.follow_up_required ? "Yes" : "N/A"} />
            <SummaryTextBlock label="Next Appointment" value={formatDateValue(detail.follow_up_date) || "N/A"} />
            <WarningTextBlock label="Warning Signs" value={detail.warning_signs} />
            <SummaryTextBlock label="Follow-up Notes" value={displayNA(detail.follow_up_notes)} />
          </section>
        )}
      </div>
    </div>
  );
}

export default function Prescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<EPrescriptionRow[]>([]);
  const [selected, setSelected] = useState<EPrescriptionRow | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PrescriptionDetailRow | null>(null);
  const [selectedItems, setSelectedItems] = useState<PrescriptionItemRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPrescriptions = useCallback(async () => {
    if (!user || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const token = readSession()?.access_token;
      const res = await withApiTiming("/v1/vetbondhu/prescriptions/bootstrap", () =>
        fetch(`${API_BASE}/v1/vetbondhu/prescriptions/bootstrap?mode=farmer&limit=40&offset=${offset}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      );
      const body = (await res.json().catch(() => ({}))) as {
        data?: { rows?: EPrescriptionRow[]; page?: { hasMore?: boolean } };
      };
      if (!res.ok || res.status === 304) return;
      const rows = body.data?.rows || [];
      setPrescriptions((prev) => {
        if (offset === 0) return rows;
        const seen = new Set(prev.map((r) => r.id));
        const incoming = rows.filter((r) => !seen.has(r.id));
        return [...prev, ...incoming];
      });
      setHasMore(Boolean(body.data?.page?.hasMore));
    } finally {
      isFetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [offset, user]);

  useEffect(() => {
    if (!user) return;
    setOffset(0);
    setHasMore(false);
    void fetchPrescriptions();

    const channel = vetbondhuApi
      .channel(`vetbondhu-e-prescriptions-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "e_prescriptions" }, (payload: { eventType?: string; new?: EPrescriptionRow }) => {
        const eventType = String(payload?.eventType || "").toUpperCase();
        if (eventType === "INSERT" && payload?.new) {
          setPrescriptions((prev) => {
            const row = payload.new as EPrescriptionRow;
            if (prev.some((p) => p.id === row.id)) return prev;
            return [row, ...prev];
          });
          return;
        }
        if (eventType === "UPDATE" && payload?.new) {
          setPrescriptions((prev) => {
            const row = payload.new as EPrescriptionRow;
            return prev.map((p) => (p.id === row.id ? row : p));
          });
          return;
        }
        void fetchPrescriptions();
      })
      .subscribe();

    return () => {
      vetbondhuApi.removeChannel(channel);
    };
  }, [fetchPrescriptions, user]);

  useEffect(() => {
    if (!selected) return;
    const updated = prescriptions.find((p) => p.id === selected.id);
    if (updated) return;
    setSelected(null);
    setSelectedDetail(null);
    setSelectedItems([]);
  }, [prescriptions, selected]);

  const openDetail = async (row: EPrescriptionRow) => {
    const prescriptionId = getPrescriptionId(row || {});
    if (!prescriptionId) {
      toast.error("Prescription detail is not available yet");
      return;
    }
    setSelected(row);
    setSelectedDetail(null);
    setSelectedItems([]);
    setLoadingDetail(true);
    try {
      const [{ data: detail, error: detailError }, { data: items, error: itemError }] = await Promise.all([
        vetbondhuApi.from("prescriptions").select("*").eq("id", prescriptionId).single(),
        vetbondhuApi.from("prescription_items").select("*").eq("prescription_id", prescriptionId),
      ]);
      if (detailError) throw detailError;
      if (itemError) throw itemError;
      setSelectedDetail(detail || null);
      setSelectedItems(Array.isArray(items) ? items : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load prescription";
      toast.error(message);
      setSelected(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!selected || !selectedDetail || loadingDetail) {
      setPdfPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setPdfPreviewLoading(true);
    setPdfPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    void (async () => {
      try {
        const { blob } = await buildPrescriptionPdfBlob(selected, selectedDetail, selectedItems);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        createdUrl = url;
        setPdfPreviewUrl(url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not generate PDF preview";
        toast.error(message);
      } finally {
        if (!cancelled) setPdfPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [selected, selectedDetail, selectedItems, loadingDetail]);

  const handleDownloadPdf = useCallback(() => {
    if (!selectedDetail) return;
    void downloadPrescriptionPdf(selected || {}, selectedDetail, selectedItems);
  }, [selected, selectedDetail, selectedItems]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Prescriptions</h1>
        <p className="text-muted-foreground mt-1">View your prescriptions from consultations</p>
      </motion.div>

      {prescriptions.length === 0 ? (
        <div className="flex flex-col items-center py-20 space-y-4">
          <FileText className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-muted-foreground">No prescriptions yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="shadow-card overflow-hidden">
                <div className="h-1" style={{ backgroundColor: VB }} />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${VB}20` }}><Pill className="h-5 w-5" style={{ color: VB }} /></div>
                      <div><h3 className="font-display font-bold text-foreground">{p.vet_name}</h3><p className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p></div>
                    </div>
                    <Badge style={{ backgroundColor: `${VB}20`, color: VB }}>Completed</Badge>
                  </div>
                  {p.advice && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: `${VB}08`, border: `1px solid ${VB}30` }}>
                      <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: VB }}><Pill className="h-3 w-3" />Advice</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{p.advice}</p>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => void openDetail(p)}>View Prescription</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {hasMore && (
            <div className="pt-2 flex justify-center">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={() => {
                  setLoadingMore(true);
                  setOffset((prev) => prev + 40);
                }}
              >
                {loadingMore ? "Loading..." : "Load older prescriptions"}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setPdfPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return null;
            });
            setSelected(null);
            setSelectedDetail(null);
            setSelectedItems([]);
          }
        }}
      >
        <DialogContent className="flex h-[min(90vh,820px)] w-[min(96vw,920px)] max-w-[920px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[920px]">
          <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 pr-14 text-left">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-left">Prescription</DialogTitle>
              {selectedDetail && !loadingDetail ? (
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0 text-white"
                  style={{ backgroundColor: VB }}
                  onClick={handleDownloadPdf}
                  disabled={pdfPreviewLoading}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Download PDF
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-muted/40">
            {loadingDetail ? (
              <div className="flex h-[480px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading prescription…
              </div>
            ) : selectedDetail ? (
              <div className="grid h-full min-h-[480px] grid-cols-1 lg:grid-cols-[360px_1fr]">
                <PatientPrescriptionSummary detail={selectedDetail} items={selectedItems} />
                <div className="relative min-h-[480px]">
                  {(pdfPreviewLoading || !pdfPreviewUrl) && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground backdrop-blur-[1px]">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating PDF preview…
                    </div>
                  )}
                  {pdfPreviewUrl ? (
                    <iframe title="Prescription PDF preview" src={pdfPreviewUrl} className="h-full min-h-[480px] w-full border-0" />
                  ) : (
                    !pdfPreviewLoading && (
                      <div className="flex h-[480px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                        Preview could not be loaded. Use Download PDF above.
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center px-4 text-sm text-muted-foreground">
                Prescription detail unavailable.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
