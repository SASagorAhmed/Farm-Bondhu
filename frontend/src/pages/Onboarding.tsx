import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Warehouse, PawPrint, ShoppingCart, Stethoscope, CheckCircle2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/farmbondhu_no_bg.png";

const steps = [
  {
    title: "Welcome to FarmBondhu!",
    description: "Your smart livestock management platform. Let's get you set up in a few quick steps.",
    icon: CheckCircle2,
  },
  {
    title: "Set Up Your Farm",
    description: "Create your first farm with details like name, location, and type. You can manage multiple farms from one dashboard.",
    icon: Warehouse,
    action: "Go to Farms",
    route: "/dashboard/farms",
  },
  {
    title: "Add Your Animals",
    description: "Register your livestock — use batch tracking for poultry or individual tracking for cattle and goats.",
    icon: PawPrint,
    action: "Go to Animals",
    route: "/dashboard/animals",
  },
  {
    title: "Explore the Marketplace",
    description: "Buy feed, medicine, equipment, and more from trusted vendors. Or sell your own farm products!",
    icon: ShoppingCart,
    action: "Browse Marketplace",
    route: "/marketplace",
  },
  {
    title: "Book a Veterinarian",
    description: "Find experienced vets specializing in your animal types. Book online consultations instantly.",
    icon: Stethoscope,
    action: "Find a Vet",
    route: "/medibondhu",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src={logo} alt="FarmBondhu" className="h-12 w-12 object-contain" />
          <span className="font-display text-2xl font-bold text-gradient-primary">FarmBondhu</span>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? "bg-gradient-hero" : "bg-muted"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
            <Card className="shadow-elevated overflow-hidden">
              <div className="h-1.5 bg-gradient-hero" />
              <CardContent className="p-8 text-center space-y-6">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-hero flex items-center justify-center text-primary-foreground">
                  <Icon className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-bold text-foreground">{current.title}</h2>
                  <p className="text-muted-foreground mt-2">{current.description}</p>
                  {step === 0 && user && <p className="text-primary font-medium mt-3">Welcome, {user.name}!</p>}
                </div>
                <div className="flex gap-3 justify-center pt-2">
                  {step > 0 && (
                    <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
                  )}
                  {current.action && current.route && (
                    <Button variant="outline" onClick={() => navigate(current.route!)}>
                      {current.action}
                    </Button>
                  )}
                  {isLast ? (
                    <Button className="bg-gradient-hero text-primary-foreground" onClick={() => navigate("/dashboard")}>
                      Go to Dashboard <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button className="bg-gradient-hero text-primary-foreground" onClick={() => setStep(step + 1)}>
                      Next <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <button onClick={() => navigate("/dashboard")} className="hover:text-primary transition-colors underline">Skip setup →</button>
        </p>
      </motion.div>
    </div>
  );
}
