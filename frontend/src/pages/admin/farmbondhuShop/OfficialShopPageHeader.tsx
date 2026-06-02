import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { useOfficialShop } from "./OfficialShopProvider";

export default function OfficialShopPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const { shopName } = useOfficialShop();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start justify-between flex-wrap gap-3"
    >
      <div className="flex items-center gap-3 min-w-0">
        <ShieldCheck className="h-7 w-7 shrink-0" style={{ color: ICON_COLORS.farm }} />
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1">
            {description ?? `${shopName} — official platform shop (admin tools)`}
          </p>
        </div>
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </motion.div>
  );
}
