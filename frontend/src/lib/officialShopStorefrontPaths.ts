import { ADMIN_PHOTO_EDITOR_BASE } from "@/features/photoEditor/lib/photoEditorPaths";

export const OFFICIAL_SHOP_ADMIN_PATHS = {
  shop: "/admin/farmbondhu-shop/shop",
  products: "/admin/farmbondhu-shop/products",
  photoEditor: ADMIN_PHOTO_EDITOR_BASE,
} as const;

export function officialShopPhotoEditorNewUrl(
  preset: string,
  target: string,
  returnTo = OFFICIAL_SHOP_ADMIN_PATHS.shop,
) {
  const p = new URLSearchParams({ preset, target, returnTo });
  return `${ADMIN_PHOTO_EDITOR_BASE}/edit/new?${p.toString()}`;
}
