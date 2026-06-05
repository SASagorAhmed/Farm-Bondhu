import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ICON_COLORS } from "@/lib/iconColors";

export type SaleRecordFormValues = {
  date: string;
  product: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  buyer: string;
};

type Props = {
  form: SaleRecordFormValues;
  onChange: (patch: Partial<SaleRecordFormValues>) => void;
};

export default function SaleRecordFormFields({ form, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Date</Label>
          <Input type="date" value={form.date} onChange={(e) => onChange({ date: e.target.value })} />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => onChange({ category: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eggs">Eggs</SelectItem>
              <SelectItem value="milk">Milk</SelectItem>
              <SelectItem value="meat">Meat</SelectItem>
              <SelectItem value="live_animals">Live Animals</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Product Name</Label>
        <Input value={form.product} onChange={(e) => onChange({ product: e.target.value })} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Quantity</Label>
          <Input
            type="number"
            value={form.quantity || ""}
            onChange={(e) => onChange({ quantity: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label>Unit</Label>
          <Input value={form.unit} onChange={(e) => onChange({ unit: e.target.value })} />
        </div>
        <div>
          <Label>Unit Price (৳)</Label>
          <Input
            type="number"
            value={form.unitPrice || ""}
            onChange={(e) => onChange({ unitPrice: Number(e.target.value) })}
          />
        </div>
      </div>
      <div>
        <Label>Buyer</Label>
        <Input value={form.buyer} onChange={(e) => onChange({ buyer: e.target.value })} />
      </div>
      {form.quantity > 0 && form.unitPrice > 0 && (
        <p className="text-sm font-medium" style={{ color: ICON_COLORS.farmBrand }}>
          Total: ৳{(form.quantity * form.unitPrice).toLocaleString()}
        </p>
      )}
    </div>
  );
}
