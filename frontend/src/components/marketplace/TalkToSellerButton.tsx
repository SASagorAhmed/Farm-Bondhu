import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import { cn } from "@/lib/utils";

interface TalkToSellerButtonProps {
  sellerId: string;
  productId: string;
  variant?: "default" | "compact" | "icon" | "chatNow";
  className?: string;
  stopPropagation?: boolean;
  hideWhenOwnListing?: boolean;
}

function isOwnListing(userId: string | undefined, sellerId: string): boolean {
  if (!userId || !sellerId) return false;
  return userId.toLowerCase() === sellerId.toLowerCase();
}

export default function TalkToSellerButton({
  sellerId,
  productId,
  variant = "default",
  className,
  stopPropagation = false,
  hideWhenOwnListing = false,
}: TalkToSellerButtonProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const ownListing = isOwnListing(user?.id, sellerId);
  if (hideWhenOwnListing && ownListing) return null;

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (!isAuthenticated) {
      toast.error("Please login to message the seller");
      return;
    }
    if (!sellerId || !productId) {
      toast.error("Unable to start chat for this product");
      return;
    }
    navigate(`/marketplace/chat/new?seller=${sellerId}&product=${productId}`);
  };

  const style = {
    borderColor: MARKETPLACE_THEME.primary,
    color: MARKETPLACE_THEME.primary,
    backgroundColor: `${MARKETPLACE_THEME.primary}10`,
  };

  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant="outline"
        className={cn("h-8 w-8 shrink-0", className)}
        style={style}
        onClick={handleClick}
        aria-label={ownListing ? "Chat about your listing" : "Message seller"}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    );
  }

  if (variant === "chatNow") {
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn("text-xs font-semibold shrink-0", className)}
        style={style}
        onClick={handleClick}
      >
        <MessageCircle className="h-3.5 w-3.5 mr-1" />
        Chat Now
      </Button>
    );
  }

  if (variant === "compact") {
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn("text-xs shrink-0", className)}
        style={style}
        onClick={handleClick}
      >
        <MessageCircle className="h-3.5 w-3.5 mr-1" />
        Chat
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      className={cn("shrink-0", className)}
      style={style}
      onClick={handleClick}
    >
      <MessageCircle className="h-4 w-4 mr-2" />
      {ownListing ? "Chat Now" : "Talk with Seller"}
    </Button>
  );
}
