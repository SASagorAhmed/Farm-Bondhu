/** Marketplace top-level lanes (seller onboarding categories). */
export const MARKETPLACE_LANES = [
  "medibondhu",
  "vetbondhu",
  "farm",
  "pet",
  "livestock_dairy",
  "farm_machinery",
];

export const LICENSE_REQUIRED_LANES = new Set(["medibondhu", "vetbondhu", "farm_machinery"]);

const LANE_CATEGORY_SLUGS = {
  medibondhu: [
    "medicine",
    "vaccines",
    "supplements",
    "first_aid",
    "health_care_items",
    "medical_equipment",
    "baby_care",
    "diabetes_care",
    "skin_personal_care",
  ],
  vetbondhu: [
    "animal_medicine",
    "pet_medicine",
    "animal_vaccine",
    "animal_vitamins_supplements",
    "dewormer",
    "wound_care",
    "animal_first_aid",
    "vet_equipment",
  ],
  farm: [
    "animal_feed",
    "seeds_plants_nursery",
    "fertilizer",
    "pesticide",
    "rice_grains_pulses",
    "vegetables_fruits",
    "bags_packaging_storage",
    "organic_products",
    "farm_accessories_grooming",
    "feed",
    "poultry feed",
    "cattle feed",
    "pest control",
    "pest_control",
    "produce",
    "organic",
    "grooming",
    "packaging",
  ],
  pet: [
    "pet_food",
    "pet_medicine_health",
    "pet_care_grooming",
    "pet_accessories",
    "pet_cage_carrier",
    "pet_bowl_feeder",
    "pet_toys",
    "pet_litter_cleaning",
  ],
  livestock_dairy: ["livestock", "meat", "milk_dairy", "eggs", "fish_fishery", "milk", "dairy"],
  farm_machinery: ["farm_machines", "farm_tools_equipment", "water_irrigation", "equipment"],
};

const categoryToLane = new Map();
for (const [lane, slugs] of Object.entries(LANE_CATEGORY_SLUGS)) {
  for (const slug of slugs) {
    categoryToLane.set(String(slug).toLowerCase(), lane);
  }
}

export function isValidMarketplaceLane(lane) {
  return MARKETPLACE_LANES.includes(String(lane || "").trim());
}

export function laneForProductCategory(category) {
  const key = String(category || "").trim().toLowerCase();
  return categoryToLane.get(key) || null;
}

export function normalizeLaneInput(lane) {
  const key = String(lane || "").trim().toLowerCase();
  if (key === "pharmacy") return "medibondhu";
  return isValidMarketplaceLane(key) ? key : null;
}

export function validateSellerOnboardingBody(body) {
  const business_name = String(body?.business_name || "").trim();
  const phone = String(body?.phone || "").trim();
  const location = String(body?.location || "").trim();
  const lanesRaw = Array.isArray(body?.lanes) ? body.lanes : [];

  if (!business_name) return { error: "business_name is required" };
  if (!phone) return { error: "phone is required" };
  if (!location) return { error: "location is required" };
  if (lanesRaw.length === 0) return { error: "Select at least one marketplace category" };

  const lanes = [];
  const seen = new Set();
  for (const item of lanesRaw) {
    const lane = normalizeLaneInput(typeof item === "string" ? item : item?.lane);
    if (!lane) return { error: `Invalid lane: ${JSON.stringify(item)}` };
    if (seen.has(lane)) continue;
    seen.add(lane);
    const license_number =
      item && typeof item === "object" && item.license_number != null
        ? String(item.license_number).trim()
        : "";
    const license_file_url =
      item && typeof item === "object" && item.license_file_url != null
        ? String(item.license_file_url).trim()
        : "";
    if (LICENSE_REQUIRED_LANES.has(lane)) {
      if (!license_number) return { error: `License number required for ${lane}` };
      if (!license_file_url) return { error: `License document required for ${lane}` };
    }
    lanes.push({
      lane,
      license_number: license_number || null,
      license_file_url: license_file_url || null,
    });
  }

  return {
    value: { business_name, phone, location, lanes },
  };
}
