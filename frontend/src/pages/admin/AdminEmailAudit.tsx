import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { API_BASE, readSession } from "@/api/client";
import { Mail, Loader2, CheckCircle2, XCircle, Eye, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

type EmailAuditRow = {
  id: string;
  created_at: string;
  email_type: string;
  category: string;
  recipient_email: string;
  subject: string;
  status: string;
  error_message: string | null;
  body_preview: string | null;
  sensitive_fields: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
  provider: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  registration_otp: "Registration OTP",
  password_reset_otp: "Password reset OTP",
  marketplace_order: "Marketplace order",
};

const PAGE_SIZE = 50;

async function fetchEmailAudit(params: { type: string; status: string; offset: number }) {
  const token = readSession()?.access_token;
  const q = new URLSearchParams();
  if (params.type && params.type !== "all") q.set("type", params.type);
  if (params.status && params.status !== "all") q.set("status", params.status);
  q.set("limit", String(PAGE_SIZE));
  q.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE}/v1/admin/email-audit?${q.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(body.error || res.status));
  return body as { data: EmailAuditRow[]; total: number; limit: number; offset: number };
}

async function fetchEmailAuditStats() {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/admin/email-audit/stats`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { byType: [], total24h: 0 };
  return (body as { data: { byType: { email_type: string; sent: number; failed: number; total: number }[]; total24h: number } }).data;
}

function typeLabel(type: string) {
  return TYPE_LABELS[type] || type.replace(/_/g, " ");
}

export default function AdminEmailAudit() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<EmailAuditRow | null>(null);

  const queryKey = ["admin-email-audit", typeFilter, statusFilter, offset];

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchEmailAudit({ type: typeFilter, status: statusFilter, offset }),
    staleTime: 15 * 1000,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-email-audit-stats"],
    queryFn: fetchEmailAuditStats,
    staleTime: 30 * 1000,
  });

  const rows = data?.data || [];
  const total = data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;

  const typeOptions = useMemo(() => {
    const fromStats = (stats?.byType || []).map((r) => r.email_type);
    const base = ["registration_otp", "password_reset_otp", "marketplace_order"];
    return [...new Set([...base, ...fromStats])];
  }, [stats]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${ICON_COLORS.admin}18` }}
          >
            <Mail className="h-5 w-5" style={{ color: ICON_COLORS.admin }} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Email Audit</h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Transactional email log for auth OTP, marketplace orders, and system mail. OTP secrets are never stored — only{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">hasValue</code> indicators appear for sensitive fields.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Last 24 hours</p>
            <p className="text-2xl font-bold mt-1">{stats?.total24h ?? "—"}</p>
          </CardContent>
        </Card>
        {(stats?.byType || []).slice(0, 3).map((s) => (
          <Card key={s.email_type} className="shadow-sm">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground truncate">{typeLabel(s.email_type)}</p>
              <p className="text-2xl font-bold mt-1">{s.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">7-day window</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.marketplace})` }} />
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Send history
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setOffset(0); }}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {typeOptions.map((t) => (
                    <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOffset(0); }}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Mail className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">No email logs yet.</p>
              <p className="text-sm text-muted-foreground/80 mt-1">New sends appear here automatically.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {typeLabel(row.email_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[160px] truncate">{row.recipient_email}</TableCell>
                      <TableCell className="text-sm max-w-[220px] truncate">{row.subject}</TableCell>
                      <TableCell>
                        {row.status === "sent" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Sent
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" /> Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {row.provider?.replace(/_/g, " ") || "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelected(row)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || isFetching}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasMore || isFetching}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Load more
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Email details</DialogTitle>
            <DialogDescription>
              {selected
                ? `${typeLabel(selected.email_type)} — ${selected.recipient_email}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selected.status}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="font-medium capitalize">{selected.provider?.replace(/_/g, " ") || "—"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5 col-span-2">
                  <p className="text-xs text-muted-foreground">Subject</p>
                  <p className="font-medium">{selected.subject}</p>
                </div>
              </div>

              {selected.sensitive_fields && Object.keys(selected.sensitive_fields).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sensitive fields</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(selected.sensitive_fields).map(([key, val]) => (
                      <Badge key={key} variant="secondary" className="font-mono text-xs">
                        {key}: {val}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selected.metadata && Object.keys(selected.metadata).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Metadata</p>
                  <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {selected.body_preview && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Body preview (sanitized)</p>
                  <pre className="text-xs bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{selected.body_preview}</pre>
                </div>
              )}

              {selected.error_message && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-semibold text-destructive mb-1">Error</p>
                  <p className="text-xs text-destructive/90">{selected.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
