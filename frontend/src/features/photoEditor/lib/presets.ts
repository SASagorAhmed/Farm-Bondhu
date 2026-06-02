import type { EditorDocument, ExportTarget, PresetKey } from "../types";

export type PresetDefinition = {
  key: PresetKey;
  labelKey: string;
  usedForKey: string;
  width: number;
  height: number;
  aspectLabel: string;
  exportTarget: ExportTarget;
  suggestedReturnTo?: string;
  /** Optional subtle tint for promo-style templates */
  backgroundColor?: string;
};

export const PHOTO_EDITOR_PRESETS: PresetDefinition[] = [
  {
    key: "product_photo",
    labelKey: "seller.photoEditor.presetProductPhoto",
    usedForKey: "seller.photoEditor.usedForProduct",
    width: 1200,
    height: 900,
    aspectLabel: "4:3",
    exportTarget: "product",
    suggestedReturnTo: "/seller/products",
  },
  {
    key: "shop_cover",
    labelKey: "seller.photoEditor.presetShopCover",
    usedForKey: "seller.photoEditor.usedForShopCover",
    width: 1500,
    height: 500,
    aspectLabel: "3:1",
    exportTarget: "shop_banner",
    suggestedReturnTo: "/seller/my-shop",
  },
  {
    key: "shop_logo",
    labelKey: "seller.photoEditor.presetShopLogo",
    usedForKey: "seller.photoEditor.usedForShopLogo",
    width: 512,
    height: 512,
    aspectLabel: "1:1",
    exportTarget: "shop_logo",
    suggestedReturnTo: "/seller/my-shop",
  },
  {
    key: "profile_photo",
    labelKey: "seller.photoEditor.presetProfile",
    usedForKey: "seller.photoEditor.usedForProfile",
    width: 400,
    height: 400,
    aspectLabel: "1:1",
    exportTarget: "profile",
    suggestedReturnTo: "/seller/profile",
  },
  {
    key: "promo_banner",
    labelKey: "seller.photoEditor.presetPromoBanner",
    usedForKey: "seller.photoEditor.usedForPromoBanner",
    width: 1200,
    height: 400,
    aspectLabel: "3:1",
    exportTarget: "download_only",
    backgroundColor: "#FDF2F8",
  },
  {
    key: "custom",
    labelKey: "seller.photoEditor.presetCustom",
    usedForKey: "seller.photoEditor.usedForCustom",
    width: 1080,
    height: 1080,
    aspectLabel: "—",
    exportTarget: "download_only",
  },
];

const LEGACY_PRESET_MAP: Record<string, PresetKey> = {
  facebook_post: "promo_banner",
  instagram_post: "shop_logo",
  website_banner: "shop_cover",
  product_poster: "product_photo",
};

export function migratePresetKey(raw: string | null | undefined): PresetKey {
  if (!raw) return "product_photo";
  if (LEGACY_PRESET_MAP[raw]) return LEGACY_PRESET_MAP[raw];
  const known = PHOTO_EDITOR_PRESETS.find((p) => p.key === raw);
  return known ? (known.key as PresetKey) : "product_photo";
}

const TARGET_TO_PRESET: Record<string, PresetKey> = {
  product: "product_photo",
  shop_banner: "shop_cover",
  shop_logo: "shop_logo",
  profile: "profile_photo",
};

/** Prefer explicit preset; otherwise map export target (e.g. from Products) to canvas ratio. */
export function resolvePresetFromParams(
  presetParam: string | null,
  targetParam: string | null,
): PresetKey {
  if (presetParam) return migratePresetKey(presetParam);
  if (targetParam && TARGET_TO_PRESET[targetParam]) return TARGET_TO_PRESET[targetParam];
  return "product_photo";
}

export function getPreset(key: PresetKey) {
  return PHOTO_EDITOR_PRESETS.find((p) => p.key === key) ?? PHOTO_EDITOR_PRESETS[0];
}

export function resolveExportTarget(
  presetKey: PresetKey,
  targetParam: string | null,
): ExportTarget | null {
  if (targetParam === "product" || targetParam === "shop_banner" || targetParam === "shop_logo" || targetParam === "profile") {
    return targetParam;
  }
  const preset = getPreset(presetKey);
  return preset.exportTarget === "download_only" ? null : preset.exportTarget;
}

export function applyLabelKeyForTarget(target: ExportTarget): string {
  switch (target) {
    case "product":
      return "seller.photoEditor.applyToProduct";
    case "shop_banner":
      return "seller.photoEditor.applyToShopCover";
    case "shop_logo":
      return "seller.photoEditor.applyToShopLogo";
    case "profile":
      return "seller.photoEditor.applyToProfile";
    default:
      return "seller.photoEditor.applyToProduct";
  }
}

export function createEmptyDocument(
  presetKey: PresetKey,
  customWidth?: number,
  customHeight?: number,
): EditorDocument {
  const preset = getPreset(presetKey);
  return {
    width: presetKey === "custom" && customWidth ? customWidth : preset.width,
    height: presetKey === "custom" && customHeight ? customHeight : preset.height,
    presetKey,
    backgroundColor: preset.backgroundColor ?? "#ffffff",
    elements: [],
  };
}
