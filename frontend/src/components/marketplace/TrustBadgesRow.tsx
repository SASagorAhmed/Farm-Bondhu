import { BadgeCheck, ShieldCheck, Truck, Wallet } from "lucide-react";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

const TRUST_ITEMS = [
  { icon: Wallet, title: "Competitive Price", desc: "Best prices every day" },
  { icon: BadgeCheck, title: "Authentic Products", desc: "Verified sellers" },
  { icon: ShieldCheck, title: "Easy & Secure Payment", desc: "COD, bKash, Nagad" },
  { icon: Truck, title: "Fast Delivery", desc: "At your doorstep" },
];

export default function TrustBadgesRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {TRUST_ITEMS.map((item) => (
        <div
          key={item.title}
          className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card hover:shadow-sm transition-shadow"
        >
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${MARKETPLACE_THEME.trustIcon}18` }}
          >
            <item.icon className="h-5 w-5" style={{ color: MARKETPLACE_THEME.trustIcon }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
