import { uploadProductImage } from "@/lib/marketplaceProductForm";
import { updateMyShop, uploadShopAsset } from "@/lib/marketplaceShopApi";
import { api } from "@/api/client";
import type { ExportTarget } from "../types";
import {
  PHOTO_EDITOR_EXPORT_URL_KEY,
  PHOTO_EDITOR_PROFILE_URL_KEY,
  PHOTO_EDITOR_SHOP_BANNER_URL_KEY,
  PHOTO_EDITOR_SHOP_LOGO_URL_KEY,
} from "../types";

export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: "image/png" });
}

export async function applyPhotoEditorExport(
  target: ExportTarget,
  dataUrl: string,
  options: { userId?: string; filename?: string },
): Promise<{ navigateHint?: "openProductForm" }> {
  const file = await dataUrlToFile(dataUrl, options.filename ?? "design.png");

  switch (target) {
    case "product": {
      const url = await uploadProductImage(file);
      sessionStorage.setItem(PHOTO_EDITOR_EXPORT_URL_KEY, url);
      return { navigateHint: "openProductForm" };
    }
    case "shop_banner": {
      const url = await uploadShopAsset("banner", file);
      if (options.userId) {
        await updateMyShop(options.userId, { banner_url: url });
      } else {
        sessionStorage.setItem(PHOTO_EDITOR_SHOP_BANNER_URL_KEY, url);
      }
      return {};
    }
    case "shop_logo": {
      const url = await uploadShopAsset("logo", file);
      if (options.userId) {
        await updateMyShop(options.userId, { logo_url: url });
      } else {
        sessionStorage.setItem(PHOTO_EDITOR_SHOP_LOGO_URL_KEY, url);
      }
      return {};
    }
    case "profile": {
      const url = await uploadProductImage(file);
      if (options.userId) {
        await api.from("profiles").update({ avatar_url: url }).eq("id", options.userId);
      } else {
        sessionStorage.setItem(PHOTO_EDITOR_PROFILE_URL_KEY, url);
      }
      return {};
    }
    default:
      return {};
  }
}
