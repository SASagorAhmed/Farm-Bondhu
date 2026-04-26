import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { API_BASE, readSession } from "@/api/client";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";

interface VetApp {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  district: string;
  address: string;
  specialization: string;
  experience_years: number;
  consultation_fee: number;
  profile_image_url?: string;
  verification_document_url?: string;
  verification_status: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  created_at: string;
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string };
  return { res, body };
}

export default function VetApprovals() {
  const [apps, setApps] = useState<VetApp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { res, body } = await apiRequest("/v1/medibondhu/admin/vet-profiles");
    if (!res.ok) {
      toast.error(body.error || "Failed to load vet approvals");
      setLoading(false);
      return;
    }
    setApps((body.data || []) as VetApp[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id: string) => {
    const { res, body } = await apiRequest(`/v1/medibondhu/admin/vet-profiles/${id}/approve`, { method: "POST" });
    if (!res.ok) {
      toast.error(body.error || "Approval failed");
      return;
    }
    toast.success("Vet approved");
    load();
  };

  const reject = async (id: string) => {
    const reason = window.prompt("Enter rejection reason", "Profile details are incomplete");
    if (reason == null) return;
    const { res, body } = await apiRequest(`/v1/medibondhu/admin/vet-profiles/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason: reason }),
    });
    if (!res.ok) {
      toast.error(body.error || "Rejection failed");
      return;
    }
    toast.success("Vet rejected");
    load();
  };

  const pending = apps.filter((a) => a.verification_status === "pending");
  const processed = apps.filter((a) => a.verification_status !== "pending");

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Vet Approvals</h1>
        <p className="text-muted-foreground mt-1">Review and approve veterinarian applications</p>
      </motion.div>

      {loading && <p className="text-sm text-muted-foreground">Loading applications...</p>}

      {pending.length > 0 && (
        <>
          <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2"><Clock className="h-5 w-5" style={{ color: ICON_COLORS.finance }} />Pending Applications ({pending.length})</h2>
          <div className="space-y-4">
            {pending.map((app, i) => (
              <motion.div key={app.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className="shadow-card overflow-hidden">
                  <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.vet}, ${ICON_COLORS.stethoscope})` }} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between flex-wrap gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: `${ICON_COLORS.vet}1A` }}>🩺</div>
                          <div><h3 className="font-display font-bold text-foreground">{app.full_name}</h3><p className="text-sm text-muted-foreground">{app.email}</p></div>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span>{app.experience_years} years experience</span>
                          <span>{app.specialization}</span>
                          <span>Fee: ৳{app.consultation_fee}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Phone: {app.phone || "-"}</p>
                        <p className="text-xs text-muted-foreground">Address: {app.district || "-"} {app.address ? `- ${app.address}` : ""}</p>
                        <div className="flex gap-3">
                          {app.profile_image_url && (
                            <a href={app.profile_image_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                              Profile image
                            </a>
                          )}
                          {app.verification_document_url && (
                            <a href={app.verification_document_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                              Verification document
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Applied: {new Date(app.created_at).toISOString().split("T")[0]}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="bg-secondary text-secondary-foreground" onClick={() => approve(app.user_id || app.id)}><CheckCircle className="h-4 w-4 mr-1" />Approve</Button>
                        <Button size="sm" variant="destructive" onClick={() => reject(app.user_id || app.id)}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {processed.length > 0 && (
        <>
          <h2 className="font-display font-bold text-lg text-foreground">Processed Applications</h2>
          <div className="space-y-3">
            {processed.map(app => (
              <Card key={app.id} className="shadow-card">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-accent/50 flex items-center justify-center text-lg">🩺</div>
                    <div>
                      <p className="font-medium text-foreground">{app.full_name}</p>
                      <p className="text-xs text-muted-foreground">{app.specialization} • {new Date(app.created_at).toISOString().split("T")[0]}</p>
                      {app.verification_status === "rejected" && app.rejection_reason && (
                        <p className="text-xs text-destructive">{app.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                  <Badge className={app.verification_status === "approved" ? "bg-secondary/15 text-secondary" : "bg-destructive/15 text-destructive"}>{app.verification_status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {!loading && apps.length === 0 && <p className="text-center text-muted-foreground py-12">No vet applications yet</p>}
    </div>
  );
}
