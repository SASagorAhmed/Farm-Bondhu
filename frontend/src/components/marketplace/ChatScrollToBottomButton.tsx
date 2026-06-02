import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import { cn } from "@/lib/utils";

interface ChatScrollToBottomButtonProps {
  visible: boolean;
  onClick: () => void;
  className?: string;
}

export default function ChatScrollToBottomButton({
  visible,
  onClick,
  className,
}: ChatScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      aria-label="Scroll to latest messages"
      onClick={onClick}
      className={cn(
        "absolute bottom-3 left-1/2 z-10 h-9 w-9 -translate-x-1/2 rounded-full shadow-md bg-background/95 backdrop-blur-sm",
        className
      )}
    >
      <ChevronDown className="h-5 w-5" style={{ color: MARKETPLACE_THEME.primary }} />
    </Button>
  );
}
