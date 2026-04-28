import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getDefaultRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, EyeOff, LogIn, Mail, Lock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, user, authzHydrating } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (isAuthenticated && authzHydrating) {
      navigate("/home", { replace: true });
      return;
    }
    if (isAuthenticated && user && !authzHydrating) {
      navigate(getDefaultRoute(user.primaryRole), { replace: true });
    }
  }, [authzHydrating, isAuthenticated, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      toast({ title: "Welcome!", description: "Logged in successfully" });
    } else {
      toast({ title: "Login Failed", description: result.error || "Invalid email or password", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-4 relative">
      <Link to="/" className="absolute top-4 left-4 flex items-center gap-1.5 text-primary-foreground/80 hover:text-primary-foreground transition-colors text-sm font-medium">
        <ArrowLeft className="h-4 w-4" />
        {t("auth.backToHome")}
      </Link>
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-4xl font-display font-bold text-primary-foreground">🐄 FarmBondhu</h1>
          </Link>
          <p className="text-primary-foreground/80 mt-2 font-body">{t("auth.smartCompanion")}</p>
        </div>

        <Card className="shadow-elevated border-0 overflow-hidden">
          <div className="h-1 bg-gradient-hero" />
          <CardHeader className="text-center pb-2">
            <h2 className="text-2xl font-display font-bold text-foreground">{t("auth.signIn")}</h2>
            <p className="text-muted-foreground text-sm">{t("auth.accessAccount")}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-input" />
                  <span className="text-muted-foreground">{t("auth.rememberMe")}</span>
                </label>
                <Link to="/forgot-password" className="text-primary hover:underline">{t("auth.forgotPassword")}</Link>
              </div>

              <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground btn-shiny" size="lg" disabled={loading}>
                <LogIn className="mr-2 h-4 w-4" />
                {loading ? t("auth.signingIn") : t("auth.signIn")}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-muted-foreground text-sm">
                {t("auth.noAccount")}{" "}
                <Link to="/signup" state={{ from: "login" }} className="text-primary font-semibold hover:underline">{t("auth.register")}</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
