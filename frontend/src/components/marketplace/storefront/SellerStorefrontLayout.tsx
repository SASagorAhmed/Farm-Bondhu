import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import TalkToSellerButton from "@/components/marketplace/TalkToSellerButton";
import SellerStorefrontHero from "./SellerStorefrontHero";
import SellerStorefrontToolbar from "./SellerStorefrontToolbar";
import SellerPinnedProducts from "./SellerPinnedProducts";
import SellerLaneSections from "./SellerLaneSections";
import {
  MAX_PINNED_PRODUCTS,
  nextPinSlot,
  sellerShopEditorPath,
  type PublicShop,
  updateMyShop,
  updateShopStorefront,
  uploadShopAsset,
} from "@/lib/marketplaceShopApi";
import { MarketplaceProduct } from "@/lib/marketplaceProduct";
import { ALL_MARKETPLACE_LANES } from "@/lib/marketplaceLaneLabels";
import { filterStorefrontProducts, getPinnedProducts } from "@/lib/storefrontUtils";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";

export type ShopStorefrontActions = {
  updateShop: (
    sellerId: string,
    patch: { description?: string; location?: string; logo_url?: string; banner_url?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  updateStorefront: (
    sellerId: string,
    items: { product_id: string; shop_pin_order?: number | null; shop_sort_order?: number }[],
  ) => Promise<{ ok: boolean; error?: string }>;
  uploadAsset: (type: "banner" | "logo", file: File) => Promise<string>;
};

export interface SellerStorefrontLayoutProps {
  shop: PublicShop;
  sellerId: string;
  products: MarketplaceProduct[];
  editMode?: boolean;
  showOwnerPreviewBanner?: boolean;
  variant?: "seller" | "admin";
  shopEditorPath?: string;
  shopActions?: ShopStorefrontActions;
  onAddProduct?: () => void;
  onEditProduct?: (product: MarketplaceProduct) => void;
  onDeleteProduct?: (product: MarketplaceProduct) => void;
  onNavigateProduct: (product: MarketplaceProduct) => void;
  onAddToCart: (product: MarketplaceProduct) => void;
  onBuyNow: (product: MarketplaceProduct) => void;
  onProductsChange?: () => void;
}

export default function SellerStorefrontLayout({
  shop,
  sellerId,
  products,
  editMode = false,
  showOwnerPreviewBanner = false,
  variant = "seller",
  shopEditorPath = "/seller/my-shop",
  shopActions,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onNavigateProduct,
  onAddToCart,
  onBuyNow,
  onProductsChange,
}: SellerStorefrontLayoutProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editForm, setEditForm] = useState({ description: shop.description || "", location: shop.location || "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  const pinned = useMemo(() => getPinnedProducts(products), [products]);
  const pinnedIds = useMemo(() => new Set(pinned.map((p) => p.id)), [pinned]);
  const gridProducts = useMemo(
    () => filterStorefrontProducts(products, { search }),
    [products, search]
  );

  const pinDisabled = pinned.length >= MAX_PINNED_PRODUCTS;
  const sampleProductId = products[0]?.id || null;

  const invalidate = () => {
    if (variant === "admin") {
      queryClient.invalidateQueries({ queryKey: ["official-shop-public", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["official-shop-products-storefront", sellerId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["public-shop", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["shop-products", sellerId] });
      queryClient.invalidateQueries({ queryKey: ["my-shop", sellerId] });
    }
    onProductsChange?.();
  };

  const adminFixedLanes = variant === "admin" ? ALL_MARKETPLACE_LANES : undefined;
  const showLaneSections = products.length > 0 || (editMode && variant === "admin");

  const saveShop = shopActions?.updateShop ?? ((id, patch) => updateMyShop(id, patch));
  const saveStorefront = shopActions?.updateStorefront ?? ((id, items) => updateShopStorefront(id, items));
  const saveAsset = shopActions?.uploadAsset ?? uploadShopAsset;

  const handleSaveInfo = async () => {
    setSavingInfo(true);
    const { ok, error } = await saveShop(sellerId, {
      description: editForm.description.trim(),
      location: editForm.location.trim(),
    });
    setSavingInfo(false);
    if (!ok) {
      toast.error(error || "Failed to update shop");
      return;
    }
    toast.success("Shop info updated");
    setEditInfoOpen(false);
    invalidate();
  };

  const handleUploadAsset = async (type: "banner" | "logo", file: File) => {
    if (type === "banner") setUploadingBanner(true);
    else setUploadingLogo(true);
    try {
      const url = await saveAsset(type, file);
      const patch = type === "banner" ? { banner_url: url } : { logo_url: url };
      const { ok, error } = await saveShop(sellerId, patch);
      if (!ok) throw new Error(error || "Failed to save");
      toast.success(type === "banner" ? "Banner updated" : "Logo updated");
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingBanner(false);
      setUploadingLogo(false);
    }
  };

  const handlePin = async (product: MarketplaceProduct) => {
    const slot = nextPinSlot(products);
    if (slot == null) {
      toast.error(`Maximum ${MAX_PINNED_PRODUCTS} pinned products. Unpin one first.`);
      return;
    }
    setPinBusy(true);
    const { ok, error } = await saveStorefront(sellerId, [
      { product_id: product.id, shop_pin_order: slot },
    ]);
    setPinBusy(false);
    if (!ok) {
      toast.error(error || "Could not pin product");
      return;
    }
    toast.success("Product pinned");
    invalidate();
  };

  const handleUnpin = async (product: MarketplaceProduct) => {
    setPinBusy(true);
    const { ok, error } = await saveStorefront(sellerId, [
      { product_id: product.id, shop_pin_order: null },
    ]);
    setPinBusy(false);
    if (!ok) {
      toast.error(error || "Could not unpin product");
      return;
    }
    toast.success("Product unpinned");
    invalidate();
  };

  const handleMovePinned = async (product: MarketplaceProduct, direction: "left" | "right") => {
    const order = product.shop_pin_order;
    if (order == null) return;
    const index = pinned.findIndex((p) => p.id === product.id);
    const neighborIndex = direction === "left" ? index - 1 : index + 1;
    const neighbor = pinned[neighborIndex];
    if (!neighbor || neighbor.shop_pin_order == null) return;

    setPinBusy(true);
    const { ok, error } = await saveStorefront(sellerId, [
      { product_id: product.id, shop_pin_order: neighbor.shop_pin_order },
      { product_id: neighbor.id, shop_pin_order: order },
    ]);
    setPinBusy(false);
    if (!ok) {
      toast.error(error || "Could not reorder featured products");
      return;
    }
    invalidate();
  };

  return (
    <div className="space-y-6 pb-10 max-w-6xl mx-auto">
      {showOwnerPreviewBanner && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-foreground">
          You are previewing your shop as buyers see it.{" "}
          <Link to={sellerShopEditorPath()} className="font-medium text-primary underline">
            Back to storefront editor
          </Link>
        </div>
      )}

      {editMode && (
        <SellerStorefrontToolbar
          sellerId={sellerId}
          variant={variant}
          onAddProduct={onAddProduct}
        />
      )}

      <SellerStorefrontHero
        shop={shop}
        productCount={products.length}
        editMode={editMode}
        variant={variant}
        shopReturnPath={shopEditorPath}
        onEditInfo={() => {
          setEditForm({ description: shop.description || "", location: shop.location || "" });
          setEditInfoOpen(true);
        }}
        onUploadBanner={editMode ? (f) => handleUploadAsset("banner", f) : undefined}
        onUploadLogo={editMode ? (f) => handleUploadAsset("logo", f) : undefined}
        uploadingBanner={uploadingBanner}
        uploadingLogo={uploadingLogo}
      />

      {!editMode && sampleProductId && (
        <div className="flex justify-end">
          <TalkToSellerButton sellerId={sellerId} productId={sampleProductId} variant="chatNow" />
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search in this shop…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {(pinned.length > 0 || editMode) && (
        <SellerPinnedProducts
          products={pinned}
          editMode={editMode}
          pinDisabled={pinBusy || pinDisabled}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onMovePinned={editMode ? handleMovePinned : undefined}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
          onOpen={onNavigateProduct}
          onAddToCart={onAddToCart}
          onBuyNow={onBuyNow}
        />
      )}

      {showLaneSections ? (
        <SellerLaneSections
          products={gridProducts}
          fixedLanes={adminFixedLanes}
          editMode={editMode}
          pinDisabled={pinBusy || pinDisabled}
          pinnedIds={pinnedIds}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
          onOpen={onNavigateProduct}
          onAddToCart={onAddToCart}
          onBuyNow={onBuyNow}
        />
      ) : (
        <div className="text-center py-16 space-y-3 rounded-xl border bg-muted/20 px-4">
          <Store className="h-12 w-12 mx-auto text-muted-foreground/40" />
          {editMode ? (
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No live products in your shop yet. Add and get listings approved under Products in the sidebar, then return here to pin and arrange them.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">No products listed in this shop yet.</p>
              {sampleProductId && (
                <TalkToSellerButton sellerId={sellerId} productId={sampleProductId} variant="default" />
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit shop info</DialogTitle>
            <DialogDescription>Description and location appear on your public storefront.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="sfDescription">Description</Label>
              <Textarea
                id="sfDescription"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="sfLocation">Location</Label>
              <Input
                id="sfLocation"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              />
            </div>
            <Button
              className="w-full text-white"
              style={{ backgroundColor: MARKETPLACE_THEME.primary }}
              disabled={savingInfo}
              onClick={handleSaveInfo}
            >
              {savingInfo ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
