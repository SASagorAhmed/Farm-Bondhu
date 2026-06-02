import { useNavigate } from "react-router-dom";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Warehouse, ShoppingCart, Stethoscope, BookOpen, MessageSquareText } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { useAuth, isPlatformAdmin, canAccessWorkspace, type WorkspaceKey } from "@/contexts/AuthContext";

interface WorkspaceTarget {
  label: string;
  adminLabel: string;
  /** Collapsed sidebar tooltip; defaults to label without the “Go to ” prefix. */
  tooltip?: string;
  url: string;
  icon: React.ElementType;
  color: string;
}

const ALL_WORKSPACES: Record<string, WorkspaceTarget> = {
  farm: { label: "Go to Farm", adminLabel: "Preview Farm", url: "/dashboard", icon: Warehouse, color: ICON_COLORS.farm },
  marketplace: { label: "Go to Marketplace", adminLabel: "Preview Marketplace", url: "/marketplace", icon: ShoppingCart, color: ICON_COLORS.cart },
  vet: { label: "Go to Vet portal", adminLabel: "Preview Vet portal", url: "/vet/dashboard", icon: Stethoscope, color: ICON_COLORS.vet },
  medibondhu: {
    label: "Go to MediBondhu",
    adminLabel: "Preview MediBondhu",
    tooltip: "Human outpatient (MediBondhu)",
    url: "/medibondhu",
    icon: Stethoscope,
    color: ICON_COLORS.medibondhu,
  },
  medibondhuDoctor: {
    label: "Go to Doctor portal",
    adminLabel: "Preview Doctor portal",
    tooltip: "MediBondhu doctor clinical workspace",
    url: "/medibondhu/doctor/dashboard",
    icon: Stethoscope,
    color: ICON_COLORS.medibondhu,
  },
  vetbondhu: {
    label: "Go to VetBondhu",
    adminLabel: "Preview VetBondhu",
    tooltip: "Animal telemed (VetBondhu)",
    url: "/vetbondhu",
    icon: Stethoscope,
    color: ICON_COLORS.vetbondhu,
  },
  learning: { label: "Go to Learning", adminLabel: "Preview Learning", url: "/learning", icon: BookOpen, color: ICON_COLORS.learning },
  community: { label: "Go to Community", adminLabel: "Preview Community", url: "/community", icon: MessageSquareText, color: ICON_COLORS.community },
};

export const ALL_WORKSPACE_KEYS = Object.keys(ALL_WORKSPACES) as WorkspaceKey[];

export function resolveWorkspaceButtonTargets(
  options: {
    targets?: WorkspaceKey[];
    currentWorkspace?: WorkspaceKey;
    platformAdmin?: boolean;
    canAccess: (key: WorkspaceKey) => boolean;
  }
): WorkspaceKey[] {
  const source = options.targets?.length ? options.targets : ALL_WORKSPACE_KEYS;
  const unique = Array.from(new Set(source));
  return unique.filter((key) => {
    if (key === options.currentWorkspace) return false;
    if (options.platformAdmin) return true;
    return options.canAccess(key);
  });
}

interface WorkspaceButtonsProps {
  targets?: WorkspaceKey[];
  currentWorkspace?: WorkspaceKey;
  collapsed: boolean;
  sectionLabel?: string;
}

export default function WorkspaceButtons({ targets, currentWorkspace, collapsed, sectionLabel = "Workspaces" }: WorkspaceButtonsProps) {
  const navigate = useNavigate();
  const { user, hasRole, hasCapability } = useAuth();
  const platformAdmin = isPlatformAdmin(user);

  const allowedTargets = resolveWorkspaceButtonTargets({
    targets,
    currentWorkspace,
    platformAdmin,
    canAccess: (key) => canAccessWorkspace(key, { hasCapability, hasRole }),
  });

  const items = allowedTargets.map((k) => ALL_WORKSPACES[k]).filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="px-2 py-1 min-w-0 w-full">
      <Separator className="my-2" />
      {!collapsed && (
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {sectionLabel}
        </p>
      )}
      {!collapsed ? (
        <div className="px-2 py-1 space-y-1.5 min-w-0 w-full">
          {items.map((ws) => (
            <Button
              key={ws.url}
              variant="outline"
              size="sm"
              className="w-full min-w-0 max-w-full justify-start gap-2 transition-all duration-200"
              style={{
                borderColor: `${ws.color}4D`,
                color: ws.color,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = ws.color;
                e.currentTarget.style.color = "white";
                e.currentTarget.style.borderColor = ws.color;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "";
                e.currentTarget.style.color = ws.color;
                e.currentTarget.style.borderColor = `${ws.color}4D`;
              }}
              onClick={() => navigate(ws.url)}
            >
              <ws.icon className="h-4 w-4" />
              {platformAdmin ? ws.adminLabel : ws.label}
            </Button>
          ))}
        </div>
      ) : (
        <SidebarMenu>
          {items.map((ws) => (
            <SidebarMenuItem key={ws.url}>
              <SidebarMenuButton
                onClick={() => navigate(ws.url)}
                tooltip={ws.tooltip ?? ws.label.replace(/^Go to /, "")}
              >
                <ws.icon className="h-4 w-4" style={{ color: ws.color }} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}
    </div>
  );
}
