import {
  Wheat,
  Pill,
  Syringe,
  Heart,
  Wrench,
  Bug,
  Egg,
  Milk,
  Leaf,
  Scissors,
  Truck,
  Fish,
  Apple,
  Sprout,
  FlaskConical,
  Cog,
  Droplets,
  Box,
  Beef,
  Bone,
  HeartPulse,
  ShoppingBag,
  UtensilsCrossed,
  ToyBrick,
  Sparkles,
  Bandage,
  Stethoscope,
  Baby,
  Activity,
  Cross,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";

export type MarketplaceLane =
  | "all"
  | "medibondhu"
  | "vetbondhu"
  | "farm"
  | "pet"
  | "livestock_dairy"
  | "farm_machinery";

export interface MarketplaceCategoryDef {
  slug: string;
  label: string;
  lane: Exclude<MarketplaceLane, "all">;
  icon: LucideIcon;
  color: string;
  aliases: string[];
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategoryDef[] = [
  // MediBondhu Pharmacy (human)
  { slug: "medicine", label: "Medicine", lane: "medibondhu", icon: Pill, color: ICON_COLORS.medibondhu, aliases: ["Medicine", "medicine"] },
  { slug: "vaccines", label: "Vaccines", lane: "medibondhu", icon: Syringe, color: ICON_COLORS.medibondhu, aliases: ["Vaccines", "vaccines"] },
  { slug: "supplements", label: "Supplements", lane: "medibondhu", icon: Heart, color: ICON_COLORS.medibondhu, aliases: ["Supplements", "supplements"] },
  { slug: "first_aid", label: "First Aid", lane: "medibondhu", icon: Bandage, color: ICON_COLORS.medibondhu, aliases: ["First Aid", "first_aid", "first aid"] },
  { slug: "health_care_items", label: "Health Care Items", lane: "medibondhu", icon: HeartPulse, color: ICON_COLORS.medibondhu, aliases: ["Health Care Items", "health_care_items", "health care"] },
  { slug: "medical_equipment", label: "Medical Equipment", lane: "medibondhu", icon: Stethoscope, color: ICON_COLORS.medibondhu, aliases: ["Medical Equipment", "medical_equipment"] },
  { slug: "baby_care", label: "Baby Care", lane: "medibondhu", icon: Baby, color: ICON_COLORS.medibondhu, aliases: ["Baby Care", "baby_care"] },
  { slug: "diabetes_care", label: "Diabetes Care", lane: "medibondhu", icon: Activity, color: ICON_COLORS.medibondhu, aliases: ["Diabetes Care", "diabetes_care"] },
  { slug: "skin_personal_care", label: "Skin & Personal Care", lane: "medibondhu", icon: Sparkles, color: ICON_COLORS.medibondhu, aliases: ["Skin & Personal Care", "skin_personal_care", "personal care"] },
  // VetBondhu Pharmacy (animal health)
  { slug: "animal_medicine", label: "Animal Medicine", lane: "vetbondhu", icon: Pill, color: ICON_COLORS.vetbondhu, aliases: ["Animal Medicine", "animal_medicine"] },
  { slug: "pet_medicine", label: "Pet Medicine", lane: "vetbondhu", icon: Pill, color: ICON_COLORS.vetbondhu, aliases: ["Pet Medicine", "pet_medicine"] },
  { slug: "animal_vaccine", label: "Animal Vaccine", lane: "vetbondhu", icon: Syringe, color: ICON_COLORS.vetbondhu, aliases: ["Animal Vaccine", "animal_vaccine"] },
  { slug: "animal_vitamins_supplements", label: "Animal Vitamins & Supplements", lane: "vetbondhu", icon: Heart, color: ICON_COLORS.vetbondhu, aliases: ["Animal Vitamins & Supplements", "animal_vitamins_supplements"] },
  { slug: "dewormer", label: "Dewormer", lane: "vetbondhu", icon: Bug, color: ICON_COLORS.vetbondhu, aliases: ["Dewormer", "dewormer"] },
  { slug: "wound_care", label: "Wound Care", lane: "vetbondhu", icon: Bandage, color: ICON_COLORS.vetbondhu, aliases: ["Wound Care", "wound_care"] },
  { slug: "animal_first_aid", label: "Animal First Aid", lane: "vetbondhu", icon: Cross, color: ICON_COLORS.vetbondhu, aliases: ["Animal First Aid", "animal_first_aid"] },
  { slug: "vet_equipment", label: "Vet Equipment", lane: "vetbondhu", icon: Stethoscope, color: ICON_COLORS.vetbondhu, aliases: ["Vet Equipment", "vet_equipment"] },
  // Farm supplies
  { slug: "animal_feed", label: "Animal Feed", lane: "farm", icon: Wheat, color: ICON_COLORS.farm, aliases: ["Animal Feed", "Feed", "feed", "Poultry Feed", "Cattle Feed", "animal_feed"] },
  { slug: "seeds_plants_nursery", label: "Seeds, Plants & Nursery", lane: "farm", icon: Sprout, color: ICON_COLORS.farm, aliases: ["Seeds, Plants & Nursery", "Seeds", "Plants", "Nursery", "seeds_plants_nursery"] },
  { slug: "fertilizer", label: "Fertilizer", lane: "farm", icon: FlaskConical, color: ICON_COLORS.farm, aliases: ["Fertilizer", "fertilizer"] },
  { slug: "pesticide", label: "Pesticide", lane: "farm", icon: Bug, color: ICON_COLORS.learning, aliases: ["Pesticide", "Pest Control", "pest control", "pest_control", "pesticide"] },
  { slug: "rice_grains_pulses", label: "Rice, Grains & Pulses", lane: "farm", icon: Wheat, color: ICON_COLORS.wheat, aliases: ["Rice, Grains & Pulses", "Rice", "Grains", "Pulses", "rice_grains_pulses"] },
  { slug: "vegetables_fruits", label: "Vegetables & Fruits", lane: "farm", icon: Apple, color: ICON_COLORS.farm, aliases: ["Vegetables & Fruits", "Produce", "produce", "vegetables_fruits"] },
  { slug: "bags_packaging_storage", label: "Bags, Packaging & Storage", lane: "farm", icon: Box, color: ICON_COLORS.cart, aliases: ["Bags, Packaging & Storage", "Packaging", "packaging", "bags_packaging_storage"] },
  { slug: "organic_products", label: "Organic Products", lane: "farm", icon: Leaf, color: ICON_COLORS.farm, aliases: ["Organic Products", "Organic", "organic", "organic_products"] },
  { slug: "farm_accessories_grooming", label: "Farm Accessories & Grooming", lane: "farm", icon: Scissors, color: ICON_COLORS.profile, aliases: ["Farm Accessories & Grooming", "Grooming", "grooming", "farm_accessories_grooming"] },
  // Pet supplies
  { slug: "pet_food", label: "Pet Food", lane: "pet", icon: Bone, color: ICON_COLORS.learning, aliases: ["Pet Food", "pet_food"] },
  { slug: "pet_medicine_health", label: "Pet Medicine & Health", lane: "pet", icon: HeartPulse, color: ICON_COLORS.health, aliases: ["Pet Medicine & Health", "pet_medicine_health"] },
  { slug: "pet_care_grooming", label: "Pet Care & Grooming", lane: "pet", icon: Scissors, color: ICON_COLORS.profile, aliases: ["Pet Care & Grooming", "pet_care_grooming"] },
  { slug: "pet_accessories", label: "Pet Accessories", lane: "pet", icon: ShoppingBag, color: ICON_COLORS.shopping, aliases: ["Pet Accessories", "pet_accessories"] },
  { slug: "pet_cage_carrier", label: "Pet Cage & Carrier", lane: "pet", icon: Box, color: ICON_COLORS.cart, aliases: ["Pet Cage & Carrier", "pet_cage_carrier"] },
  { slug: "pet_bowl_feeder", label: "Pet Bowl & Feeder", lane: "pet", icon: UtensilsCrossed, color: ICON_COLORS.marketplace, aliases: ["Pet Bowl & Feeder", "pet_bowl_feeder"] },
  { slug: "pet_toys", label: "Pet Toys", lane: "pet", icon: ToyBrick, color: ICON_COLORS.learning, aliases: ["Pet Toys", "pet_toys"] },
  { slug: "pet_litter_cleaning", label: "Pet Litter & Cleaning", lane: "pet", icon: Sparkles, color: ICON_COLORS.marketplace, aliases: ["Pet Litter & Cleaning", "pet_litter_cleaning"] },
  // Livestock & dairy
  { slug: "livestock", label: "Livestock", lane: "livestock_dairy", icon: Truck, color: ICON_COLORS.farm, aliases: ["Livestock", "livestock"] },
  { slug: "meat", label: "Meat", lane: "livestock_dairy", icon: Beef, color: ICON_COLORS.learning, aliases: ["Meat", "meat"] },
  { slug: "milk_dairy", label: "Milk & Dairy", lane: "livestock_dairy", icon: Milk, color: ICON_COLORS.milk, aliases: ["Milk & Dairy", "Milk", "Dairy", "milk", "dairy", "milk_dairy"] },
  { slug: "eggs", label: "Eggs", lane: "livestock_dairy", icon: Egg, color: ICON_COLORS.egg, aliases: ["Eggs", "eggs"] },
  { slug: "fish_fishery", label: "Fish & Fishery", lane: "livestock_dairy", icon: Fish, color: ICON_COLORS.marketplace, aliases: ["Fish & Fishery", "Fish", "Fishery", "fish_fishery"] },
  // Farm machinery
  { slug: "farm_machines", label: "Farm Machines", lane: "farm_machinery", icon: Cog, color: ICON_COLORS.finance, aliases: ["Farm Machines", "Machines", "farm_machines"] },
  { slug: "farm_tools_equipment", label: "Farm Tools & Equipment", lane: "farm_machinery", icon: Wrench, color: ICON_COLORS.finance, aliases: ["Farm Tools & Equipment", "Equipment", "equipment", "farm_tools_equipment"] },
  { slug: "water_irrigation", label: "Water & Irrigation", lane: "farm_machinery", icon: Droplets, color: ICON_COLORS.marketplace, aliases: ["Water & Irrigation", "Water", "Irrigation", "water_irrigation"] },
];

const MEDIBONDHU_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "medibondhu").map((c) => c.slug)
);
const VETBONDHU_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "vetbondhu").map((c) => c.slug)
);
const FARM_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "farm").map((c) => c.slug)
);
const PET_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "pet").map((c) => c.slug)
);
const LIVESTOCK_DAIRY_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "livestock_dairy").map((c) => c.slug)
);
const FARM_MACHINERY_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "farm_machinery").map((c) => c.slug)
);

