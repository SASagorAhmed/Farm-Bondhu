import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useAuth, formatUserRoleLabel, getUserRoleBadgeClass } from "@/contexts/AuthContext";
import { api } from "@/api/client";
import { UserCircle, Mail, Phone, Pencil, X, Save, ArrowLeft, FileText, Upload, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import RoleChangeRequest from "@/components/profile/RoleChangeRequest";
import MediDoctorProfileSetup from "@/pages/doctor/MediDoctorProfileSetup";
import UserAddressesSection from "@/components/address/UserAddressesSection";
import AdminProfilePanel from "@/components/admin/AdminProfilePanel";
import { usePhotoEditorProfileSessionExport } from "@/features/photoEditor/hooks/usePhotoEditorProfileSessionExport";
import { removeProfileCv, uploadProfileCv } from "@/lib/communityHiringApi";

export default function ProfilePage() {
  const { user, refreshProfile, hasRole, hasCapability } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });
  const isAdmin = user?.primaryRole === "admin";
  const showDoctorClinicalProfile =
    !isAdmin && (hasRole("doctor") || hasCapability("can_practice_human"));

  usePhotoEditorProfileSessionExport(user?.id, refreshProfile);

  useEffect(() => {
    const previousOverflowY = document.body.style.overflowY;
    const previousOverscrollY = document.body.style.overscrollBehaviorY;
    document.body.style.overflowY = "hidden";
    document.body.style.overscrollBehaviorY = "none";
    return () => {
      document.body.style.overflowY = previousOverflowY;
      document.body.style.overscrollBehaviorY = previousOverscrollY;
    };
  }, []);

  const handleEdit = () => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
    });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { error } = await api
      .from("profiles")
      .update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
      })
      .eq("id", user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated successfully");
      await refreshProfile();
      setEditing(false);
    }
    setSaving(false);
  };

  const handleCvUpload = async (file?: File | null) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      toast.error("Upload a PDF, PNG, JPG, or JPEG CV file");
      return;
    }
    setCvUploading(true);
    try {
      const result = await uploadProfileCv(file);
      if (!result.ok) {
        toast.error(result.error || "CV upload failed");
        return;
      }
      toast.success("CV uploaded");
      await refreshProfile({ force: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CV upload failed");
    } finally {
      setCvUploading(false);
    }
  };

  const handleCvRemove = async () => {
    setCvUploading(true);
    try {
      const result = await removeProfileCv();
      if (!result.ok) {
        toast.error(result.error || "Could not remove CV");
        return;
      }
      toast.success("CV removed");
      await refreshProfile({ force: true });
    } finally {
      setCvUploading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 overflow-x-hidden pb-4 md:pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account settings and preferences.</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
      </motion.div>

      {/* User Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-muted-foreground" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserCircle className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className="h-9"
                  />
                </div>
              ) : (
                <>
                  <p className="font-semibold text-foreground">{user?.name || "—"}</p>
                  <Badge className={getUserRoleBadgeClass(user)}>{formatUserRoleLabel(user)}</Badge>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 pt-2">
            {/* Email - always read-only */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span>{user?.email || "—"}</span>
            </div>

            {/* Phone */}
            {editing ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Phone
                </Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="h-9"
                />
              </div>
            ) : (
              user?.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )
            )}

          </div>

          {editing && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!isAdmin && <UserAddressesSection />}

      {!isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              CV / Resume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Save a CV here so you can safely share it when you click Interested on hiring posts.
            </p>
            {user?.cvUrl ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.cvFilename || "Uploaded CV"}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.cvUpdatedAt ? `Updated ${new Date(user.cvUpdatedAt).toLocaleDateString()}` : "Ready to share with consent"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => window.open(user.cvUrl, "_blank", "noopener,noreferrer")}>
                    Open
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild disabled={cvUploading}>
                    <label className="cursor-pointer">
                      <Upload className="h-3.5 w-3.5 mr-1" /> Replace
                      <input type="file" accept=".pdf,image/png,image/jpeg,image/jpg" className="sr-only" onChange={(e) => void handleCvUpload(e.target.files?.[0])} />
                    </label>
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={handleCvRemove} disabled={cvUploading}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" asChild disabled={cvUploading}>
                <label className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {cvUploading ? "Uploading..." : "Upload CV"}
                  <input type="file" accept=".pdf,image/png,image/jpeg,image/jpg" className="sr-only" onChange={(e) => void handleCvUpload(e.target.files?.[0])} />
                </label>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && <AdminProfilePanel />}

      {/* Role Change Request */}
      {user?.primaryRole !== "admin" && <RoleChangeRequest />}

      {showDoctorClinicalProfile && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">Clinical Profile & Verification</h2>
          <p className="text-sm text-muted-foreground">Your doctor workspace profile is merged here. Keep practice and verification details up to date.</p>
          <MediDoctorProfileSetup embedded hideDisplayNameField />
        </div>
      )}
    </div>
  );
}
