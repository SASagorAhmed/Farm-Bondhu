import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { API_BASE, readSession } from "@/api/client";
import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { UserCircle, Mail, Phone, MapPin, Shield, FileText, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ICON_COLORS, iconBg } from "@/lib/iconColors";
import RoleChangeRequest from "@/components/profile/RoleChangeRequest";

type VetProfile = {
  id?: string;
  full_name: string;
  phone: string;
  email: string;
  district: string;
  address: string;
  specialization: string;
  experience_years: number;
  consultation_fee: number;
  profile_image_url: string;
  verification_document_url: string;
  verification_status?: "pending" | "approved" | "rejected";
  rejection_reason?: string | null;
  is_profile_complete?: boolean;
};

const EMPTY_PROFILE: VetProfile = {
  full_name: "",
  phone: "",
  email: "",
  district: "",
  address: "",
  specialization: "",
  experience_years: 0,
  consultation_fee: 500,
  profile_image_url: "",
  verification_document_url: "",
};

async function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function VetProfilePage() {
  const { user, session } = useAuth();
  const [form, setForm] = useState<VetProfile>(EMPTY_PROFILE);
  const [initialVetForm, setInitialVetForm] = useState<VetProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [vetEditing, setVetEditing] = useState(false);
  const [latestFetchedForm, setLatestFetchedForm] = useState<VetProfile>(EMPTY_PROFILE);
  const [hasHydratedView, setHasHydratedView] = useState(false);

  useEffect(() => {
    if (!session || !user) return;
    let active = true;
    const token = readSession()?.access_token;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/v1/medibondhu/vet-profile/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const body = (await res.json().catch(() => ({}))) as { data?: Partial<VetProfile>; error?: string };
        if (active && res.ok && body.data) {
          const incoming = body.data;
          setLatestFetchedForm((previous) => {
            const hydrated = {
              ...EMPTY_PROFILE,
              ...previous,
              ...incoming,
              full_name: String(incoming.full_name ?? previous.full_name ?? user.name ?? ""),
              phone: String(incoming.phone ?? previous.phone ?? user.phone ?? ""),
              email: String(incoming.email ?? previous.email ?? user.email ?? ""),
              district: String(incoming.district ?? previous.district ?? user.location ?? ""),
              address: String(incoming.address ?? previous.address ?? user.location ?? ""),
              specialization: String(incoming.specialization ?? previous.specialization ?? ""),
              experience_years: Number(
                incoming.experience_years ?? previous.experience_years ?? 0
              ),
              consultation_fee: Number(
                incoming.consultation_fee ?? previous.consultation_fee ?? 500
              ),
            };
            if (!vetEditing) {
              const unchanged =
                form.full_name === hydrated.full_name &&
                form.phone === hydrated.phone &&
                form.email === hydrated.email &&
                form.district === hydrated.district &&
                form.address === hydrated.address &&
                form.specialization === hydrated.specialization &&
                Number(form.experience_years) === Number(hydrated.experience_years) &&
                Number(form.consultation_fee) === Number(hydrated.consultation_fee) &&
                form.profile_image_url === hydrated.profile_image_url &&
                form.verification_document_url === hydrated.verification_document_url &&
                (form.verification_status || "pending") === (hydrated.verification_status || "pending");
              if (unchanged) return hydrated;
              setForm(hydrated);
              setInitialVetForm(hydrated);
            }
            return hydrated;
          });
          setHasHydratedView(true);
        } else if (active) {
          const fallback = {
            ...EMPTY_PROFILE,
            full_name: user.name || "",
            phone: user.phone || "",
            email: user.email || "",
            district: user.location || "",
            address: user.location || "",
          };
          setLatestFetchedForm(fallback);
          if (!vetEditing) {
            setForm(fallback);
            setInitialVetForm(fallback);
          }
          setHasHydratedView(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [session, user, vetEditing]);

  const verificationLabel = useMemo(() => {
    const status = form.verification_status || "pending";
    if (status === "approved") return { text: "Approved", tone: "bg-secondary/15 text-secondary" };
    if (status === "rejected") return { text: "Rejected", tone: "bg-destructive/15 text-destructive" };
    return { text: "Pending Verification", tone: "bg-yellow-100 text-yellow-800" };
  }, [form.verification_status]);

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!form.full_name?.trim()) missing.push("Full name");
    if (!form.phone?.trim()) missing.push("Phone");
    if (!form.email?.trim()) missing.push("Email");
    if (!form.district?.trim()) missing.push("District");
    if (!form.address?.trim()) missing.push("Address");
    if (!form.specialization?.trim()) missing.push("Specialization");
    if (!Number.isFinite(Number(form.experience_years)) || Number(form.experience_years) < 0) missing.push("Experience years");
    if (!Number.isFinite(Number(form.consultation_fee)) || Number(form.consultation_fee) < 0) missing.push("Consultation fee");
    if (!form.profile_image_url?.trim()) missing.push("Profile image");
    if (!form.verification_document_url?.trim()) missing.push("Verification document");
    return missing;
  }, [form]);

  const canSubmit = missingFields.length === 0 && !loading && !uploadingProfileImage && !uploadingDocument;

  const uploadFile = async (file: File, purpose: "profile_image" | "verification_document") => {
    const token = readSession()?.access_token;
    const dataUrl = await toDataUrl(file);
    const res = await fetch(`${API_BASE}/v1/medibondhu/vet-profile/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        purpose,
        file_data: dataUrl,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { data?: { url?: string }; error?: string };
    if (!res.ok || !body.data?.url) {
      throw new Error(body.error || "Upload failed");
    }
    return body.data.url;
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>, purpose: "profile_image" | "verification_document") => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (purpose === "profile_image") setUploadingProfileImage(true);
      else setUploadingDocument(true);
      const url = await uploadFile(file, purpose);
      setForm((prev) => ({
        ...prev,
        profile_image_url: purpose === "profile_image" ? url : prev.profile_image_url,
        verification_document_url: purpose === "verification_document" ? url : prev.verification_document_url,
      }));
      setInitialVetForm((prev) => ({
        ...prev,
        profile_image_url: purpose === "profile_image" ? url : prev.profile_image_url,
        verification_document_url: purpose === "verification_document" ? url : prev.verification_document_url,
      }));
      toast({ title: "Upload complete" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Upload failed";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      if (purpose === "profile_image") setUploadingProfileImage(false);
      else setUploadingDocument(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!session) return;
    const token = readSession()?.access_token;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/v1/medibondhu/vet-profile/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          district: form.district.trim(),
          address: form.address.trim(),
          specialization: form.specialization.trim(),
          experience_years: Number(form.experience_years),
          consultation_fee: Number(form.consultation_fee),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: VetProfile; error?: string };
      if (!res.ok || !body.data) {
        throw new Error(body.error || "Failed to save profile");
      }
      setForm((prev) => ({ ...prev, ...body.data }));
      setInitialVetForm((prev) => ({ ...prev, ...body.data }));
      setLatestFetchedForm((prev) => ({ ...prev, ...body.data }));
      setVetEditing(false);
      toast({ title: "Vet profile saved", description: "Verification status is now pending review." });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save profile";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;
  if (!hasHydratedView && loading) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-display font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-1">Loading your vet profile...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your professional profile.</p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardContent className="p-6 flex flex-col items-center text-center">
            {form.profile_image_url ? (
              <img src={form.profile_image_url} alt="Vet profile" className="h-20 w-20 rounded-full object-cover mb-4" />
            ) : (
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-3xl font-bold text-primary-foreground mb-4">
                {user.name.charAt(0)}
              </div>
            )}
            <h2 className="text-lg font-semibold">{form.full_name || user.name}</h2>
            <p className="text-sm text-muted-foreground">{form.email || user.email}</p>
            <Badge variant="outline" className="mt-2">{formatUserRoleLabel(user)}</Badge>
            <div className="flex items-center gap-1 mt-2 text-green-600">
              <Shield className="h-4 w-4" />
              <span className="text-xs">Veterinary Profile</span>
            </div>
            <Badge className={`mt-2 ${verificationLabel.tone}`}>{verificationLabel.text}</Badge>
            {missingFields.length > 0 && (
              <p className="text-xs mt-2" style={{ color: ICON_COLORS.vet }}>
                Complete required vet verification details before submitting.
              </p>
            )}
            {(form.verification_status || "pending") === "pending" && (
              <p className="text-xs text-muted-foreground mt-2">
                Your vet account is under review. You can update details while waiting.
              </p>
            )}
            {(form.verification_status || "pending") === "rejected" && (
              <p className="text-xs text-destructive mt-2">
                Rejected: {form.rejection_reason || "Please update details and resubmit."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Vet Profile</CardTitle>
              {!vetEditing ? (
                <Button variant="outline" size="sm" onClick={() => setVetEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {missingFields.length > 0 && (
              <div
                className="rounded-md border p-3 text-sm"
                style={{
                  borderColor: ICON_COLORS.vet,
                  backgroundColor: iconBg(ICON_COLORS.vet),
                  color: ICON_COLORS.vet,
                }}
              >
                <p className="font-medium">Required before verification submit:</p>
                <p className="mt-1">{missingFields.join(", ")}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><UserCircle className="h-4 w-4" /> Full Name</Label>
              <Input disabled={!vetEditing} value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</Label>
              <Input value={form.email} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Phone className="h-4 w-4" /> Phone</Label>
              <Input disabled={!vetEditing} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Enter phone number" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><MapPin className="h-4 w-4" /> District</Label>
              <Input disabled={!vetEditing} value={form.district} onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))} placeholder="Enter district" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea disabled={!vetEditing} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Village/road/address" />
            </div>
            <div className="space-y-2">
              <Label>Specialization</Label>
              <Input
                disabled={!vetEditing}
                value={form.specialization}
                onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
                placeholder="Poultry, Dairy, Goat, General Veterinary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Experience (years)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!vetEditing}
                  value={form.experience_years}
                  onChange={(e) => setForm((p) => ({ ...p, experience_years: Number(e.target.value || 0) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Consultation Fee (BDT)</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!vetEditing}
                  value={form.consultation_fee}
                  onChange={(e) => setForm((p) => ({ ...p, consultation_fee: Number(e.target.value || 0) }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><UserCircle className="h-4 w-4" /> Profile Image</Label>
              <Input disabled={!vetEditing} type="file" accept="image/*" onChange={(e) => void handleFileChange(e, "profile_image")} />
              {form.profile_image_url && (
                <a className="text-xs text-primary underline" href={form.profile_image_url} target="_blank" rel="noreferrer">
                  View uploaded profile image
                </a>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><FileText className="h-4 w-4" /> Verification Document (Certificate/License)</Label>
              <Input disabled={!vetEditing} type="file" accept=".pdf,image/*" onChange={(e) => void handleFileChange(e, "verification_document")} />
              {form.verification_document_url && (
                <a className="text-xs text-primary underline" href={form.verification_document_url} target="_blank" rel="noreferrer">
                  View uploaded verification document
                </a>
              )}
            </div>
            {vetEditing ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => void handleSave()}
                  disabled={saving || !canSubmit}
                  className="flex-1"
                >
                  {saving || loading || uploadingProfileImage || uploadingDocument ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm(latestFetchedForm);
                    setInitialVetForm(latestFetchedForm);
                    setVetEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {user?.primaryRole !== "admin" && <RoleChangeRequest />}
    </div>
  );
}
