import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Pill, Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { buildPrescriptionPdfBlob, downloadPrescriptionPdf } from "@/lib/prescriptionPdf";

const MB = "#12C2D6";

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

function getPrescriptionId(p: Record<string, unknown>) {
  const metadata = p.metadata && typeof p.metadata === "object" ? (p.metadata as Record<string, unknown>) : {};
  const fromMeta = metadata.prescription_id;
  const fromFlat = p.prescription_id;
  const id = fromMeta || fromFlat;
  return typeof id === "string" ? id : "";
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

  const fetchPrescriptions = useCallback(async () => {
    if (!user || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const { data } = await api
        .from("e_prescriptions")
        .select("*")
        .eq("patient_mock_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setPrescriptions(data);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchPrescriptions();

    const channel = api
      .channel(`medibondhu-e-prescriptions-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "e_prescriptions" }, () => {
        void fetchPrescriptions();
      })
      .subscribe();

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      void fetchPrescriptions();
    };
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(poll, 10000);
    };
    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        poll();
        startPolling();
      } else {
        stopPolling();
      }
    };
    startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      api.removeChannel(channel);
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
        api.from("prescriptions").select("*").eq("id", prescriptionId).single(),
        api.from("prescription_items").select("*").eq("prescription_id", prescriptionId),
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
                <div className="h-1" style={{ backgroundColor: MB }} />
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${MB}20` }}><Pill className="h-5 w-5" style={{ color: MB }} /></div>
                      <div><h3 className="font-display font-bold text-foreground">{p.vet_name}</h3><p className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p></div>
                    </div>
                    <Badge style={{ backgroundColor: `${MB}20`, color: MB }}>Completed</Badge>
                  </div>
                  {p.advice && (
                    <div className="p-4 rounded-lg" style={{ backgroundColor: `${MB}08`, border: `1px solid ${MB}30` }}>
                      <p className="text-xs font-medium mb-2 flex items-center gap-1" style={{ color: MB }}><Pill className="h-3 w-3" />Advice</p>
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
                  style={{ backgroundColor: MB }}
                  onClick={handleDownloadPdf}
                  disabled={pdfPreviewLoading}
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Download PDF
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          <div className="relative min-h-0 flex-1 bg-muted/40">
            {loadingDetail ? (
              <div className="flex h-[480px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading prescription…
              </div>
            ) : selectedDetail ? (
              <>
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
              </>
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
