import { Check, CheckCheck } from "lucide-react";
import type { ReceiptStatus } from "@/lib/marketplaceChatReceipts";
import { cn } from "@/lib/utils";

const LABELS: Record<ReceiptStatus, string> = {
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  seen: "Seen",
};

interface ChatMessageReceiptProps {
  status: ReceiptStatus;
  className?: string;
  onPrimaryBubble?: boolean;
}

export default function ChatMessageReceipt({ status, className, onPrimaryBubble }: ChatMessageReceiptProps) {
  const label = LABELS[status];
  const muted = onPrimaryBubble ? "text-primary-foreground/60" : "text-muted-foreground";
  const seenColor = onPrimaryBubble ? "text-sky-200" : "text-sky-500";

  if (status === "sending") {
    return (
      <span className={cn("inline-flex items-center text-[10px]", muted, className)} aria-label={label}>
        ···
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span className={cn("inline-flex items-center", muted, className)} aria-label={label} title={label}>
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span className={cn("inline-flex items-center", muted, className)} aria-label={label} title={label}>
        <CheckCheck className="h-3 w-3" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", seenColor, className)} aria-label={label} title={label}>
      <CheckCheck className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}