const LANE_SLUGS: Exclude<MarketplaceLane, "all">[] = [
  "medibondhu",
  "vetbondhu",
  "farm",
  "pet",
  "livestock_dairy",
  "farm_machinery",
];

/** Mirrors backend `normalizeCategory()` in validators/product.js */
export const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  feed: "animal_feed",
  poultry_feed: "animal_feed",
  cattle_feed: "animal_feed",
  milk: "milk_dairy",
  dairy: "milk_dairy",
  produce: "vegetables_fruits",
  organic: "organic_products",
  pest_control: "pesticide",
  equipment: "farm_tools_equipment",
  grooming: "farm_accessories_grooming",
  packaging: "bags_packaging_storage",
  first_aid: "first_aid",
  health_care: "health_care_items",
  personal_care: "skin_personal_care",
};

const aliasToSlug = new Map<string, string>();
for (const cat of MARKETPLACE_CATEGORIES) {
  aliasToSlug.set(cat.slug.toLowerCase(), cat.slug);
  aliasToSlug.set(cat.label.toLowerCase(), cat.slug);
  for (const a of cat.aliases) {
    aliasToSlug.set(a.toLowerCase(), cat.slug);
  }
}

export function normalizeLaneSlug(input: string | null | undefined): MarketplaceLane {
  const key = String(input || "").trim().toLowerCase();
  if (!key || key === "all") return "all";
  if (key === "pharmacy") return "medibondhu";
  if (LANE_SLUGS.includes(key as Exclude<MarketplaceLane, "all">)) {
    return key as Exclude<MarketplaceLane, "all">;
  }
  return "all";
}

