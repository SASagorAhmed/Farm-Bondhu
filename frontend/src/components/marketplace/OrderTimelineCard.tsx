import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, CheckCircle2, Truck, Clock, XCircle, RotateCcw } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

export type OrderTimelineEvent = {
  status: string;
  timestamp: string;
  note?: string;
};

const STATUS_STEPS = [
  { status: "pending", label: "Order Placed", icon: Clock },
  { status: "confirmed", label: "Seller Confirmed", icon: CheckCircle2 },
  { status: "packed", label: "Packed", icon: Package },
  { status: "shipped", label: "Shipped", icon: Truck },
  { status: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
] as const;

const statusColors: Record<string, string> = {
  pending: ICON_COLORS.finance,
  confirmed: MARKETPLACE_THEME.primary,
  packed: MARKETPLACE_THEME.primary,
  shipped: MARKETPLACE_THEME.primary,
  out_for_delivery: ICON_COLORS.farm,
  delivered: ICON_COLORS.farm,
  cancelled: ICON_COLORS.health,
  return_requested: ICON_COLORS.finance,
  returned: ICON_COLORS.health,
  refunded: ICON_COLORS.finance,
};

type OrderTimelineCardProps = {
  status: string;
  trackingId?: string | null;
  estimatedDelivery?: string | null;
  timeline?: OrderTimelineEvent[] | null;
  returnReason?: string | null;
  progressAccent?: string;
};

function normalizeTimeline(timeline?: OrderTimelineEvent[] | null): OrderTimelineEvent[] {
  if (!timeline) return [];
  if (Array.isArray(timeline)) return timeline;
  return [];
}

export default function OrderTimelineCard({
  status,
  trackingId,
  estimatedDelivery,
  timeline,
  returnReason,
  progressAccent = MARKETPLACE_THEME.primary,
}: OrderTimelineCardProps) {
  const events = normalizeTimeline(timeline);
  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.status === status);
  const isCancelled = status === "cancelled";
  const isReturned = ["return_requested", "returned", "refunded"].includes(status);

  return (
    <div className="space-y-4">
      {!isCancelled && !isReturned && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${progressAccent}, ${ICON_COLORS.farm})` }} />
          <CardHeader>
            <CardTitle className="font-display">Order Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between relative overflow-x-auto pb-2">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-border min-w-[480px]" />
              <div
                className="absolute top-5 left-0 h-0.5 transition-all duration-500 min-w-0"
                style={{
                  width: `${Math.max(0, (currentStepIndex / (STATUS_STEPS.length - 1)) * 100)}%`,
                  backgroundColor: progressAccent,
                }}
              />
              {STATUS_STEPS.map((step, i) => {
                const done = i <= currentStepIndex;
                const current = i === currentStepIndex;
                return (
                  <div
                    key={step.status}
                    className="flex flex-col items-center relative z-10 shrink-0"
                    style={{ width: `${100 / STATUS_STEPS.length}%`, minWidth: 72 }}
                  >
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${current ? "ring-4 ring-offset-2 ring-sky-300/40" : ""}`}
                      style={{
                        backgroundColor: done ? progressAccent : "hsl(var(--muted))",
                        color: done ? "white" : "hsl(var(--muted-foreground))",
                      }}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className={`text-[10px] sm:text-xs mt-2 text-center ${done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {trackingId && (
              <div className="mt-6 p-3 rounded-lg bg-accent/30 flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4" style={{ color: progressAccent }} />
                <span className="text-muted-foreground">Tracking ID:</span>
                <span className="font-mono font-bold text-foreground">{trackingId}</span>
              </div>
            )}
            {estimatedDelivery && status !== "delivered" && (
              <p className="mt-3 text-sm text-muted-foreground">
                Estimated delivery: <span className="font-medium text-foreground">{estimatedDelivery}</span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(isCancelled || isReturned) && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ backgroundColor: ICON_COLORS.health }} />
          <CardContent className="p-6 flex items-center gap-4">
            {isCancelled ? (
              <XCircle className="h-8 w-8" style={{ color: ICON_COLORS.health }} />
            ) : (
              <RotateCcw className="h-8 w-8" style={{ color: ICON_COLORS.finance }} />
            )}
            <div>
              <p className="font-bold text-foreground">
                {isCancelled
                  ? "Order Cancelled"
                  : `Return ${status === "return_requested" ? "Requested" : status === "returned" ? "Completed" : "Refunded"}`}
              </p>
              {returnReason && <p className="text-sm text-muted-foreground">Reason: {returnReason}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {events.length > 0 && (
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${progressAccent}, ${ICON_COLORS.vet})` }} />
          <CardHeader>
            <CardTitle className="font-display">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...events].reverse().map((event, i) => (
                <div key={`${event.timestamp}-${i}`} className="flex items-start gap-3">
                  <div
                    className="h-3 w-3 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: statusColors[event.status] || progressAccent }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">{event.status.replace(/_/g, " ")}</p>
                    {event.note && <p className="text-xs text-muted-foreground">{event.note}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString("en-GB")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export { statusColors as orderStatusColors };
