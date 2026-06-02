/** Vendor / seller panel brand tokens (original sky blue — unchanged by buyer redesign). */
export const VENDOR_THEME = {
  primary: "#0EA5E9",
  primaryDark: "#0284C7",
  primaryLight: "#38BDF8",
} as const;

export function vendorGradient(): string {
  return `linear-gradient(to right, ${VENDOR_THEME.primary}, ${VENDOR_THEME.primaryDark})`;
}
