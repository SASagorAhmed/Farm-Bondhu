import { motion } from "framer-motion";
import {
  Wheat, ShoppingCart, Stethoscope, BarChart3,
  Bell, Shield, Users, Truck
} from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { useLanguage } from "@/contexts/LanguageContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

const FeaturesSection = () => {
  const { t } = useLanguage();

  const features = [
    { icon: Wheat, title: t("features.farmManagement"), description: t("features.farmManagementDesc"), iconColor: ICON_COLORS.farm },
    { icon: ShoppingCart, title: t("features.marketplace"), description: t("features.marketplaceDesc"), iconColor: ICON_COLORS.marketplace },
    { icon: Stethoscope, title: t("features.vetConsultation"), description: t("features.vetConsultationDesc"), iconColor: ICON_COLORS.vet },
    { icon: BarChart3, title: t("features.analytics"), description: t("features.analyticsDesc"), iconColor: ICON_COLORS.finance },
    { icon: Bell, title: t("features.notifications"), description: t("features.notificationsDesc"), iconColor: ICON_COLORS.bell },
    { icon: Shield, title: t("features.verified"), description: t("features.verifiedDesc"), iconColor: ICON_COLORS.admin },
    { icon: Users, title: t("features.multiRole"), description: t("features.multiRoleDesc"), iconColor: ICON_COLORS.dashboard },
    { icon: Truck, title: t("features.orderDelivery"), description: t("features.orderDeliveryDesc"), iconColor: ICON_COLORS.orders },
  ];

  return (
    <section id="features" className="py-24 bg-accent/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
            {t("features.badge")}
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mt-3 mb-4">
            {t("features.title")}{" "}
            <span className="text-gradient-primary">{t("features.titleHighlight")}</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("features.subtitle")}
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              whileHover={{ y: -6 }}
              className="group bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-all duration-300 border border-border hover:border-primary/30"
              style={{ "--glow-color": f.iconColor } as React.CSSProperties}
            >
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3"
                style={{ backgroundColor: `${f.iconColor}1A`, color: f.iconColor }}
              >
                <f.icon size={24} />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
