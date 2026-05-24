import { apiJson } from "@/api/client";
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplaceCategories";

export const UNIT_PRESETS = ["piece", "kg", "bag", "litre", "box"] as const;

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
  is_flash_sale: boolean;
  flash_sale_end: string;
  wholesaleEnabled: boolean;
  wholesale_price: string;
  wholesale_min_qty: string;
}

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  category: "feed",
  unit: "piece",
  description: "",
  price: "",
  original_price: "",
  stock: "0",
  image: "",
  imageFile: null,
  free_delivery: false,
  is_flash_sale: false,
  flash_sale_end: "",
  wholesaleEnabled: false,
  wholesale_price: "",
  wholesale_min_qty: "",
};

export type ProductFormErrors = Partial<Record<keyof ProductFormValues | "submit", string>>;

export function computeFormDiscountPercent(originalPrice: string, salePrice: string): number {
  const orig = Number(originalPrice);
  const sale = Number(salePrice);
  if (!orig || !sale || orig <= sale) return 0;
  return Math.round(((orig - sale) / orig) * 100);
}

export function fromDbRow(row: Record<string, unknown>): ProductFormValues {
  const wholesalePrice = row.wholesale_price != null ? Number(row.wholesale_price) : 0;
  const wholesaleMinQty = row.wholesale_min_qty != null ? Number(row.wholesale_min_qty) : 0;
  const flashEnd = row.flash_sale_end ? String(row.flash_sale_end) : "";
  let flashLocal = "";
  if (flashEnd) {
    const d = new Date(flashEnd);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      flashLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  return {
    name: String(row.name || ""),
    category: String(row.category || "feed"),
    unit: String(row.unit || "piece"),
    description: String(row.description || ""),
    price: row.price != null ? String(row.price) : "",
    original_price: row.original_price != null ? String(row.original_price) : "",
    stock: row.stock != null ? String(row.stock) : "0",
    image: String(row.image || ""),
    imageFile: null,
    free_delivery: Boolean(row.free_delivery),
    is_flash_sale: Boolean(row.is_flash_sale),
    flash_sale_end: flashLocal,
    wholesaleEnabled: wholesalePrice > 0 && wholesaleMinQty > 0,
    wholesale_price: wholesalePrice > 0 ? String(wholesalePrice) : "",
    wholesale_min_qty: wholesaleMinQty > 0 ? String(wholesaleMinQty) : "",
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

  if (values.is_flash_sale) {
    if (!values.original_price || computeFormDiscountPercent(values.original_price, values.price) <= 0) {
      errors.original_price = "Flash sale needs MRP higher than sale price";
    }
    if (!values.flash_sale_end) errors.flash_sale_end = "Flash sale end time is required";
    else if (new Date(values.flash_sale_end).getTime() <= Date.now()) {
      errors.flash_sale_end = "End time must be in the future";
    }
  }

  if (values.wholesaleEnabled) {
    const wp = Number(values.wholesale_price);
    const wq = Number(values.wholesale_min_qty);
    if (!values.wholesale_price || Number.isNaN(wp) || wp <= 0) errors.wholesale_price = "Wholesale price required";
    if (!values.wholesale_min_qty || Number.isNaN(wq) || wq <= 0 || !Number.isInteger(wq)) {
      errors.wholesale_min_qty = "Min order qty required";
    }
    if (!Number.isNaN(wp) && !Number.isNaN(price) && wp >= price) {
      errors.wholesale_price = "Wholesale price must be below retail";
    }
  }

  return errors;
}

export function toApiPayload(values: ProductFormValues, imageUrl: string) {
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    category: values.category,
    unit: values.unit.trim(),
    description: values.description.trim(),
    price: Number(values.price),
    stock: Number(values.stock),
    image: imageUrl,
    free_delivery: values.free_delivery,
    is_flash_sale: values.is_flash_sale,
  };

  payload.original_price = values.original_price ? Number(values.original_price) : null;
  payload.flash_sale_end = values.is_flash_sale && values.flash_sale_end
    ? new Date(values.flash_sale_end).toISOString()
    : null;

  if (!values.is_flash_sale) {
    payload.is_flash_sale = false;
    payload.flash_sale_end = null;
  }

  if (values.wholesaleEnabled) {
    payload.wholesale_price = Number(values.wholesale_price);
    payload.wholesale_min_qty = Number(values.wholesale_min_qty);
  } else {
    payload.wholesale_price = null;
    payload.wholesale_min_qty = null;
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
  const pharmacy = MARKETPLACE_CATEGORIES.filter((c) => c.lane === "pharmacy");
  const farm = MARKETPLACE_CATEGORIES.filter((c) => c.lane === "farm");
  return { pharmacy, farm };
}

export async function resolveProductImageUrl(values: ProductFormValues): Promise<string> {
  if (values.imageFile) return uploadProductImage(values.imageFile);
  if (values.image.trim()) return values.image.trim();
  throw new Error("Product photo is required");
}
