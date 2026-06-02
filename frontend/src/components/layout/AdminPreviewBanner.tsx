import { useNavigate } from "react-router-dom";
import { useAuth, formatUserRoleLabel, isPlatformAdmin, isSuperAdmin } from "@/contexts/AuthContext";
import { ICON_COLORS } from "@/lib/iconColors";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, ShieldAlert } from "lucide-react";

export default function AdminPreviewBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user || !isPlatformAdmin(user)) return null;

  const fullAccess = isSuperAdmin(user);

  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: `${ICON_COLORS.admin}40`,
        backgroundColor: `${ICON_COLORS.admin}0D`,
      }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" style={{ color: ICON_COLORS.admin }} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {formatUserRoleLabel(user)} preview
            {fullAccess ? " — full access" : " — read-only"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fullAccess
              ? "You can edit in this workspace. Cross-user moderation stays in Control Center."
              : "Browse only. Manage the platform from Control Center; Super Admin can edit in preview."}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => navigate("/admin")}
      >
        <LayoutDashboard className="h-4 w-4" />
        Back to Control Center
      </Button>
    </div>
  );
}
