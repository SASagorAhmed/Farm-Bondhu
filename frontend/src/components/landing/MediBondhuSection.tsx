import { motion } from "framer-motion";
import { Video, MessageSquare, FileText, Pill, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import vetImg from "@/assets/vet-consultation.jpg";
import { ICON_COLORS } from "@/lib/iconColors";
import { useLanguage } from "@/contexts/LanguageContext";

const MediBondhuSection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const benefits = [
    t("medibondhu.benefit1"),
    t("medibondhu.benefit2"),
    t("medibondhu.benefit3"),
    t("medibondhu.benefit4"),
    t("medibondhu.benefit5"),
    t("medibondhu.benefit6"),
  ];

  return (
    <section id="medibondhu" className="py-24 bg-accent/30">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: ICON_COLORS.vet }}>
              {t("medibondhu.badge")}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mt-3 mb-4">
              {t("medibondhu.title1")}{" "}
              <span style={{ color: ICON_COLORS.vet }}>{t("medibondhu.titleHighlight")}</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {t("medibondhu.description")}
            </p>

            <div className="space-y-3 mb-8">
              {benefits.map((b) => (
                <motion.div
                  key={b}
                  className="flex items-start gap-3"
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <CheckCircle2 className="mt-0.5 shrink-0" size={18} style={{ color: ICON_COLORS.farm }} />
                  <span className="text-sm text-foreground">{b}</span>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: `${ICON_COLORS.vet}1A`, color: ICON_COLORS.vet }}>
                <Video size={16} /> {t("medibondhu.videoCall")}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: `${ICON_COLORS.dashboard}1A`, color: ICON_COLORS.dashboard }}>
                <MessageSquare size={16} /> {t("medibondhu.liveChat")}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: `${ICON_COLORS.farm}1A`, color: ICON_COLORS.farm }}>
                <FileText size={16} /> {t("medibondhu.ePrescription")}
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: `${ICON_COLORS.finance}1A`, color: ICON_COLORS.finance }}>
                <Pill size={16} /> {t("medibondhu.medicineLink")}
              </div>
            </div>

            <Button
              size="lg"
              className="text-white hover:opacity-90"
              style={{ backgroundColor: ICON_COLORS.vet }}
              onClick={() => navigate("/medibondhu/vets")}
            >
              {t("medibondhu.findVet")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden shadow-elevated">
              <img src={vetImg} alt="Veterinary consultation" className="w-full h-[450px] object-cover" />
            </div>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-6 -left-4 bg-card rounded-xl p-4 shadow-elevated border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ICON_COLORS.prescription}1A` }}>
                  <FileText size={20} style={{ color: ICON_COLORS.prescription }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("medibondhu.prescriptionReady")}</p>
                  <p className="text-xs text-muted-foreground">{t("medibondhu.autoLinked")}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MediBondhuSection;
