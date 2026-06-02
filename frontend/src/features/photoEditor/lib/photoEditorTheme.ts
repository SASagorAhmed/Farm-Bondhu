import { VENDOR_THEME, vendorGradient } from "@/lib/vendorTheme";

export const photoEditorTheme = {
  primary: VENDOR_THEME.primary,
  primaryDark: VENDOR_THEME.primaryDark,
  gradient: vendorGradient(),
  buttonStyle: { backgroundColor: VENDOR_THEME.primary, color: "#ffffff" } as const,
  activeRingClass: "ring-[#0EA5E9]",
  hoverBorderStyle: { borderColor: VENDOR_THEME.primary } as const,
};
