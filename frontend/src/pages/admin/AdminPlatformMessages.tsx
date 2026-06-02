import { motion } from "framer-motion";
import { MessageCircle, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AdminChatInbox from "@/components/marketplace/AdminChatInbox";
import { ICON_COLORS } from "@/lib/iconColors";

export default function AdminPlatformMessages() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${ICON_COLORS.admin}, #7c3aed)` }}
        >
          <MessageCircle className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Reported Messages</h1>
            <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${ICON_COLORS.admin}1A`, color: ICON_COLORS.admin }}>
              <Shield className="h-3 w-3 mr-0.5" /> Admin
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Marketplace conversations that users reported only. Reply as Platform Support when a report is pending.
          </p>
        </div>
      </motion.div>

      <AdminChatInbox scope="reported" />
    </div>
  );
}
