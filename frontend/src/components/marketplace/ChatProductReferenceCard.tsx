import { ExternalLink, MapPin, Star } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import type { ChatProductReference } from "@/lib/marketplaceChatProduct";
import { cn } from "@/lib/utils";

interface ChatProductReferenceCardProps {
  product: ChatProductReference;
  onClick: () => void;
  highlight?: boolean;
  variant?: "full" | "compact";
  className?: string;
}

export default function ChatProductReferenceCard({
  product,
  onClick,
  highlight = false,
  variant = "full",
  className,
}: ChatProductReferenceCardProps) {
  const compact = variant === "compact";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-muted/30 hover:bg-muted/60 transition-all text-left w-full",
        compact ? "mx-3 mb-3 p-2" : "mx-3 mb-3 p-2.5",
        highlight && "ring-2 ring-offset-1",
        className
      )}
      style={highlight ? { borderColor: MARKETPLACE_THEME.primary, ringColor: MARKETPLACE_THEME.primary } : undefined}
    >
      <img
        src={product.image}
        alt={product.name}
        className={cn("rounded-md object-cover bg-accent shrink-0", compact ? "h-10 w-10" : "h-12 w-12")}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="font-semibold" style={{ color: ICON_COLORS.health }}>
            ৳{product.price}
          </span>
          {!compact && product.rating != null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3" style={{ color: ICON_COLORS.finance, fill: ICON_COLORS.finance }} />
              {product.rating}
            </span>
          )}
          {!compact && product.location && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {product.location}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
