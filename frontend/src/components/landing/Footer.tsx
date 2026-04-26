import { Mail, Phone, MapPin, ArrowUp, Facebook, Youtube, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { useLanguage } from "@/contexts/LanguageContext";

const Footer = () => {
  const { t } = useLanguage();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-[hsl(240,20%,10%)] py-16 relative">
      <div className="container mx-auto px-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logo} alt="FarmBondhu" className="h-8 w-8 object-contain" />
              <span className="font-display text-lg font-bold text-primary-foreground">FarmBondhu</span>
            </div>
            <p className="text-sm text-primary-foreground/60 leading-relaxed mb-4">
              {t("footer.description")}
            </p>
            <div className="flex gap-3">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/60 hover:bg-primary-foreground/20 hover:text-secondary transition-colors">
                <Facebook size={16} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/60 hover:bg-primary-foreground/20 hover:text-secondary transition-colors">
                <Youtube size={16} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-primary-foreground/10 flex items-center justify-center text-primary-foreground/60 hover:bg-primary-foreground/20 hover:text-secondary transition-colors">
                <Linkedin size={16} />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4">{t("footer.platform")}</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/60">
              <li><a href="#features" className="hover:text-secondary transition-colors">{t("footer.farmManagement")}</a></li>
              <li><a href="#marketplace" className="hover:text-secondary transition-colors">{t("nav.marketplace")}</a></li>
              <li><a href="#medibondhu" className="hover:text-secondary transition-colors">{t("nav.medibondhu")}</a></li>
              <li><a href="#pricing" className="hover:text-secondary transition-colors">{t("nav.pricing")}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4">{t("footer.company")}</h4>
            <ul className="space-y-2 text-sm text-primary-foreground/60">
              <li><a href="#" className="hover:text-secondary transition-colors">{t("footer.aboutUs")}</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors">{t("footer.careers")}</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors">{t("footer.blog")}</a></li>
              <li><a href="#faq" className="hover:text-secondary transition-colors">{t("nav.faq")}</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-primary-foreground mb-4">{t("footer.contact")}</h4>
            <ul className="space-y-3 text-sm text-primary-foreground/60">
              <li className="flex items-center gap-2"><Mail size={14} /> support@farmbondhu.com</li>
              <li className="flex items-center gap-2"><Phone size={14} /> +880 1234-567890</li>
              <li className="flex items-center gap-2"><MapPin size={14} /> Dhaka, Bangladesh</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 pt-8 flex items-center justify-between">
          <p className="text-sm text-primary-foreground/40">
            © {new Date().getFullYear()} FarmBondhu. {t("footer.allRights")}
          </p>
          <Button
            size="icon"
            variant="ghost"
            className="text-primary-foreground/40 hover:text-secondary hover:bg-primary-foreground/10 rounded-lg"
            onClick={scrollToTop}
            aria-label="Back to top"
          >
            <ArrowUp size={18} />
          </Button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
