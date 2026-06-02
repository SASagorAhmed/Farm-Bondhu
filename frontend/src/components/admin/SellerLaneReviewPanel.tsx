import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, ExternalLink, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { laneLabel } from "@/lib/marketplaceLaneLabels";
import {
  adminListSellerLanesForUser,
  adminReviewSellerLane,
  type AdminSellerLaneRow,
} from "@/lib/sellerOnboardingApi";

const LANE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) || url.startsWith("data:image/");
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url) || url.includes("application/pdf");
}

function LicensePreview({ url }: { url: string }) {
  if (isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-2">
        <img src={url} alt="License document" className="max-h-40 rounded-lg border object-contain bg-muted/30" />
      </a>
    );
  }
  if (isPdfUrl(url)) {
    return (
      <div className="mt-2 space-y-2">
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary">
          Open PDF in new tab <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <iframe src={url} title="License PDF" className="hidden md:block w-full h-48 rounded-lg border bg-muted/20" />
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary mt-2">
      View document <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

export type SellerRequestDetails = {
  business_name?: string;
  businessName?: string;
  phone?: string;
  location?: string;
  lanes?: Array<{ lane: string; license_number?: string | null; license_file_url?: string | null }>;
  products?: string;
  seller_type?: string;
};

interface Props {
  userId: string;
  requestDetails?: SellerRequestDetails | null;
  compact?: boolean;
  onLaneReviewed?: () => void;
}

export function SellerLaneReviewPanel({ userId, requestDetails, compact, onLaneReviewed }: Props) {
  const queryClient = useQueryClient();
  const [reviewTarget, setReviewTarget] = useState<AdminSellerLaneRow | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: grants = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-seller-lanes-user", userId],
    queryFn: async () => {
      const { ok, data, error } = await adminListSellerLanesForUser(userId, "all");
      if (!ok) throw new Error(error || "Failed to load lane grants");
      return data || [];
    },
  });

  const details = requestDetails || grants[0]?.request_details || {};
  const businessName = details.business_name || details.businessName || grants[0]?.user_name || "Seller";
  const phone = details.phone || "—";
  const location = details.location || "—";

  const pendingCount = grants.filter((g) => g.status === "pending").length;
  const approvedCount = grants.filter((g) => g.status === "approved").length;
  const rejectedCount = grants.filter((g) => g.status === "rejected").length;
  const hasPartial = approvedCount > 0 && (pendingCount > 0 || rejectedCount > 0);

  const openReview = (row: AdminSellerLaneRow, action: "approve" | "reject") => {
    setReviewTarget(row);
    setReviewAction(action);
    setReviewNotes("");
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);
    const { ok, error } = await adminReviewSellerLane(
      reviewTarget.user_id,
      reviewTarget.lane,
      reviewAction,
      reviewNotes.trim() || undefined
    );
    setSubmitting(false);
    if (!ok) {
      toast.error(error || "Review failed");
      return;
    }
    toast.success(reviewAction === "approve" ? "Lane approved" : "Lane rejected");
    setReviewTarget(null);
    await refetch();
    void queryClient.invalidateQueries({ queryKey: ["admin-seller-lanes"] });
    onLaneReviewed?.();
  };

  const displayGrants: AdminSellerLaneRow[] =
    grants.length > 0
      ? grants
      : (details.lanes || []).map((l) => ({
          user_id: userId,
          lane: l.lane,
          status: "pending" as const,
          license_number: l.license_number,
          license_file_url: l.license_file_url,
        }));

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="rounded-lg border bg-muted/30 p-4 grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Business</p>
            <p className="font-medium">{businessName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Phone</p>
            <p>{phone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Location</p>
            <p>{location}</p>
          </div>
        </div>
      )}

      {hasPartial && (
        <p className="text-sm text-muted-foreground rounded-lg border border-blue-200 bg-blue-50/80 dark:bg-blue-950/20 px-3 py-2">
          Partial approval: {approvedCount} approved, {pendingCount} pending, {rejectedCount} rejected.
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading lane grants…</p>}

      {!isLoading && displayGrants.length === 0 && (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>No lane grants found for this applicant.</p>
          {requestDetails?.products && (
            <p className="text-xs">Legacy request: {requestDetails.products}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {displayGrants.map((row) => (
          <div key={`${row.user_id}-${row.lane}`} className="rounded-xl border p-4 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge variant="outline">{laneLabel(row.lane)}</Badge>
                <Badge className={`ml-2 ${LANE_STATUS_COLORS[row.status] || ""}`}>{row.status}</Badge>
              </div>
              {row.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => openReview(row, "approve")}>
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => openReview(row, "reject")}>
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
            {row.license_number && (
              <p className="text-sm"><span className="text-muted-foreground">License #:</span> {row.license_number}</p>
            )}
            {row.license_file_url && <LicensePreview url={row.license_file_url} />}
            {row.status === "rejected" && row.review_notes && (
              <p className="text-sm text-destructive">Admin note: {row.review_notes}</p>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <Button variant="outline" size="sm" asChild>
          <Link to="/admin/marketplace/seller-lanes">
            <Store className="h-4 w-4 mr-1" /> Open seller lane queue
          </Link>
        </Button>
      )}

      <Dialog open={Boolean(reviewTarget)} onOpenChange={(open) => !open && setReviewTarget(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>{reviewAction === "approve" ? "Approve lane" : "Reject lane"}</DialogTitle>
            <DialogDescription>
              {reviewTarget ? laneLabel(reviewTarget.lane) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
            <label className="text-sm font-medium">
              Notes {reviewAction === "reject" ? "(required, shown to seller)" : "(optional)"}
            </label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={reviewAction === "reject" ? "Explain what the seller should fix…" : "Optional admin note"}
              className="mt-1"
              rows={3}
            />
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button
              onClick={() => void submitReview()}
              disabled={submitting || (reviewAction === "reject" && !reviewNotes.trim())}
              className={reviewAction === "approve" ? "text-white" : undefined}
              style={reviewAction === "approve" ? { backgroundColor: ICON_COLORS.farm } : undefined}
            >
              {submitting ? "Saving…" : reviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SellerLaneReviewPanel;
