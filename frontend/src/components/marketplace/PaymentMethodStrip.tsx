const METHODS = [
  { id: "cod", label: "COD", color: "#16A34A" },
  { id: "bkash", label: "bKash", color: "#E2136E" },
  { id: "nagad", label: "Nagad", color: "#F6921E" },
  { id: "card", label: "Card", color: "#2563EB" },
  { id: "upay", label: "UPAY", color: "#6B21A8" },
];

interface Props {
  compact?: boolean;
}

export default function PaymentMethodStrip({ compact = false }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "justify-center py-2"}`}>
      {!compact && <span className="text-xs text-muted-foreground w-full text-center mb-1">Secure payment methods</span>}
      {METHODS.map((m) => (
        <div
          key={m.id}
          className="px-3 py-1.5 rounded-md border border-border/80 bg-muted/30 text-xs font-semibold"
          style={{ color: m.color }}
        >
          {m.label}
        </div>
      ))}
    </div>
  );
}
