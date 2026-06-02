import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";

import {

  Table,

  TableBody,

  TableCell,

  TableHead,

  TableHeader,

  TableRow,

} from "@/components/ui/table";

import { Zap, Store, Loader2, Search, ShieldCheck, AlertCircle } from "lucide-react";

import { toast } from "sonner";

import { ICON_COLORS } from "@/lib/iconColors";

import { MARKETPLACE_THEME, marketplaceGradient } from "@/lib/marketplaceTheme";

import { productDiscountPercent } from "@/lib/marketplaceProduct";

import { adminSetProductFlashSale } from "@/lib/adminFlashSaleApi";

import type { AdminSellerRow } from "@/lib/adminMarketplaceApi";

import AdminFlashSalePendingRequests from "@/components/admin/AdminFlashSalePendingRequests";



type ProductRow = Record<string, unknown> & {

  id: string;

  name: string;

  seller_id: string;

  seller_name?: string;

  price: number;

  original_price?: number | null;

  stock?: number;

  is_flash_sale?: boolean;

  flash_sale_end?: string | null;

  listing_status?: string;

};



type ShopBrowserRow = {

  user_id: string;

  shop_name: string;

  owner_name?: string;

  is_verified?: boolean;

  product_count: number;

  fromFallback?: boolean;

};



function defaultFlashEndLocal(): string {

  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

}



function flashEndToLocal(iso?: string | null): string {

  if (!iso) return defaultFlashEndLocal();

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return defaultFlashEndLocal();

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

}



function formatFlashEndDisplay(iso?: string | null): string {

  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString();

}



function approvedCountForSeller(products: ProductRow[], sellerId: string): number {

  return products.filter(

    (p) =>

      String(p.seller_id) === sellerId && String(p.listing_status || "approved") === "approved",

  ).length;

}



function buildShopBrowserRows(shops: AdminSellerRow[], products: ProductRow[]): ShopBrowserRow[] {

  const rows: ShopBrowserRow[] = shops.map((s) => ({

    user_id: s.user_id,

    shop_name: s.shop_name?.trim() || "Unnamed shop",

    owner_name: s.owner_name,

    is_verified: s.is_verified,

    product_count: approvedCountForSeller(products, s.user_id),

  }));



  if (rows.length > 0) return rows;



  const bySeller = new Map<string, ShopBrowserRow>();

  for (const p of products) {

    const sid = String(p.seller_id || "");

    if (!sid) continue;

    const existing = bySeller.get(sid);

    const isApproved = String(p.listing_status || "approved") === "approved";

    if (!existing) {

      bySeller.set(sid, {

        user_id: sid,

        shop_name: (p.seller_name?.trim() || "Unnamed shop") as string,

        owner_name: p.seller_name,

        product_count: isApproved ? 1 : 0,

        fromFallback: true,

      });

    } else if (isApproved) {

      existing.product_count += 1;

    }

  }

  return [...bySeller.values()].sort((a, b) => a.shop_name.localeCompare(b.shop_name));

}



interface Props {

  shops: AdminSellerRow[];

  products: ProductRow[];

  initialShopUserId?: string | null;

  shopsLoading?: boolean;

  shopsLoadError?: boolean;

  productsLoading?: boolean;

  productsLoadError?: boolean;

  onProductsChange: () => void;

}



