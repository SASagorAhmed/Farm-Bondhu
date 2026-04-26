import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const CTASection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <section className="py-24 bg-accent/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="bg-gradient-hero rounded-3xl p-12 sm:p-16 text-center relative overflow-hidden"
        >
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-secondary/15 blur-2xl" />
          <div className="absolute bottom-10 right-10 w-56 h-56 rounded-full bg-primary-foreground/5 blur-3xl" />
          <motion.div
            className="absolute top-1/4 right-1/4 w-3 h-3 rounded-full bg-secondary/40"
            animate={{ y: [0, -15, 0], x: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/3 left-1/3 w-2 h-2 rounded-full bg-primary-foreground/20"
            animate={{ y: [0, 12, 0], x: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1 }}
          />
          <motion.div
            className="absolute top-1/2 left-[15%] w-4 h-4 rounded-full bg-secondary/20"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 2 }}
          />

          <div className="relative z-10">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4">
              {t("cta.title")}
            </h2>
            <p className="text-primary-foreground/80 text-lg max-w-xl mx-auto mb-8">
              {t("cta.description")}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button
                size="lg"
                className="btn-shiny bg-primary-foreground/20 backdrop-blur-md border border-primary-foreground/40 text-primary-foreground shadow-elevated hover:bg-primary-foreground/30 text-base px-8 font-semibold"
                onClick={() => navigate("/signup")}
              >
                {t("cta.startTrial")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                className="bg-primary-foreground/10 backdrop-blur-md border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/20 text-base px-8"
                asChild
              >
                <a href="mailto:support@farmbondhu.com">{t("cta.contactSales")}</a>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
