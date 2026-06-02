export type PresetKey =
  | "product_photo"
  | "shop_cover"
  | "shop_logo"
  | "profile_photo"
  | "promo_banner"
  | "custom";

export type ExportTarget =
  | "product"
  | "shop_banner"
  | "shop_logo"
  | "profile"
  | "download_only";

export type ElementType = "image" | "text" | "rect" | "circle" | "line" | "sticker";

export type EditorElement = {
  id: string;
  type: ElementType;
  name: string;
  visible: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  align?: "left" | "center" | "right";
  src?: string;
  sticker?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
};

export type EditorDocument = {
  width: number;
  height: number;
  presetKey: PresetKey;
  backgroundColor: string;
  backgroundImage?: string;
  elements: EditorElement[];
};

export type PhotoEditorTool =
  | "preset"
  | "upload"
  | "crop"
  | "adjust"
  | "text"
  | "shapes"
  | "stickers"
  | "background"
  | "layers";

export type ToastCanvasJson = {
  engine: "toast";
  presetKey: PresetKey;
  width: number;
  height: number;
  backgroundColor?: string;
  /** Flattened preview for quick restore */
  imageDataUrl?: string;
};

export type FabricCanvasJson = {
  engine: "fabric";
  presetKey: PresetKey;
  width: number;
  height: number;
  backgroundColor: string;
  fabricJson?: Record<string, unknown>;
};

export type PhotoEditorCanvasJson = EditorDocument | ToastCanvasJson | FabricCanvasJson;

export type DesignDraft = {
  id: string;
  user_id: string;
  title: string;
  preset_key: string | null;
  width: number;
  height: number;
  canvas_json: PhotoEditorCanvasJson;
  thumbnail_data: string | null;
  created_at: string;
  updated_at: string;
};

export const PHOTO_EDITOR_EXPORT_URL_KEY = "photoEditorExportUrl";
export const PHOTO_EDITOR_SHOP_BANNER_URL_KEY = "photoEditorShopBannerUrl";
export const PHOTO_EDITOR_SHOP_LOGO_URL_KEY = "photoEditorShopLogoUrl";
export const PHOTO_EDITOR_PROFILE_URL_KEY = "photoEditorProfileUrl";
export const PHOTO_EDITOR_LOCAL_DRAFT_PREFIX = "photoEditorLocalDraft:";
