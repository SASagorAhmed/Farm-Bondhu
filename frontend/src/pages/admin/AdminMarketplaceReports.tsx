import { motion } from "framer-motion";
import { Flag, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import AdminModerationReportsTable from "@/components/admin/AdminModerationReportsTable";
import { ICON_COLORS } from "@/lib/iconColors";

export default function AdminMarketplaceReports() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${ICON_COLORS.cart}, #dc2626)` }}
        >
          <Flag className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Chat Reports</h1>
            <Badge variant="outline" className="text-[10px]">Marketplace</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Marketplace conversation reports — open a thread in Reported Messages to respond as Platform Support.
          </p>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.cart}, #dc2626)` }} />
          <CardContent className="p-4 md:p-6">
            <AdminModerationReportsTable
              defaultTypeFilter="marketplace"
              showTypeTabs={false}
              title="Marketplace chat reports"
            />
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
