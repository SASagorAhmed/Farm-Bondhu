import { useEffect, useMemo, useState } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePlus, Tag, Truck, Zap, Loader2 } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import {
  EMPTY_PRODUCT_FORM,
  ProductFormErrors,
  ProductFormValues,
  UNIT_PRESETS,
  computeFormDiscountPercent,
  getCategoryGroups,
  validateProductForm,
} from "@/lib/marketplaceProductForm";

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValues?: ProductFormValues;
  title?: string;
  description?: string;
  submitLabel?: string;
  accentColor?: string;
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
  onSubmit,
}: ProductFormDialogProps) {
  const [values, setValues] = useState<ProductFormValues>(EMPTY_PRODUCT_FORM);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { pharmacy, farm } = useMemo(() => getCategoryGroups(), []);
  const discount = computeFormDiscountPercent(values.original_price, values.price);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues ? { ...initialValues, imageFile: null } : { ...EMPTY_PRODUCT_FORM });
    setErrors({});
    setPreviewUrl(initialValues?.image || null);
  }, [open, initialValues]);

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
              "Add photo, pricing, stock, delivery, and optional flash sale or wholesale pricing."}
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
              <div>
                <Label>Category</Label>
                <Select value={values.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Pharmacy</SelectLabel>
                      {pharmacy.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Farm</SelectLabel>
                      {farm.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>{c.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
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
              <Label>Stock quantity</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={values.stock}
                onChange={(e) => set("stock", e.target.value)}
              />
              {errors.stock && <p className="text-xs text-destructive mt-1">{errors.stock}</p>}
            </div>
          </div>

          <Separator />

          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4" style={{ color: accentColor }} />
                <Label className="font-semibold">Free delivery</Label>
              </div>
              <Switch checked={values.free_delivery} onCheckedChange={(v) => set("free_delivery", v)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Platform shipping is ৳60 per order unless any item has free delivery.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" style={{ color: MARKETPLACE_THEME.accent }} />
                <Label className="font-semibold">Flash sale</Label>
              </div>
              <Switch checked={values.is_flash_sale} onCheckedChange={(v) => set("is_flash_sale", v)} />
            </div>
            {values.is_flash_sale && (
              <div>
                <Label className="text-xs text-muted-foreground">Sale ends at</Label>
                <Input
                  type="datetime-local"
                  value={values.flash_sale_end}
                  onChange={(e) => set("flash_sale_end", e.target.value)}
                />
                {errors.flash_sale_end && (
                  <p className="text-xs text-destructive mt-1">{errors.flash_sale_end}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Product appears in the homepage Flash Sale row with countdown timer.
                </p>
              </div>
            )}
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
              <div className="grid grid-cols-2 gap-3">
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
