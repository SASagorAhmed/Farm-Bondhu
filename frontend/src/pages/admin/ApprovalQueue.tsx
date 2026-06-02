import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
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
import { CheckCircle, XCircle, Clock, Loader2, Eye, UserCircle, Store } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";
import StatCard from "@/components/dashboard/StatCard";
import { ICON_COLORS } from "@/lib/iconColors";
import SellerLaneReviewPanel from "@/components/admin/SellerLaneReviewPanel";

interface ApprovalRequest {
  id: string;
  user_id: string;
  request_type: string;
  details: Record<string, unknown> | null;
  status: "pending" | "approved" | "rejected" | "partially_approved";
  review_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewer_profile?: { name: string; admin_level?: string } | null;
  applicant_name?: string;
  applicant_email?: string;
}

async function callVetApprovalEndpoint(userId: string, status: "approved" | "rejected", reviewNotes?: string) {
  const token = readSession()?.access_token;
  const path =
    status === "approved"
      ? `/v1/vetbondhu/admin/vet-profiles/${encodeURIComponent(userId)}/approve`
      : `/v1/vetbondhu/admin/vet-profiles/${encodeURIComponent(userId)}/reject`;
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
  seller_access: "Seller Access (Legacy)",
  seller_onboarding: "Seller Onboarding (Marketplace Lanes)",
  vet_verification: "Vet Verification",
  vendor_approval: "Vendor Approval",
  farmer_upgrade: "Farmer Upgrade",
  role_upgrade: "Role Upgrade",
  role_change: "Role Change",
  farm_management_access: "Farm Management Access",
  vet_service_access: "VetBondhu Consultation Services",
};

/** Legacy request types no longer offered in Access Center */
const LEGACY_TYPE_LABELS: Record<string, string> = {
  business_buyer_access: "Business Buyer Access (legacy)",
};

function requestTypeLabel(type: string): string {
  return TYPE_LABELS[type] || LEGACY_TYPE_LABELS[type] || type;
}

const SELLER_REQUEST_TYPES = new Set(["seller_onboarding", "seller_access"]);

const CAPABILITY_MAP: Record<string, string[]> = {
  vet_verification: ["can_consult_as_vet"],
  vendor_approval: ["can_sell"],
  farm_management_access: ["can_manage_farm", "can_manage_animals"],
  vet_service_access: ["can_book_vet"],
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  partially_approved: "bg-blue-100 text-blue-800",
};

const TYPE_FILTER_OPTIONS = [
  "all",
  "seller_onboarding",
  "seller_access",
  "vet_verification",
  "farm_management_access",
  "vet_service_access",
  "role_change",
] as const;

function isSellerRequest(type: string) {
  return SELLER_REQUEST_TYPES.has(type);
}

