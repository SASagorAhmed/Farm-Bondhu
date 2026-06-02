import { apiJson } from "@/api/client";
import { MARKETPLACE_CATEGORIES, resolveCategorySlug } from "@/lib/marketplaceCategories";

export const UNIT_PRESETS = ["piece", "kg", "bag", "litre", "box"] as const;

export type WholesaleRule = "quantity" | "order_value" | "quantity_and_value";

export interface ProductFormValues {
  name: string;
  category: string;
  unit: string;
  description: string;
  price: string;
  original_price: string;
  stock: string;
  image: string;
  imageFile: File | null;
  free_delivery: boolean;
  delivery_charge_dhaka: string;
  delivery_charge_outside: string;
  is_flash_sale: boolean;
  flash_sale_end: string;
  wholesaleEnabled: boolean;
  wholesale_price: string;
  wholesale_rule: WholesaleRule;
  wholesale_min_qty: string;
  wholesale_min_order_bdt: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  category: "animal_feed",
  unit: "piece",
  description: "",
  price: "",
  original_price: "",
  stock: "0",
  image: "",
  imageFile: null,
  free_delivery: false,
  delivery_charge_dhaka: "80",
  delivery_charge_outside: "120",
  is_flash_sale: false,
  flash_sale_end: "",
  wholesaleEnabled: false,
  wholesale_price: "",
  wholesale_rule: "quantity",
  wholesale_min_qty: "",
  wholesale_min_order_bdt: "",
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues | "submit", string>>;

export function computeFormDiscountPercent(originalPrice: string, salePrice: string): number {
  const orig = Number(originalPrice);
  const sale = Number(salePrice);
  if (!orig || !sale || orig <= sale) return 0;
  return Math.round(((orig - sale) / orig) * 100);
}

function normalizeWholesaleRule(value: unknown): WholesaleRule {
  const r = String(value || "quantity").trim();
  if (r === "order_value" || r === "quantity_and_value") return r;
  return "quantity";
}

export function wholesalePreviewText(values: ProductFormValues): string | null {
  if (!values.wholesaleEnabled || !values.wholesale_price) return null;
  const price = Number(values.wholesale_price);
  if (!Number.isFinite(price) || price <= 0) return null;

  if (values.wholesale_rule === "order_value" && values.wholesale_min_order_bdt) {
    return `Wholesale ৳${price} when line value ≥ ৳${values.wholesale_min_order_bdt} (at retail price)`;
  }
  if (values.wholesale_rule === "quantity_and_value" && values.wholesale_min_qty && values.wholesale_min_order_bdt) {
    return `Wholesale ৳${price} when ≥ ${values.wholesale_min_qty} units and line value ≥ ৳${values.wholesale_min_order_bdt}`;
  }
  if (values.wholesale_min_qty) {
    return `Wholesale ৳${price} when buyer orders ≥ ${values.wholesale_min_qty} units`;
  }
  return `Wholesale ৳${price} when threshold is met`;
}

export function fromDbRow(row: Record<string, unknown>): ProductFormValues {
  const wholesalePrice = row.wholesale_price != null ? Number(row.wholesale_price) : 0;
  const wholesaleMinQty = row.wholesale_min_qty != null ? Number(row.wholesale_min_qty) : 0;
  const wholesaleMinOrderBdt = row.wholesale_min_order_bdt != null ? Number(row.wholesale_min_order_bdt) : 0;
  const flashEnd = row.flash_sale_end ? String(row.flash_sale_end) : "";
  let flashLocal = "";
  if (flashEnd) {
    const d = new Date(flashEnd);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      flashLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  let wholesaleRule = normalizeWholesaleRule(row.wholesale_rule);
  if (wholesalePrice > 0 && !row.wholesale_rule) {
    if (wholesaleMinQty > 0 && wholesaleMinOrderBdt > 0) wholesaleRule = "quantity_and_value";
    else if (wholesaleMinOrderBdt > 0) wholesaleRule = "order_value";
    else wholesaleRule = "quantity";
  }

  const rawCategory = row.category != null ? String(row.category) : "";
  const category =
    resolveCategorySlug(rawCategory) || rawCategory || "animal_feed";

  return {
    name: String(row.name || ""),
    category,
    unit: String(row.unit || "piece"),
    description: String(row.description || ""),
    price: row.price != null ? String(row.price) : "",
    original_price: row.original_price != null ? String(row.original_price) : "",
    stock: row.stock != null ? String(row.stock) : "0",
    image: String(row.image || ""),
    imageFile: null,
    free_delivery: Boolean(row.free_delivery),
    delivery_charge_dhaka:
      row.delivery_charge_dhaka != null ? String(row.delivery_charge_dhaka) : "80",
    delivery_charge_outside:
      row.delivery_charge_outside != null ? String(row.delivery_charge_outside) : "120",
    is_flash_sale: Boolean(row.is_flash_sale),
    flash_sale_end: flashLocal,
    wholesaleEnabled: wholesalePrice > 0,
    wholesale_price: wholesalePrice > 0 ? String(wholesalePrice) : "",
    wholesale_rule: wholesaleRule,
    wholesale_min_qty: wholesaleMinQty > 0 ? String(wholesaleMinQty) : "",
    wholesale_min_order_bdt: wholesaleMinOrderBdt > 0 ? String(wholesaleMinOrderBdt) : "",
  };
}

export function validateProductForm(values: ProductFormValues, mode: "create" | "edit"): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!values.name.trim()) errors.name = "Product name is required";
  if (!values.category.trim()) errors.category = "Category is required";
  if (!values.unit.trim()) errors.unit = "Unit is required";