export default function AdminFlashSaleManager({

  shops,

  products,

  initialShopUserId,

  shopsLoading,

  shopsLoadError,

  productsLoading,

  productsLoadError,

  onProductsChange,

}: Props) {

  const [shopSearch, setShopSearch] = useState("");

  const [selectedShopUserId, setSelectedShopUserId] = useState<string | null>(initialShopUserId || null);

  const [savingId, setSavingId] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Record<string, { flashEnd: string; originalPrice: string }>>({});



  useEffect(() => {

    if (initialShopUserId) setSelectedShopUserId(initialShopUserId);

  }, [initialShopUserId]);



  const shopBrowserRows = useMemo(() => buildShopBrowserRows(shops, products), [shops, products]);



  const activeFlashProducts = useMemo(

    () => products.filter((p) => Boolean(p.is_flash_sale)),

    [products],

  );



  const shopsWithMeta = useMemo(() => {

    const q = shopSearch.trim().toLowerCase();

    return shopBrowserRows

      .filter((shop) => {

        if (!q) return true;

        return (

          shop.shop_name.toLowerCase().includes(q) ||

          (shop.owner_name || "").toLowerCase().includes(q)

        );

      })

      .sort((a, b) => a.shop_name.localeCompare(b.shop_name));

  }, [shopBrowserRows, shopSearch]);



  const selectedShop = shopsWithMeta.find((s) => s.user_id === selectedShopUserId) ?? null;



  const shopProducts = useMemo(() => {

    if (!selectedShopUserId) return [];

    return products

      .filter(

        (p) =>

          String(p.seller_id) === selectedShopUserId &&

          String(p.listing_status || "approved") === "approved",

      )

      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  }, [products, selectedShopUserId]);



  const catalogLoading = shopsLoading || productsLoading;

  const catalogError = shopsLoadError || productsLoadError;



  const getDraft = (p: ProductRow) => {

    const existing = drafts[p.id];

    if (existing) return existing;

    return {

      flashEnd: flashEndToLocal(p.flash_sale_end),

      originalPrice:

        p.original_price != null ? String(p.original_price) : String(Number(p.price) + 50),

    };

  };



  const setDraft = (id: string, patch: Partial<{ flashEnd: string; originalPrice: string }>) => {

    setDrafts((prev) => {

      const product = products.find((x) => x.id === id);

      const base = product ? getDraft(product) : { flashEnd: defaultFlashEndLocal(), originalPrice: "" };

      return { ...prev, [id]: { ...base, ...patch } };

    });

  };



  const saveFlash = async (product: ProductRow, enable: boolean) => {

    setSavingId(product.id);

    try {

      if (!enable) {

        const { ok, error } = await adminSetProductFlashSale(product.id, { is_flash_sale: false });

        if (!ok) throw new Error(error || "Failed to remove flash sale");

        toast.success("Removed from flash sale");

      } else {

        const draft = getDraft(product);

        const salePrice = Number(product.price);

        const originalPrice = Number(draft.originalPrice);

        if (!draft.flashEnd) throw new Error("End time is required");

        if (!Number.isFinite(originalPrice) || originalPrice <= salePrice) {

          throw new Error("Original price (MRP) must be higher than sale price");

        }

        const { ok, error } = await adminSetProductFlashSale(product.id, {

          is_flash_sale: true,

          flash_sale_end: new Date(draft.flashEnd).toISOString(),

          original_price: originalPrice,

        });

        if (!ok) throw new Error(error || "Failed to enable flash sale");

        toast.success("Added to flash sale");

      }

      onProductsChange();

    } catch (e) {

      toast.error(e instanceof Error ? e.message : "Save failed");

    } finally {

      setSavingId(null);

    }

  };



  const shopListEmptyMessage = () => {

    if (catalogLoading) return "Loading shops…";

    if (catalogError) return "Could not load shop list. Refresh and try again.";

    if (shopBrowserRows.length === 0) return "No sellers or shops yet.";

    if (shopsWithMeta.length === 0) return "No shops match your search.";

    return null;

  };



  const emptyMsg = shopListEmptyMessage();



  return (

    <div className="space-y-6">

      {(catalogError || productsLoadError) && (

        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">

          <AlertCircle className="h-4 w-4 shrink-0" />

          Some marketplace data failed to load. Flash sale controls may be incomplete.

        </div>

      )}



      <AdminFlashSalePendingRequests onChanged={onProductsChange} />



      <Card className="shadow-card overflow-hidden">

        <div className="h-1" style={{ background: marketplaceGradient() }} />

        <CardHeader>

          <CardTitle className="text-lg font-display flex items-center gap-2">

            <Zap className="h-5 w-5" style={{ color: MARKETPLACE_THEME.accent }} />

            Active flash sales ({activeFlashProducts.length})

          </CardTitle>

        </CardHeader>

        <CardContent className="p-0">

          {productsLoading ? (

            <p className="px-6 pb-6 text-sm text-muted-foreground flex items-center gap-2">

              <Loader2 className="h-4 w-4 animate-spin" />

              Loading flash sale products…

            </p>

          ) : activeFlashProducts.length === 0 ? (

            <p className="px-6 pb-6 text-sm text-muted-foreground">No products in flash sale right now.</p>

          ) : (

            <Table>

              <TableHeader>

                <TableRow>

                  <TableHead>Shop</TableHead>

                  <TableHead>Product</TableHead>

                  <TableHead>Price</TableHead>

                  <TableHead>MRP</TableHead>

                  <TableHead>Ends</TableHead>

                  <TableHead className="text-right">Action</TableHead>

                </TableRow>

              </TableHeader>

              <TableBody>

                {activeFlashProducts.map((p) => (

                  <TableRow key={p.id}>

                    <TableCell className="text-muted-foreground">{p.seller_name || "—"}</TableCell>

                    <TableCell className="font-medium">{p.name}</TableCell>

                    <TableCell>৳{Number(p.price).toLocaleString()}</TableCell>

                    <TableCell>

                      {p.original_price != null ? `৳${Number(p.original_price).toLocaleString()}` : "—"}

                    </TableCell>

                    <TableCell className="text-sm">{formatFlashEndDisplay(p.flash_sale_end)}</TableCell>

                    <TableCell className="text-right">

                      <Button

                        variant="outline"

                        size="sm"

                        disabled={savingId === p.id}

                        onClick={() => void saveFlash(p, false)}

                      >

                        {savingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Remove"}

                      </Button>

                    </TableCell>

                  </TableRow>

                ))}

              </TableBody>

            </Table>

          )}

        </CardContent>

      </Card>



      <div className="grid lg:grid-cols-[300px_1fr] gap-4">

        <Card className="shadow-card">

          <CardHeader className="pb-2">

            <CardTitle className="text-base font-display flex items-center gap-2">

              <Store className="h-4 w-4" style={{ color: ICON_COLORS.store }} />

              Shops ({shopBrowserRows.length})

            </CardTitle>

          </CardHeader>

          <CardContent className="space-y-3">

            <div className="relative">

              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

              <Input

                placeholder="Search shop or owner…"

                value={shopSearch}

                onChange={(e) => setShopSearch(e.target.value)}

                className="pl-8"

                disabled={catalogLoading}

              />

            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-1">

              {shopsWithMeta.map((shop) => (

                <button

                  key={shop.user_id}

                  type="button"

                  onClick={() => setSelectedShopUserId(shop.user_id)}

                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${

                    selectedShopUserId === shop.user_id

                      ? "bg-primary/10 text-foreground font-medium"

                      : "hover:bg-muted/60 text-muted-foreground"

                  }`}

                >

                  <div className="flex items-start justify-between gap-1">

                    <span className="block truncate font-medium text-foreground">{shop.shop_name}</span>

                    {shop.is_verified && (

                      <ShieldCheck

                        className="h-3.5 w-3.5 shrink-0"

                        style={{ color: ICON_COLORS.marketplace }}

                        aria-label="Verified shop"

                      />

                    )}

                  </div>

                  {shop.owner_name && (

                    <span className="block truncate text-xs opacity-80">{shop.owner_name}</span>

                  )}

                  <span className="text-xs opacity-80">

                    {shop.product_count} approved product{shop.product_count === 1 ? "" : "s"}

                    {shop.fromFallback ? " · from listings" : ""}

                  </span>

                </button>

              ))}

              {emptyMsg && (

                <p className="text-sm text-muted-foreground py-4 text-center">{emptyMsg}</p>

              )}

            </div>

          </CardContent>

        </Card>



        <Card className="shadow-card overflow-hidden">

          <CardHeader>

            <CardTitle className="text-base font-display">

              {selectedShop ? `Products — ${selectedShop.shop_name}` : "Select a shop"}

            </CardTitle>

            <p className="text-sm text-muted-foreground">

              Only approved listings can be added to the homepage Flash Sale section.

            </p>

          </CardHeader>

          <CardContent className="p-0">

            {catalogLoading && !selectedShopUserId ? (

              <p className="px-6 pb-6 text-sm text-muted-foreground flex items-center gap-2">

                <Loader2 className="h-4 w-4 animate-spin" />

                Loading products…

              </p>

            ) : !selectedShopUserId ? (

              <p className="px-6 pb-6 text-sm text-muted-foreground">Choose a shop from the list to manage flash sale.</p>

            ) : shopProducts.length === 0 ? (

              <p className="px-6 pb-6 text-sm text-muted-foreground">No approved products in this shop.</p>

            ) : (

              <Table>

                <TableHeader>

                  <TableRow>

                    <TableHead>Product</TableHead>

                    <TableHead>Stock</TableHead>

                    <TableHead>Price</TableHead>

                    <TableHead>Flash sale</TableHead>

                  </TableRow>

                </TableHeader>

                <TableBody>

                  {shopProducts.map((p) => {

                    const draft = getDraft(p);

                    const isOn = Boolean(p.is_flash_sale);

                    const discount = productDiscountPercent({

                      price: Number(p.price),

                      originalPrice: p.original_price != null ? Number(p.original_price) : undefined,

                    });

                    return (

                      <TableRow key={p.id}>

                        <TableCell>

                          <div className="space-y-1">

                            <p className="font-medium">{p.name}</p>

                            {isOn && (

                              <Badge

                                className="text-[10px]"

                                style={{ backgroundColor: MARKETPLACE_THEME.accent, color: "white" }}

                              >

                                <Zap className="h-2.5 w-2.5 mr-0.5" />

                                In flash sale

                              </Badge>

                            )}

                          </div>

                        </TableCell>

                        <TableCell>{p.stock ?? 0}</TableCell>

                        <TableCell>৳{Number(p.price).toLocaleString()}</TableCell>

                        <TableCell>

                          <div className="space-y-3 min-w-[220px]">

                            <div className="flex items-center justify-between gap-2">

                              <Label className="text-xs">Enable</Label>

                              <Switch

                                checked={isOn}

                                disabled={savingId === p.id}

                                onCheckedChange={(checked) => {

                                  if (!checked) void saveFlash(p, false);

                                  else setDraft(p.id, getDraft(p));

                                }}

                              />

                            </div>

                            {!isOn && (

                              <>

                                <div>

                                  <Label className="text-xs text-muted-foreground">MRP (৳)</Label>

                                  <Input

                                    type="number"

                                    min={0}

                                    value={draft.originalPrice}

                                    onChange={(e) => setDraft(p.id, { originalPrice: e.target.value })}

                                    className="h-8"

                                  />

                                </div>

                                <div>

                                  <Label className="text-xs text-muted-foreground">Ends at</Label>

                                  <Input

                                    type="datetime-local"

                                    value={draft.flashEnd}

                                    onChange={(e) => setDraft(p.id, { flashEnd: e.target.value })}

                                    className="h-8"

                                  />

                                </div>

                                <Button

                                  size="sm"

                                  className="w-full text-white"

                                  style={{ backgroundColor: MARKETPLACE_THEME.primary }}

                                  disabled={savingId === p.id}

                                  onClick={() => void saveFlash(p, true)}

                                >

                                  {savingId === p.id ? (

                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />

                                  ) : (

                                    "Add to flash sale"

                                  )}

                                </Button>

                              </>

                            )}

                            {isOn && discount > 0 && (

                              <p className="text-xs text-muted-foreground">

                                {discount}% off · ends {formatFlashEndDisplay(p.flash_sale_end)}

                              </p>

                            )}

                          </div>

                        </TableCell>

                      </TableRow>

                    );

                  })}

                </TableBody>

              </Table>

            )}

          </CardContent>

        </Card>

      </div>

    </div>

  );

}