export default function ApprovalQueue() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [applicantName, setApplicantName] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchRequests = useCallback(async () => {
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
      return [];
    }

    const rawRequests = (data as ApprovalRequest[]) || [];
    const userIds = [...new Set(rawRequests.map((r) => r.user_id))];
    let profileMap: Record<string, { name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await api.from("profiles").select("id, name, email").in("id", userIds);
      (profiles || []).forEach((p: { id: string; name?: string; email?: string }) => {
        profileMap[p.id] = { name: p.name || "", email: p.email || "" };
      });
    }

    const reviewerIds = [...new Set(rawRequests.filter((r) => r.reviewed_by).map((r) => r.reviewed_by!))];
    let reviewerMap: Record<string, { name: string; admin_level?: string }> = {};
    if (reviewerIds.length > 0) {
      const { data: profiles } = await api.from("profiles").select("id, name").in("id", reviewerIds);
      const { data: teamData } = await api.from("admin_team").select("user_id, admin_level, admin_role").in("user_id", reviewerIds);
      (profiles || []).forEach((p: { id: string; name?: string }) => {
        const team = (teamData || []).find((t: { user_id: string }) => t.user_id === p.id);
        const level = team?.admin_level || (team as { admin_role?: string })?.admin_role;
        reviewerMap[p.id] = { name: p.name || "", admin_level: level };
      });
    }

    return rawRequests.map((r) => ({
      ...r,
      applicant_name: profileMap[r.user_id]?.name,
      applicant_email: profileMap[r.user_id]?.email,
      reviewer_profile: r.reviewed_by ? reviewerMap[r.reviewed_by] || null : null,
    })) as ApprovalRequest[];
  }, [filter, toast]);

  const { data: cachedRequests = [], isLoading: loading } = useQuery({
    queryKey: queryKeys().approvalQueue(filter),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: fetchRequests,
  });

  useEffect(() => {
    setRequests(cachedRequests);
  }, [cachedRequests]);

  const filteredRequests = useMemo(() => {
    if (typeFilter === "all") return requests;
    return requests.filter((r) => r.request_type === typeFilter);
  }, [requests, typeFilter]);

  const stats = useMemo(() => ({
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved" || r.status === "partially_approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  useEffect(() => {
    const tables = ["approval_requests", "profiles", "user_roles", "user_capabilities"];
    const channels = tables.map((table) =>
      api
        .channel(`approval-live-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys().approvalQueue(filter) });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [filter, queryClient]);

  const openDetail = async (req: ApprovalRequest) => {
    setSelectedRequest(req);
    setReviewNotes(req.review_notes || "");
    setApplicantName(req.applicant_name || req.applicant_email || req.user_id.slice(0, 8));
  };

  const handleAction = async (status: "approved" | "rejected") => {
    if (!selectedRequest) return;
    if (isSellerRequest(selectedRequest.request_type)) {
      toast({
        title: "Use lane review",
        description: "Approve or reject each marketplace category separately below.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(true);
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
        await api.from("profiles").update({ primary_role: newRole as never }).eq("id", selectedRequest.user_id);
        await api.from("user_roles").upsert(
          { user_id: selectedRequest.user_id, role: newRole as never },
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
    queryClient.invalidateQueries({ queryKey: queryKeys().approvalQueue(filter) });
  };

  const renderDetails = (details: Record<string, unknown> | null, requestType: string) => {
    if (!details || typeof details !== "object") return null;
    if (isSellerRequest(requestType)) {
      const lanes = Array.isArray(details.lanes) ? details.lanes : [];
      const business = details.business_name || details.businessName;
      return (
        <div className="mt-1 space-y-0.5">
          {business && <p className="text-[11px] text-muted-foreground">Business: {String(business)}</p>}
          {lanes.length > 0 && (
            <p className="text-[11px] text-muted-foreground">{lanes.length} lane(s) requested</p>
          )}
          {details.products && <p className="text-[11px] text-muted-foreground truncate">Products: {String(details.products)}</p>}
        </div>
      );
    }
    const entries = Object.entries(details).filter(([, v]) => v != null && v !== "");
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

  const renderFullDetails = (details: Record<string, unknown> | null) => {
    if (!details || typeof details !== "object") return <p className="text-sm text-muted-foreground">No details provided.</p>;
    const entries = Object.entries(details).filter(([k, v]) => v != null && v !== "" && k !== "lanes");
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

  const selectedIsSeller = selectedRequest ? isSellerRequest(selectedRequest.request_type) : false;

  return (
    <div className="space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Approval Queue</h1>
        <p className="text-muted-foreground mt-1">Review and manage user access requests.</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Pending" value={stats.pending} icon={<Clock className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={0} />
        <StatCard title="Approved" value={stats.approved} icon={<CheckCircle className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={1} />
        <StatCard title="Rejected" value={stats.rejected} icon={<XCircle className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={2} />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_FILTER_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All types" : requestTypeLabel(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/marketplace/seller-lanes">
            <Store className="h-4 w-4 mr-1" /> Seller lane queue
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No requests found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => (
                  <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(req)}>
                    <TableCell>
                      <p className="font-medium text-sm text-foreground">{req.applicant_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{req.applicant_email || req.user_id.slice(0, 8)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{requestTypeLabel(req.request_type)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">{renderDetails(req.details, req.request_type)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[req.status] || STATUS_COLORS.pending}>{req.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(req.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(req); }}>
                        <Eye className="h-4 w-4 mr-1" />
                        {isSellerRequest(req.request_type) ? "Review lanes" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              Request Detail
            </DialogTitle>
            <DialogDescription>
              {selectedIsSeller
                ? "Review each marketplace category separately. Lane approval grants seller access."
                : "Review the applicant's request and take action."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-5">
            {selectedRequest && (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <UserCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm">{applicantName}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedRequest.applicant_email}</p>
                  </div>
                  <Badge className={`ml-auto shrink-0 ${STATUS_COLORS[selectedRequest.status] || STATUS_COLORS.pending}`}>
                    {selectedRequest.status.replace("_", " ")}
                  </Badge>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Request Type</Label>
                  <p className="text-sm font-medium">{requestTypeLabel(selectedRequest.request_type)}</p>
                </div>

                {selectedIsSeller ? (
                  <>
                    {selectedRequest.request_type === "seller_access" && !selectedRequest.details?.lanes && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2 text-sm text-muted-foreground">
                        Legacy seller request. New applications use per-lane review below when lane grants exist.
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">Marketplace lanes</Label>
                      <SellerLaneReviewPanel
                        userId={selectedRequest.user_id}
                        requestDetails={selectedRequest.details as never}
                        compact
                        onLaneReviewed={() => {
                          queryClient.invalidateQueries({ queryKey: queryKeys().approvalQueue(filter) });
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Application Details</Label>
                    <div className="p-3 rounded-lg border border-border bg-muted/30">
                      {renderFullDetails(selectedRequest.details)}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">Submitted</Label>
                  <p className="text-sm">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                </div>

                {!selectedIsSeller && selectedRequest.status === "pending" && (
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
                    <p className="text-sm font-medium">{selectedRequest.reviewer_profile.name}</p>
                  </div>
                )}

                {selectedRequest.review_notes && selectedRequest.status !== "pending" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Review Notes</Label>
                    <p className="text-sm bg-muted/30 p-2 rounded">{selectedRequest.review_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-0">
            {selectedIsSeller ? (
              <>
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
                <Button variant="secondary" asChild>
                  <Link to="/admin/marketplace/seller-lanes">Seller lane queue</Link>
                </Button>
              </>
            ) : selectedRequest?.status === "pending" ? (
              <>
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
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
