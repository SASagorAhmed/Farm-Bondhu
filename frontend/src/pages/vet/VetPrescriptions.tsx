import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { API_BASE, api, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Plus, Eye, Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { getAnimalTypeLabel } from "@/lib/animalTypes";
import { toast } from "@/hooks/use-toast";

interface Prescription {
  id: string;
  consultation_id: string | null;
  farmer_name: string;
  animal_type: string;
  diagnosis: string | null;
  severity: string | null;
  status: string;
  follow_up_required: boolean;
  follow_up_date: string | null;
  created_at: string;
}

const statusStyles: Record<string, { label: string; class: string }> = {
  draft: { label: "Draft", class: "bg-muted text-muted-foreground" },
  issued: { label: "Issued", class: "bg-green-100 text-green-700" },
  updated: { label: "Updated", class: "bg-blue-100 text-blue-700" },
  canceled: { label: "Canceled", class: "bg-red-100 text-red-700" },
  completed: { label: "Completed", class: "bg-primary/10 text-primary" },
};

function formatDateTimeSafe(value: string | null | undefined, fallback = "Unknown time") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : format(date, "MMM dd, yyyy h:mm a");
}

function formatDateSafe(value: string | null | undefined, fallback = "Unknown date") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : format(date, "MMM dd");
}

export default function VetPrescriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .from("prescriptions")
      .select("*")
      .eq("vet_user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPrescriptions((data as Prescription[]) || []);
        setLoading(false);
      });
  }, [user]);

  const issueDraft = async (prescriptionId: string) => {
    const token = readSession()?.access_token;
    setIssuingId(prescriptionId);
    try {
      const res = await fetch(`${API_BASE}/v1/medibondhu/prescriptions/${prescriptionId}/issue`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { data?: Prescription; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to issue prescription");
      setPrescriptions((prev) =>
        prev.map((item) => (item.id === prescriptionId ? { ...item, status: "issued" } : item))
      );
      toast({
        title: "Prescription Issued ✅",
        description: "Draft has been issued successfully.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to issue prescription";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIssuingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Prescriptions</h1>
          <p className="text-muted-foreground mt-1">View and manage all prescriptions you've issued.</p>
        </div>
        <Button onClick={() => navigate("/vet/prescriptions/create")}>
          <Plus className="h-4 w-4 mr-1" /> New Prescription
        </Button>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            All Prescriptions ({prescriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground mb-4">No prescriptions created yet.</p>
              <Button variant="outline" onClick={() => navigate("/vet/prescriptions/create")}>
                <Plus className="h-4 w-4 mr-1" /> Create First Prescription
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {prescriptions.map(p => {
                const st = statusStyles[p.status] || statusStyles.draft;
                return (
                  <div key={p.id} className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/vet/prescriptions/${p.id}`)}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{p.farmer_name}</p>
                          <Badge className={`text-xs capitalize ${st.class}`}>{st.label}</Badge>
                          {p.severity && (
                            <Badge variant="outline" className="text-xs capitalize">{p.severity}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground capitalize">
                          {getAnimalTypeLabel(p.animal_type) || p.animal_type}
                          {p.diagnosis && ` — ${p.diagnosis.substring(0, 60)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTimeSafe(p.created_at)}
                          {p.follow_up_required && p.follow_up_date && ` • Follow-up: ${formatDateSafe(p.follow_up_date)}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {p.status === "draft" ? (
                        <Button
                          size="sm"
                          className="shrink-0"
                          disabled={issuingId === p.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void issueDraft(p.id);
                          }}
                        >
                          {issuingId === p.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4 mr-1" />
                          )}
                          Issue
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
