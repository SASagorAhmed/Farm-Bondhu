import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/api/client";
import { Store, Upload, Clock, CheckCircle2, XCircle, FileText, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: `${ICON_COLORS.finance}1A`, text: ICON_COLORS.finance },
  approved: { bg: `${ICON_COLORS.farm}1A`, text: ICON_COLORS.farm },
  rejected: { bg: `${ICON_COLORS.health}1A`, text: ICON_COLORS.health },
};
const statusIcons: Record<string, React.ElementType> = { pending: Clock, approved: CheckCircle2, rejected: XCircle };

interface ShopReq { id: string; shopName: string; description: string; status: string; requestDate: string; reviewDate?: string; reviewNote?: string; }
interface ShopData { id: string; shopName: string; description: string; location: string; totalProducts: number; totalSales: number; status: string; }

export default function MyShop() {
  const { user, hasCapability } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<ShopReq[]>([]);
  const [myShop, setMyShop] = useState<ShopData | null>(null);
  const [form, setForm] = useState({ shopName: "", description: "", phone: user?.phone || "", location: user?.location || "" });
  const [nidFile, setNidFile] = useState<File | null>(null);

  useEffect(() => {
    if (!hasCapability("can_sell")) {
      const path = window.location.pathname;
      const prefix = path.startsWith("/dashboard") ? "/dashboard" : "/marketplace";
      navigate(`${prefix}/access-center?request=seller_access`, { replace: true });
    }
  }, [hasCapability, navigate]);

  useEffect(() => {
    if (!user) return;
    // Load shop requests
    api.from("approval_requests").select("*").eq("user_id", user.id).eq("request_type", "shop_access").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setRequests(data.map((r: any) => ({
        id: r.id, shopName: (r.details as any)?.shopName || "N/A", description: (r.details as any)?.description || "",
        status: r.status, requestDate: new Date(r.created_at).toISOString().split("T")[0],
        reviewDate: r.updated_at !== r.created_at ? new Date(r.updated_at).toISOString().split("T")[0] : undefined,
        reviewNote: r.review_notes,
      })));
    });
    // Load shop
    api.from("shops").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) setMyShop({ id: data.id, shopName: data.shop_name, description: data.description, location: data.location, totalProducts: data.total_products, totalSales: Number(data.total_sales), status: data.status });
    });
  }, [user]);

  const hasApproved = requests.some(r => r.status === "approved");
  const hasPending = requests.some(r => r.status === "pending");

  const handleSubmit = async () => {
    if (!form.shopName || !form.description || !form.phone || !form.location) { toast.error("Please fill all fields"); return; }
    if (!nidFile) { toast.error("Please upload your NID card"); return; }
    if (!user) return;
    await api.from("approval_requests").insert({
      user_id: user.id, request_type: "shop_access",
      details: { shopName: form.shopName, description: form.description, phone: form.phone, location: form.location, nidCardUrl: "/placeholder.svg" } as any,
    });
    setRequests(prev => [{ id: `temp_${Date.now()}`, shopName: form.shopName, description: form.description, status: "pending", requestDate: new Date().toISOString().split("T")[0] }, ...prev]);
    setOpen(false);
    setForm({ shopName: "", description: "", phone: user?.phone || "", location: user?.location || "" });
    setNidFile(null);
    toast.success("Shop request submitted! Admin will review your application.");
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">My Shop</h1>
          <p className="text-muted-foreground mt-1">{hasApproved || myShop ? "Manage your shop and products" : "Request to open a shop on FarmBondhu"}</p>
        </div>
        {hasApproved || myShop ? (
          <Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }} onClick={() => navigate("/seller/dashboard")}><Store className="h-4 w-4 mr-1" /> Go to Seller Dashboard</Button>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }} disabled={hasPending}><Plus className="h-4 w-4 mr-1" /> {hasPending ? "Request Pending" : "Request Shop"}</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display">Request to Open a Shop</DialogTitle>
                <DialogDescription>Submit your shop details and NID for review.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Shop Name</Label><Input value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} placeholder="e.g. Rahim's Farm Store" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What will you sell?" rows={3} /></div>
                <div><Label>Phone Number</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
                <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Mymensingh" /></div>
                <div>
                  <Label>NID Card (Upload Image)</Label>
                  <div className="mt-1">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-accent/30 hover:bg-accent/50 transition-colors">
                      {nidFile ? (<div className="flex flex-col items-center text-foreground"><FileText className="h-8 w-8 mb-1" style={{ color: ICON_COLORS.marketplace }} /><span className="text-sm font-medium">{nidFile.name}</span></div>) : (<div className="flex flex-col items-center text-muted-foreground"><Upload className="h-8 w-8 mb-1" /><span className="text-sm">Click to upload NID card</span></div>)}
                      <input type="file" className="hidden" accept="image/*" onChange={e => setNidFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                </div>
                <Button onClick={handleSubmit} className="w-full text-white" style={{ backgroundColor: ICON_COLORS.marketplace }} disabled={!form.shopName || !form.description || !nidFile}>Submit Request</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </motion.div>

      {myShop && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1.5" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: ICON_COLORS.marketplace }}><Store className="h-7 w-7" /></div>
                <div className="flex-1">
                  <h3 className="text-xl font-display font-bold text-foreground">{myShop.shopName}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{myShop.description}</p>
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-muted-foreground">📍 {myShop.location}</span>
                    <span className="text-muted-foreground">📦 {myShop.totalProducts} products</span>
                    <span className="font-medium" style={{ color: ICON_COLORS.marketplace }}>৳{myShop.totalSales.toLocaleString()} total sales</span>
                  </div>
                </div>
                <Badge style={{ backgroundColor: `${ICON_COLORS.farm}1A`, color: ICON_COLORS.farm }}>{myShop.status}</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
          <CardHeader><CardTitle className="text-lg font-display">Shop Request History</CardTitle></CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Store className="h-12 w-12 mx-auto text-muted-foreground/40" />
                <p className="text-muted-foreground">You haven't requested a shop yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => {
                  const StatusIcon = statusIcons[req.status] || Clock;
                  const colors = statusColors[req.status] || statusColors.pending;
                  return (
                    <div key={req.id} className="p-4 rounded-lg border border-border bg-accent/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><StatusIcon className="h-5 w-5" style={{ color: colors.text }} /><h4 className="font-medium text-foreground">{req.shopName}</h4></div>
                        <Badge style={{ backgroundColor: colors.bg, color: colors.text }}>{req.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{req.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Submitted: {req.requestDate}</span>
                        {req.reviewDate && <span>Reviewed: {req.reviewDate}</span>}
                      </div>
                      {req.reviewNote && <p className="text-sm bg-accent/50 p-2 rounded text-foreground"><span className="font-medium">Admin note:</span> {req.reviewNote}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