export function resolveCategorySlug(input: string | null | undefined): string | null {
  if (!input || input === "all") return null;
  const key = input.trim().toLowerCase();
  const fromAlias = aliasToSlug.get(key);
  if (fromAlias) return fromAlias;
  if (MARKETPLACE_CATEGORIES.some((c) => c.slug === key)) return key;
  const normalizedKey = key.replace(/\s+/g, "_");
  if (normalizedKey !== key) {
    const fromNormalizedAlias = aliasToSlug.get(normalizedKey);
    if (fromNormalizedAlias) return fromNormalizedAlias;
    if (MARKETPLACE_CATEGORIES.some((c) => c.slug === normalizedKey)) return normalizedKey;
  }
  const legacy = LEGACY_CATEGORY_ALIASES[normalizedKey];
  return legacy || null;
}

export function getCategoryLabel(slug: string): string {
  return MARKETPLACE_CATEGORIES.find((c) => c.slug === slug)?.label || slug;
}

export function getLaneForCategory(slug: string | null | undefined): MarketplaceLane {
  if (!slug) return "all";
  if (MEDIBONDHU_SLUGS.has(slug)) return "medibondhu";
  if (VETBONDHU_SLUGS.has(slug)) return "vetbondhu";
  if (FARM_SLUGS.has(slug)) return "farm";
  if (PET_SLUGS.has(slug)) return "pet";
  if (LIVESTOCK_DAIRY_SLUGS.has(slug)) return "livestock_dairy";
  if (FARM_MACHINERY_SLUGS.has(slug)) return "farm_machinery";
  return "all";
}

