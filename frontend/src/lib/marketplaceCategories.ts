import {
  Wheat, Pill, Syringe, Heart, Wrench, Bug, Egg, Milk, Package, Leaf, Scissors, Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";

export type MarketplaceLane = "all" | "pharmacy" | "farm";

export interface MarketplaceCategoryDef {
  slug: string;
  label: string;
  lane: Exclude<MarketplaceLane, "all">;
  icon: LucideIcon;
  color: string;
  aliases: string[];
}

export const MARKETPLACE_CATEGORIES: MarketplaceCategoryDef[] = [
  { slug: "feed", label: "Feed", lane: "farm", icon: Wheat, color: ICON_COLORS.farm, aliases: ["Feed", "Poultry Feed", "Cattle Feed", "feed"] },
  { slug: "medicine", label: "Medicine", lane: "pharmacy", icon: Pill, color: ICON_COLORS.health, aliases: ["Medicine", "medicine"] },
  { slug: "vaccines", label: "Vaccines", lane: "pharmacy", icon: Syringe, color: ICON_COLORS.health, aliases: ["Vaccines", "vaccines"] },
  { slug: "supplements", label: "Supplements", lane: "pharmacy", icon: Heart, color: ICON_COLORS.stethoscope, aliases: ["Supplements", "supplements"] },
  { slug: "equipment", label: "Equipment", lane: "farm", icon: Wrench, color: ICON_COLORS.finance, aliases: ["Equipment", "equipment"] },
  { slug: "pest_control", label: "Pest Control", lane: "farm", icon: Bug, color: ICON_COLORS.learning, aliases: ["Pest Control", "pest control", "pest_control"] },
  { slug: "livestock", label: "Livestock", lane: "farm", icon: Truck, color: ICON_COLORS.farm, aliases: ["Livestock", "livestock"] },
  { slug: "eggs", label: "Eggs", lane: "farm", icon: Egg, color: ICON_COLORS.egg, aliases: ["Eggs", "eggs"] },
  { slug: "meat", label: "Meat", lane: "farm", icon: Package, color: ICON_COLORS.learning, aliases: ["Meat", "meat"] },
  { slug: "milk", label: "Milk", lane: "farm", icon: Milk, color: ICON_COLORS.milk, aliases: ["Milk", "Dairy", "milk", "dairy"] },
  { slug: "produce", label: "Produce", lane: "farm", icon: Leaf, color: ICON_COLORS.farm, aliases: ["Produce", "Organic", "produce", "organic"] },
  { slug: "grooming", label: "Grooming", lane: "farm", icon: Scissors, color: ICON_COLORS.profile, aliases: ["Grooming", "grooming"] },
  { slug: "packaging", label: "Packaging", lane: "farm", icon: Package, color: ICON_COLORS.cart, aliases: ["Packaging", "packaging"] },
];

const PHARMACY_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "pharmacy").map((c) => c.slug)
);
const FARM_SLUGS = new Set(
  MARKETPLACE_CATEGORIES.filter((c) => c.lane === "farm").map((c) => c.slug)
);

const aliasToSlug = new Map<string, string>();
for (const cat of MARKETPLACE_CATEGORIES) {
  aliasToSlug.set(cat.slug.toLowerCase(), cat.slug);
  aliasToSlug.set(cat.label.toLowerCase(), cat.slug);
  for (const a of cat.aliases) {
    aliasToSlug.set(a.toLowerCase(), cat.slug);
  }
}

export function resolveCategorySlug(input: string | null | undefined): string | null {
  if (!input || input === "all") return null;
  const key = input.trim().toLowerCase();
  return aliasToSlug.get(key) || (MARKETPLACE_CATEGORIES.some((c) => c.slug === key) ? key : null);
}

export function getCategoryLabel(slug: string): string {
  return MARKETPLACE_CATEGORIES.find((c) => c.slug === slug)?.label || slug;
}

export function getLaneForCategory(slug: string | null | undefined): MarketplaceLane {
  if (!slug) return "all";
  if (PHARMACY_SLUGS.has(slug)) return "pharmacy";
  if (FARM_SLUGS.has(slug)) return "farm";
  return "all";
}

export function getLaneForProductCategory(category: string | undefined): MarketplaceLane {
  const slug = resolveCategorySlug(category);
  return slug ? getLaneForCategory(slug) : "all";
}

export function getCategoriesForLane(lane: MarketplaceLane): MarketplaceCategoryDef[] {
  if (lane === "all") return MARKETPLACE_CATEGORIES;
  return MARKETPLACE_CATEGORIES.filter((c) => c.lane === lane);
}

export function productMatchesLane(category: string | undefined, lane: MarketplaceLane): boolean {
  if (lane === "all") return true;
  return getLaneForProductCategory(category) === lane;
}

export const BUYER_HOME_CATEGORIES = MARKETPLACE_CATEGORIES.filter((c) =>
  ["feed", "medicine", "supplements", "equipment", "pest_control"].includes(c.slug)
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
