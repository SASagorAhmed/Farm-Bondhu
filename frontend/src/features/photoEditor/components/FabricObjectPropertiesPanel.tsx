import { useEffect, useState } from "react";
import type { Canvas, FabricObject } from "fabric";
import { FabricImage } from "fabric";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { Copy, Trash2 } from "lucide-react";
import {
  applyObjectChrome,
  findObjectByDataId,
  isFabricImage,
  isFabricTextbox,
} from "../engines/fabric/fabricCanvasHelpers";
import { applyFillSelection, parseFillSelection } from "../engines/fabric/fabricFillColor";
import { fitTextToContent, resetTextAutoFit } from "../engines/fabric/fabricTextHelpers";
import {
  applyTextFill,
  applyTextStyle,
  asStyledTextbox,
  getActiveTextFill,
  getActiveTextStyle,
  hasPartialSelection,
  isTextBold,
  isTextItalic,
  setTextFontSize,
  toggleTextBold,
  toggleTextItalic,
} from "../engines/fabric/fabricTextSelection";
import FabricFontPicker from "./FabricFontPicker";
import FabricColorPicker from "./FabricColorPicker";

interface Props {
  canvas: Canvas | null;
  selectedId: string | null;
  onHistory: () => void;
  onClearSelection: () => void;
  onReplaceImage?: (file: File) => void;
}

function getActiveObject(canvas: Canvas, selectedId: string): FabricObject | null {
  const active = canvas.getActiveObject();
  if (active && String(active.get("dataId") ?? "") === selectedId) return active;
  return findObjectByDataId(canvas, selectedId) ?? null;
}

