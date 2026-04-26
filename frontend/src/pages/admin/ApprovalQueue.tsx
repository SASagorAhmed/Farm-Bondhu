import { useState, useEffect } from "react";
import { API_BASE, api, readSession } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, Loader2, Eye, UserCircle } from "lucide-react";
import { motion } from "framer-motion";

interface ApprovalRequest {
  id: string;
  user_id: string;
  request_type: string;
  details: any;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewer_profile?: { name: string; admin_level?: string } | null;
}

async function callVetApprovalEndpoint(userId: string, status: "approved" | "rejected", reviewNotes?: string) {
  const token = readSession()?.access_token;
  const path =
    status === "approved"
      ? `/v1/medibondhu/admin/vet-profiles/${encodeURIComponent(userId)}/approve`
      : `/v1/medibondhu/admin/vet-profiles/${encodeURIComponent(userId)}/reject`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: status === "rejected" ? JSON.stringify({ rejection_reason: reviewNotes || "Rejected by admin" }) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error || `Vet ${status} failed`);
  }
}

const TYPE_LABELS: Record<string, string> = {
  seller_access: "Seller Access",
  vet_verification: "Vet Verification",
  vendor_approval: "Vendor Approval",
  farmer_upgrade: "Farmer Upgrade",
  role_upgrade: "Role Upgrade",
  role_change: "Role Change",
  farm_management_access: "Farm Management Access",
  vet_service_access: "Vet Service Access",
  business_buyer_access: "Business Buyer Access",
};

