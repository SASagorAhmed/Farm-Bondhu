import { Headphones } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import AdminChatInbox from "@/components/marketplace/AdminChatInbox";

export default function AdminCustomerSupport() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Headphones className="h-7 w-7" style={{ color: ICON_COLORS.admin }} />
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Customer Support</h1>
          <p className="text-muted-foreground mt-1">
            Help and complaint chats from all users — separate from marketplace seller messages.
          </p>
        </div>
      </motion.div>
      <AdminChatInbox scope="platform_support" />
    </div>
  );
}
