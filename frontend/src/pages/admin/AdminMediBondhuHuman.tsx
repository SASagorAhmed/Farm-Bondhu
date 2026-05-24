import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, readSession } from "@/api/client";

const MB = "#12C2D6";

type DoctorWithdrawalRow = {
  id: string;
  doctor_user_id: string;
  request_amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  note?: string | null;
  review_note?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  doctor_name?: string | null;
  doctor_email?: string | null;
};

type DoctorWithdrawalDetails = {
  request: DoctorWithdrawalRow & { doctor_phone?: string | null; doctor_location?: string | null };
  summary?: {
    gross_earnings?: number;
    platform_fee?: number;
    net_earnings?: number;
    available_balance?: number;
  };
  consultations?: { id: string; patient_name?: string; fee?: number; created_at?: string; completed_at?: string }[];
  doctor_profile?: {
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    location?: string | null;
    qualification?: string | null;
    medical_reg_number?: string | null;
    registration_body?: string | null;
    consultation_fee?: number | null;
  } | null;
  request_history?: DoctorWithdrawalRow[];
};

export default function AdminMediBondhuHuman() {
  const qc = useQueryClient();
  const [hName, setHName] = useState("");
  const [hAddr, setHAddr] = useState("");
  const [spName, setSpName] = useState("");
  const [withdrawStatusFilter, setWithdrawStatusFilter] = useState<"all" | "pending" | "approved" | "rejected" | "paid">("all");
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);
  const [withdrawDetails, setWithdrawDetails] = useState<DoctorWithdrawalDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const hospitals = useQuery({
    queryKey: ["admin", "medibondhu-human", "hospitals"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: unknown[] }>("/admin/hospitals");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const specialties = useQuery({
    queryKey: ["admin", "medibondhu-human", "specialties"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: { id: string; name: string; slug: string; is_active: boolean }[] }>(
        "/admin/specialties",
      );
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const doctors = useQuery({
    queryKey: ["admin", "medibondhu-human", "doctors"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: unknown[] }>("/admin/doctors");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const appointments = useQuery({
    queryKey: ["admin", "medibondhu-human", "appointments"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: unknown[] }>("/admin/appointments?limit=80");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const doctorWithdrawals = useQuery({
    queryKey: ["admin", "medibondhu-human", "doctor-withdrawals", withdrawStatusFilter],
    queryFn: async () => {
      const suffix = withdrawStatusFilter === "all" ? "" : `?status=${encodeURIComponent(withdrawStatusFilter)}`;
      const { res, body } = await mediHumanJson<{ data?: DoctorWithdrawalRow[] }>(`/admin/doctor-withdrawals${suffix}`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const fetchWithdrawDetails = useCallback(async (id: string) => {
    const { res, body } = await mediHumanJson<{ data?: DoctorWithdrawalDetails }>(`/admin/doctor-withdrawals/${id}/details`);
    if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    setSelectedWithdrawalId(id);
    setWithdrawDetails(body.data || null);
  }, []);

  const reviewWithdrawal = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" }) => {
      const note = reviewNotes[id]?.trim() || undefined;
      const { res, body } = await mediHumanJson(`/admin/doctor-withdrawals/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Doctor withdrawal updated");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "doctor-withdrawals"] });
      if (selectedWithdrawalId) {
        await fetchWithdrawDetails(selectedWithdrawalId);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const token = readSession()?.access_token;
    if (!token) return;
    const channel = api
      .channel("admin-medibondhu-human-withdrawals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "medibondhu_doctor_withdrawals" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "doctor-withdrawals"] });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [qc]);

  const mkHosp = useMutation({
    mutationFn: async () => {
      const { res, body } = await mediHumanJson(`/admin/hospitals`, {
        method: "POST",
        body: JSON.stringify({ name: hName, address: hAddr }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Hospital added");
      setHName("");
      setHAddr("");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "hospitals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mkSpec = useMutation({
    mutationFn: async () => {
      const { res, body } = await mediHumanJson(`/admin/specialties`, {
        method: "POST",
        body: JSON.stringify({ name: spName }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Specialty saved");
      setSpName("");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "specialties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { res, body } = await mediHumanJson(`/admin/doctors/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Doctor approved");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "doctors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { res, body } = await mediHumanJson(`/admin/doctors/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejection_reason: "Admin review" }),
      });
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
    },
    onSuccess: async () => {
      toast.success("Doctor rejected");
      await qc.invalidateQueries({ queryKey: ["admin", "medibondhu-human", "doctors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold" style={{ color: MB }}>
          MediBondhu — Human module
        </h1>
        <p className="text-sm text-muted-foreground">Data lives in `medibondhu_*` tables only (isolated from VetBondhu).</p>
      </div>

      <Tabs defaultValue="core" className="space-y-4">
        <TabsList>
          <TabsTrigger value="core">Core management</TabsTrigger>
          <TabsTrigger value="withdrawals">Doctor withdrawals ({doctorWithdrawals.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="core" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold">Add hospital</h2>
                <div>
                  <Label>Name</Label>
                  <Input value={hName} onChange={(e) => setHName(e.target.value)} />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={hAddr} onChange={(e) => setHAddr(e.target.value)} />
                </div>
                <Button style={{ backgroundColor: MB, color: "white" }} disabled={mkHosp.isPending} onClick={() => mkHosp.mutate()}>
                  Save
                </Button>
                <ul className="text-sm text-muted-foreground space-y-1 max-h-40 overflow-auto">
                  {(hospitals.data as { name?: string }[])?.map((h, i) => (
                    <li key={i}>• {h.name}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <div className="h-1" style={{ backgroundColor: MB }} />
              <CardContent className="p-4 space-y-3">
                <h2 className="font-semibold">Add / update specialty</h2>
                <div>
                  <Label>Name</Label>
                  <Input value={spName} onChange={(e) => setSpName(e.target.value)} placeholder="e.g. Nephrology" />
                </div>
                <Button style={{ backgroundColor: MB, color: "white" }} disabled={mkSpec.isPending} onClick={() => mkSpec.mutate()}>
                  Upsert specialty
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <div className="h-1" style={{ backgroundColor: MB }} />
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold">Doctors ({doctors.data?.length ?? 0})</h2>
              <div className="divide-y rounded-md border max-h-96 overflow-auto">
                {(doctors.data as {
                  id: string;
                  full_name?: string;
                  approval_status?: string;
                  medical_reg_number?: string;
                  registration_body?: string;
                  account_email?: string;
                  verification_documents?: unknown;
                }[])?.map((d) => {
                  const docs = Array.isArray(d.verification_documents)
                    ? (d.verification_documents as { type?: string; url?: string; uploaded_at?: string }[])
                    : [];
                  return (
                    <div key={d.id} className="flex flex-col gap-2 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium">{d.full_name}</p>
                          {d.account_email ? (
                            <p className="text-xs text-muted-foreground truncate">Account: {d.account_email}</p>
                          ) : null}
                          {d.medical_reg_number ? (
                            <p className="text-xs">
                              Registration: <span className="font-mono">{d.medical_reg_number}</span>
                              {d.registration_body ? <span className="text-muted-foreground"> ({d.registration_body})</span> : null}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Registration number not provided</p>
                          )}
                          <Badge variant="outline" className="capitalize">{d.approval_status}</Badge>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(d.id)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate(d.id)}>
                            Reject
                          </Button>
                        </div>
                      </div>
                      {docs.length > 0 ? (
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {docs.map((doc, idx) =>
                            doc?.url ? (
                              <li key={`${doc.type}-${idx}`}>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium underline"
                                  style={{ color: MB }}
                                >
                                  {doc.type?.replace(/_/g, " ") || `Document ${idx + 1}`}
                                </a>
                              </li>
                            ) : null,
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">No verification uploads on file.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <div className="h-1" style={{ backgroundColor: MB }} />
            <CardContent className="p-4 space-y-3">
              <h2 className="font-semibold">Recent human appointments ({appointments.data?.length ?? 0})</h2>
              <div className="divide-y rounded-md border max-h-80 overflow-auto text-sm">
                {(appointments.data as { id: string; status?: string; doctor_name?: string; patient_email?: string }[])?.map((a) => (
                  <div key={a.id} className="p-3 flex justify-between gap-3">
                    <span className="text-muted-foreground font-mono text-xs">{a.id.slice(0, 8)}…</span>
                    <span>{a.doctor_name}</span>
                    <span className="truncate">{a.patient_email}</span>
                    <Badge>{a.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Label>Status</Label>
                <select
                  value={withdrawStatusFilter}
                  onChange={(e) => setWithdrawStatusFilter(e.target.value as typeof withdrawStatusFilter)}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="divide-y rounded-md border max-h-96 overflow-auto">
                {(doctorWithdrawals.data || []).map((w) => (
                  <div key={w.id} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <p className="font-medium">{w.doctor_name || w.doctor_email || w.doctor_user_id}</p>
                        <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="capitalize">{w.status}</Badge>
                        <span className="font-semibold">৳{Number(w.request_amount || 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <Textarea
                      value={reviewNotes[w.id] || ""}
                      onChange={(e) => setReviewNotes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                      placeholder="Admin note / reason"
                      className="min-h-[44px]"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => void fetchWithdrawDetails(w.id)}>Details</Button>
                      {w.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => reviewWithdrawal.mutate({ id: w.id, action: "approve" })} disabled={reviewWithdrawal.isPending}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => reviewWithdrawal.mutate({ id: w.id, action: "reject" })} disabled={reviewWithdrawal.isPending}>
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {!doctorWithdrawals.data?.length && (
                  <p className="text-sm text-muted-foreground p-6 text-center">No doctor withdrawal requests found.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedWithdrawalId && withdrawDetails && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold">Selected withdrawal details</h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <p><span className="text-muted-foreground">Doctor:</span> {withdrawDetails.doctor_profile?.full_name || withdrawDetails.request.doctor_name || "-"}</p>
                  <p><span className="text-muted-foreground">Email:</span> {withdrawDetails.doctor_profile?.email || withdrawDetails.request.doctor_email || "-"}</p>
                  <p><span className="text-muted-foreground">Requested:</span> ৳{Number(withdrawDetails.request.request_amount || 0).toFixed(2)}</p>
                  <p><span className="text-muted-foreground">Status:</span> {withdrawDetails.request.status}</p>
                  <p><span className="text-muted-foreground">Gross:</span> ৳{Number(withdrawDetails.summary?.gross_earnings || 0).toFixed(2)}</p>
                  <p><span className="text-muted-foreground">Net:</span> ৳{Number(withdrawDetails.summary?.net_earnings || 0).toFixed(2)}</p>
                  <p><span className="text-muted-foreground">Available:</span> ৳{Number(withdrawDetails.summary?.available_balance || 0).toFixed(2)}</p>
                  <p><span className="text-muted-foreground">Request note:</span> {withdrawDetails.request.note || "-"}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