const CAPABILITY_MAP: Record<string, string[]> = {
  seller_access: ["can_sell", "can_manage_store"],
  vet_verification: ["can_consult_as_vet"],
  vendor_approval: ["can_sell"],
  farm_management_access: ["can_manage_farm", "can_manage_animals"],
  vet_service_access: ["can_book_vet"],
  business_buyer_access: ["can_bulk_buy"],
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function ApprovalQueue() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [applicantName, setApplicantName] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    let query = api
      .from("approval_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter as "pending" | "approved" | "rejected");
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error loading requests", description: error.message, variant: "destructive" });
      setRequests([]);
      setLoading(false);
      return;
    }

    const requests = (data as any[]) || [];

    // Enrich reviewed_by with reviewer profile + admin level
    const reviewerIds = [...new Set(requests.filter((r) => r.reviewed_by).map((r) => r.reviewed_by))];
    let reviewerMap: Record<string, { name: string; admin_level?: string }> = {};
    if (reviewerIds.length > 0) {
      const { data: profiles } = await api.from("profiles").select("id, name").in("id", reviewerIds);
      const { data: teamData } = await api.from("admin_team").select("user_id, admin_level, admin_role").in("user_id", reviewerIds);
      (profiles || []).forEach((p: any) => {
        const team = (teamData || []).find((t: any) => t.user_id === p.id);
        const level = team?.admin_level || (team as { admin_role?: string })?.admin_role;
        reviewerMap[p.id] = { name: p.name, admin_level: level };
      });
    }

    setRequests(requests.map((r) => ({
      ...r,
      reviewer_profile: r.reviewed_by ? reviewerMap[r.reviewed_by] || null : null,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [filter]);

  const openDetail = async (req: ApprovalRequest) => {
    setSelectedRequest(req);
    setReviewNotes(req.review_notes || "");
    // Fetch applicant name
    const { data } = await api.from("profiles").select("name, email").eq("id", req.user_id).single();
    setApplicantName(data?.name || data?.email || req.user_id.slice(0, 8));
  };

  const handleAction = async (status: "approved" | "rejected") => {
    if (!selectedRequest) return;
    setActionLoading(true);

    // Current user id from session (backend-verified JWT)
    const { data: { user: authUser } } = await api.auth.getUser();

    if (selectedRequest.request_type === "vet_verification") {
      try {
        await callVetApprovalEndpoint(selectedRequest.user_id, status, reviewNotes || undefined);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Vet verification action failed";
        toast({ title: "Error", description: message, variant: "destructive" });
        setActionLoading(false);
        return;
      }
    }

    const { error } = await api
      .from("approval_requests")
      .update({
        status,
        review_notes: reviewNotes || null,
        reviewed_by: authUser?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedRequest.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setActionLoading(false);
      return;
    }

    if (status === "approved") {
      if (selectedRequest.request_type === "role_change" && selectedRequest.details?.requested_role) {
        const newRole = selectedRequest.details.requested_role as string;
        // Update primary_role in profiles
        await api
          .from("profiles")
          .update({ primary_role: newRole as any })
          .eq("id", selectedRequest.user_id);
        // Upsert new role in user_roles
        await api.from("user_roles").upsert(
          { user_id: selectedRequest.user_id, role: newRole as any },
          { onConflict: "user_id,role" }
        );
      } else {
        const caps = CAPABILITY_MAP[selectedRequest.request_type] || [];
        for (const cap of caps) {
          await api.from("user_capabilities").upsert({
            user_id: selectedRequest.user_id,
            capability_code: cap,
            is_enabled: true,
          });
        }
      }
    }

    toast({ title: `Request ${status}`, description: `The request has been ${status}.` });
    setSelectedRequest(null);
    setActionLoading(false);
    fetchRequests();
  };

  const renderDetails = (details: any) => {
    if (!details || typeof details !== "object") return null;
    const entries = Object.entries(details).filter(([, v]) => v);
    if (entries.length === 0) return null;
    return (
      <div className="mt-1 space-y-0.5">
        {entries.slice(0, 3).map(([k, v]) => (
          <p key={k} className="text-[11px] text-muted-foreground">
            <span className="capitalize">{k.replace(/_/g, " ")}</span>: {String(v)}
          </p>
        ))}
        {entries.length > 3 && <p className="text-[11px] text-muted-foreground">+{entries.length - 3} more fields</p>}
      </div>
    );
  };

  const renderFullDetails = (details: any) => {
    if (!details || typeof details !== "object") return <p className="text-sm text-muted-foreground">No details provided.</p>;
    const entries = Object.entries(details).filter(([, v]) => v);
    return (
      <div className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
            <span className="text-sm text-foreground">{String(v)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Approval Queue</h1>
        <p className="text-muted-foreground mt-1">Review and manage user access requests.</p>
      </motion.div>

      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No {filter !== "all" ? filter : ""} requests found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(req)}>
                    <TableCell className="font-mono text-xs">{req.user_id.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge variant="outline">{TYPE_LABELS[req.request_type] || req.request_type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">{renderDetails(req.details)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[req.status]}>{req.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(req.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(req); }}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              Request Detail
            </DialogTitle>
            <DialogDescription>Review the applicant's request and take action.</DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-5">
              {/* Applicant */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{applicantName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedRequest.user_id.slice(0, 16)}…</p>
                </div>
                <Badge className={`ml-auto ${STATUS_COLORS[selectedRequest.status]}`}>{selectedRequest.status}</Badge>
              </div>

              {/* Request Type */}
              <div>
                <Label className="text-xs text-muted-foreground">Request Type</Label>
                <p className="text-sm font-medium">{TYPE_LABELS[selectedRequest.request_type] || selectedRequest.request_type}</p>
              </div>

              {/* Full Details */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Application Details</Label>
                <div className="p-3 rounded-lg border border-border bg-muted/30">
                  {renderFullDetails(selectedRequest.details)}
                </div>
              </div>

              {/* Date */}
              <div>
                <Label className="text-xs text-muted-foreground">Submitted</Label>
                <p className="text-sm">{new Date(selectedRequest.created_at).toLocaleString()}</p>
              </div>

              {/* Review Notes */}
              {selectedRequest.status === "pending" && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Review Notes (optional)</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes about this decision..."
                    className="resize-none"
                    rows={3}
                  />
                </div>
              )}

              {selectedRequest.status !== "pending" && selectedRequest.reviewer_profile && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  <Label className="text-xs text-muted-foreground block mb-1">Reviewed By</Label>
                  <p className="text-sm font-medium">
                    {selectedRequest.reviewer_profile.name}
                    {selectedRequest.reviewer_profile.admin_level && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {selectedRequest.reviewer_profile.admin_level === "super_admin" ? "Super Admin" : selectedRequest.reviewer_profile.admin_level === "co_admin" ? "Co-Admin" : "Moderator"}
                      </Badge>
                    )}
                  </p>
                </div>
              )}

              {selectedRequest.review_notes && selectedRequest.status !== "pending" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Review Notes</Label>
                  <p className="text-sm bg-muted/30 p-2 rounded">{selectedRequest.review_notes}</p>
                </div>
              )}
            </div>
          )}

          {selectedRequest?.status === "pending" && (
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
                disabled={actionLoading}
                onClick={() => handleAction("rejected")}
              >
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={actionLoading}
                onClick={() => handleAction("approved")}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Approve
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
