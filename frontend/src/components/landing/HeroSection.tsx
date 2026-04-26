import { motion } from "framer-motion";
import { ArrowRight, Play, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroImg from "@/assets/hero-farm.jpg";
import { useLanguage } from "@/contexts/LanguageContext";

const FloatingParticle = ({ delay, x, y, size }: { delay: number; x: string; y: string; size: number }) => (
  <motion.div
    className="absolute rounded-full bg-secondary/30"
    style={{ left: x, top: y, width: size, height: size }}
    animate={{ y: [0, -20, 0], opacity: [0.3, 0.7, 0.3] }}
    transition={{ repeat: Infinity, duration: 4, delay, ease: "easeInOut" }}
  />
);

const HeroSection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const stats = [
    { value: "10K+", label: t("hero.activeFarmers") },
    { value: "500+", label: t("hero.veterinarians") },
    { value: "50K+", label: t("hero.productsListed") },
    { value: "99%", label: t("hero.satisfaction") },
  ];

  const scrollToHowItWorks = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="home" className="relative min-h-screen flex items-center pt-16 overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImg} alt="Modern livestock farm" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(240,20%,10%)]/85 via-[hsl(240,20%,10%)]/60 to-[hsl(240,20%,10%)]/30" />
      </div>

      <FloatingParticle delay={0} x="10%" y="20%" size={6} />
      <FloatingParticle delay={1} x="80%" y="30%" size={4} />
      <FloatingParticle delay={2} x="60%" y="70%" size={5} />
      <FloatingParticle delay={0.5} x="25%" y="60%" size={3} />
      <FloatingParticle delay={1.5} x="75%" y="15%" size={7} />
      <FloatingParticle delay={3} x="90%" y="55%" size={4} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm font-medium backdrop-blur-sm border border-secondary/30 mb-6 text-shadow-sm">
              <Shield size={14} />
              {t("hero.badge")}
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="font-display text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6 text-shadow-lg"
            style={{ color: "hsl(0 0% 100%)" }}
          >
            {t("hero.title1")}{" "}
            <span className="text-gradient-gold">{t("hero.titleHighlight")}</span>{" "}
            {t("hero.title2")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg sm:text-xl max-w-2xl mb-8 leading-relaxed text-shadow-md"
            style={{ color: "hsl(0 0% 85%)" }}
          >
            {t("hero.description")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="flex flex-wrap gap-4 mb-12"
          >
            <Button
              size="lg"
              className="btn-shiny bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90 text-base px-8"
              onClick={() => navigate("/signup")}
            >
              {t("hero.startTrial")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="bg-primary-foreground/15 backdrop-blur-md border border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/25 text-base px-8"
              onClick={scrollToHowItWorks}
            >
              <Play className="mr-2 h-5 w-5" />
              {t("hero.watchDemo")}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-6"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center sm:text-left">
                <div className="font-display text-2xl sm:text-3xl font-bold text-secondary text-shadow-sm">
                  {stat.value}
                </div>
                <div className="text-sm" style={{ color: "hsl(0 0% 75%)" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
