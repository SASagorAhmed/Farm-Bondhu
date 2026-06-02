import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePlus, Tag, Truck, Loader2, Palette } from "lucide-react";
import { PHOTO_EDITOR_EXPORT_URL_KEY } from "@/features/photoEditor/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import type { MarketplaceLane } from "@/lib/marketplaceCategories";
import { getLaneForProductCategory, getSubcategoriesForLane } from "@/lib/marketplaceCategories";
import { ALL_MARKETPLACE_LANES, laneLabel } from "@/lib/marketplaceLaneLabels";
import {
  EMPTY_PRODUCT_FORM,
  ProductFormErrors,
  ProductFormValues,
  WholesaleRule,
  UNIT_PRESETS,
  computeFormDiscountPercent,
  validateProductForm,
  wholesalePreviewText,
} from "@/lib/marketplaceProductForm";

type ProductLane = Exclude<MarketplaceLane, "all">;

function resolveInitialPickerLane(
  lanes: readonly ProductLane[],
  category: string,
  defaultLane?: ProductLane,
): ProductLane | "" {
  if (!lanes.length) return "";
  const fromCategory = getLaneForProductCategory(category);
  if (fromCategory !== "all" && lanes.includes(fromCategory)) return fromCategory;
  if (defaultLane && lanes.includes(defaultLane)) return defaultLane;
  if (lanes.length === 1) return lanes[0];
  return "";
}

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValues?: ProductFormValues;
  title?: string;
  description?: string;
  submitLabel?: string;
  accentColor?: string;
  /** Top marketplace lanes shown in the category picker (e.g. seller-approved lanes). */
  allowedLanes?: readonly ProductLane[];
  /** Single-lane picker (e.g. product detail edit). Ignored when allowedLanes is set. */
  allowedLane?: ProductLane;
  /** Pre-select marketplace lane on create (e.g. active products tab). */
  defaultPickerLane?: ProductLane;
  /** Override "Create with Photo Editor" destination (defaults to seller flow). */
  photoEditorCreateUrl?: string;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
  );
}

