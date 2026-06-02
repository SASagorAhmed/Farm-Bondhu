import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  createEmptyAddressForm,
  getAreas,
  getCountries,
  getDistricts,
  getDivisions,
  getUpazilas,
  resetAfterCountryChange,
  resetAfterDistrictChange,
  resetAfterDivisionChange,
  resetAfterUpazilaChange,
  type AddressType,
  type UserAddressFormValues,
  formToPayload,
} from "@/lib/bangladeshLocations";
import { formatBangladeshMobileHint, isValidBangladeshMobile } from "@/lib/bangladeshPhone";

interface UserAddressFormProps {
  initial?: Partial<UserAddressFormValues>;
  submitLabel?: string;
  saving?: boolean;
  showDefaultToggle?: boolean;
  defaultChecked?: boolean;
  onDefaultChange?: (value: boolean) => void;
  onSubmit: (payload: ReturnType<typeof formToPayload>, form: UserAddressFormValues) => void | Promise<void>;
}

export default function UserAddressForm({
  initial,
  submitLabel = "Save Address",
  saving = false,
  showDefaultToggle = true,
  defaultChecked = false,
  onDefaultChange,
  onSubmit,
}: UserAddressFormProps) {
  const [form, setForm] = useState<UserAddressFormValues>(() => createEmptyAddressForm(initial));
  const [errors, setErrors] = useState<string[]>([]);

  const divisions = useMemo(() => getDivisions(), []);
  const districts = useMemo(
    () => (form.divisionId ? getDistricts(form.divisionId) : []),
    [form.divisionId]
  );
  const upazilas = useMemo(
    () => (form.divisionId && form.districtId ? getUpazilas(form.divisionId, form.districtId) : []),
    [form.divisionId, form.districtId]
  );
  const areas = useMemo(
    () =>
      form.divisionId && form.districtId && form.upazilaId
        ? getAreas(form.divisionId, form.districtId, form.upazilaId)
        : [],
    [form.divisionId, form.districtId, form.upazilaId]
  );

  const validate = (): boolean => {
    const next: string[] = [];
    if (!form.fullName.trim()) next.push("Full name is required");
    if (!isValidBangladeshMobile(form.phone)) next.push(`Mobile number must be ${formatBangladeshMobileHint()}`);
    if (form.altPhone.trim() && !isValidBangladeshMobile(form.altPhone)) {
      next.push(`Alternative mobile must be ${formatBangladeshMobileHint()}`);
    }
    if (!form.country) next.push("Country is required");
    if (!form.divisionId) next.push("Division is required");
    if (!form.districtId) next.push("District is required");
    if (!form.upazilaId) next.push("Upazila/Thana is required");
    if (!form.fullAddress.trim()) next.push("Full address is required");
    setErrors(next);
    return next.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(formToPayload(form, defaultChecked), form);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.map((err) => (
            <p key={err}>{err}</p>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="addrFullName">Full Name *</Label>
          <Input
            id="addrFullName"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Full name"
          />
        </div>
        <div>
          <Label htmlFor="addrPhone">Mobile Number *</Label>
          <Input
            id="addrPhone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="01XXXXXXXXX"
          />
        </div>
        <div>
          <Label htmlFor="addrAltPhone">Alternative Mobile Number</Label>
          <Input
            id="addrAltPhone"
            value={form.altPhone}
            onChange={(e) => setForm((f) => ({ ...f, altPhone: e.target.value }))}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Country *</Label>
          <Select
            value={form.country}
            onValueChange={(value) => setForm((f) => resetAfterCountryChange(f, value))}
          >
            <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
            <SelectContent>
              {getCountries().map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Division *</Label>
          <Select
            value={form.divisionId || undefined}
            disabled={!form.country}
            onValueChange={(value) => setForm((f) => resetAfterDivisionChange(f, value))}
          >
            <SelectTrigger><SelectValue placeholder="Select division" /></SelectTrigger>
            <SelectContent>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>District *</Label>
          <Select
            value={form.districtId || undefined}
            disabled={!form.divisionId}
            onValueChange={(value) => setForm((f) => resetAfterDistrictChange(f, value))}
          >
            <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Upazila / Thana *</Label>
          <Select
            value={form.upazilaId || undefined}
            disabled={!form.districtId}
            onValueChange={(value) => setForm((f) => resetAfterUpazilaChange(f, value))}
          >
            <SelectTrigger><SelectValue placeholder="Select upazila/thana" /></SelectTrigger>
            <SelectContent>
              {upazilas.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="addrArea">Area / Union / Ward</Label>
          {areas.length > 0 ? (
            <Select value={form.area || undefined} onValueChange={(value) => setForm((f) => ({ ...f, area: value }))}>
              <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="addrArea"
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              placeholder="Union, ward, or village name"
            />
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="addrFullAddress">Full Address *</Label>
        <Textarea
          id="addrFullAddress"
          value={form.fullAddress}
          onChange={(e) => setForm((f) => ({ ...f, fullAddress: e.target.value }))}
          placeholder="House number, road, village, shop or building name"
          rows={3}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="addrLandmark">Landmark</Label>
          <Input
            id="addrLandmark"
            value={form.landmark}
            onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
            placeholder="Near mosque, school, bazar..."
          />
        </div>
        <div>
          <Label htmlFor="addrPostCode">Post Code</Label>
          <Input
            id="addrPostCode"
            value={form.postCode}
            onChange={(e) => setForm((f) => ({ ...f, postCode: e.target.value }))}
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <Label>Address Type</Label>
        <RadioGroup
          value={form.addressType}
          onValueChange={(value) => setForm((f) => ({ ...f, addressType: value as AddressType }))}
          className="flex flex-wrap gap-4 pt-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="home" id="addrTypeHome" />
            <Label htmlFor="addrTypeHome" className="font-normal">Home</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="office" id="addrTypeOffice" />
            <Label htmlFor="addrTypeOffice" className="font-normal">Office</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="other" id="addrTypeOther" />
            <Label htmlFor="addrTypeOther" className="font-normal">Other</Label>
          </div>
        </RadioGroup>
      </div>

      {showDefaultToggle && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={defaultChecked}
            onChange={(e) => onDefaultChange?.(e.target.checked)}
          />
          Set as default address
        </label>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
