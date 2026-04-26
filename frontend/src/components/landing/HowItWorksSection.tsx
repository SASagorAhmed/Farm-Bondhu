import { motion } from "framer-motion";
import { UserPlus, Settings, ShoppingCart, Stethoscope } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { useLanguage } from "@/contexts/LanguageContext";

const HowItWorksSection = () => {
  const { t } = useLanguage();

  const steps = [
    { icon: UserPlus, step: "01", title: t("howItWorks.step1Title"), description: t("howItWorks.step1Desc"), iconColor: ICON_COLORS.dashboard },
    { icon: Settings, step: "02", title: t("howItWorks.step2Title"), description: t("howItWorks.step2Desc"), iconColor: ICON_COLORS.farm },
    { icon: ShoppingCart, step: "03", title: t("howItWorks.step3Title"), description: t("howItWorks.step3Desc"), iconColor: ICON_COLORS.marketplace },
    { icon: Stethoscope, step: "04", title: t("howItWorks.step4Title"), description: t("howItWorks.step4Desc"), iconColor: ICON_COLORS.vet },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-gradient-hero relative overflow-hidden">
      <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-secondary/10 blur-3xl" />
      <div className="absolute bottom-20 left-20 w-48 h-48 rounded-full bg-primary-foreground/5 blur-2xl" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold text-primary-foreground uppercase tracking-wider">
            {t("howItWorks.badge")}
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mt-3 mb-4 text-shadow-md">
            {t("howItWorks.title")}
          </h2>
          <p className="text-primary-foreground/90 text-lg text-shadow-sm">
            {t("howItWorks.subtitle")}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative"
            >
              <div className="bg-card/95 rounded-2xl p-6 border border-secondary/30 shadow-elevated hover:bg-card transition-colors">
                <div className="text-5xl font-display font-bold text-primary mb-4">
                  {s.step}
                </div>
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 border border-secondary/30"
                  style={{ backgroundColor: `${s.iconColor}1A`, color: s.iconColor }}
                >
                  <s.icon size={24} />
                </div>
                <h3 className="font-display text-lg font-semibold text-card-foreground mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-secondary/30" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
