import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { API_BASE, api, readSession } from "@/api/client";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, Stethoscope, Pill, Heart, CalendarCheck,
  FileText, Loader2, Clock, AlertTriangle, Send,
} from "lucide-react";

interface PrescriptionData {
  id: string;
  consultation_id: string | null;
  vet_name: string;
  farmer_name: string;
  animal_type: string;
  breed: string | null;
  animal_gender: string | null;
  animal_age: string | null;
  animal_weight: string | null;
  farm_name: string | null;
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
  completed: "bg-primary/10 text-primary",
};

const severityStyles: Record<string, string> = {
  mild: "bg-green-100 text-green-700",
  moderate: "bg-yellow-100 text-yellow-700",
  severe: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function PrescriptionDetail() {
  const { prescriptionId } = useParams();
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (!prescriptionId) return;
    const fetchData = async () => {
      const [{ data: pData }, { data: mData }] = await Promise.all([
        api.from("prescriptions").select("*").eq("id", prescriptionId).single(),
        api.from("prescription_items").select("*").eq("prescription_id", prescriptionId).order("created_at"),
      ]);
      setPrescription(pData as PrescriptionData | null);
      setMedicines((mData as MedicineItem[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [prescriptionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  const issueDraft = async () => {
    if (!p || p.status !== "draft") return;
    const token = readSession()?.access_token;
    setIssuing(true);
    try {
      const res = await fetch(`${API_BASE}/v1/medibondhu/prescriptions/${p.id}/issue`, {
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
            <Stethoscope className="h-5 w-5 text-primary" />
            Prescription
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(p.created_at), "MMMM dd, yyyy 'at' h:mm a")}
          </p>
        </div>
        <Badge className={`capitalize ${statusStyles[p.status] || statusStyles.draft}`}>
          {p.status}
        </Badge>
        {p.status === "draft" ? (
          <Button onClick={() => void issueDraft()} disabled={issuing}>
            {issuing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Issue Prescription
          </Button>
        ) : null}
      </motion.div>

      {/* Prescription Card */}
      <Card className="border-t-4 border-t-primary overflow-hidden">
        {/* Doctor & Patient */}
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Veterinarian</p>
              <p className="font-display font-bold text-foreground">{p.vet_name}</p>
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
              <InfoCell label="Batch ID" value={p.batch_id} />
              <InfoCell label="Affected Count" value={p.affected_count?.toString()} />
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Diagnosis */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" /> Diagnosis
              {p.severity && (
                <Badge className={`text-xs capitalize ml-2 ${severityStyles[p.severity] || ""}`}>
                  {p.severity}
                </Badge>
              )}
            </h3>
            {p.symptoms && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-0.5">Symptoms</p>
                <p className="text-sm bg-accent/50 rounded-lg p-3">{p.symptoms}</p>
              </div>
            )}
            {p.clinical_findings && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-0.5">Clinical Findings</p>
                <p className="text-sm bg-accent/50 rounded-lg p-3">{p.clinical_findings}</p>
              </div>
            )}
            {p.diagnosis && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Diagnosis</p>
                <p className="text-sm bg-primary/5 rounded-lg p-3 font-medium">{p.diagnosis}</p>
              </div>
            )}
          </div>

          <Separator className="mb-6" />

          {/* Medicines */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Pill className="h-4 w-4 text-blue-500" /> Medicines ({medicines.length})
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mt-2">
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Dosage</p>
                        <p className="font-semibold">{m.dosage} {m.dosage_unit}</p>
                      </div>
                      <div className="bg-background rounded-lg p-2 text-center">
                        <p className="text-muted-foreground">Frequency</p>
                        <p className="font-semibold capitalize">{m.frequency}</p>
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
                  <FileText className="h-4 w-4 text-orange-500" /> Care Instructions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {p.feeding_advice && <InstructionCard icon="🍽" label="Feeding" text={p.feeding_advice} />}
                  {p.hydration_note && <InstructionCard icon="💧" label="Hydration" text={p.hydration_note} />}
                  {p.isolation_advice && <InstructionCard icon="🔒" label="Isolation" text={p.isolation_advice} />}
                  {p.care_instructions && <InstructionCard icon="📋" label="General Care" text={p.care_instructions} />}
                </div>
              </div>
            </>
          )}

          {/* Follow-up */}
          {p.follow_up_required && (
            <>
              <Separator className="mb-6" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" /> Follow-up
                </h3>
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
                  {p.follow_up_date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="font-medium">Next appointment:</span>
                      <span>{format(new Date(p.follow_up_date), "MMMM dd, yyyy")}</span>
                    </div>
                  )}
                  {p.warning_signs && (
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">Warning signs: </span>
                        <span className="text-muted-foreground">{p.warning_signs}</span>
                      </div>
                    </div>
                  )}
                  {p.follow_up_notes && (
                    <p className="text-sm text-muted-foreground italic">{p.follow_up_notes}</p>
                  )}
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