  const price = Number(values.price);
  if (!values.price || Number.isNaN(price) || price < 0) errors.price = "Valid sale price is required";

  const stock = Number(values.stock);
  if (values.stock === "" || Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0) {
    errors.stock = "Stock must be a non-negative whole number";
  }

  if (values.original_price) {
    const orig = Number(values.original_price);
    if (Number.isNaN(orig) || orig < 0) errors.original_price = "Invalid original price";
    else if (!Number.isNaN(price) && orig < price) errors.original_price = "MRP must be ≥ sale price";
  }

  const hasImage = Boolean(values.imageFile || values.image.trim());
  if (mode === "create" && !hasImage) errors.image = "Product photo is required";

  if (!values.free_delivery) {
    const dhaka = Number(values.delivery_charge_dhaka);
    if (!values.delivery_charge_dhaka || Number.isNaN(dhaka) || dhaka < 0 || !Number.isInteger(dhaka)) {
      errors.delivery_charge_dhaka = "Valid Dhaka delivery charge required";
    }
    const outside = Number(values.delivery_charge_outside);
    if (!values.delivery_charge_outside || Number.isNaN(outside) || outside < 0 || !Number.isInteger(outside)) {
      errors.delivery_charge_outside = "Valid outside Dhaka delivery charge required";
    }
  }

  if (values.wholesaleEnabled) {
    const wp = Number(values.wholesale_price);
    if (!values.wholesale_price || Number.isNaN(wp) || wp <= 0) errors.wholesale_price = "Wholesale price required";
    if (!Number.isNaN(wp) && !Number.isNaN(price) && wp >= price) {
      errors.wholesale_price = "Wholesale price must be below retail";
    }

    if (values.wholesale_rule === "quantity" || values.wholesale_rule === "quantity_and_value") {
      const wq = Number(values.wholesale_min_qty);
      if (!values.wholesale_min_qty || Number.isNaN(wq) || wq <= 0 || !Number.isInteger(wq)) {
        errors.wholesale_min_qty = "Min order qty required";
      }
    }

    if (values.wholesale_rule === "order_value" || values.wholesale_rule === "quantity_and_value") {
      const wv = Number(values.wholesale_min_order_bdt);
      if (!values.wholesale_min_order_bdt || Number.isNaN(wv) || wv <= 0) {
        errors.wholesale_min_order_bdt = "Min order value (৳) required";
      }
    }
  }

  return errors;
}

/** Seller create/update — flash sale is admin-only; never send flash fields. */
export function toSellerApiPayload(values: ProductFormValues, imageUrl: string) {
  const payload = toApiPayload(values, imageUrl);
  delete payload.is_flash_sale;
  delete payload.flash_sale_end;
  return payload;
}

export function toApiPayload(values: ProductFormValues, imageUrl: string) {
  const category =
    resolveCategorySlug(values.category) || values.category.trim();
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    category,
    unit: values.unit.trim(),
    description: values.description.trim(),
    price: Number(values.price),
    stock: Number(values.stock),
    image: imageUrl,
    free_delivery: values.free_delivery,
  };

  if (values.free_delivery) {
    payload.delivery_charge_dhaka = null;
    payload.delivery_charge_outside = null;
  } else {
    payload.delivery_charge_dhaka = Number(values.delivery_charge_dhaka);
    payload.delivery_charge_outside = Number(values.delivery_charge_outside);
  }

  payload.original_price = values.original_price ? Number(values.original_price) : null;

  if (values.wholesaleEnabled) {
    payload.wholesale_price = Number(values.wholesale_price);
    payload.wholesale_rule = values.wholesale_rule;
    payload.wholesale_min_qty =
      values.wholesale_rule === "order_value" ? null : Number(values.wholesale_min_qty);
    payload.wholesale_min_order_bdt =
      values.wholesale_rule === "quantity" ? null : Number(values.wholesale_min_order_bdt);
  } else {
    payload.wholesale_price = null;
    payload.wholesale_rule = null;
    payload.wholesale_min_qty = null;
    payload.wholesale_min_order_bdt = null;
  }

  return payload;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Image must be 5MB or smaller"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadProductImage(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const { res, body } = await apiJson("/v1/marketplace/products/upload-image", {
    method: "POST",
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired — please sign in again");
    throw new Error(String(body.error || "Image upload failed"));
  }
  const url = (body as { data?: { url?: string } }).data?.url;
  if (!url) throw new Error("Image upload failed");
  return String(url);
}

export function getCategoryGroups() {
  return {
    medibondhu: MARKETPLACE_CATEGORIES.filter((c) => c.lane === "medibondhu"),
    vetbondhu: MARKETPLACE_CATEGORIES.filter((c) => c.lane === "vetbondhu"),
    farm: MARKETPLACE_CATEGORIES.filter((c) => c.lane === "farm"),
    pet: MARKETPLACE_CATEGORIES.filter((c) => c.lane === "pet"),
    livestock_dairy: MARKETPLACE_CATEGORIES.filter((c) => c.lane === "livestock_dairy"),
    farm_machinery: MARKETPLACE_CATEGORIES.filter((c) => c.lane === "farm_machinery"),
  };
}

export async function resolveProductImageUrl(values: ProductFormValues): Promise<string> {
  if (values.imageFile) return uploadProductImage(values.imageFile);
  if (values.image.trim()) return values.image.trim();
  throw new Error("Product photo is required");
}
