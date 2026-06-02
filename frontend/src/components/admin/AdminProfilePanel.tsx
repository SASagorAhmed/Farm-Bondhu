import { useNavigate } from "react-router-dom";
import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  LayoutDashboard,
  Users,
  Shield,
  Bell,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

const QUICK_LINKS = [
  { title: "Users", url: "/admin/users", icon: Users, color: ICON_COLORS.users },
  { title: "Admin Team", url: "/admin/team", icon: Shield, color: ICON_COLORS.shield },
  { title: "Approvals", url: "/admin/approvals", icon: Shield, color: ICON_COLORS.shield },
  { title: "Broadcast", url: "/admin/broadcast", icon: Bell, color: ICON_COLORS.heartPulse },
  { title: "Reports", url: "/admin/reports", icon: TrendingUp, color: ICON_COLORS.trending },
] as const;

export default function AdminProfilePanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user?.primaryRole !== "admin") return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Platform administration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the platform from the Control Center. Doctor and vet profiles are managed in their
          respective admin modules, not on your personal account.
        </p>
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ backgroundColor: ICON_COLORS.admin }} />
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" style={{ color: ICON_COLORS.admin }} />
            Admin access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-red-100 text-red-800">{formatUserRoleLabel(user)}</Badge>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            style={{ backgroundColor: ICON_COLORS.admin }}
            onClick={() => navigate("/admin")}
          >
            Open Control Center
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Platform shortcuts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Button
              key={link.url}
              type="button"
              variant="outline"
              className="justify-between h-auto py-3 px-4"
              onClick={() => navigate(link.url)}
            >
              <span className="flex items-center gap-2">
                <link.icon className="h-4 w-4 shrink-0" style={{ color: link.color }} />
                {link.title}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
