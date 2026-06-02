import { Circle as CircleIcon, Egg, Minus, Square, Triangle } from "lucide-react";

export type PhotoEditorShapeKind = "rect" | "circle" | "line" | "triangle" | "ellipse";

export const PHOTO_EDITOR_SHAPES: {
  id: PhotoEditorShapeKind;
  icon: typeof Square;
  labelKey: string;
}[] = [
  { id: "rect", icon: Square, labelKey: "seller.photoEditor.shapeRect" },
  { id: "circle", icon: CircleIcon, labelKey: "seller.photoEditor.shapeCircle" },
  { id: "line", icon: Minus, labelKey: "seller.photoEditor.shapeLine" },
  { id: "triangle", icon: Triangle, labelKey: "seller.photoEditor.shapeTriangle" },
  { id: "ellipse", icon: Egg, labelKey: "seller.photoEditor.shapeEllipse" },
];
