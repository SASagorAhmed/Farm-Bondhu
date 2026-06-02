import type { ExportTarget } from "../types";

export const DEFAULT_PHOTO_EDITOR_BASE = "/seller/photo-editor";
export const ADMIN_PHOTO_EDITOR_BASE = "/admin/farmbondhu-shop/photo-editor";

export function resolvePhotoEditorBase(pathname: string): string {
  if (pathname.includes("/admin/farmbondhu-shop/photo-editor")) {
    return ADMIN_PHOTO_EDITOR_BASE;
  }
  return DEFAULT_PHOTO_EDITOR_BASE;
}

export function defaultReturnForTarget(target: ExportTarget, pathname: string): string {
  const isAdmin = pathname.includes("/admin/farmbondhu-shop");
  switch (target) {
    case "product":
      return isAdmin ? "/admin/farmbondhu-shop/products" : "/seller/products";
    case "shop_banner":
    case "shop_logo":
      return isAdmin ? "/admin/farmbondhu-shop/shop" : "/seller/my-shop";
    case "profile":
      return isAdmin ? "/admin/profile" : "/seller/profile";
    default:
      return resolvePhotoEditorBase(pathname);
  }
}

export function productPhotoEditorNewUrl(
  returnTo: string,
  base: string = DEFAULT_PHOTO_EDITOR_BASE,
) {
  const p = new URLSearchParams({
    preset: "product_photo",
    target: "product",
    returnTo,
  });
  return photoEditorPaths(base).editNew(p.toString());
}

export function photoEditorPaths(base: string = DEFAULT_PHOTO_EDITOR_BASE) {
  return {
    home: base,
    drafts: `${base}/drafts`,
    editNew(query?: string) {
      return `${base}/edit/new${query ? `?${query}` : ""}`;
    },
    editId(id: string, query?: string) {
      return `${base}/edit/${id}${query ? `?${query}` : ""}`;
    },
    hubBack(query?: string) {
      return `${base}${query ? `?${query}` : ""}`;
    },
  };
}
