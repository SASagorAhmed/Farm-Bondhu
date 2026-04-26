import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Globe, Palette, ShieldCheck, ArrowLeft, UserCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const navigate = useNavigate();
  const { user, hasRole, hasCapability } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [notifications, setNotifications] = useState({ orders: true, promotions: false, updates: true });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">{t("settings.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
        </div>
      </motion.div>

      <Card
        className="border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
        onClick={() => {
          const target = hasRole("vet") || hasCapability("can_consult_as_vet") ? "/vet/profile" : "/profile";
          navigate(target);
        }}
      >
        <CardContent className="flex items-center gap-3 py-4">
          <UserCircle className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{t("settings.editProfile")}</p>
            <p className="text-xs text-muted-foreground">{t("settings.editProfileDesc")}</p>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" /> {t("settings.notifications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "orders" as const, label: t("settings.orderUpdates"), desc: t("settings.orderUpdatesDesc") },
            { key: "promotions" as const, label: t("settings.promotions"), desc: t("settings.promotionsDesc") },
            { key: "updates" as const, label: t("settings.platformUpdates"), desc: t("settings.platformUpdatesDesc") },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={notifications[item.key]}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, [item.key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" /> {t("settings.language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "bn")}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="bn">বাংলা (Bangla)</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" /> {t("settings.appearance")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("settings.appearanceDesc")}</p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> {t("settings.privacy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("settings.privacyDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
