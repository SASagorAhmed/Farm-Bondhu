import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getPostLoginPath } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AccessDenied() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);
  const homeRoute = user ? getPostLoginPath(user) : "/";

  const handleRefreshAccess = async () => {
    setRefreshing(true);
    try {
      await refreshProfile({ force: true });
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(homeRoute, { replace: true });
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="shadow-elevated border-0 overflow-hidden">
          <div className="h-1.5 bg-destructive" />
          <CardContent className="p-8 text-center space-y-5">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">{t("accessDenied.title")}</h2>
              <p className="text-muted-foreground mt-2">{t("accessDenied.description")}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={() => void handleRefreshAccess()}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t("accessDenied.refreshAccess")}
              </Button>
              <Link to={homeRoute}>
                <Button className="w-full bg-gradient-hero text-primary-foreground">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("accessDenied.goHome")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
