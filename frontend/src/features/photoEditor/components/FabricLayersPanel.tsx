import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import type { LayerKind } from "../engines/fabric/fabricCanvasHelpers";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Layers,
  Lock,
  Shapes,
  Smile,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";

export type LayerMeta = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  kind: LayerKind;
  thumbSrc?: string;
};

export type FabricLayersPanelProps = {
  className?: string;
  layers: LayerMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: { visible?: boolean; locked?: boolean }) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onReorder: (id: string, targetVisualIndex: number) => void;
  onToFront: (id: string) => void;
  onToBack: (id: string) => void;
  showHeader?: boolean;
};

function LayerKindIcon({ kind, thumbSrc }: { kind: LayerKind; thumbSrc?: string }) {
  if (kind === "image" && thumbSrc) {
    return <img src={thumbSrc} alt="" className="fabric-editor-layer-thumb" />;
  }
  const cls = "h-3.5 w-3.5 shrink-0 text-muted-foreground";
  switch (kind) {
    case "image":
      return <ImageIcon className={cls} />;
    case "text":
      return <Type className={cls} />;
    case "sticker":
      return <Smile className={cls} />;
    case "shape":
      return <Shapes className={cls} />;
    default:
      return <Shapes className={cls} />;
  }
}

export default function FabricLayersPanel({
  className,
  layers,
  selectedId,
  onSelect,
  onUpdate,
  onRemove,
  onMove,
  onReorder,
  onToFront,
  onToBack,
  showHeader = true,
}: FabricLayersPanelProps) {
  const { t } = useLanguage();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const visualLayers = [...layers].reverse();

  const handleDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropIndex(null);
  }, []);

  const handleDrop = useCallback(
    (targetVisualIndex: number) => {
      if (!dragId) return;
      const fromIndex = visualLayers.findIndex((l) => l.id === dragId);
      if (fromIndex < 0 || fromIndex === targetVisualIndex) {
        handleDragEnd();
        return;
      }
      onReorder(dragId, targetVisualIndex);
      handleDragEnd();
    },
    [dragId, handleDragEnd, onReorder, visualLayers],
  );

  return (
    <div className={cn("fabric-editor-layers-dock", className)}>
      {showHeader && (
        <div className="fabric-editor-layers-dock-header">
          <div className="flex items-center gap-1.5 min-w-0">
            <Layers className="h-4 w-4 shrink-0 text-primary" style={{ color: photoEditorTheme.primary }} />
            <h3 className="fabric-editor-layers-dock-title">{t("seller.photoEditor.toolLayers")}</h3>
          </div>
          <span className="fabric-editor-layers-dock-count">{layers.length}</span>
        </div>
      )}
      <p className="fabric-editor-layers-dock-hint">{t("seller.photoEditor.dragToReorder")}</p>

      <ul className="fabric-editor-layers-list">
        {visualLayers.map((el, visualIndex) => (
          <li
            key={el.id}
            draggable
            onDragStart={() => handleDragStart(el.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => {
              e.preventDefault();
              setDropIndex(visualIndex);
            }}
            onDragLeave={() => setDropIndex(null)}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(visualIndex);
            }}
            className={cn(
              "fabric-editor-layer-row",
              selectedId === el.id && "fabric-editor-layer-row--selected",
              dropIndex === visualIndex && dragId && dragId !== el.id && "fabric-editor-layer-row--drop-target",
            )}
          >
            <button
              type="button"
              className="fabric-editor-layer-grip"
              aria-label={t("seller.photoEditor.dragToReorder")}
              onMouseDown={() => handleDragStart(el.id)}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <LayerKindIcon kind={el.kind} thumbSrc={el.thumbSrc} />
            <button type="button" className="fabric-editor-layer-name" onClick={() => onSelect(el.id)}>
              {el.name}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title={el.visible ? t("seller.photoEditor.hideLayer") : t("seller.photoEditor.showLayer")}
              onClick={() => onUpdate(el.id, { visible: !el.visible })}
            >
              {el.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              title={el.locked ? t("seller.photoEditor.unlockLayer") : t("seller.photoEditor.lockLayer")}
              onClick={() => onUpdate(el.id, { locked: !el.locked })}
            >
              {el.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 md:hidden"
              onClick={() => onMove(el.id, "up")}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 md:hidden"
              onClick={() => onMove(el.id, "down")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive"
              title={t("seller.photoEditor.deleteObject")}
              onClick={() => onRemove(el.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
        {layers.length === 0 && (
          <li className="fabric-editor-layers-empty">{t("seller.photoEditor.noLayersYet")}</li>
        )}
      </ul>

      {selectedId && (
        <div className="fabric-editor-layer-order-grid">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            title={t("seller.photoEditor.bringForward")}
            onClick={() => onMove(selectedId, "up")}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            title={t("seller.photoEditor.sendBackward")}
            onClick={() => onMove(selectedId, "down")}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            title={t("seller.photoEditor.bringToFront")}
            onClick={() => onToFront(selectedId)}
          >
            <ChevronsUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            title={t("seller.photoEditor.sendToBack")}
            onClick={() => onToBack(selectedId)}
          >
            <ChevronsDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
