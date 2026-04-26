import { motion } from "framer-motion";
import { Shield, Users, Stethoscope, ShoppingBag, Lock, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const TrustBar = () => {
  const { t } = useLanguage();

  const badges = [
    { icon: Users, label: "10,000+", sub: t("trust.activeFarmers") },
    { icon: Stethoscope, label: "500+", sub: t("trust.verifiedVets") },
    { icon: ShoppingBag, label: "50,000+", sub: t("trust.productsListed") },
    { icon: Lock, label: "100%", sub: t("trust.securePayments") },
    { icon: Award, label: "4.9★", sub: t("trust.userRating") },
    { icon: Shield, label: "Admin", sub: t("trust.verifiedSellers") },
  ];

  return (
    <section className="py-12 bg-accent/20 border-y border-border/50 overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-8"
        >
          {t("trust.badge")}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {badges.map((b, i) => (
            <motion.div
              key={b.sub}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-card/60 border border-border/50 hover:border-primary/20 transition-all"
            >
              <b.icon size={20} className="text-primary" />
              <span className="font-display font-bold text-lg text-foreground">{b.label}</span>
              <span className="text-xs text-muted-foreground">{b.sub}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TrustBar;
