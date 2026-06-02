import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { BadgePercent, CalendarCheck, DollarSign, Landmark, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE, api, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMediDoctorPreviewActions } from "@/hooks/useMediDoctorPreviewActions";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import { MB } from "@/components/medibondhu/MediChrome";

type EarningRow = {
  id: string;
  patient_name: string;
  fee: number;
  created_at: string;
  completed_at?: string | null;
};

type WithdrawalRow = {
  id: string;
  request_amount: number;
  status: "pending" | "approved" | "rejected" | "paid";
  note?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
};

type EarningsSummary = {
  gross_earnings: number;
  consultation_count: number;
  monthly_gross: number;
  platform_fee_rate: number;
  platform_fee: number;
  net_earnings: number;
  withdrawn_total: number;
  pending_withdraw_total: number;
  available_balance: number;
  history: EarningRow[];
};

function formatMoney(value: number) {
  return `৳${Number(value || 0).toFixed(2)}`;
}

export default function MediDoctorEarnings() {
  const { user } = useAuth();
  const { readOnly } = useMediDoctorPreviewActions();
  const queryClient = useQueryClient();
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [schemaHint, setSchemaHint] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return { summary: null, withdrawals: [] as WithdrawalRow[] };
    const token = readSession()?.access_token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [summaryRes, withdrawalsRes] = await Promise.all([
        fetch(`${API_BASE}/v1/medibondhu/doctor-earnings/summary`, { headers }),
        fetch(`${API_BASE}/v1/medibondhu/doctor-withdrawals`, { headers }),
      ]);
      const summaryBody = (await summaryRes.json().catch(() => ({}))) as { data?: EarningsSummary; error?: string; note?: string };
      const withdrawalsBody = (await withdrawalsRes.json().catch(() => ({}))) as { data?: WithdrawalRow[]; error?: string; note?: string };
      if (!summaryRes.ok) throw new Error(summaryBody.error || "Failed to load earnings summary");
      if (!withdrawalsRes.ok) throw new Error(withdrawalsBody.error || "Failed to load withdrawals");
      const noteMsg = [summaryBody.note, withdrawalsBody.note].find((x) => typeof x === "string" && x.trim().length > 0) || null;
      setSchemaHint(noteMsg);
      return {
        summary: summaryBody.data || null,
        withdrawals: Array.isArray(withdrawalsBody.data) ? withdrawalsBody.data : [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load earnings";
      toast.error(message);
      setSchemaHint(null);
      return { summary: null, withdrawals: [] as WithdrawalRow[] };
    }
  }, [user]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys().medibondhuHumanDoctorEarnings(user?.id),
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.vet.staleTime,
    gcTime: moduleCachePolicy.vet.gcTime,
    queryFn: fetchAll,
  });

  const summary = data?.summary || null;
  const withdrawals = data?.withdrawals || [];

  useEffect(() => {
    if (!user?.id) return;
    const channel = api
      .channel(`medibondhu-doctor-earnings-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "medibondhu_doctor_withdrawals" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorEarnings(user.id) });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "medibondhu_appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorEarnings(user.id) });
      })
      .subscribe();
    return () => {
      api.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const submitWithdrawal = async () => {
    if (!summary) return;
    const amount = Number(requestAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid withdrawal amount");
      return;
    }
    if (amount > summary.available_balance) {
      toast.error("Amount exceeds available balance");
      return;
    }
    const token = readSession()?.access_token;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/v1/medibondhu/doctor-withdrawals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          request_amount: amount,
          note: requestNote.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Withdrawal request failed");
      toast.success("Withdrawal request submitted");
      setRequestAmount("");
      setRequestNote("");
      queryClient.invalidateQueries({ queryKey: queryKeys().medibondhuHumanDoctorEarnings(user?.id) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Withdrawal request failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Doctor panel</p>
        <h1 className="text-3xl font-display font-bold mt-1 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: `${MB}18` }}>
            <Wallet className="h-5 w-5" style={{ color: MB }} />
          </span>
          Earnings
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Track gross, platform fee, net earnings, and doctor-only withdrawals.</p>
        {schemaHint ? <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">{schemaHint}</p> : null}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Gross Earnings", value: formatMoney(summary?.gross_earnings || 0), icon: DollarSign, color: "text-green-500" },
          { label: "Platform Fee (15%)", value: formatMoney(summary?.platform_fee || 0), icon: BadgePercent, color: "text-rose-500" },
          { label: "Net Earnings", value: formatMoney(summary?.net_earnings || 0), icon: Wallet, color: "text-emerald-600" },
          { label: "Available Balance", value: formatMoney(summary?.available_balance || 0), icon: Landmark, color: "text-blue-600" },
          { label: "This Month", value: formatMoney(summary?.monthly_gross || 0), icon: TrendingUp, color: "text-blue-500" },
          { label: "Consultations", value: String(summary?.consultation_count || 0), icon: CalendarCheck, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Withdrawal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Available balance: <span className="font-semibold text-foreground">{formatMoney(summary?.available_balance || 0)}</span>
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount (BDT)</Label>
              <Input type="number" min={0} step="0.01" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} placeholder="Enter withdrawal amount" disabled={readOnly} />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="Add note for admin" className="min-h-[44px]" disabled={readOnly} />
            </div>
          </div>
          <Button onClick={() => void submitWithdrawal()} disabled={readOnly || submitting || isLoading}>
            {submitting ? "Submitting..." : "Request Withdrawal"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Withdrawal History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No withdrawal requests yet.</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((row) => (
                <div key={row.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium">{formatMoney(row.request_amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(row.created_at), "MMM dd, yyyy")} • {row.status.toUpperCase()}
                    </p>
                    {row.note ? <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Your note:</span> {row.note}</p> : null}
                    {row.review_note ? <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Admin reason:</span> {row.review_note}</p> : null}
                    {row.reviewed_at ? <p className="text-xs text-muted-foreground mt-1">Reviewed: {format(new Date(row.reviewed_at), "MMM dd, yyyy HH:mm")}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Earning History</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : !summary?.history?.length ? (
            <p className="text-center text-muted-foreground py-8">No completed consultations yet.</p>
          ) : (
            <div className="space-y-3">
              {summary.history.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium">{r.patient_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(r.completed_at || r.created_at), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-green-600">{formatMoney(r.fee)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
