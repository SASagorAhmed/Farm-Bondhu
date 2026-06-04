import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE, vetbondhuApi, readSession } from "@/api/client";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  ArrowLeft, Stethoscope, Pill, Heart, CalendarCheck,
  FileText, Loader2, Clock, AlertTriangle, Send, Edit3, Save, X,
} from "lucide-react";

interface PrescriptionData {
  id: string;
  consultation_id: string | null;
  vet_name: string;
  vet_degree?: string | null;
  vet_address?: string | null;
  farmer_name: string;
  animal_type: string;
  breed: string | null;
  animal_gender: string | null;
  animal_age: string | null;
  animal_weight: string | null;
  farm_name: string | null;
  shed_or_pen: string | null;
  batch_id: string | null;
  animal_id: string | null;
  affected_count: number | null;
  symptoms: string | null;
  clinical_findings: string | null;
  diagnosis: string | null;
  severity: string | null;
  feeding_advice: string | null;
  isolation_advice: string | null;
  hydration_note: string | null;
  care_instructions: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  warning_signs: string | null;
  follow_up_notes: string | null;
  status: string;
  created_at: string;
}

interface MedicineItem {
  id: string;
  medicine_name: string;
  medicine_type: string | null;
  dosage: string;
  dosage_unit: string;
  frequency: string;
  dose_pattern: string | null;
  timing: string | null;
  route: string | null;
  duration_days: number | null;
  purpose: string | null;
  notes: string | null;
}

const statusStyles: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-green-100 text-green-700",
  updated: "bg-blue-100 text-blue-700",
  canceled: "bg-red-100 text-red-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const severityStyles: Record<string, string> = {
  mild: "bg-green-100 text-green-700",
  moderate: "bg-yellow-100 text-yellow-700",
  severe: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};
const VB = ICON_COLORS.vetbondhu;

function displayNA(value?: string | number | boolean | null) {
  const text = value == null ? "" : String(value).trim();
  return text || "N/A";
}

function formatPrescriptionDate(value?: string | null) {
  const text = displayNA(value);
  if (text === "N/A") return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : format(date, "MMMM dd, yyyy");
}

