import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, scale: 0.9 }, show: { opacity: 1, scale: 1, transition: { duration: 0.4 } } };

const AnimalsSection = () => {
  const { t } = useLanguage();

  const animals = [
    { name: t("animals.chicken"), emoji: "🐔", products: t("marketplace.eggs") + ", " + t("marketplace.meat"), type: t("animals.poultry") },
    { name: t("animals.duck"), emoji: "🦆", products: t("marketplace.eggs") + ", " + t("marketplace.meat"), type: t("animals.poultry") },
    { name: t("animals.turkey"), emoji: "🦃", products: t("marketplace.meat"), type: t("animals.poultry") },
    { name: t("animals.cow"), emoji: "🐄", products: t("marketplace.milk") + ", " + t("marketplace.meat"), type: t("animals.cattle") },
    { name: t("animals.bull"), emoji: "🐂", products: t("marketplace.meat"), type: t("animals.cattle") },
    { name: t("animals.goat"), emoji: "🐐", products: t("marketplace.milk") + ", " + t("marketplace.meat"), type: t("animals.smallRuminant") },
    { name: t("animals.sheep"), emoji: "🐑", products: t("marketplace.meat"), type: t("animals.smallRuminant") },
  ];

  return (
    <section id="animals" className="py-24 bg-gradient-to-b from-accent/20 via-background to-accent/10">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-sm font-semibold text-secondary uppercase tracking-wider">
            {t("animals.badge")}
          </span>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mt-3 mb-4">
            {t("animals.title1")} <span className="text-gradient-gold">{t("animals.titleHighlight")}</span> {t("animals.title2")}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("animals.subtitle")}
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4"
        >
          {animals.map((a) => (
            <motion.div
              key={a.name}
              variants={item}
              whileHover={{ y: -8, scale: 1.05 }}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border shadow-card hover:shadow-elevated transition-all cursor-pointer group"
            >
              <motion.span
                className="text-5xl"
                whileHover={{ scale: 1.2, rotate: [0, -8, 8, 0] }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {a.emoji}
              </motion.span>
              <div className="text-center">
                <h3 className="font-display font-semibold text-foreground">{a.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{a.type}</p>
                <p className="text-xs text-primary font-medium mt-1">{a.products}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default AnimalsSection;
