import type { CSSProperties } from "react";
import { COW_WEIGHT_THEME } from "@/lib/cowWeight/cowWeightTheme";

/** Rose retake warning. */
export const COW_WEIGHT_RETAKE_ACCENT = COW_WEIGHT_THEME.alert;
export const COW_WEIGHT_RETAKE_BG = COW_WEIGHT_THEME.alertBg;

export const cowWeightRetakeAlertBox =
  "rounded-lg border px-3 py-2.5 space-y-2 text-sm shadow-sm";

export const cowWeightRetakeAlertTitle = "text-sm font-bold leading-snug";

export const cowWeightRetakeAlertBullet = "text-xs font-medium leading-snug";

export const cowWeightCalloutMistakesTipStyle: CSSProperties = {
  color: COW_WEIGHT_THEME.farmText,
  backgroundColor: COW_WEIGHT_THEME.farmBg,
  borderColor: COW_WEIGHT_THEME.farmBorder,
};

export const cowWeightCalloutMistakesTip =
  "text-sm rounded-md px-3 py-2 border";

/** Head side picker — dashboard blue. */
export const COW_WEIGHT_HEAD_SIDE_ACCENT = COW_WEIGHT_THEME.blue;
export const COW_WEIGHT_HEAD_SIDE_BG = COW_WEIGHT_THEME.blueBg;

export const cowWeightHeadSidePanel =
  "w-full rounded-lg border px-3 py-3 space-y-2.5 text-sm shadow-sm";

export const cowWeightHeadSideOptionBase =
  "flex-1 min-w-0 rounded-md border px-2 py-2.5 text-xs sm:text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1";

export const cowWeightCalloutFarmStyle: CSSProperties = {
  color: COW_WEIGHT_THEME.farmTextMuted,
  backgroundColor: COW_WEIGHT_THEME.farmBg,
  borderColor: COW_WEIGHT_THEME.farmBorder,
};

export const cowWeightCalloutBoxStyle: CSSProperties = {
  backgroundColor: COW_WEIGHT_THEME.farmBg,
  borderColor: COW_WEIGHT_THEME.farmBorder,
};

export const cowWeightCallout =
  "text-xs rounded-lg px-3 py-2 border";

export const cowWeightCalloutBox = "rounded-lg border p-3 space-y-2 text-sm";

export const cowWeightPanelLayout =
  "rounded-lg border p-3 space-y-2 text-sm shrink-0 w-full shadow-sm";

export const cowWeightLiveSummaryLocked = cowWeightPanelLayout;

export const cowWeightLiveWeightValue = "text-xl font-bold tabular-nums";

export const COW_WEIGHT_LIVE_ACCENT = COW_WEIGHT_THEME.farm;

export const cowWeightCalloutInlineStyle: CSSProperties = { color: COW_WEIGHT_THEME.farmTextMuted };
export const cowWeightCalloutInline = "text-xs";

export const cowWeightCalloutStrongStyle: CSSProperties = { color: COW_WEIGHT_THEME.farmText };
export const cowWeightCalloutStrong = "text-xs font-medium";

export const cowWeightCalloutMutedStyle: CSSProperties = { color: COW_WEIGHT_THEME.farmText, opacity: 0.9 };
export const cowWeightCalloutMuted = "text-xs";

export const cowWeightCalloutMutedSoftStyle: CSSProperties = { color: COW_WEIGHT_THEME.farmText, opacity: 0.8 };
export const cowWeightCalloutMutedSoft = "text-xs";

export const cowWeightCalloutHintStyle: CSSProperties = { color: COW_WEIGHT_THEME.farmTextMuted, opacity: 0.9 };
export const cowWeightCalloutHint = "text-xs";

export const cowWeightCalloutBadgeOutline = "text-[10px] font-normal border";

export const cowWeightCalloutBadgeOutlineStyle: CSSProperties = {
  color: COW_WEIGHT_THEME.farmTextMuted,
  borderColor: COW_WEIGHT_THEME.farmBorder,
  backgroundColor: COW_WEIGHT_THEME.farmBg,
};

export const cowWeightCalloutBadgeSolidStyle: CSSProperties = {
  backgroundColor: `${COW_WEIGHT_THEME.farm}33`,
  color: COW_WEIGHT_THEME.farmText,
};

export const cowWeightCalloutPanelStyle: CSSProperties = {
  color: COW_WEIGHT_THEME.farmText,
  backgroundColor: COW_WEIGHT_THEME.farmBg,
  borderColor: COW_WEIGHT_THEME.farmBorder,
};

export const cowWeightCalloutPanelStrongStyle: CSSProperties = {
  color: COW_WEIGHT_THEME.farmText,
  backgroundColor: `${COW_WEIGHT_THEME.farm}22`,
  borderColor: COW_WEIGHT_THEME.farmBorder,
};

export const cowWeightCalloutPanel = "text-xs border rounded px-2 py-1";
export const cowWeightCalloutPanelStrong = "text-xs border rounded px-2 py-1.5 font-medium";

export const cowWeightCalloutLowConfidenceStyle: CSSProperties = cowWeightCalloutPanelStyle;
export const cowWeightCalloutLowConfidence = "text-xs border rounded px-2 py-1";

export const cowWeightDistanceBarStyle: CSSProperties = {
  borderTopColor: COW_WEIGHT_THEME.cyan,
  borderColor: COW_WEIGHT_THEME.farmBorder,
  backgroundColor: COW_WEIGHT_THEME.farmBg,
};

export const cowWeightDistanceFallbackBarStyle: CSSProperties = {
  borderTopColor: COW_WEIGHT_THEME.cyan,
  borderColor: COW_WEIGHT_THEME.farmBorder,
  backgroundColor: COW_WEIGHT_THEME.farmBg,
};

export const cowWeightOrientationPill =
  "absolute top-2 right-2 text-white text-xs sm:text-sm font-bold px-3 py-1.5 rounded-md shadow max-w-[min(100%,220px)] text-right";
