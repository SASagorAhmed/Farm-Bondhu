import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, Unlock, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import type { EditorElement } from "../types";

interface Props {
  elements: EditorElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<EditorElement>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
}

export default function PhotoEditorLayerList({
  elements,
  selectedId,
  onSelect,
  onUpdate,
  onRemove,
  onMove,
}: Props) {
  const reversed = [...elements].reverse();
  return (
    <ul className="space-y-1 max-h-[280px] overflow-y-auto">
      {reversed.map((el) => (
        <li
          key={el.id}
          className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${
            selectedId === el.id ? "bg-primary/10" : "hover:bg-muted/60"
          }`}
        >
          <button type="button" className="flex-1 text-left truncate" onClick={() => onSelect(el.id)}>
            {el.name}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onUpdate(el.id, { visible: !el.visible })}
          >
            {el.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onUpdate(el.id, { locked: !el.locked })}
          >
            {el.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove(el.id, "up")}>
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMove(el.id, "down")}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onRemove(el.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </li>
      ))}
      {elements.length === 0 && <p className="text-xs text-muted-foreground py-2">No layers yet</p>}
    </ul>
  );
}
