const VALID_CATEGORIES = new Set([
  "medicine",
  "vaccines",
  "supplements",
  "first_aid",
  "health_care_items",
  "medical_equipment",
  "baby_care",
  "diabetes_care",
  "skin_personal_care",
  "animal_medicine",
  "pet_medicine",
  "animal_vaccine",
  "animal_vitamins_supplements",
  "dewormer",
  "wound_care",
  "animal_first_aid",
  "vet_equipment",
  "animal_feed",
  "seeds_plants_nursery",
  "fertilizer",
  "pesticide",
  "rice_grains_pulses",
  "vegetables_fruits",
  "bags_packaging_storage",
  "organic_products",
  "farm_accessories_grooming",
  "pet_food",
  "pet_medicine_health",
  "pet_care_grooming",
  "pet_accessories",
  "pet_cage_carrier",
  "pet_bowl_feeder",
  "pet_toys",
  "pet_litter_cleaning",
  "livestock",
  "meat",
  "milk_dairy",
  "eggs",
  "fish_fishery",
  "farm_machines",
  "farm_tools_equipment",
  "water_irrigation",
]);

const ALLOWED_FIELDS = new Set([
  "name",
  "description",
  "category",
  "unit",
  "price",
  "original_price",
  "stock",
  "image",
  "free_delivery",
  "delivery_charge_dhaka",
  "delivery_charge_outside",
  "is_flash_sale",
  "flash_sale_end",
  "wholesale_price",
  "wholesale_min_qty",
  "wholesale_rule",
  "wholesale_min_order_bdt",
  "location",
  "seller_name",
  "is_verified_seller",
]);

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function bool(v) {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return null;
}

