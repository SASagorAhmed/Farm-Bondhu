import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, Shield } from "lucide-react";
import { SELLER_ONBOARDING_LANES } from "@/lib/marketplaceLaneLabels";
import {
  resubmitSellerLanes,
  submitSellerOnboarding,
  uploadSellerLicense,
  type SellerOnboardingLaneInput,
} from "@/lib/sellerOnboardingApi";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";

interface Props {
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Resubmit rejected lanes only */
  resubmitLanes?: string[];
  defaultBusinessName?: string;
  defaultPhone?: string;
  defaultLocation?: string;
}

type LaneDraft = {
  selected: boolean;
  license_number: string;
  license_file_url: string;
  uploading: boolean;
};

function initialLaneDrafts(selected?: Set<string>): Record<string, LaneDraft> {
  const out: Record<string, LaneDraft> = {};
  for (const { lane } of SELLER_ONBOARDING_LANES) {
    out[lane] = {
      selected: selected ? selected.has(lane) : false,
      license_number: "",
      license_file_url: "",
      uploading: false,
    };
  }
  return out;
}

export default function SellerOnboardingForm({
  onSuccess,
  onCancel,
  resubmitLanes,
  defaultBusinessName = "",
  defaultPhone = "",
  defaultLocation = "",
}: Props) {
  const isResubmit = Boolean(resubmitLanes?.length);
  const [businessName, setBusinessName] = useState(defaultBusinessName);
  const [phone, setPhone] = useState(defaultPhone);
  const [location, setLocation] = useState(defaultLocation);
  const [laneDrafts, setLaneDrafts] = useState<Record<string, LaneDraft>>(() =>
    initialLaneDrafts(isResubmit ? new Set(resubmitLanes) : undefined)
  );
  const [submitting, setSubmitting] = useState(false);

  const setLane = (lane: string, patch: Partial<LaneDraft>) => {
    setLaneDrafts((prev) => ({ ...prev, [lane]: { ...prev[lane], ...patch } }));
  };

  const handleLicenseFile = async (lane: string, file: File | null) => {
    if (!file) return;
    setLane(lane, { uploading: true });
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      const result = await uploadSellerLicense(dataUrl);
      setLane(lane, { uploading: false });
      if (!result.ok || !result.url) {
        toast.error(result.error || "License upload failed");
        return;
      }
      setLane(lane, { license_file_url: result.url });
      toast.success("License uploaded");
    };
    reader.onerror = () => {
      setLane(lane, { uploading: false });
      toast.error("Could not read file");
    };
    reader.readAsDataURL(file);
  };

  const buildSelectedLanes = (): SellerOnboardingLaneInput[] => {
    const lanes: SellerOnboardingLaneInput[] = [];
    for (const { lane, licenseRequired } of SELLER_ONBOARDING_LANES) {
      const draft = laneDrafts[lane];
      if (!draft?.selected) continue;
      if (licenseRequired) {
        if (!draft.license_number.trim() || !draft.license_file_url) {
          throw new Error(`License required for ${lane}`);
        }
      }
      lanes.push({
        lane,
        license_number: draft.license_number.trim() || null,
        license_file_url: draft.license_file_url || null,
      });
    }
    return lanes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isResubmit) {
      if (!businessName.trim() || !phone.trim() || !location.trim()) {
        toast.error("Business name, phone, and location are required");
        return;
      }
    }
    let lanes: SellerOnboardingLaneInput[];
    try {
      lanes = buildSelectedLanes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Complete license fields");
      return;
    }
    if (lanes.length === 0) {
      toast.error("Select at least one marketplace category");
      return;
    }

    setSubmitting(true);
    const result = isResubmit
      ? await resubmitSellerLanes(lanes)
      : await submitSellerOnboarding({
          business_name: businessName.trim(),
          phone: phone.trim(),
          location: location.trim(),
          lanes,
        });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error || "Submission failed");
      return;
    }
    toast.success(isResubmit ? "Lane resubmitted for review" : "Seller application submitted");
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!isResubmit && (
        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
            <CardDescription>One shop — you can sell in multiple categories after approval.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="so-business">Business name</Label>
              <Input id="so-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="so-phone">Phone</Label>
              <Input id="so-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required className="mt-1" />
            </div>
            <div>
              <Label htmlFor="so-location">Location</Label>
              <Input id="so-location" value={location} onChange={(e) => setLocation(e.target.value)} required className="mt-1" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Marketplace categories</CardTitle>
          <CardDescription>Select at least one. Regulated categories require a trade license.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {SELLER_ONBOARDING_LANES.map(({ lane, label, licenseRequired }) => {
            const draft = laneDrafts[lane];
            const locked = isResubmit && !resubmitLanes?.includes(lane);
            return (
              <div
                key={lane}
                className="rounded-xl border p-4 space-y-3"
                style={{ borderColor: draft.selected ? `${ICON_COLORS.cart}55` : undefined }}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`lane-${lane}`}
                    checked={draft.selected}
                    disabled={locked}
                    onCheckedChange={(v) => setLane(lane, { selected: Boolean(v) })}
                  />
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`lane-${lane}`} className="font-medium cursor-pointer">
                      {label}
                    </Label>
                    {licenseRequired && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Shield className="h-3 w-3" /> License required
                      </p>
                    )}
                  </div>
                </div>
                {draft.selected && licenseRequired && (
                  <div className="grid gap-3 md:grid-cols-2 pl-7">
                    <div>
                      <Label htmlFor={`lic-num-${lane}`}>License number</Label>
                      <Input
                        id={`lic-num-${lane}`}
                        value={draft.license_number}
                        onChange={(e) => setLane(lane, { license_number: e.target.value })}
                        className="mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label>License document</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={draft.uploading} asChild>
                          <label className="cursor-pointer">
                            {draft.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            <span className="ml-2">{draft.license_file_url ? "Replace file" : "Upload"}</span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="sr-only"
                              onChange={(e) => void handleLicenseFile(lane, e.target.files?.[0] || null)}
                            />
                          </label>
                        </Button>
                        {draft.license_file_url && (
                          <a href={draft.license_file_url} target="_blank" rel="noreferrer" className="text-xs text-primary truncate">
                            View uploaded
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting} style={{ backgroundColor: ICON_COLORS.cart }} className="text-white">
          {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isResubmit ? "Resubmit for review" : "Submit application"}
        </Button>
      </div>
    </form>
  );
}
