import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Store, Save } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import { fetchPublicShop } from "@/lib/marketplaceShopApi";
import { updateOfficialShopProfile } from "@/lib/adminFarmBondhuShopApi";
import ChatNotificationSoundSettings from "@/components/marketplace/ChatNotificationSoundSettings";
import OfficialShopPageHeader from "./OfficialShopPageHeader";
import { useOfficialShop } from "./OfficialShopProvider";

export default function OfficialShopSettings() {
  const { sellerId, shopName } = useOfficialShop();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: shop, isLoading } = useQuery({
    queryKey: ["official-shop-settings", sellerId],
    enabled: Boolean(sellerId),
    queryFn: () => fetchPublicShop(sellerId),
  });

  useEffect(() => {
    if (shop) {
      setDescription(shop.description || "");
      setLocation(shop.location || "");
    }
  }, [shop]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateOfficialShopProfile({ description, location });
    } catch (error) {
      setSaving(false);
      toast.error(error instanceof Error ? error.message : "Could not save settings");
      return;
    }
    setSaving(false);
    toast.success("Shop settings saved");
  };

  return (
    <div className="space-y-6">
      <OfficialShopPageHeader title="Settings" />

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading…</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Store className="h-5 w-5" style={{ color: ICON_COLORS.farm }} />
                Store information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Shop name</Label>
                <Input value={shopName} disabled />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: ICON_COLORS.farm }} className="text-white">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Chat sounds</CardTitle>
            </CardHeader>
            <CardContent>
              <ChatNotificationSoundSettings />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
