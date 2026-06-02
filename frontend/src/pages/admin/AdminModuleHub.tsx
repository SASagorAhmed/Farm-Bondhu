import { useNavigate } from "react-router-dom";
import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { ADMIN_MODULE_HUB_ITEMS } from "@/lib/adminModules";
import { ICON_COLORS } from "@/lib/iconColors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminModuleHub() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Control Center</h1>
          {user && (
            <Badge variant="secondary" style={{ backgroundColor: `${ICON_COLORS.admin}20`, color: ICON_COLORS.admin }}>
              {formatUserRoleLabel(user)}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Choose a module to manage. Each workspace shows only the controls for that area.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_MODULE_HUB_ITEMS.map((mod, i) => (
          <motion.div
            key={mod.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className="shadow-card cursor-pointer hover:shadow-md transition-shadow overflow-hidden group h-full"
              onClick={() => navigate(mod.defaultPath)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(mod.defaultPath);
                }
              }}
            >
              <div className="h-1" style={{ backgroundColor: mod.color }} />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${mod.color}18` }}
                  >
                    <mod.icon className="h-5 w-5" style={{ color: mod.color }} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                </div>
                <CardTitle className="text-base font-display pt-2">{mod.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
                <p className="text-[10px] text-muted-foreground mt-3 font-medium uppercase tracking-wider">
                  {mod.navItems.length} control{mod.navItems.length === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
