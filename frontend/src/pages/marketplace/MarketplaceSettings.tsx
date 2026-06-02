import { motion } from "framer-motion";
import { Settings } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ICON_COLORS } from "@/lib/iconColors";
import ChatNotificationSoundSettings from "@/components/marketplace/ChatNotificationSoundSettings";

export default function MarketplaceSettings() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7" style={{ color: ICON_COLORS.marketplace }} />
          {t("marketplace.settings.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("marketplace.settings.subtitle")}</p>
      </motion.div>

      <ChatNotificationSoundSettings />
    </div>
  );
}