function normalizeCategory(value) {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  const aliases = {
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
  return aliases[key] || key;
}

function isValidUrl(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  if (s.startsWith("/")) return true;
  if (s.startsWith("data:image/")) return true;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, unknown>} body
 * @param {{ partial?: boolean, existing?: Record<string, unknown> }} opts
 */
export function validateProductPayload(body, opts = {}) {
  const partial = Boolean(opts.partial);
  const existing = opts.existing || {};
  const src = body && typeof body === "object" ? body : {};

  for (const key of Object.keys(src)) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw badRequest(`Unknown field: ${key}`);
    }
  }

  const merged = partial ? { ...existing, ...src } : { ...src };

  const out = {};

  if (!partial || "name" in src) {
    const name = String(merged.name || "").trim();
    if (!name) throw badRequest("Product name is required");
    if (name.length > 200) throw badRequest("Product name must be 200 characters or less");
    out.name = name;
  }

  if (!partial || "category" in src) {
    const category = normalizeCategory(merged.category);
    if (!category) throw badRequest("Category is required");
    if (!VALID_CATEGORIES.has(category)) throw badRequest("Invalid category");
    out.category = category;
  }

  if (!partial || "unit" in src) {
    const unit = String(merged.unit || "").trim();
    if (!unit) throw badRequest("Unit is required");
    out.unit = unit.slice(0, 40);
  }

  if (!partial || "price" in src) {
    const price = num(merged.price);
    if (price == null || Number.isNaN(price) || price < 0) {
      throw badRequest("Valid sale price is required");
    }
    out.price = price;
  }

  if (!partial || "stock" in src) {
    const stock = num(merged.stock);
    if (stock == null || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
      throw badRequest("Stock must be a non-negative integer");
    }
    out.stock = stock;
  }

  if (!partial || "description" in src) {
    out.description = merged.description != null ? String(merged.description) : "";
  }

  if (!partial || "image" in src) {
    const image = String(merged.image || "").trim();
    if (!partial && !image) throw badRequest("Product image is required");
    if (image && !isValidUrl(image)) throw badRequest("Invalid image URL");
    out.image = image || null;
  }

  if (!partial || "location" in src) {
    out.location = merged.location != null ? String(merged.location).slice(0, 200) : null;
  }

  if (!partial || "original_price" in src) {
    const originalPrice = merged.original_price == null || merged.original_price === ""
      ? null
      : num(merged.original_price);
    if (originalPrice != null && (Number.isNaN(originalPrice) || originalPrice < 0)) {
      throw badRequest("Original price must be a non-negative number");
    }
    const salePrice = num(out.price ?? merged.price);
    if (originalPrice != null && salePrice != null && originalPrice < salePrice) {
      throw badRequest("Original price must be greater than or equal to sale price");
    }
    out.original_price = originalPrice;
  }

  if (!partial || "free_delivery" in src) {
    const fd = bool(merged.free_delivery);
    out.free_delivery = fd == null ? false : fd;
  }

  if (!partial || "delivery_charge_dhaka" in src) {
    if (merged.delivery_charge_dhaka == null || merged.delivery_charge_dhaka === "") {
      out.delivery_charge_dhaka = null;
    } else {
      const charge = num(merged.delivery_charge_dhaka);
      if (charge == null || Number.isNaN(charge) || charge < 0 || !Number.isInteger(charge)) {
        throw badRequest("delivery_charge_dhaka must be a non-negative integer");
      }
      out.delivery_charge_dhaka = charge;
    }
  }

  if (!partial || "delivery_charge_outside" in src) {
    if (merged.delivery_charge_outside == null || merged.delivery_charge_outside === "") {
      out.delivery_charge_outside = null;
    } else {
      const charge = num(merged.delivery_charge_outside);
      if (charge == null || Number.isNaN(charge) || charge < 0 || !Number.isInteger(charge)) {
        throw badRequest("delivery_charge_outside must be a non-negative integer");
      }
      out.delivery_charge_outside = charge;
    }
  }

  if (!partial || "is_flash_sale" in src) {
    const fs = bool(merged.is_flash_sale);
    out.is_flash_sale = fs == null ? false : fs;
  }

  if (!partial || "flash_sale_end" in src) {
    if (merged.flash_sale_end == null || merged.flash_sale_end === "") {
      out.flash_sale_end = null;
    } else {
      const d = new Date(merged.flash_sale_end);
      if (Number.isNaN(d.getTime())) throw badRequest("Invalid flash sale end time");
      out.flash_sale_end = d.toISOString();
    }
  }

  if (!partial || "wholesale_price" in src || "wholesale_min_qty" in src || "wholesale_rule" in src || "wholesale_min_order_bdt" in src) {
    const wp = merged.wholesale_price == null || merged.wholesale_price === ""
      ? null
      : num(merged.wholesale_price);
    const wq = merged.wholesale_min_qty == null || merged.wholesale_min_qty === ""
      ? null
      : num(merged.wholesale_min_qty);
    const wv = merged.wholesale_min_order_bdt == null || merged.wholesale_min_order_bdt === ""
      ? null
      : num(merged.wholesale_min_order_bdt);
    const rawRule = merged.wholesale_rule == null || merged.wholesale_rule === ""
      ? "quantity"
      : String(merged.wholesale_rule).trim();
    const validRules = new Set(["quantity", "order_value", "quantity_and_value"]);
    const rule = validRules.has(rawRule) ? rawRule : "quantity";

    const hasWp = wp != null && !Number.isNaN(wp);
    const hasWq = wq != null && !Number.isNaN(wq);
    const hasWv = wv != null && !Number.isNaN(wv);

    if (!hasWp) {
      out.wholesale_price = null;
      out.wholesale_min_qty = null;
      out.wholesale_min_order_bdt = null;
      out.wholesale_rule = null;
    } else {
      if (wp <= 0) throw badRequest("Invalid wholesale pricing");
      const salePrice = num(out.price ?? merged.price);
      if (salePrice != null && wp >= salePrice) {
        throw badRequest("Wholesale price must be less than retail price");
      }

      const effectiveRule = hasWq && hasWv
        ? "quantity_and_value"
        : hasWv
          ? "order_value"
          : hasWq
            ? "quantity"
            : rule;

      if (effectiveRule === "quantity" || effectiveRule === "quantity_and_value") {
        if (!hasWq || wq <= 0 || !Number.isInteger(wq)) {
          throw badRequest("Wholesale minimum quantity is required");
        }
        out.wholesale_min_qty = wq;
      } else {
        out.wholesale_min_qty = null;
      }

      if (effectiveRule === "order_value" || effectiveRule === "quantity_and_value") {
        if (!hasWv || wv <= 0) {
          throw badRequest("Wholesale minimum order value is required");
        }
        out.wholesale_min_order_bdt = wv;
      } else {
        out.wholesale_min_order_bdt = null;
      }

      out.wholesale_price = wp;
      out.wholesale_rule = effectiveRule;
    }
  }

  if (!partial || "seller_name" in src) {
    if (merged.seller_name != null) out.seller_name = String(merged.seller_name).slice(0, 200);
  }

  if (!partial || "is_verified_seller" in src) {
    const verified = bool(merged.is_verified_seller);
    if (verified != null) out.is_verified_seller = verified;
  }

  const isFlash = Boolean(out.is_flash_sale ?? merged.is_flash_sale);
  if (isFlash) {
    const salePrice = num(out.price ?? merged.price);
    const originalPrice = out.original_price !== undefined
      ? out.original_price
      : (merged.original_price == null || merged.original_price === "" ? null : num(merged.original_price));
    if (originalPrice == null || salePrice == null || originalPrice <= salePrice) {
      throw badRequest("Flash sale requires original price higher than sale price");
    }
    const endRaw = out.flash_sale_end !== undefined ? out.flash_sale_end : merged.flash_sale_end;
    if (!endRaw) throw badRequest("Flash sale end time is required");
    const end = new Date(endRaw);
    if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) {
      throw badRequest("Flash sale end time must be in the future");
    }
  }

  return out;
}
