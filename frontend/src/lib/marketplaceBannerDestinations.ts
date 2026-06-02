export const MARKETPLACE_BANNER_DESTINATIONS = [
  { value: "none", label: "None (no link)" },
  { value: "/marketplace", label: "Marketplace — All" },
  { value: "/marketplace?lane=medibondhu", label: "MediBondhu Pharmacy" },
  { value: "/marketplace?lane=vetbondhu", label: "VetBondhu Pharmacy" },
  { value: "/marketplace?lane=farm", label: "Farm Supplies" },
  { value: "/marketplace?lane=pet", label: "Pet Supplies" },
  { value: "/marketplace?lane=livestock_dairy", label: "Livestock & Dairy" },
  { value: "/marketplace?lane=farm_machinery", label: "Farm Machinery" },
  { value: "/buyer/categories", label: "Browse categories" },
  { value: "/cart", label: "Cart" },
  { value: "custom", label: "Custom URL" },
] as const;

export function resolveBannerLinkUrl(destination: string, customUrl: string): string | null {
  if (destination === "none") return null;
  if (destination === "custom") {
    const trimmed = customUrl.trim();
    return trimmed || null;
  }
  return destination;
}

export function parseBannerLinkToDestination(linkUrl: string | null | undefined): {
  destination: string;
  customUrl: string;
} {
  if (!linkUrl || !linkUrl.trim()) {
    return { destination: "none", customUrl: "" };
  }
  const preset = MARKETPLACE_BANNER_DESTINATIONS.find((d) => d.value === linkUrl.trim());
  if (preset && preset.value !== "custom" && preset.value !== "none") {
    return { destination: preset.value, customUrl: "" };
  }
  return { destination: "custom", customUrl: linkUrl.trim() };
}

export function getBannerDestinationLabel(linkUrl: string | null | undefined): string {
  if (!linkUrl) return "No link";
  const { destination, customUrl } = parseBannerLinkToDestination(linkUrl);
  if (destination === "custom") return customUrl;
  return MARKETPLACE_BANNER_DESTINATIONS.find((d) => d.value === destination)?.label || linkUrl;
}