export default function PrescriptionDetail() {
  const { prescriptionId } = useParams();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [diseaseDraft, setDiseaseDraft] = useState("");
  const [shortDescriptionDraft, setShortDescriptionDraft] = useState("");

  useEffect(() => {
    if (!prescriptionId) return;
    const fetchData = async () => {
      const [{ data: pData }, { data: mData }] = await Promise.all([
        vetbondhuApi.from("prescriptions").select("*").eq("id", prescriptionId).single(),
        vetbondhuApi.from("prescription_items").select("*").eq("prescription_id", prescriptionId).order("created_at"),
      ]);
      setPrescription(pData as PrescriptionData | null);
      if (pData) {
        const p = pData as PrescriptionData;
        setDiseaseDraft(p.diagnosis || "");
        setShortDescriptionDraft(p.symptoms || "");
      }
      setMedicines((mData as MedicineItem[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [prescriptionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: VB }} />
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>Prescription not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const p = prescription;
  const vetDesignation = p.vet_degree?.trim() || "Veterinary Professional";
  const vetAddress = p.vet_address?.trim();

  const resetSummaryDraft = () => {
    setDiseaseDraft(p.diagnosis || "");
    setShortDescriptionDraft(p.symptoms || "");
    setEditingSummary(false);
  };

  const saveSummaryDraft = async () => {
    if (!p || p.status !== "draft") return;
    setSavingSummary(true);
    const { data, error } = await vetbondhuApi
      .from("prescriptions")
      .update({
        diagnosis: diseaseDraft.trim() || null,
        symptoms: shortDescriptionDraft.trim() || null,
      })
      .eq("id", p.id);
    setSavingSummary(false);
    if (error) {
      toast({ title: "Error", description: error.message || "Failed to update prescription summary.", variant: "destructive" });
      return;
    }
    const updated = data as PrescriptionData | null;
    const nextDiagnosis = updated?.diagnosis ?? (diseaseDraft.trim() || null);
    const nextSymptoms = updated?.symptoms ?? (shortDescriptionDraft.trim() || null);
    setPrescription((prev) =>
      prev
        ? {
            ...prev,
            diagnosis: nextDiagnosis,
            symptoms: nextSymptoms,
          }
        : prev
    );
    setDiseaseDraft(nextDiagnosis || "");
    setShortDescriptionDraft(nextSymptoms || "");
    setEditingSummary(false);
    toast({ title: "Summary updated", description: "Disease and short description were saved." });
  };

  const issueDraft = async () => {
    if (!p || p.status !== "draft") return;
    const token = readSession()?.access_token;
    setIssuing(true);
    try {
      const res = await fetch(`${API_BASE}/v1/vetbondhu/prescriptions/${p.id}/issue`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { data?: PrescriptionData; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to issue prescription");
      setPrescription((prev) => (prev ? { ...prev, status: "issued" } : prev));
      toast({
        title: "Prescription Issued ✅",
        description: "Draft has been issued successfully.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to issue prescription";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Stethoscope className="h-5 w-5" style={{ color: VB }} />
            VetBondhu Prescription
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(p.created_at), "MMMM dd, yyyy 'at' h:mm a")}
          </p>
        </div>
        <Badge className={`capitalize ${statusStyles[p.status] || statusStyles.draft}`}>
          {p.status}
        </Badge>
        {p.status === "draft" ? (
          <Button className="text-white" style={{ backgroundColor: VB }} onClick={() => void issueDraft()} disabled={issuing}>
            {issuing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Issue Prescription
          </Button>
        ) : null}
      </motion.div>

      {/* Prescription Card */}
      <Card className="border-t-4 overflow-hidden" style={{ borderTopColor: VB }}>
        {/* Doctor & Patient */}
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Veterinarian</p>
              <p className="font-display font-bold text-foreground">{p.vet_name}</p>
              <p className="text-sm font-medium" style={{ color: VB }}>{vetDesignation}</p>
              {vetAddress && <p className="text-xs text-muted-foreground mt-0.5">{vetAddress}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Patient / Owner</p>
              <p className="font-display font-bold text-foreground">{p.farmer_name}</p>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Animal Info */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🐄</span> Animal Information
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <InfoCell label="Type" value={p.animal_type} />
              <InfoCell label="Breed" value={p.breed} />
              <InfoCell label="Gender" value={p.animal_gender} />
              <InfoCell label="Age" value={p.animal_age} />
              <InfoCell label="Weight" value={p.animal_weight} />
              <InfoCell label="Farm" value={p.farm_name} />
              <InfoCell label="Shed / Pen" value={p.shed_or_pen} />
              <InfoCell label="Batch ID" value={p.batch_id} />
              <InfoCell label="Animal ID" value={p.animal_id} />
              <InfoCell label="Affected Count" value={p.affected_count?.toString()} />
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Diagnosis */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Heart className="h-4 w-4" style={{ color: VB }} /> Disease Summary
              {p.severity && (
                <Badge className={`text-xs capitalize ml-2 ${severityStyles[p.severity] || ""}`}>
                  {p.severity}
                </Badge>
              )}
              {p.status === "draft" && !editingSummary && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 px-2 text-xs"
                  onClick={() => setEditingSummary(true)}
                  style={{ color: VB }}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              )}
            </h3>
            {editingSummary ? (
              <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: `${VB}33`, backgroundColor: `${VB}0D` }}>
                <div className="space-y-1.5">
                  <Label className="text-xs">Disease / Condition</Label>
                  <Textarea
                    value={diseaseDraft}
                    onChange={(event) => setDiseaseDraft(event.target.value)}
                    placeholder="e.g. FMD, Newcastle disease, digestive disorder..."
                    rows={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Short Description / Symptoms</Label>
                  <Textarea
                    value={shortDescriptionDraft}
                    onChange={(event) => setShortDescriptionDraft(event.target.value)}
                    placeholder="Describe the condition, observed symptoms, and short case summary..."
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={resetSummaryDraft} disabled={savingSummary}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void saveSummaryDraft()}
                    disabled={savingSummary}
                    className="text-white"
                    style={{ backgroundColor: VB }}
                  >
                    {savingSummary ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                    Save Summary
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {p.diagnosis && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Disease / Condition</p>
                    <p className="text-sm rounded-lg p-3 font-medium" style={{ backgroundColor: `${VB}0D` }}>{p.diagnosis}</p>
                  </div>
                )}
                {p.symptoms && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Short Description / Symptoms</p>
                    <p className="text-sm bg-accent/50 rounded-lg p-3">{p.symptoms}</p>
                  </div>
                )}
                {p.clinical_findings && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Clinical Findings</p>
                    <p className="text-sm bg-accent/50 rounded-lg p-3">{p.clinical_findings}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <Separator className="mb-6" />

          {/* Medicines */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Pill className="h-4 w-4" style={{ color: VB }} /> Medicines ({medicines.length})
            </h3>
            {medicines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No medicines prescribed.</p>
            ) : (
              <div className="space-y-3">
                {medicines.map((m, idx) => (
                  <div key={m.id} className="rounded-xl border p-4 bg-accent/20">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{idx + 1}. {m.medicine_name}</p>
                        {m.medicine_type && <Badge variant="outline" className="text-xs capitalize mt-0.5">{m.medicine_type}</Badge>}
                      </div>
                      {m.purpose && <p className="text-xs text-muted-foreground italic">{m.purpose}</p>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs mt-2">
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Dosage</p>
                        <p className="font-semibold">{m.dosage} {m.dosage_unit}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Frequency</p>
                        <p className="font-semibold capitalize">{m.frequency}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Dose Pattern</p>
                        <p className="font-semibold">{m.dose_pattern || "—"}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Timing</p>
                        <p className="font-semibold capitalize">{m.timing || "—"}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Route</p>
                        <p className="font-semibold capitalize">{m.route || "—"}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-semibold">{m.duration_days ? `${m.duration_days} days` : "—"}</p>
                      </div>
                    </div>
                    {m.notes && <p className="text-xs text-muted-foreground mt-2 italic">⚠ {m.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Care Instructions */}
          {(p.feeding_advice || p.isolation_advice || p.hydration_note || p.care_instructions) && (
            <>
              <Separator className="mb-6" />
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" style={{ color: VB }} /> Care Instructions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {p.feeding_advice && <InstructionCard icon="🍽" label="Feeding" text={p.feeding_advice} />}
                  {p.hydration_note && <InstructionCard icon="💧" label="Hydration" text={p.hydration_note} />}
                  {p.isolation_advice && <InstructionCard icon="🔒" label="Isolation" text={p.isolation_advice} />}
                  {p.care_instructions && <InstructionCard icon="📋" label="Vet Advice / General Care" text={p.care_instructions} />}
                </div>
              </div>
            </>
          )}

          {/* Follow-up */}
          {(p.follow_up_required || p.follow_up_date || p.warning_signs || p.follow_up_notes) && (
            <>
              <Separator className="mb-6" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" style={{ color: VB }} /> Follow-up
                </h3>
                <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: `${VB}33`, backgroundColor: `${VB}0D` }}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Follow-up required:</span>
                    <span>{p.follow_up_required ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" style={{ color: VB }} />
                    <span className="font-medium">Next appointment:</span>
                    <span>{formatPrescriptionDate(p.follow_up_date)}</span>
                  </div>
                  <div className="rounded-lg border border-red-600 bg-red-50 p-3 text-sm text-red-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-700" />
                      <div className="min-w-0">
                        <p className="font-semibold">Warning signs</p>
                        <p className="whitespace-pre-wrap">{displayNA(p.warning_signs)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Follow-up notes: </span>
                    <span className="text-muted-foreground whitespace-pre-wrap">{displayNA(p.follow_up_notes)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}

function InstructionCard({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div className="rounded-lg bg-accent/50 p-3">
      <p className="text-xs font-semibold mb-1">{icon} {label}</p>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
