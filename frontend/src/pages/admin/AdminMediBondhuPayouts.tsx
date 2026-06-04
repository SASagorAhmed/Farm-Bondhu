import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, CalendarCheck, Loader2, Shield, Stethoscope, Users } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, readSession } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mediHumanJson } from "@/lib/medibondhuHuman";
import { ICON_COLORS } from "@/lib/iconColors";

const MB = ICON_COLORS.medibondhu;

type DoctorWithdrawalRow = {
  id: string;
  doctor_user_id: string;
  request_amount: number;
  status: "pending" | "approved" | "rejected" | "paid" | string;
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

type MediDoctorRow = {
  id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  specialty_name?: string | null;
  location?: string | null;
  experience_years?: number | null;
  fee?: number | null;
  rating?: number | null;
  rating_count?: number | null;
  approval_status?: string | null;
  available?: boolean;
  status_label?: string | null;
};

type MediBookingRow = {
  id: string;
  patient_name?: string | null;
  doctor_name?: string | null;
  consultation_type?: string | null;
  fee?: number | null;
  status?: string | null;
  created_at: string;
};

type MediPayoutOverview = {
  total_doctors: number;
  available_doctors: number;
  total_bookings: number;
  active_sessions: number;
  pending_withdrawals: number;
  all_doctors: MediDoctorRow[];
  available_doctors_list: MediDoctorRow[];
  recent_bookings: MediBookingRow[];
};

function statusBadgeClass(status: string) {
  if (status === "pending") return "bg-cyan-100 text-cyan-700";
  if (status === "approved" || status === "paid") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-muted text-muted-foreground";
}

export default function AdminMediBondhuPayouts() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("doctors");
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);
  const [withdrawDetails, setWithdrawDetails] = useState<DoctorWithdrawalDetails | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);

  const withdrawalsQuery = useQuery({
    queryKey: ["admin", "medibondhu-payouts", "doctor-withdrawals"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: DoctorWithdrawalRow[] }>("/admin/doctor-withdrawals");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || [];
    },
  });

  const overviewQuery = useQuery({
    queryKey: ["admin", "medibondhu-payouts", "overview", "v1"],
    queryFn: async () => {
      const { res, body } = await mediHumanJson<{ data?: MediPayoutOverview }>("/admin/payout-overview");
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      return body.data || {
        total_doctors: 0,
        available_doctors: 0,
        total_bookings: 0,
        active_sessions: 0,
        pending_withdrawals: 0,
        all_doctors: [],
        available_doctors_list: [],
        recent_bookings: [],
      };
    },
  });

  const fetchWithdrawDetails = useCallback(async (id: string) => {
    setDetailsLoading(true);
    try {
      const { res, body } = await mediHumanJson<{ data?: DoctorWithdrawalDetails }>(`/admin/doctor-withdrawals/${id}/details`);
      if (!res.ok) throw new Error(String((body as { error?: string }).error || res.status));
      setSelectedWithdrawalId(id);
      setWithdrawDetails(body.data || null);
    } finally {
      setDetailsLoading(false);
    }
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
      toast.success("MediBondhu doctor payout updated");
      await queryClient.invalidateQueries({ queryKey: ["admin", "medibondhu-payouts", "doctor-withdrawals"] });
      if (selectedWithdrawalId) {
        await fetchWithdrawDetails(selectedWithdrawalId);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const token = readSession()?.access_token;
    if (!token) return;
    const channel = api
      .channel("admin-medibondhu-payouts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "medibondhu_doctor_withdrawals" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "medibondhu-payouts", "doctor-withdrawals"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "medibondhu-payouts", "overview"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "medibondhu_doctors" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "medibondhu-payouts", "overview"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "medibondhu_appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin", "medibondhu-payouts", "overview"] });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [queryClient]);

  const withdrawals = withdrawalsQuery.data || [];
  const overview = overviewQuery.data;
  const doctors = overview?.all_doctors || [];
  const availableDoctors = overview?.available_doctors_list || [];
  const bookings = overview?.recent_bookings || [];
  const totalDoctors = overview?.total_doctors ?? doctors.length;
  const availableDoctorCount = overview?.available_doctors ?? availableDoctors.length;
  const totalBookings = overview?.total_bookings ?? bookings.length;
  const activeSessions = overview?.active_sessions ?? bookings.filter((row) => ["pending", "confirmed", "in_progress"].includes(String(row.status || ""))).length;
  const pendingWithdrawals = overview?.pending_withdrawals ?? withdrawals.filter((row) => row.status === "pending").length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${MB}, #0891b2)` }}>
          <Banknote className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">MediBondhu Doctor Payouts</h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${MB}1A`, color: MB }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin View
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">MediBondhu-only human doctor payout monitoring</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Doctors", value: totalDoctors, icon: Users, color: MB, tab: "doctors" },
          { label: "Available Doctors", value: availableDoctorCount, icon: Stethoscope, color: MB, tab: "available" },
          { label: "Total Bookings", value: totalBookings, icon: CalendarCheck, color: ICON_COLORS.dashboard, tab: "bookings" },
          { label: "Active Sessions", value: activeSessions, icon: CalendarCheck, color: ICON_COLORS.health, tab: "bookings" },
          { label: "Pending Withdrawals", value: pendingWithdrawals, icon: Shield, color: ICON_COLORS.admin, tab: "withdrawals" },
        ].map((stat) => (
          <Card
            key={stat.label}
            className="shadow-card overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab(stat.tab)}
          >
            <div className="h-1" style={{ background: `linear-gradient(to right, ${MB}, #0891b2)` }} />
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="doctors">All Doctors ({totalDoctors})</TabsTrigger>
          <TabsTrigger value="available">Available Doctors ({availableDoctorCount})</TabsTrigger>
          <TabsTrigger value="bookings">Recent Bookings ({totalBookings})</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals ({withdrawals.length})</TabsTrigger>
          <TabsTrigger value="details" disabled={!selectedWithdrawalId}>Details</TabsTrigger>
        </TabsList>

        <TabsContent value="doctors">
          <DoctorsTableCard title="Registered MediBondhu Doctors" rows={doctors} isLoading={overviewQuery.isLoading} />
        </TabsContent>

        <TabsContent value="available">
          <DoctorsTableCard title="Available MediBondhu Doctors" rows={availableDoctors} isLoading={overviewQuery.isLoading} />
        </TabsContent>

        <TabsContent value="bookings">
          <BookingsTableCard rows={bookings} isLoading={overviewQuery.isLoading} />
        </TabsContent>

        <TabsContent value="withdrawals">
          <PayoutTableCard
            title="MediBondhu Doctor Withdrawal Requests"
            rows={withdrawals}
            isLoading={withdrawalsQuery.isLoading}
            detailsLoading={detailsLoading}
            reviewNotes={reviewNotes}
            reviewPending={reviewWithdrawal.isPending}
            onDetails={(id) => {
              void fetchWithdrawDetails(id).then(() => setActiveTab("details"));
            }}
            onNoteChange={(id, value) => setReviewNotes((prev) => ({ ...prev, [id]: value }))}
            onReview={(id, action) => reviewWithdrawal.mutate({ id, action })}
          />
        </TabsContent>

        <TabsContent value="details">
          {selectedWithdrawalId && (
            <Card className="shadow-card overflow-hidden">
              <div className="h-1" style={{ background: `linear-gradient(to right, ${MB}, #0891b2)` }} />
              <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-semibold">Payout Details</h3>
                <Button size="sm" variant="ghost" onClick={() => { setSelectedWithdrawalId(null); setWithdrawDetails(null); setActiveTab("withdrawals"); }}>
                  Close
                </Button>
              </div>
              {detailsLoading ? (
                <p className="text-sm text-muted-foreground">Loading details...</p>
              ) : !withdrawDetails ? (
                <p className="text-sm text-muted-foreground">No details available.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Gross</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.gross_earnings || 0).toFixed(2)}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Platform Fee</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.platform_fee || 0).toFixed(2)}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Net</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.net_earnings || 0).toFixed(2)}</p></CardContent></Card>
                    <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Available</p><p className="font-semibold">৳{Number(withdrawDetails.summary?.available_balance || 0).toFixed(2)}</p></CardContent></Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Doctor Profile</CardTitle></CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Name:</span> {withdrawDetails.doctor_profile?.full_name || withdrawDetails.request.doctor_name || "-"}</p>
                        <p><span className="text-muted-foreground">Email:</span> {withdrawDetails.doctor_profile?.email || withdrawDetails.request.doctor_email || "-"}</p>
                        <p><span className="text-muted-foreground">Phone:</span> {withdrawDetails.doctor_profile?.phone || withdrawDetails.request.doctor_phone || "-"}</p>
                        <p><span className="text-muted-foreground">Qualification:</span> {withdrawDetails.doctor_profile?.qualification || "-"}</p>
                        <p><span className="text-muted-foreground">Registration:</span> {withdrawDetails.doctor_profile?.medical_reg_number || "-"}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Request Context</CardTitle></CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Requested:</span> ৳{Number(withdrawDetails.request.request_amount || 0).toFixed(2)}</p>
                        <p><span className="text-muted-foreground">Status:</span> {withdrawDetails.request.status || "-"}</p>
                        <p><span className="text-muted-foreground">Doctor Note:</span> {withdrawDetails.request.note || "-"}</p>
                        <p><span className="text-muted-foreground">Admin Note:</span> {withdrawDetails.request.review_note || "-"}</p>
                        <p><span className="text-muted-foreground">Created:</span> {withdrawDetails.request.created_at ? new Date(withdrawDetails.request.created_at).toLocaleString() : "-"}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Completed Consultations</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {(withdrawDetails.consultations || []).slice(0, 10).map((consultation) => (
                        <div key={consultation.id} className="flex items-center justify-between rounded border p-2 text-sm">
                          <div>
                            <p className="font-medium">{consultation.patient_name || "Patient"}</p>
                            <p className="text-muted-foreground">{new Date(consultation.completed_at || consultation.created_at || Date.now()).toLocaleDateString()}</p>
                          </div>
                          <p className="font-semibold">৳{Number(consultation.fee || 0).toFixed(2)}</p>
                        </div>
                      ))}
                      {!(withdrawDetails.consultations || []).length && <p className="text-sm text-muted-foreground">No completed consultations found.</p>}
                    </CardContent>
                  </Card>
                </div>
              )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PayoutTableCard({
  title,
  rows,
  isLoading,
  detailsLoading,
  reviewNotes,
  reviewPending,
  onDetails,
  onNoteChange,
  onReview,
}: {
  title: string;
  rows: DoctorWithdrawalRow[];
  isLoading: boolean;
  detailsLoading: boolean;
  reviewNotes: Record<string, string>;
  reviewPending: boolean;
  onDetails: (id: string) => void;
  onNoteChange: (id: string, value: string) => void;
  onReview: (id: string, action: "approve" | "reject") => void;
}) {
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(to right, ${MB}, #0891b2)` }} />
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading MediBondhu payouts...
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No MediBondhu doctor payout requests found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested On</TableHead>
                <TableHead>Doctor Note</TableHead>
                <TableHead>Admin Note</TableHead>
                <TableHead>Review Note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.doctor_name || "Doctor"}</div>
                    <div className="text-xs text-muted-foreground">{row.doctor_email || row.doctor_user_id}</div>
                  </TableCell>
                  <TableCell className="font-semibold">৳{Number(row.request_amount || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={`capitalize ${statusBadgeClass(String(row.status || ""))}`}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(row.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="max-w-[200px] text-xs text-muted-foreground">{row.note || "-"}</TableCell>
                  <TableCell className="max-w-[200px] text-xs text-muted-foreground">{row.review_note || "-"}</TableCell>
                  <TableCell>
                    <Textarea
                      value={reviewNotes[row.id] || ""}
                      onChange={(event) => onNoteChange(row.id, event.target.value)}
                      placeholder="Optional note"
                      className="min-h-[44px] min-w-[180px]"
                      disabled={row.status !== "pending" || reviewPending}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onDetails(row.id)} disabled={detailsLoading}>
                        Details
                      </Button>
                      {row.status === "pending" ? (
                        <>
                          <Button size="sm" className="text-white" style={{ backgroundColor: MB }} onClick={() => onReview(row.id, "approve")} disabled={reviewPending}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onReview(row.id, "reject")} disabled={reviewPending}>
                            Reject
                          </Button>
                        </>
                      ) : (
                        <span className="self-center text-xs text-muted-foreground">Reviewed</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DoctorsTableCard({ title, rows, isLoading }: { title: string; rows: MediDoctorRow[]; isLoading: boolean }) {
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(to right, ${MB}, #0891b2)` }} />
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading MediBondhu doctors...
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No MediBondhu doctors found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((doctor) => (
                <TableRow key={doctor.id}>
                  <TableCell>
                    <div className="font-medium">{doctor.name || "Doctor"}</div>
                    <div className="text-xs text-muted-foreground">{doctor.email || doctor.user_id || "-"}</div>
                  </TableCell>
                  <TableCell>{doctor.specialty_name || "-"}</TableCell>
                  <TableCell>{doctor.location || "-"}</TableCell>
                  <TableCell>{Number(doctor.experience_years || 0)} yrs</TableCell>
                  <TableCell>৳{Number(doctor.fee || 0)}</TableCell>
                  <TableCell>{Number(doctor.rating || 0).toFixed(1)}</TableCell>
                  <TableCell>
                    <Badge className={doctor.available ? "bg-cyan-100 text-cyan-700" : "bg-muted text-muted-foreground"}>
                      {doctor.status_label || (doctor.available ? "Available" : "Offline")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BookingsTableCard({ rows, isLoading }: { rows: MediBookingRow[]; isLoading: boolean }) {
  return (
    <Card className="shadow-card overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(to right, ${MB}, #0891b2)` }} />
      <CardHeader><CardTitle className="text-lg">Recent MediBondhu Bookings</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading MediBondhu bookings...
          </p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No MediBondhu bookings found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.patient_name || "Patient"}</TableCell>
                  <TableCell>{booking.doctor_name || "Doctor"}</TableCell>
                  <TableCell className="capitalize">{booking.consultation_type || "-"}</TableCell>
                  <TableCell>৳{Number(booking.fee || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={String(booking.status || "") === "completed" ? "bg-cyan-100 text-cyan-700" : "bg-muted text-muted-foreground"}>
                      {booking.status || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(booking.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
