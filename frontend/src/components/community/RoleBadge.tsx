import { Badge } from "@/components/ui/badge";
import { ICON_COLORS } from "@/lib/iconColors";

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  farmer: { label: "Farmer", color: ICON_COLORS.farm },
  buyer: { label: "Buyer", color: ICON_COLORS.cart },
  vendor: { label: "Vendor", color: ICON_COLORS.store },
  vet: { label: "Verified Vet", color: ICON_COLORS.medibondhu },
  admin: { label: "Admin", color: ICON_COLORS.admin },
};

export default function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] || { label: role, color: "#6B7280" };
  return (
    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-semibold" style={{ borderColor: config.color, color: config.color }}>
      {config.label}
    </Badge>
  );
}
