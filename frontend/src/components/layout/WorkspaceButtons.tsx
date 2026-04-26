import { useNavigate } from "react-router-dom";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Warehouse, ShoppingCart, Stethoscope, BookOpen, MessageSquareText } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceTarget {
  label: string;
  url: string;
  icon: React.ElementType;
  color: string;
}

const ALL_WORKSPACES: Record<string, WorkspaceTarget> = {
  farm: { label: "Go to Farm", url: "/dashboard", icon: Warehouse, color: ICON_COLORS.farm },
  marketplace: { label: "Go to Marketplace", url: "/marketplace", icon: ShoppingCart, color: ICON_COLORS.cart },
  vet: { label: "Go to Vet", url: "/vet/dashboard", icon: Stethoscope, color: ICON_COLORS.vet },
  medibondhu: { label: "Go to MediBondhu", url: "/medibondhu", icon: Stethoscope, color: ICON_COLORS.medibondhu },
  learning: { label: "Go to Learning", url: "/learning", icon: BookOpen, color: ICON_COLORS.learning },
  community: { label: "Go to Community", url: "/community", icon: MessageSquareText, color: ICON_COLORS.community },
};

interface WorkspaceButtonsProps {
  targets: string[];
  collapsed: boolean;
}

export default function WorkspaceButtons({ targets, collapsed }: WorkspaceButtonsProps) {
  const navigate = useNavigate();
  const { hasRole, hasCapability } = useAuth();

  const allowedTargets = targets.filter((key) => {
    const isVet = hasRole("vet") || hasCapability("can_consult_as_vet");
    if (key === "marketplace") return true;
    if (key === "community") return true;
    if (key === "vet") return isVet;
    if (key === "farm") return hasRole("farmer") || hasCapability("can_manage_farm");
    if (key === "medibondhu") return !isVet && (hasRole("farmer") || hasCapability("can_book_vet"));
    if (key === "learning") return hasCapability("can_access_learning") || hasRole("farmer") || isVet;
    return false;
  });

  const items = allowedTargets.map((k) => ALL_WORKSPACES[k]).filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="px-2 py-1">
      <Separator className="my-2" />
      {!collapsed && (
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspaces
        </p>
      )}
      {!collapsed ? (
        <div className="px-2 py-1 space-y-1.5">
          {items.map((ws) => (
            <Button
              key={ws.url}
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 transition-all duration-200"
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
              {ws.label}
            </Button>
          ))}
        </div>
      ) : (
        <SidebarMenu>
          {items.map((ws) => (
            <SidebarMenuItem key={ws.url}>
              <SidebarMenuButton onClick={() => navigate(ws.url)} tooltip={ws.label.replace("Go to ", "")}>
                <ws.icon className="h-4 w-4" style={{ color: ws.color }} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      )}
    </div>
  );
}
