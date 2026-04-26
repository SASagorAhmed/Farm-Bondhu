import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { useAuth, formatUserRoleLabel } from "@/contexts/AuthContext";
import { api } from "@/api/client";
import { UserCircle, Mail, Phone, MapPin, Pencil, X, Save, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import RoleChangeRequest from "@/components/profile/RoleChangeRequest";

const ROLE_COLORS: Record<string, string> = {
  buyer: "bg-blue-100 text-blue-800",
  farmer: "bg-green-100 text-green-800",
  vendor: "bg-orange-100 text-orange-800",
  vet: "bg-purple-100 text-purple-800",
  admin: "bg-red-100 text-red-800",
};

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    location: user?.location || "",
  });

  const handleEdit = () => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
      location: user?.location || "",
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
        location: form.location.trim() || null,
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

  return (
    <div className="space-y-6">
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
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCircle className="h-8 w-8 text-primary" />
            </div>
            <div>
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
                  <Badge className={ROLE_COLORS[user?.primaryRole || "buyer"]}>{formatUserRoleLabel(user)}</Badge>
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

            {/* Location */}
            {editing ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Location
                </Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Your location"
                  className="h-9"
                />
              </div>
            ) : (
              user?.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{user.location}</span>
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

      {/* Role Change Request */}
      {user?.primaryRole !== "admin" && <RoleChangeRequest />}
    </div>
  );
}
