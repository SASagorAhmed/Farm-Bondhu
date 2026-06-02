import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { updateMyShop } from "@/lib/marketplaceShopApi";
import {
  PHOTO_EDITOR_SHOP_BANNER_URL_KEY,
  PHOTO_EDITOR_SHOP_LOGO_URL_KEY,
} from "@/features/photoEditor/types";

/** Applies banner/logo URLs exported from Photo Editor when returning to My Shop. */
export function usePhotoEditorShopSessionExports(sellerId: string, onApplied?: () => void) {
  const applied = useRef(false);

  useEffect(() => {
    if (!sellerId || applied.current) return;

    const bannerUrl = sessionStorage.getItem(PHOTO_EDITOR_SHOP_BANNER_URL_KEY);
    const logoUrl = sessionStorage.getItem(PHOTO_EDITOR_SHOP_LOGO_URL_KEY);
    if (!bannerUrl && !logoUrl) return;

    applied.current = true;

    void (async () => {
      try {
        const patch: { banner_url?: string; logo_url?: string } = {};
        if (bannerUrl) {
          patch.banner_url = bannerUrl;
          sessionStorage.removeItem(PHOTO_EDITOR_SHOP_BANNER_URL_KEY);
        }
        if (logoUrl) {
          patch.logo_url = logoUrl;
          sessionStorage.removeItem(PHOTO_EDITOR_SHOP_LOGO_URL_KEY);
        }
        const { ok, error } = await updateMyShop(sellerId, patch);
        if (!ok) throw new Error(error || "Failed to apply shop image");
        toast.success("Shop image updated from Photo Editor");
        onApplied?.();
      } catch (err) {
        applied.current = false;
        toast.error(err instanceof Error ? err.message : "Could not apply shop image");
      }
    })();
  }, [sellerId, onApplied]);
}