export function getLaneForProductCategory(category: string | undefined): MarketplaceLane {
  const slug = resolveCategorySlug(category);
  if (slug) return getLaneForCategory(slug);
  const asLane = normalizeLaneSlug(category);
  if (asLane !== "all") return asLane;
  return "all";
}

export function getCategoriesForLane(lane: MarketplaceLane): MarketplaceCategoryDef[] {
  if (lane === "all") return MARKETPLACE_CATEGORIES;
  return MARKETPLACE_CATEGORIES.filter((c) => c.lane === lane);
}

export function productMatchesLane(category: string | undefined, lane: MarketplaceLane): boolean {
  if (lane === "all") return true;
  return getLaneForProductCategory(category) === lane;
}

/** Canonical subcategories for a lane (sorted labels) — use for seller/admin filters and forms. */
export function getSubcategoriesForLane(lane: Exclude<MarketplaceLane, "all">) {
  return getCategoriesForLane(lane)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function productMatchesSubcategoryFilter(
  productCategory: string | undefined,
  filterSlug: string,
): boolean {
  if (filterSlug === "all") return true;
  const productSlug = resolveCategorySlug(productCategory) || productCategory;
  return productSlug === filterSlug;
}

export function displayProductCategory(category: string | undefined): string {
  const slug = resolveCategorySlug(category) || category;
  return slug ? getCategoryLabel(slug) : "—";
}

export const BUYER_HOME_CATEGORIES = MARKETPLACE_CATEGORIES.filter((c) =>
  ["medicine", "animal_feed", "fertilizer", "eggs", "pet_food", "farm_machines", "animal_medicine"].includes(c.slug)
);

export type SortOption = "newest" | "price_asc" | "price_desc" | "rating";

export function sortProducts<T extends { price: number; rating?: number; created_at?: string }>(
  items: T[],
  sort: SortOption
): T[] {
  const copy = [...items];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price_desc":
      return copy.sort((a, b) => b.price - a.price);
    case "rating":
      return copy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case "newest":
    default:
      return copy.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
  }
}
