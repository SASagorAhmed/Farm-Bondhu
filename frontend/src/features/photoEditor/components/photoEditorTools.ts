import {
  Upload,
  Crop,
  SlidersHorizontal,
  Type,
  Shapes,
  Smile,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  RotateCw,
  FlipHorizontal,
} from "lucide-react";
import type { PhotoEditorTool } from "../types";

export const PHOTO_EDITOR_TOOLS: { id: PhotoEditorTool; icon: typeof Upload; labelKey: string }[] = [
  { id: "preset", icon: LayoutTemplate, labelKey: "seller.photoEditor.toolPreset" },
  { id: "upload", icon: Upload, labelKey: "seller.photoEditor.toolUpload" },
  { id: "crop", icon: Crop, labelKey: "seller.photoEditor.toolCrop" },
  { id: "adjust", icon: SlidersHorizontal, labelKey: "seller.photoEditor.toolAdjust" },
  { id: "text", icon: Type, labelKey: "seller.photoEditor.toolText" },
  { id: "shapes", icon: Shapes, labelKey: "seller.photoEditor.toolShapes" },
  { id: "stickers", icon: Smile, labelKey: "seller.photoEditor.toolStickers" },
  { id: "background", icon: ImageIcon, labelKey: "seller.photoEditor.toolBackground" },
  { id: "layers", icon: Layers, labelKey: "seller.photoEditor.toolLayers" },
];

export { RotateCw, FlipHorizontal };
