import { motion } from "framer-motion";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import marketplaceImg from "@/assets/marketplace.jpg";
import { ICON_COLORS } from "@/lib/iconColors";
import { useLanguage } from "@/contexts/LanguageContext";

const MarketplaceSection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const categories = [
    { name: t("marketplace.eggs"), emoji: "🥚" },
    { name: t("marketplace.meat"), emoji: "🥩" },
    { name: t("marketplace.milk"), emoji: "🥛" },
    { name: t("marketplace.liveAnimals"), emoji: "🐄" },
    { name: t("marketplace.feed"), emoji: "🌾" },
    { name: t("marketplace.medicine"), emoji: "💊" },
    { name: t("marketplace.vaccines"), emoji: "💉" },
    { name: t("marketplace.equipment"), emoji: "🔧" },
  ];

  return (
    <section id="marketplace" className="py-24">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden shadow-elevated">
              <img src={marketplaceImg} alt="FarmBondhu Marketplace" className="w-full h-[400px] object-cover" />
            </div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="absolute -bottom-6 -right-4 bg-card rounded-xl p-4 shadow-elevated border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ICON_COLORS.farm}1A` }}>
                  <TrendingUp size={20} style={{ color: ICON_COLORS.farm }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("marketplace.products")}</p>
                  <p className="text-xs text-muted-foreground">{t("marketplace.fromVerified")}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: ICON_COLORS.marketplace }}>
              {t("marketplace.badge")}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3 mb-4">
              {t("marketplace.title1")}{" "}
              <span className="text-gradient-gold">{t("marketplace.titleHighlight")}</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {t("marketplace.description")}
            </p>

            <div className="grid grid-cols-4 gap-3 mb-8">
              {categories.map((cat) => (
                <motion.div
                  key={cat.name}
                  whileHover={{ scale: 1.08, y: -2 }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-accent hover:bg-accent/80 transition-colors cursor-pointer border border-transparent hover:border-primary/20"
                >
                  <span className="text-2xl">{cat.emoji}</span>
                  <span className="text-xs font-medium text-foreground">{cat.name}</span>
                </motion.div>
              ))}
            </div>

            <Button
              size="lg"
              className="bg-gradient-hero text-primary-foreground shadow-card hover:opacity-90"
              onClick={() => navigate("/marketplace")}
            >
              {t("marketplace.explore")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MarketplaceSection;
