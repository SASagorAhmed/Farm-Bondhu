import type { CalculationBreakdownGroup } from "./calculationBreakdown";
import { COW_WEIGHT_THEME } from "./cowWeightTheme";
import { ICON_COLORS, iconBg } from "@/lib/iconColors";

export interface CowWeightAuditGroupTheme {
  accent: string;
  bg: string;
  labelKey: string;
}

const GROUP_THEMES: Record<CalculationBreakdownGroup, CowWeightAuditGroupTheme> = {
  image: {
    accent: COW_WEIGHT_THEME.blue,
    bg: iconBg(COW_WEIGHT_THEME.blue),
    labelKey: "cowWeight.audit.group.image",
  },
  bbox: {
    accent: ICON_COLORS.admin,
    bg: iconBg(ICON_COLORS.admin),
    labelKey: "cowWeight.audit.group.bbox",
  },
  keypoints: {
    accent: COW_WEIGHT_THEME.farm,
    bg: iconBg(COW_WEIGHT_THEME.farm),
    labelKey: "cowWeight.audit.group.keypoints",
  },
  frozen: {
    accent: ICON_COLORS.community,
    bg: iconBg(ICON_COLORS.community),
    labelKey: "cowWeight.audit.group.frozen",
  },
  lines: {
    accent: ICON_COLORS.finance,
    bg: iconBg(ICON_COLORS.finance),
    labelKey: "cowWeight.audit.group.lines",
  },
  scale: {
    accent: ICON_COLORS.marketplace,
    bg: iconBg(ICON_COLORS.marketplace),
    labelKey: "cowWeight.audit.group.scale",
  },
  convert: {
    accent: COW_WEIGHT_THEME.cyan,
    bg: iconBg(COW_WEIGHT_THEME.cyan),
    labelKey: "cowWeight.audit.group.convert",
  },
  weight: {
    accent: COW_WEIGHT_THEME.alert,
    bg: iconBg(COW_WEIGHT_THEME.alert),
    labelKey: "cowWeight.audit.group.weight",
  },
};

export function auditGroupTheme(group: CalculationBreakdownGroup): CowWeightAuditGroupTheme {
  return GROUP_THEMES[group];
}

/** Step-focus highlight (consistent across groups). */
export const AUDIT_STEP_FOCUS = {
  accent: COW_WEIGHT_THEME.farm,
  bg: iconBg(COW_WEIGHT_THEME.farm),
  ring: `${COW_WEIGHT_THEME.farm}66`,
} as const;
