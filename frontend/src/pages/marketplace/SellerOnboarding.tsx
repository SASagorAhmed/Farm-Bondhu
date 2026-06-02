import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SellerOnboardingForm from "@/components/marketplace/SellerOnboardingForm";
import { fetchSellerOnboardingMe } from "@/lib/sellerOnboardingApi";
import { laneLabel } from "@/lib/marketplaceLaneLabels";
import { ICON_COLORS } from "@/lib/iconColors";

export default function SellerOnboarding() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const { data, refetch } = useQuery({
    queryKey: ["seller-onboarding-me", user?.id],
    enabled: Boolean(user?.id),
    queryFn: fetchSellerOnboardingMe,
  });

  const grants = data?.grants || [];
  const rejectedLanes = grants.filter((g) => g.status === "rejected").map((g) => g.lane);
  const approvedLanes = data?.approved_lanes || [];
  const pendingLanes = grants.filter((g) => g.status === "pending").map((g) => g.lane);
  const hasPending = pendingLanes.length > 0;
  const hasRejected = rejectedLanes.length > 0;
  const hasApproved = approvedLanes.length > 0;
  const hasAnyGrants = grants.length > 0;

  const handleSuccess = async () => {
    await refetch();
    await refreshProfile();
    const next = await fetchSellerOnboardingMe();
    if ((next?.approved_lanes?.length || 0) > 0) {
      navigate("/seller/dashboard");
    }
  };

  const showNewApplication = !hasPending && !hasRejected && (!hasAnyGrants || hasApproved);
  const showWaiting = hasPending && !hasApproved && !hasRejected;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Store className="h-6 w-6" style={{ color: ICON_COLORS.cart }} />
            Seller onboarding
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose categories for your shop. Admin reviews each category separately.
          </p>
        </div>
      </div>

      {(hasApproved || hasPending || hasRejected) && (
        <div className="flex flex-wrap gap-2">
          {approvedLanes.map((lane) => (
            <Badge key={`a-${lane}`} variant="secondary" className="bg-green-100 text-green-800">
              Approved: {laneLabel(lane)}
            </Badge>
          ))}
          {pendingLanes.map((lane) => (
            <Badge key={`p-${lane}`} variant="secondary" className="bg-yellow-100 text-yellow-800">
              Pending: {laneLabel(lane)}
            </Badge>
          ))}
          {rejectedLanes.map((lane) => (
            <Badge key={`r-${lane}`} variant="secondary" className="bg-red-100 text-red-800">
              Rejected: {laneLabel(lane)}
            </Badge>
          ))}
        </div>
      )}

      {hasRejected && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Resubmit rejected categories</h2>
          {grants
            .filter((g) => g.status === "rejected" && g.review_notes)
            .map((g) => (
              <p key={g.lane} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{laneLabel(g.lane)}:</span> {g.review_notes}
              </p>
            ))}
          <SellerOnboardingForm resubmitLanes={rejectedLanes} onSuccess={handleSuccess} />
        </div>
      )}

      {showNewApplication && !hasRejected && (
        <SellerOnboardingForm
          defaultBusinessName={user?.name || ""}
          defaultPhone={user?.phone || ""}
          defaultLocation={user?.location || ""}
          onSuccess={handleSuccess}
        />
      )}

      {showWaiting && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Your application is under review. You will be notified when admin approves your categories.
        </p>
      )}

      {hasApproved && (
        <div className="flex justify-center">
          <Button type="button" onClick={() => navigate("/seller/dashboard")}>
            Go to seller dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