export default function ProductFormDialog({
  open,
  onOpenChange,
  mode,
  initialValues,
  title,
  description,
  submitLabel,
  accentColor = ICON_COLORS.marketplace,
  allowedLanes,
  allowedLane,
  defaultPickerLane,
  photoEditorCreateUrl,
  onSubmit,
}: ProductFormDialogProps) {
  const defaultPhotoEditorCreateUrl = `/seller/photo-editor/edit/new?preset=product_photo&target=product&returnTo=${encodeURIComponent("/seller/products")}`;
  const navigate = useNavigate();
  const [values, setValues] = useState<ProductFormValues>(EMPTY_PRODUCT_FORM);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickerLane, setPickerLane] = useState<ProductLane | "">("");

  const pickerLanes = useMemo((): ProductLane[] => {
    if (allowedLanes?.length) return [...allowedLanes];
    if (allowedLane) return [allowedLane];
    return [...ALL_MARKETPLACE_LANES];
  }, [allowedLanes, allowedLane]);

  const subcategoriesForPicker = useMemo(
    () => (pickerLane ? getSubcategoriesForLane(pickerLane) : []),
    [pickerLane],
  );

  const showLaneSelect = pickerLanes.length > 1;
  const discount = computeFormDiscountPercent(values.original_price, values.price);

  useEffect(() => {
    if (!open) return;
    const nextValues = initialValues ? { ...initialValues, imageFile: null } : { ...EMPTY_PRODUCT_FORM };
    setValues(nextValues);
    setErrors({});
    setPreviewUrl(nextValues.image || null);
    setPickerLane(
      resolveInitialPickerLane(
        pickerLanes,
        nextValues.category,
        mode === "create" ? defaultPickerLane : undefined,
      ),
    );
    const exported = sessionStorage.getItem(PHOTO_EDITOR_EXPORT_URL_KEY);
    if (exported) {
      sessionStorage.removeItem(PHOTO_EDITOR_EXPORT_URL_KEY);
      setValues((prev) => ({ ...prev, image: exported, imageFile: null }));
      setPreviewUrl(exported);
    }
  }, [open, initialValues, pickerLanes, mode, defaultPickerLane]);

  useEffect(() => {
    if (!values.imageFile) return;
    const url = URL.createObjectURL(values.imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [values.imageFile]);

  const set = <K extends keyof ProductFormValues>(key: K, val: ProductFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => ({ ...prev, [key]: undefined, submit: undefined }));
  };

  const handleSubmit = async () => {
    const nextErrors = validateProductForm(values, mode);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (e) {
      setErrors({ submit: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {title ?? (mode === "edit" ? "Edit Product" : "Add New Product")}
          </DialogTitle>
          <DialogDescription>
            {description ??
              "Add photo, pricing, stock, delivery, and optional wholesale pricing."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="space-y-3">
            <SectionTitle>Basic information</SectionTitle>
            <div>
              <Label>Product name</Label>
              <Input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Layer Feed Premium (50kg)"
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-3">
                {showLaneSelect ? (
                  <div>
                    <Label>Marketplace category</Label>
                    <Select
                      value={pickerLane || undefined}
                      onValueChange={(lane) => {
                        setPickerLane(lane as ProductLane);
                        set("category", "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select marketplace category" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickerLanes.map((lane) => (
                          <SelectItem key={lane} value={lane}>
                            {laneLabel(lane)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : pickerLanes.length === 1 ? (
                  <div>
                    <Label>Marketplace category</Label>
                    <p className="text-sm text-muted-foreground py-2">{laneLabel(pickerLanes[0])}</p>
                  </div>
                ) : null}
                <div>
                  <Label>Subcategory</Label>
                  <Select
                    value={values.category || undefined}
                    onValueChange={(v) => set("category", v)}
                    disabled={!pickerLane}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          pickerLane ? "Select subcategory" : "Select marketplace category first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(60vh,16rem)]">
                      {subcategoriesForPicker.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-xs text-destructive mt-1">{errors.category}</p>
                  )}
                </div>
              </div>
              <div>
                <Label>Unit / pack size</Label>
                <Input
                  value={values.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  placeholder="piece, kg, bag..."
                  list="product-unit-presets"
                />
                <datalist id="product-unit-presets">
                  {UNIT_PRESETS.map((u) => <option key={u} value={u} />)}
                </datalist>
                {errors.unit && <p className="text-xs text-destructive mt-1">{errors.unit}</p>}
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Describe your product..."
                rows={3}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Product photo</SectionTitle>
            <div className="flex items-start gap-4">
              <div className="h-24 w-24 rounded-lg border border-dashed border-border flex items-center justify-center overflow-hidden bg-accent/20 shrink-0">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-contain" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    set("imageFile", file);
                    setErrors((prev) => ({ ...prev, image: undefined }));
                  }}
                />
                <p className="text-xs text-muted-foreground">JPG or PNG, max 5MB. Required for new listings.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(photoEditorCreateUrl ?? defaultPhotoEditorCreateUrl);
                  }}
                >
                  <Palette className="h-3.5 w-3.5" />
                  Create with Photo Editor
                </Button>
                {errors.image && <p className="text-xs text-destructive">{errors.image}</p>}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Pricing</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Original price / MRP (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  value={values.original_price}
                  onChange={(e) => set("original_price", e.target.value)}
                  placeholder="Optional"
                />
                {errors.original_price && (
                  <p className="text-xs text-destructive mt-1">{errors.original_price}</p>
                )}
              </div>
              <div>
                <Label>Sale price (৳)</Label>
                <Input
                  type="number"
                  min={0}
                  value={values.price}
                  onChange={(e) => set("price", e.target.value)}
                />
                {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
              </div>
            </div>
            {discount > 0 && (
              <Badge style={{ backgroundColor: MARKETPLACE_THEME.accent, color: "white" }}>
                {discount}% discount
              </Badge>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <SectionTitle>Inventory</SectionTitle>
            <div className="max-w-xs">
              <Label>Available stock (units)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={values.stock}
                onChange={(e) => set("stock", e.target.value)}
              />
              {errors.stock && <p className="text-xs text-destructive mt-1">{errors.stock}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Decreases automatically when orders are placed. Update this to restock.
              </p>
            </div>
          </div>

          <Separator />

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: accentColor }} />
                <Label className="font-semibold">Free delivery</Label>
              </div>
              <Switch checked={values.free_delivery} onCheckedChange={(v) => set("free_delivery", v)} />
            </div>
            {!values.free_delivery && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-xs text-muted-foreground">Dhaka metro delivery (৳)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={values.delivery_charge_dhaka}
                    onChange={(e) => set("delivery_charge_dhaka", e.target.value)}
                  />
                  {errors.delivery_charge_dhaka && (
                    <p className="text-xs text-destructive mt-1">{errors.delivery_charge_dhaka}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Outside Dhaka delivery (৳)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={values.delivery_charge_outside}
                    onChange={(e) => set("delivery_charge_outside", e.target.value)}
                  />
                  {errors.delivery_charge_outside && (
                    <p className="text-xs text-destructive mt-1">{errors.delivery_charge_outside}</p>
                  )}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Default platform rates are ৳80 (Dhaka metro) and ৳120 (other areas). One delivery fee applies per top category in an order; same category uses the highest product charge.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" style={{ color: ICON_COLORS.finance }} />
                <Label className="font-semibold">Wholesale pricing</Label>
              </div>
              <Switch
                checked={values.wholesaleEnabled}
                onCheckedChange={(v) => set("wholesaleEnabled", v)}
              />
            </div>
            {values.wholesaleEnabled && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Wholesale price (৳)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={values.wholesale_price}
                    onChange={(e) => set("wholesale_price", e.target.value)}
                  />
                  {errors.wholesale_price && (
                    <p className="text-xs text-destructive mt-1">{errors.wholesale_price}</p>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Discount unlock rule</Label>
                  <RadioGroup
                    value={values.wholesale_rule}
                    onValueChange={(v) => set("wholesale_rule", v as WholesaleRule)}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="quantity" id="wh-rule-qty" />
                      <Label htmlFor="wh-rule-qty" className="font-normal text-sm">Minimum quantity</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="order_value" id="wh-rule-value" />
                      <Label htmlFor="wh-rule-value" className="font-normal text-sm">Minimum order value (৳ on this line)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="quantity_and_value" id="wh-rule-both" />
                      <Label htmlFor="wh-rule-both" className="font-normal text-sm">Both quantity and value</Label>
                    </div>
                  </RadioGroup>
                </div>

                {(values.wholesale_rule === "quantity" || values.wholesale_rule === "quantity_and_value") && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Min order qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={values.wholesale_min_qty}
                      onChange={(e) => set("wholesale_min_qty", e.target.value)}
                    />
                    {errors.wholesale_min_qty && (
                      <p className="text-xs text-destructive mt-1">{errors.wholesale_min_qty}</p>
                    )}
                  </div>
                )}

                {(values.wholesale_rule === "order_value" || values.wholesale_rule === "quantity_and_value") && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Min order value (৳ at retail price)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={values.wholesale_min_order_bdt}
                      onChange={(e) => set("wholesale_min_order_bdt", e.target.value)}
                    />
                    {errors.wholesale_min_order_bdt && (
                      <p className="text-xs text-destructive mt-1">{errors.wholesale_min_order_bdt}</p>
                    )}
                  </div>
                )}

                {wholesalePreviewText(values) && (
                  <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
                    {wholesalePreviewText(values)}
                  </p>
                )}
              </div>
            )}
          </div>

          {errors.submit && <p className="text-sm text-destructive">{errors.submit}</p>}

          <Button
            className="w-full text-white"
            style={{ backgroundColor: accentColor }}
            disabled={saving}
            onClick={() => void handleSubmit()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              submitLabel ?? (mode === "edit" ? "Update Product" : "Add Product")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
