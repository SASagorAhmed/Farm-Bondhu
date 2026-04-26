import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";
import { useTheme } from "@/components/ThemeProvider";
import { useLanguage } from "@/contexts/LanguageContext";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const navLinks = [
    { label: t("nav.home"), href: "#home" },
    { label: t("nav.features"), href: "#features" },
    { label: t("nav.marketplace"), href: "#marketplace" },
    { label: t("nav.medibondhu"), href: "#medibondhu" },
    { label: t("nav.animals"), href: "#animals" },
    { label: t("nav.pricing"), href: "#pricing" },
    { label: t("nav.faq"), href: "#faq" },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border"
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <a href="#home" className="flex items-center">
          <BrandLogo size="md" />
        </a>

        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-accent"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            {t("nav.login")}
          </Button>
          <Button size="sm" className="btn-shiny bg-gradient-hero text-primary-foreground shadow-card hover:opacity-90" onClick={() => navigate("/signup")}>
            {t("nav.getStarted")}
          </Button>
        </div>

        <button
          className="lg:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-b border-border overflow-hidden"
          >
            <div className="flex flex-col p-4 gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-accent rounded-md transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                <Button variant="ghost" className="w-full justify-start gap-2" onClick={toggleTheme}>
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === "dark" ? t("nav.lightMode") : t("nav.darkMode")}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { setMobileOpen(false); navigate("/login"); }}>{t("nav.login")}</Button>
                <Button className="w-full btn-shiny bg-gradient-hero text-primary-foreground" onClick={() => { setMobileOpen(false); navigate("/signup"); }}>{t("nav.getStarted")}</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
