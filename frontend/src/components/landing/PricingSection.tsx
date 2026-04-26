import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const PricingSection = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const plans = [
    {
      name: t("pricing.starter"),
      price: t("pricing.free"),
      period: "",
      description: t("features.farmManagementDesc").slice(0, 40) + "...",
      features: ["1 Farm", "Up to 100 animals", t("sidebar.production"), t("sidebar.browseProducts"), "AI Assistant", t("sidebar.community")],
      cta: t("pricing.getStartedFree"),
      popular: false,
    },
    {
      name: t("pricing.professional"),
      price: "৳999",
      period: "/month",
      description: t("features.analyticsDesc").slice(0, 40) + "...",
      features: ["5 Farms", "Unlimited animals", t("sidebar.finances"), t("sidebar.myShop"), t("sidebar.consultations"), "AI Assistant (unlimited)", t("sidebar.learningCenter"), "Priority support", t("sidebar.reports")],
      cta: t("pricing.startFreeTrial"),
      popular: true,
    },
    {
      name: t("pricing.enterprise"),
      price: "৳2,499",
      period: "/month",
      description: t("features.multiRoleDesc").slice(0, 40) + "...",
      features: ["Unlimited Farms", "Unlimited animals", "Multi-user team", t("features.analytics"), "API access", "Custom integrations", "Dedicated manager", "SLA guarantee", "White-label"],
      cta: t("pricing.contactSales"),
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <Badge className="bg-gradient-hero text-primary-foreground mb-4">{t("pricing.badge")}</Badge>
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            {t("pricing.title")}
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            {t("pricing.subtitle")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
              <Card className={`shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden relative h-full ${plan.popular ? "border-2 border-primary" : ""}`}>
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <Badge className="bg-gradient-hero text-primary-foreground rounded-none rounded-bl-lg px-3 py-1">{t("pricing.mostPopular")}</Badge>
                  </div>
                )}
                <div className={`h-1.5 ${plan.popular ? "bg-gradient-hero" : "bg-muted"}`} />
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="mb-6">
                    <h3 className="text-xl font-display font-bold text-foreground">{plan.name}</h3>
                    <div className="mt-3">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full mt-6 ${plan.popular ? "bg-gradient-hero text-primary-foreground btn-shiny" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => navigate("/signup")}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
