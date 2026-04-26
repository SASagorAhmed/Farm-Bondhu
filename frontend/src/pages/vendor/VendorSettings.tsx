import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Store, Bell, CreditCard, MapPin, Save } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";

export default function VendorSettings() {
  const { user } = useAuth();

  const [shopName, setShopName] = useState("Rahim's Farm Store");
  const [description, setDescription] = useState("Fresh farm products directly from our farms");
  const [phone, setPhone] = useState(user?.phone || "01712345678");
  const [location, setLocation] = useState(user?.location || "Mymensingh");
  const [payoutMethod, setPayoutMethod] = useState("bkash");
  const [payoutAccount, setPayoutAccount] = useState("01712345678");

  const [emailNotif, setEmailNotif] = useState(true);
  const [orderNotif, setOrderNotif] = useState(true);
  const [reviewNotif, setReviewNotif] = useState(true);
  const [stockNotif, setStockNotif] = useState(true);

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your store preferences</p>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Store Information */}
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Store className="h-5 w-5" style={{ color: ICON_COLORS.marketplace }} />
              Store Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Shop Name</Label>
              <Input value={shopName} onChange={e => setShopName(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div>
                <Label>Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input value={location} onChange={e => setLocation(e.target.value)} className="pl-9" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payout Settings */}
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${ICON_COLORS.marketplace})` }} />
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <CreditCard className="h-5 w-5" style={{ color: ICON_COLORS.finance }} />
              Payout Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Payout Method</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="rocket">Rocket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{payoutMethod === "bank" ? "Account Number" : "Mobile Number"}</Label>
              <Input value={payoutAccount} onChange={e => setPayoutAccount(e.target.value)} placeholder={payoutMethod === "bank" ? "Enter account number" : "01XXXXXXXXX"} />
            </div>
            {payoutMethod === "bank" && (
              <>
                <div>
                  <Label>Bank Name</Label>
                  <Input placeholder="e.g. Dutch Bangla Bank" />
                </div>
                <div>
                  <Label>Branch</Label>
                  <Input placeholder="e.g. Mymensingh Branch" />
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">Payouts are processed within 2-3 business days</p>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card className="shadow-card overflow-hidden lg:col-span-2">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.bell}, ${ICON_COLORS.marketplace})` }} />
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Bell className="h-5 w-5" style={{ color: ICON_COLORS.bell }} />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: "Email Notifications", desc: "Receive summary emails for orders and updates", state: emailNotif, set: setEmailNotif },
                { label: "New Order Alerts", desc: "Get notified when a new order is placed", state: orderNotif, set: setOrderNotif },
                { label: "Review Alerts", desc: "Get notified when a customer leaves a review", state: reviewNotif, set: setReviewNotif },
                { label: "Low Stock Alerts", desc: "Alert when product stock goes below threshold", state: stockNotif, set: setStockNotif },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={item.state} onCheckedChange={item.set} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }} onClick={handleSave}>
          <Save className="h-4 w-4 mr-1" /> Save Changes
        </Button>
      </div>
    </div>
  );
}
