import { MARKETPLACE_BANNER_DESTINATIONS } from "@/lib/marketplaceBannerDestinations";
import type { MarketplaceLane } from "@/lib/marketplaceCategories";

/** All marketplace lanes — official FarmBondhu shop can list in any lane without onboarding. */
export const ALL_MARKETPLACE_LANES = [
  "medibondhu",
  "vetbondhu",
  "farm",
  "pet",
  "livestock_dairy",
  "farm_machinery",
] as const satisfies readonly Exclude<MarketplaceLane, "all">[];

export const SELLER_ONBOARDING_LANES: { lane: Exclude<MarketplaceLane, "all">; label: string; licenseRequired: boolean }[] = [
  { lane: "medibondhu", label: "MediBondhu Pharmacy", licenseRequired: true },
  { lane: "vetbondhu", label: "VetBondhu Pharmacy", licenseRequired: true },
  { lane: "farm", label: "Farm Supplies", licenseRequired: false },
  { lane: "pet", label: "Pet Supplies", licenseRequired: false },
  { lane: "livestock_dairy", label: "Livestock & Dairy", licenseRequired: false },
  { lane: "farm_machinery", label: "Farm Machinery", licenseRequired: true },
];

export function laneLabel(lane: string): string {
  return SELLER_ONBOARDING_LANES.find((l) => l.lane === lane)?.label
    || MARKETPLACE_BANNER_DESTINATIONS.find((d) => d.value.includes(`lane=${lane}`))?.label
    || lane;
}

export type SellerLaneGrant = {
  user_id: string;
  lane: string;
  status: "pending" | "approved" | "rejected";
  license_number?: string | null;
  license_file_url?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
};

export type SellerOnboardingMe = {
  grants: SellerLaneGrant[];
  approved_lanes: string[];
  can_list: boolean;
  latest_request?: { id: string; status: string; details?: Record<string, unknown> } | null;
};
