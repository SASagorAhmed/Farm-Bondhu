import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { PHOTO_EDITOR_TOOLS } from "./photoEditorTools";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import type { PhotoEditorTool } from "../types";

interface Props {
  active: PhotoEditorTool;
  onChange: (tool: PhotoEditorTool) => void;
  className?: string;
}

export default function PhotoEditorToolSidebar({ active, onChange, className }: Props) {
  const { t } = useLanguage();
  return (
    <nav
      className={cn(
        "flex md:flex-col gap-1 p-2 bg-card border-border shrink-0",
        "md:border-r overflow-x-auto md:overflow-y-auto",
        className,
      )}
    >
      {PHOTO_EDITOR_TOOLS.map(({ id, icon: Icon, labelKey }) => (
        <Button
          key={id}
          type="button"
          variant={active === id ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "flex md:flex-col gap-1 h-auto py-2 px-3 min-w-[72px] md:min-w-0",
            active === id && photoEditorTheme.activeRingClass,
          )}
          style={
            active === id
              ? { backgroundColor: `${photoEditorTheme.primary}14`, color: photoEditorTheme.primary }
              : undefined
          }
          onClick={() => onChange(id)}
          title={t(labelKey)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-[10px] leading-tight hidden md:inline">{t(labelKey)}</span>
        </Button>
      ))}
    </nav>
  );
}
