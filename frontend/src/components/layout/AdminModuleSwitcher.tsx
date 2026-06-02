import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { ADMIN_MODULE_HUB_ITEMS, type AdminModule } from "@/lib/adminModules";

interface Props {
  activeModule: AdminModule;
  collapsed: boolean;
}

export default function AdminModuleSwitcher({ activeModule, collapsed }: Props) {
  const navigate = useNavigate();

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => navigate(activeModule.defaultPath)}
        className="p-1.5 rounded-lg mx-auto text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title={activeModule.label}
      >
        <activeModule.icon className="h-4 w-4" style={{ color: activeModule.color }} />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-lg px-1 py-0.5 hover:bg-accent/50 transition-colors"
        >
          <activeModule.icon className="h-4 w-4 shrink-0" style={{ color: activeModule.color }} />
          <span className="text-sm font-semibold tracking-tight truncate" style={{ color: activeModule.color }}>
            {activeModule.label}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-auto" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => navigate("/admin")} className="gap-2">
          <LayoutGrid className="h-4 w-4" />
          All modules
        </DropdownMenuItem>
        {ADMIN_MODULE_HUB_ITEMS.map((mod) => (
          <DropdownMenuItem
            key={mod.id}
            onClick={() => navigate(mod.defaultPath)}
            className="gap-2"
          >
            <mod.icon className="h-4 w-4" style={{ color: mod.color }} />
            {mod.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
