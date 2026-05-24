import type { CSSProperties } from "react";
import { ICON_COLORS, iconBg } from "@/lib/iconColors";

/** Cow weight module palette — aligned with farm management active green. */
export const COW_WEIGHT_THEME = {
  farm: ICON_COLORS.farmBrand,
  farmBg: iconBg(ICON_COLORS.farmBrand),
  farmBorder: "#9EDDC1",
  farmText: "#065F46",
  farmTextMuted: "#047857",
  blue: ICON_COLORS.dashboard,
  blueBg: iconBg(ICON_COLORS.dashboard),
  blueBorder: `${ICON_COLORS.dashboard}55`,
  cyan: ICON_COLORS.medibondhu,
  alert: ICON_COLORS.health,
  alertBg: iconBg(ICON_COLORS.health),
} as const;

export type CowWeightPanelVariant = "farm" | "blue";

export function cowWeightPanelStyle(variant: CowWeightPanelVariant): CSSProperties {
  switch (variant) {
    case "farm":
      return {
        backgroundColor: COW_WEIGHT_THEME.farmBg,
        borderColor: COW_WEIGHT_THEME.farmBorder,
      };
    case "blue":
      return {
        backgroundColor: COW_WEIGHT_THEME.blueBg,
        borderColor: COW_WEIGHT_THEME.blueBorder,
      };
  }
}

export function cowWeightTextStyle(): CSSProperties {
  return { color: COW_WEIGHT_THEME.farmText };
}

export function cowWeightAccentStyle(variant: "farm" | "blue"): CSSProperties {
  return { color: variant === "farm" ? COW_WEIGHT_THEME.farm : COW_WEIGHT_THEME.blue };
}

/** Solid farm-green CTA (Save, Next, Take photo, etc.). */
export const cowWeightPrimaryButtonClass = "text-white hover:opacity-90";
export const cowWeightPrimaryButtonStyle: CSSProperties = {
  backgroundColor: COW_WEIGHT_THEME.farm,
};

/** Farm-green outline for secondary actions (Gallery, Tap reference, etc.). */
export const cowWeightOutlineButtonClass = "border bg-background hover:bg-[#10B9811A]";
export const cowWeightOutlineButtonStyle: CSSProperties = {
  borderColor: COW_WEIGHT_THEME.farmBorder,
  color: COW_WEIGHT_THEME.farmText,
};

/** Ghost back/retake link — green text, light green hover. */
export const cowWeightBackLinkClass = "hover:bg-[#10B9811A] hover:text-[#10B981]";
export const cowWeightBackLinkStyle: CSSProperties = {
  color: COW_WEIGHT_THEME.farm,
};

/** Layout-only classes shared by themed panels. */
export const cowWeightPanelLayout = "rounded-lg border p-3 space-y-2 text-sm shrink-0 w-full shadow-sm";

export const cowWeightCalloutLayout = "rounded-lg border px-3 py-2 text-xs";
