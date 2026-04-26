import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { API_BASE, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, TrendingUp, CalendarCheck, Landmark, Wallet, BadgePercent } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type EarningRow = {
  id: string;
  patient_name: string;
  fee: number;
  created_at: string;
  completed_at?: string | null;
  animal_type: string | null;
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

export default function VetEarnings() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchAll = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const token = readSession()?.access_token;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const [summaryRes, withdrawRes] = await Promise.all([
        fetch(`${API_BASE}/v1/medibondhu/vet-earnings/summary`, { headers }),
        fetch(`${API_BASE}/v1/medibondhu/vet-withdrawals`, { headers }),
      ]);
      const summaryBody = (await summaryRes.json().catch(() => ({}))) as { data?: EarningsSummary; error?: string };
      const withdrawBody = (await withdrawRes.json().catch(() => ({}))) as { data?: WithdrawalRow[]; error?: string };
      if (!summaryRes.ok) throw new Error(summaryBody.error || "Failed to load earnings summary");
      if (!withdrawRes.ok) throw new Error(withdrawBody.error || "Failed to load withdrawals");
      setSummary(summaryBody.data || null);
      setWithdrawals(Array.isArray(withdrawBody.data) ? withdrawBody.data : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load earnings";
      toast.error(message);
      setSummary(null);
      setWithdrawals([]);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void fetchAll({ silent: true });
      }, 10000);
    };
    const stopPolling = () => {
      if (!intervalId) return;
      clearInterval(intervalId);
      intervalId = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchAll({ silent: true });
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
    };
  }, [fetchAll, user]);

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
      const res = await fetch(`${API_BASE}/v1/medibondhu/vet-withdrawals`, {
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
      await fetchAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Withdrawal request failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Earnings</h1>
        <p className="text-muted-foreground mt-1">Track gross, platform fee, net earnings, and request withdrawal.</p>
      </motion.div>

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
              <Input
                type="number"
                min={0}
                step="0.01"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder="Enter withdrawal amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                placeholder="Add note for admin"
                className="min-h-[44px]"
              />
            </div>
          </div>
          <Button onClick={() => void submitWithdrawal()} disabled={submitting || loading}>
            {submitting ? "Submitting..." : "Request Withdrawal"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Withdrawal History</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
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
          {loading ? (
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
                      {r.animal_type ? `${r.animal_type} • ` : ""}
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