export default function FabricObjectPropertiesPanel({
  canvas,
  selectedId,
  onHistory,
  onClearSelection,
  onReplaceImage,
}: Props) {
  const { t } = useLanguage();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!canvas || !selectedId) return;
    const bump = () => tick((n) => n + 1);
    canvas.on("object:modified", bump);
    canvas.on("text:selection:changed", bump);
    canvas.on("text:editing:entered", bump);
    canvas.on("text:editing:exited", bump);
    canvas.on("text:changed", bump);
    return () => {
      canvas.off("object:modified", bump);
      canvas.off("text:selection:changed", bump);
      canvas.off("text:editing:entered", bump);
      canvas.off("text:editing:exited", bump);
      canvas.off("text:changed", bump);
    };
  }, [canvas, selectedId]);

  if (!canvas || !selectedId) return null;

  const obj = getActiveObject(canvas, selectedId);
  if (!obj) return null;

  const refresh = () => {
    canvas.requestRenderAll();
    tick((n) => n + 1);
    onHistory();
  };

  const duplicate = () => {
    void obj.clone().then((cloned) => {
      cloned.set({
        left: (obj.left ?? 0) + 20,
        top: (obj.top ?? 0) + 20,
        dataId: `${String(obj.get("dataId") ?? "obj")}-copy-${Date.now()}`,
      });
      applyObjectChrome(cloned);
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      refresh();
    });
  };

  const remove = () => {
    canvas.remove(obj);
    canvas.discardActiveObject();
    onClearSelection();
    refresh();
  };

  const isText = isFabricTextbox(obj);
  const isImage = isFabricImage(obj) && obj instanceof FabricImage;
  const isShape = !isText && !isImage;

  const textObj = asStyledTextbox(obj);
  const partialSelection = isText && hasPartialSelection(textObj);
  const activeFontSize = Number(getActiveTextStyle(textObj, "fontSize") ?? textObj.fontSize ?? 36);
  const activeFontFamily = String(getActiveTextStyle(textObj, "fontFamily") ?? textObj.fontFamily ?? "system-ui, sans-serif");
  const activeFill = getActiveTextFill(textObj);

  const scaledW = Math.round((obj.width ?? 0) * (obj.scaleX ?? 1));
  const scaledH = Math.round((obj.height ?? 0) * (obj.scaleY ?? 1));

  const setNumeric = (key: "left" | "top" | "angle", value: number) => {
    obj.set(key, value);
    obj.setCoords();
    refresh();
  };

  const setSize = (w: number, h: number) => {
    const baseW = obj.width ?? 1;
    const baseH = obj.height ?? 1;
    obj.set({ scaleX: w / baseW, scaleY: h / baseH });
    obj.setCoords();
    refresh();
  };

  const flip = (axis: "x" | "y") => {
    if (axis === "x") obj.set("flipX", !obj.flipX);
    else obj.set("flipY", !obj.flipY);
    refresh();
  };

  const refreshText = () => {
    fitTextToContent(textObj, { force: true });
    refresh();
  };

  return (
    <div className="fabric-editor-rail-section space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="fabric-editor-rail-title mb-0">{t("seller.photoEditor.selectionProperties")}</h3>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={duplicate} title={t("seller.photoEditor.duplicate")}>
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={remove} title={t("seller.photoEditor.deleteObject")}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="fabric-editor-grid-2">
        <div className="fabric-editor-field">
          <Label className="text-xs">X</Label>
          <Input type="number" value={Math.round(obj.left ?? 0)} onChange={(e) => setNumeric("left", Number(e.target.value))} />
        </div>
        <div className="fabric-editor-field">
          <Label className="text-xs">Y</Label>
          <Input type="number" value={Math.round(obj.top ?? 0)} onChange={(e) => setNumeric("top", Number(e.target.value))} />
        </div>
        {!isText && (
          <>
            <div className="fabric-editor-field">
              <Label className="text-xs">W</Label>
              <Input type="number" min={1} value={scaledW} onChange={(e) => setSize(Number(e.target.value) || 1, scaledH)} />
            </div>
            <div className="fabric-editor-field">
              <Label className="text-xs">H</Label>
              <Input type="number" min={1} value={scaledH} onChange={(e) => setSize(scaledW, Number(e.target.value) || 1)} />
            </div>
          </>
        )}
        <div className="fabric-editor-field col-span-2">
          <Label className="text-xs">{t("seller.photoEditor.rotation")}</Label>
          <Input type="number" value={Math.round(obj.angle ?? 0)} onChange={(e) => setNumeric("angle", Number(e.target.value))} />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => flip("x")}>
          {t("seller.photoEditor.flip")} H
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => flip("y")}>
          {t("seller.photoEditor.flip")} V
        </Button>
      </div>
      <p className="fabric-editor-hint">{t("seller.photoEditor.layersDockHint")}</p>

      <div className="fabric-editor-field">
        <Label className="text-xs">{t("seller.photoEditor.opacity")}</Label>
        <Input
          type="range"
          min={0}
          max={100}
          value={Math.round((obj.opacity ?? 1) * 100)}
          onChange={(e) => {
            obj.set("opacity", Number(e.target.value) / 100);
            refresh();
          }}
        />
      </div>

      {isText && (
        <>
          <p className="fabric-editor-hint">{t("seller.photoEditor.selectTextToStyle")}</p>
          {partialSelection && (
            <p className="fabric-editor-hint text-primary">{t("seller.photoEditor.partialSelectionActive")}</p>
          )}
          <div className="fabric-editor-field">
            <Label className="text-xs">{t("seller.photoEditor.textContent")}</Label>
            <Input
              value={String(textObj.text ?? "")}
              onChange={(e) => {
                textObj.set("text", e.target.value);
                refreshText();
              }}
            />
          </div>
          <FabricFontPicker
            value={activeFontFamily}
            onChange={(fontFamily) => {
              applyTextStyle(textObj, { fontFamily });
              refresh();
            }}
          />
          <div className="fabric-editor-field">
            <Label className="text-xs">{t("seller.photoEditor.fontSize")}</Label>
            <Input
              type="range"
              min={8}
              max={200}
              value={activeFontSize}
              onChange={(e) => {
                setTextFontSize(textObj, Number(e.target.value));
                refresh();
              }}
            />
            <Input
              type="number"
              min={8}
              max={200}
              value={activeFontSize}
              onChange={(e) => {
                setTextFontSize(textObj, Number(e.target.value) || 36);
                refresh();
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => {
              resetTextAutoFit(textObj);
              refresh();
            }}
          >
            {t("seller.photoEditor.fitTextToContent")}
          </Button>
          <FabricColorPicker
            value={activeFill}
            allowGradients={!partialSelection}
            onChange={(fill) => {
              if (fill.type === "solid" && partialSelection) {
                applyTextFill(textObj, fill.color);
              } else {
                applyFillSelection(textObj, fill);
                fitTextToContent(textObj, { force: true });
              }
              refresh();
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={isTextBold(textObj) ? "secondary" : "outline"}
              onClick={() => {
                toggleTextBold(textObj);
                refresh();
              }}
            >
              B
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isTextItalic(textObj) ? "secondary" : "outline"}
              onClick={() => {
                toggleTextItalic(textObj);
                refresh();
              }}
            >
              I
            </Button>
          </div>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((align) => (
              <Button
                key={align}
                type="button"
                size="sm"
                variant={textObj.textAlign === align ? "secondary" : "outline"}
                className="flex-1 text-xs"
                onClick={() => {
                  textObj.set("textAlign", align);
                  refresh();
                }}
              >
                {align}
              </Button>
            ))}
          </div>
        </>
      )}

      {isImage && (
        <>
          {onReplaceImage && (
            <div className="fabric-editor-field">
              <Label className="text-xs">{t("seller.photoEditor.replaceImage")}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onReplaceImage(f);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </>
      )}

      {isShape && (
        <>
          <FabricColorPicker
            value={parseFillSelection((obj as { fill?: unknown }).fill)}
            onChange={(fill) => {
              applyFillSelection(obj, fill);
              refresh();
            }}
          />
          <div className="fabric-editor-field">
            <Label className="text-xs">{t("seller.photoEditor.strokeWidth")}</Label>
            <Input
              type="number"
              min={0}
              max={20}
              value={Number((obj as { strokeWidth?: number }).strokeWidth ?? 0)}
              onChange={(e) => {
                obj.set("strokeWidth", Number(e.target.value));
                refresh();
              }}
            />
          </div>
          <div>
            <p className="fabric-editor-color-subtitle">{t("seller.photoEditor.strokeColor")}</p>
            <FabricColorPicker
              value={{
                type: "solid",
                color: String((obj as { stroke?: string }).stroke ?? "#000000"),
              }}
              onChange={(fill) => {
                if (fill.type === "solid") {
                  obj.set("stroke", fill.color);
                  refresh();
                }
              }}
              allowGradients={false}
              showTitle={false}
            />
          </div>
        </>
      )}
    </div>
  );
}
