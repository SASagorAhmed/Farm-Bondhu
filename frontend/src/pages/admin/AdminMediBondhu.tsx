import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_BASE, api, readSession } from "@/api/client";
import { Stethoscope, CalendarCheck, Users, Loader2, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";

type VetRow = {
  id: string;
  name?: string;
  email?: string | null;
  specialization?: string;
  location?: string;
  experience?: number;
  fee?: number;
  rating?: number;
  available?: boolean;
  is_online?: boolean;
  status_label?: string;
  last_seen_at?: string | null;
};

type BookingRow = {
  id: string;
  patient_name?: string;
  vet_name?: string;
  booking_type?: string;
  consultation_method?: string;
  fee?: number;
  status?: string;
  created_at: string;
};

type WithdrawalRow = {
  id: string;
  vet_name?: string;
  vet_email?: string;
  request_amount?: number;
  status?: "pending" | "approved" | "rejected" | "paid" | string;
  created_at: string;
  note?: string | null;
  review_note?: string | null;
};

type WithdrawalConsultationRow = {
  id: string;
  patient_name?: string;
  animal_type?: string | null;
  completed_at?: string | null;
  created_at: string;
  fee?: number;
};

type WithdrawalDetails = {
  summary?: {
    gross_earnings?: number;
    platform_fee?: number;
    net_earnings?: number;
    available_balance?: number;
  };
  vet_profile?: Record<string, unknown> & {
    full_name?: string;
    email?: string;
    phone?: string;
    specialization?: string;
    district?: string;
    verification_status?: string;
  };
  request?: {
    request_amount?: number;
    status?: string;
    note?: string | null;
    review_note?: string | null;
    created_at?: string;
    vet_name?: string;
    vet_email?: string;
    vet_phone?: string;
  };
  consultations?: WithdrawalConsultationRow[];
};

type VetBondhuOverview = {
  total_vets: number;
  available_now: number;
  total_bookings: number;
  active_sessions: number;
  pending_withdrawals: number;
  all_vets: VetRow[];
  online_vets: VetRow[];
  recent_bookings: BookingRow[];
};

const VB = ICON_COLORS.vetbondhu;
const OVERVIEW_QUERY_KEY = ["admin-vetbondhu-overview", "lists-v2"] as const;

export default function AdminVetBondhuOverview() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);
  const [withdrawDetails, setWithdrawDetails] = useState<WithdrawalDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("vets");
  const detailsFetchingRef = useRef(false);
  const queryClient = useQueryClient();

  const fetchWithdrawals = useCallback(async (options?: { silent?: boolean }) => {
    const token = readSession()?.access_token;
    try {
      const res = await fetch(`${API_BASE}/v1/vetbondhu/admin/vet-withdrawals`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { data?: WithdrawalRow[]; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load withdrawals");
      return Array.isArray(body.data) ? body.data : [];
    } catch (error) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : "Failed to load withdrawals";
        toast.error(message);
      }
      return [];
    }
  }, []);

  const fetchWithdrawalDetails = useCallback(async (id: string, options?: { silent?: boolean }) => {
    if (detailsFetchingRef.current) return;
    detailsFetchingRef.current = true;
    const token = readSession()?.access_token;
    setDetailsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/vetbondhu/admin/vet-withdrawals/${id}/details`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { data?: WithdrawalDetails; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load withdrawal details");
      setWithdrawDetails(body.data || null);
      setSelectedWithdrawalId(id);
    } catch (error) {
      if (!options?.silent) {
        const message = error instanceof Error ? error.message : "Failed to load withdrawal details";
        toast.error(message);
      }
      setWithdrawDetails(null);
      setSelectedWithdrawalId(null);
    } finally {
      setDetailsLoading(false);
      detailsFetchingRef.current = false;
    }
  }, []);

  const { data: cachedWithdrawals = [], isLoading: withdrawalsLoading } = useQuery({
    queryKey: ["admin-vetbondhu-withdrawals"],
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => fetchWithdrawals(),
  });

  useEffect(() => {
    setWithdrawals(cachedWithdrawals);
  }, [cachedWithdrawals]);

  useEffect(() => {
    const channels = [
      { key: "admin-vetbondhu-vets-live", table: "vets", queryKey: ["admin-vetbondhu-vets"] as const },
      { key: "admin-vetbondhu-bookings-live", table: "consultation_bookings", queryKey: ["admin-vetbondhu-bookings"] as const },
      { key: "admin-vetbondhu-withdrawals-live", table: "vet_withdrawals", queryKey: ["admin-vetbondhu-withdrawals"] as const },
    ].map((entry) =>
      api
        .channel(entry.key)
        .on("postgres_changes", { event: "*", schema: "public", table: entry.table }, () => {
          queryClient.invalidateQueries({ queryKey: entry.queryKey });
          queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
          if (selectedWithdrawalId) {
            void fetchWithdrawalDetails(selectedWithdrawalId, { silent: true });
          }
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [fetchWithdrawalDetails, queryClient, selectedWithdrawalId]);
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: OVERVIEW_QUERY_KEY,
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const token = readSession()?.access_token;
      const res = await fetch(`${API_BASE}/v1/vetbondhu/admin/overview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = (await res.json().catch(() => ({}))) as { data?: VetBondhuOverview; error?: string };
      if (!res.ok) throw new Error(body.error || "Failed to load VetBondhu overview");
      return body.data || {
        total_vets: 0,
        available_now: 0,
        total_bookings: 0,
        active_sessions: 0,
        pending_withdrawals: 0,
        all_vets: [],
        online_vets: [],
        recent_bookings: [],
      };
    },
  });

  const loading = withdrawalsLoading || overviewLoading;

  const vets = overview?.all_vets || [];
  const bookings = overview?.recent_bookings || [];
  const totalVets = overview?.total_vets ?? vets.length;
  const availableVets = overview?.available_now ?? 0;
  const totalBookings = overview?.total_bookings ?? bookings.length;
  const activeBookings = overview?.active_sessions ?? bookings.filter(b => ["pending", "confirmed", "in_progress"].includes(b.status || "")).length;
  const pendingWithdrawals = overview?.pending_withdrawals ?? withdrawals.filter((w) => w.status === "pending").length;
  const onlineVets = overview?.online_vets || [];

  const handleReview = async (id: string, action: "approve" | "reject") => {
    const token = readSession()?.access_token;
    setActingId(id);
    try {
      const res = await fetch(`${API_BASE}/v1/vetbondhu/admin/vet-withdrawals/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ note: (reviewNote[id] || "").trim() || null }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || `Failed to ${action} request`);
      toast.success(`Withdrawal ${action}d`);
      queryClient.invalidateQueries({ queryKey: ["admin-vetbondhu-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
      if (selectedWithdrawalId === id) {
        await fetchWithdrawalDetails(id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${action} request`;
      toast.error(message);
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${VB}, #047857)` }}>
          <Stethoscope className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">VetBondhu Overview</h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${VB}1A`, color: VB }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin View
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">Platform-wide VetBondhu veterinary services monitoring</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Vets", value: totalVets, icon: Users, color: VB },
          { label: "Available Now", value: availableVets, icon: Stethoscope, color: VB, clickable: true },
          { label: "Total Bookings", value: totalBookings, icon: CalendarCheck, color: ICON_COLORS.dashboard },
          { label: "Active Sessions", value: activeBookings, icon: CalendarCheck, color: ICON_COLORS.health },
          { label: "Pending Withdrawals", value: pendingWithdrawals, icon: Shield, color: ICON_COLORS.admin },
        ].map(s => (
          <Card
            key={s.label}
            className={`shadow-card overflow-hidden ${s.clickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            onClick={() => {
              if (s.clickable) setActiveTab("available");
            }}
          >
            <div className="h-1" style={{ background: `linear-gradient(to right, ${VB}, #047857)` }} />
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="vets">All Vets ({totalVets})</TabsTrigger>
          <TabsTrigger value="available">Available Now ({availableVets})</TabsTrigger>
          <TabsTrigger value="bookings">Recent Bookings ({totalBookings})</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals ({withdrawals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="vets">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${VB}, #047857)` }} />
            <CardHeader><CardTitle className="text-lg">Registered Veterinarians</CardTitle></CardHeader>
            <CardContent>
              {vets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No vets registered yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Experience</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vets.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name}</TableCell>
                        <TableCell>{v.specialization}</TableCell>
                        <TableCell>{v.location}</TableCell>
                        <TableCell>{v.experience} yrs</TableCell>
                        <TableCell>৳{v.fee}</TableCell>
                        <TableCell>{v.rating}</TableCell>
                        <TableCell>
                          <Badge variant={v.available ? "default" : "secondary"}>
                            {v.available ? "Available" : "Offline"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="available">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${VB}, #047857)` }} />
            <CardHeader><CardTitle className="text-lg">Active Online Vets</CardTitle></CardHeader>
            <CardContent>
              {onlineVets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No vets are online right now</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Last Seen</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {onlineVets.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.name || "Vet Doctor"}</TableCell>
                        <TableCell>{v.email || "-"}</TableCell>
                        <TableCell>{v.specialization || "-"}</TableCell>
                        <TableCell>{v.location || "-"}</TableCell>
                        <TableCell>৳{Number(v.fee || 0)}</TableCell>
                        <TableCell className="text-sm">{v.last_seen_at ? new Date(v.last_seen_at).toLocaleString() : "-"}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-700">Online</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${VB}, #047857)` }} />
            <CardHeader><CardTitle className="text-lg">Recent Consultation Bookings</CardTitle></CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bookings yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Vet</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.patient_name}</TableCell>
                        <TableCell>{b.vet_name}</TableCell>
                        <TableCell className="capitalize">{b.booking_type}</TableCell>
                        <TableCell className="capitalize">{b.consultation_method}</TableCell>
                        <TableCell>৳{b.fee}</TableCell>
                        <TableCell>
                          <Badge variant={b.status === "completed" ? "default" : b.status === "pending" ? "secondary" : "outline"}>
                            {b.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${VB}, #047857)` }} />
            <CardHeader><CardTitle className="text-lg">Vet Withdrawal Requests</CardTitle></CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No withdrawal requests yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vet</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested On</TableHead>
                      <TableHead>Vet Note</TableHead>
                      <TableHead>Admin Reason</TableHead>
                      <TableHead>Review Note</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>
                          <div className="font-medium">{w.vet_name || "Vet"}</div>
                          <div className="text-xs text-muted-foreground">{w.vet_email || "-"}</div>
                        </TableCell>
                        <TableCell className="font-medium">৳{Number(w.request_amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={w.status === "pending" ? "secondary" : w.status === "approved" ? "default" : "outline"}>
                            {w.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(w.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-[220px] text-xs text-muted-foreground">{w.note || "-"}</TableCell>
                        <TableCell className="max-w-[220px] text-xs text-muted-foreground">{w.review_note || "-"}</TableCell>
                        <TableCell>
                          <input
                            id={`withdraw-review-note-${w.id}`}
                            name={`withdrawReviewNote-${w.id}`}
                            className="w-full rounded border px-2 py-1 text-sm bg-background"
                            value={reviewNote[w.id] || ""}
                            onChange={(e) => setReviewNote((prev) => ({ ...prev, [w.id]: e.target.value }))}
                            placeholder="Optional note"
                            disabled={w.status !== "pending" || actingId === w.id}
                          />
                        </TableCell>
                        <TableCell>
                          {w.status === "pending" ? (
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => void fetchWithdrawalDetails(w.id)} disabled={detailsLoading}>
                                Details
                              </Button>
                              <Button size="sm" onClick={() => void handleReview(w.id, "approve")} disabled={actingId === w.id}>Approve</Button>
                              <Button size="sm" variant="destructive" onClick={() => void handleReview(w.id, "reject")} disabled={actingId === w.id}>Reject</Button>
                            </div>
                          ) : (
                            <div className="flex gap-2 flex-wrap items-center">
                              <Button size="sm" variant="outline" onClick={() => void fetchWithdrawalDetails(w.id)} disabled={detailsLoading}>
                                Details
                              </Button>
                              <span className="text-xs text-muted-foreground">Reviewed</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {selectedWithdrawalId && (
                <div className="mt-6 rounded-lg border p-4 bg-muted/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base">Withdrawal Details</h3>
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedWithdrawalId(null); setWithdrawDetails(null); }}>
                      Close
                    </Button>
                  </div>
                  {detailsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading details...</p>
                  ) : !withdrawDetails ? (
                    <p className="text-sm text-muted-foreground">No details available.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-4 gap-3">
                        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Gross</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.gross_earnings || 0).toFixed(2)}</p></CardContent></Card>
                        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Platform Fee (15%)</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.platform_fee || 0).toFixed(2)}</p></CardContent></Card>
                        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Net</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.net_earnings || 0).toFixed(2)}</p></CardContent></Card>
                        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Available</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.available_balance || 0).toFixed(2)}</p></CardContent></Card>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Vet Profile</CardTitle></CardHeader>
                          <CardContent className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Name:</span> {withdrawDetails.vet_profile?.full_name || withdrawDetails.request?.vet_name || "-"}</p>
                            <p><span className="text-muted-foreground">Email:</span> {withdrawDetails.vet_profile?.email || withdrawDetails.request?.vet_email || "-"}</p>
                            <p><span className="text-muted-foreground">Phone:</span> {withdrawDetails.vet_profile?.phone || withdrawDetails.request?.vet_phone || "-"}</p>
                            <p><span className="text-muted-foreground">Specialization:</span> {withdrawDetails.vet_profile?.specialization || "-"}</p>
                            <p><span className="text-muted-foreground">District:</span> {withdrawDetails.vet_profile?.district || "-"}</p>
                            <p><span className="text-muted-foreground">Verification:</span> {withdrawDetails.vet_profile?.verification_status || "-"}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-sm">Request Context</CardTitle></CardHeader>
                          <CardContent className="text-sm space-y-1">
                            <p><span className="text-muted-foreground">Requested:</span> ৳{Number(withdrawDetails.request?.request_amount || 0).toFixed(2)}</p>
                            <p><span className="text-muted-foreground">Status:</span> {withdrawDetails.request?.status || "-"}</p>
                            <p><span className="text-muted-foreground">Vet Note:</span> {withdrawDetails.request?.note || "-"}</p>
                            <p><span className="text-muted-foreground">Admin Reason:</span> {withdrawDetails.request?.review_note || "-"}</p>
                            <p><span className="text-muted-foreground">Created:</span> {withdrawDetails.request?.created_at ? new Date(withdrawDetails.request.created_at).toLocaleString() : "-"}</p>
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Completed Consultations</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                          {(withdrawDetails.consultations || []).slice(0, 10).map((c) => (
                            <div key={c.id} className="flex items-center justify-between text-sm border rounded p-2">
                              <div>
                                <p className="font-medium">{c.patient_name || "Patient"}</p>
                                <p className="text-muted-foreground">{c.animal_type || "-"} • {new Date(c.completed_at || c.created_at).toLocaleDateString()}</p>
                              </div>
                              <p className="font-semibold">৳{Number(c.fee || 0).toFixed(2)}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
