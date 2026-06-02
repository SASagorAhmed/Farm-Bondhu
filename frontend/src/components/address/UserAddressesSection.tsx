import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Plus, Star, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import UserAddressForm from "@/components/address/UserAddressForm";
import type { SavedUserAddress } from "@/lib/bangladeshLocations";
import {
  createUserAddress,
  deleteUserAddress,
  fetchUserAddresses,
  setDefaultUserAddress,
  updateUserAddress,
} from "@/lib/userAddressesApi";

export default function UserAddressesSection() {
  const [addresses, setAddresses] = useState<SavedUserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavedUserAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [makeDefault, setMakeDefault] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAddresses(await fetchUserAddresses());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setMakeDefault(addresses.length === 0);
    setDialogOpen(true);
  };

  const openEdit = (addr: SavedUserAddress) => {
    setEditing(addr);
    setMakeDefault(addr.isDefault);
    setDialogOpen(true);
  };

  const handleSave = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editing) {
        await updateUserAddress(editing.id, payload);
        toast.success("Address updated");
      } else {
        await createUserAddress(payload);
        toast.success("Address saved");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUserAddress(id);
      toast.success("Address deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete address");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultUserAddress(id);
      toast.success("Default address updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          Saved Addresses
        </CardTitle>
        <Button size="sm" variant="outline" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Add Address
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading addresses...</p>}
        {!loading && addresses.length === 0 && (
          <p className="text-sm text-muted-foreground">No saved addresses yet. Add one for checkout and delivery.</p>
        )}
        {addresses.map((addr) => (
          <div key={addr.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{addr.fullName}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{addr.addressType}</Badge>
                  {addr.isDefault && (
                    <Badge className="text-[10px] gap-1"><Star className="h-3 w-3" />Default</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{addr.phone}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {addr.fullAddress}, {addr.area ? `${addr.area}, ` : ""}{addr.upazila}, {addr.district}, {addr.division}
                </p>
                {addr.landmark && <p className="text-xs text-muted-foreground">Landmark: {addr.landmark}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {!addr.isDefault && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void handleSetDefault(addr.id)} title="Set default">
                    <Star className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(addr)} title="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(addr.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Address" : "Add Address"}</DialogTitle>
          </DialogHeader>
          <UserAddressForm
            key={editing?.id || "new"}
            initial={editing || undefined}
            saving={saving}
            defaultChecked={makeDefault}
            onDefaultChange={setMakeDefault}
            onSubmit={async (payload) => handleSave({ ...payload, is_default: makeDefault })}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
