import { Flag } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";

export default function ChatReportStatusBanner() {
  return (
    <div
      className="mx-3 mt-2 mb-1 rounded-lg border px-3 py-2 text-xs flex items-start gap-2"
      style={{ backgroundColor: `${ICON_COLORS.admin}0D`, borderColor: `${ICON_COLORS.admin}33` }}
    >
      <Flag className="h-4 w-4 shrink-0 mt-0.5" style={{ color: ICON_COLORS.admin }} />
      <p className="text-foreground">
        Report under review — FarmBondhu support has been notified and will review this conversation.
      </p>
    </div>
  );
}
