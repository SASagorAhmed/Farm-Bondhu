import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Copy, Eye } from "lucide-react";
import { shopPath } from "@/lib/marketplaceShopApi";
import { toast } from "sonner";

interface Props {
  sellerId: string;
  onPreview?: () => void;
  variant?: "seller" | "admin";
}

export default function SellerStorefrontToolbar({ sellerId, onPreview, variant = "seller" }: Props) {
  const isAdmin = variant === "admin";
  const publicUrl = `${window.location.origin}${shopPath(sellerId)}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Shop link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="pb-4 mb-4 border-b border-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isAdmin ? "Official shop storefront" : "My Shop"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? "Manage FarmBondhu shop layout — pin featured products and update branding for buyers."
              : "Arrange how buyers see your products — pin featured items and edit your storefront."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5" /> Copy link
          </Button>
          {onPreview ? (
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onPreview}>
              <Eye className="h-3.5 w-3.5" /> Preview as buyer
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
              <Link to={`${shopPath(sellerId)}?preview=1`}>
                <Eye className="h-3.5 w-3.5" /> Preview as buyer
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
