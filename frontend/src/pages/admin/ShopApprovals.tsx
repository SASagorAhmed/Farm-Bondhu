import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/api/client";
import { Store, CheckCircle2, XCircle, Clock, Eye, MapPin, Phone } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

interface ShopReq {
  id: string;
  userId: string;
  userName: string;
  shopName: string;
  description: string;
  nidCardUrl: string;
  phone: string;
  location: string;
  status: string;
  requestDate: string;
  reviewDate?: string;
  reviewNote?: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-primary/15 text-primary",
  approved: "bg-secondary/15 text-secondary",
  rejected: "bg-destructive/15 text-destructive",
};

export default function ShopApprovals() {
  const [requests, setRequests] = useState<ShopReq[]>([]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<ShopReq | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const queryClient = useQueryClient();

  const { data: cachedRequests = [] } = useQuery({
    queryKey: queryKeys().shopApprovals(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const { data } = await api.from("approval_requests").select("*, profiles:user_id(name, phone, location)").eq("request_type", "shop_access").order("created_at", { ascending: false });
      if (data) {
        return data.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.profiles?.name || "Unknown",
          shopName: (r.details as any)?.shopName || "N/A",
          description: (r.details as any)?.description || "",
          nidCardUrl: (r.details as any)?.nidCardUrl || "/placeholder.svg",
          phone: (r.details as any)?.phone || r.profiles?.phone || "",
          location: (r.details as any)?.location || r.profiles?.location || "",
          status: r.status,
          requestDate: new Date(r.created_at).toISOString().split("T")[0],
          reviewDate: r.updated_at !== r.created_at ? new Date(r.updated_at).toISOString().split("T")[0] : undefined,
          reviewNote: r.review_notes,
        })) as ShopReq[];
      }
      return [];
    },
  }, []);

  useEffect(() => {
    setRequests(cachedRequests);
  }, [cachedRequests]);

  useEffect(() => {
    const channels = ["approval_requests", "profiles"].map((table) =>
      api
        .channel(`shop-approvals-live-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys().shopApprovals() });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient]);

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;
  const approvedCount = requests.filter(r => r.status === "approved").length;
  const rejectedCount = requests.filter(r => r.status === "rejected").length;

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    const note = reviewNote || (status === "approved" ? "Application approved" : "Application rejected");
    await api.from("approval_requests").update({ status, review_notes: note, reviewed_by: (await api.auth.getUser()).data.user?.id }).eq("id", id);
    setRequests(requests.map(r => r.id === id ? { ...r, status, reviewDate: new Date().toISOString().split("T")[0], reviewNote: note } : r));
    setSelected(null);
    setReviewNote("");
    toast.success(`Shop request ${status}`);
    queryClient.invalidateQueries({ queryKey: queryKeys().shopApprovals() });
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Shop Approvals</h1>
        <p className="text-muted-foreground mt-1">Review and approve farmer shop requests</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Requests" value={requests.length} icon={<Store className="h-5 w-5" />} iconColor={ICON_COLORS.store} index={0} />
        <StatCard title="Pending" value={pendingCount} icon={<Clock className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={1} />
        <StatCard title="Approved" value={approvedCount} icon={<CheckCircle2 className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={2} />
        <StatCard title="Rejected" value={rejectedCount} icon={<XCircle className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all" className="text-xs">All ({requests.length})</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="approved" className="text-xs">Approved ({approvedCount})</TabsTrigger>
          <TabsTrigger value="rejected" className="text-xs">Rejected ({rejectedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.store}, ${ICON_COLORS.marketplace})` }} />
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Shop Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(req => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium text-foreground">{req.userName}</TableCell>
                  <TableCell className="text-foreground">{req.shopName}</TableCell>
                  <TableCell className="text-muted-foreground">{req.location}</TableCell>
                  <TableCell className="text-muted-foreground">{req.requestDate}</TableCell>
                  <TableCell><Badge className={statusColors[req.status] || ""}>{req.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => { setSelected(req); setReviewNote(req.reviewNote || ""); }}>
                      <Eye className="h-4 w-4 mr-1" /> Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No requests found</p>}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Review Shop Request</DialogTitle>
            <DialogDescription>Read the application and approve or reject with an optional note.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-muted-foreground">Applicant</p><p className="font-medium text-foreground">{selected.userName}</p></div>
                <div><p className="text-xs text-muted-foreground">Shop Name</p><p className="font-medium text-foreground">{selected.shopName}</p></div>
                <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /><p className="text-sm text-foreground">{selected.phone}</p></div>
                <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" /><p className="text-sm text-foreground">{selected.location}</p></div>
              </div>
              <div><p className="text-xs text-muted-foreground mb-1">Description</p><p className="text-sm text-foreground bg-accent/30 p-3 rounded-lg">{selected.description}</p></div>
              {selected.status === "pending" ? (
                <>
                  <div><p className="text-xs text-muted-foreground mb-1">Review Note (Optional)</p><Textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Add a note..." rows={2} /></div>
                  <div className="flex gap-3">
                    <Button className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={() => handleAction(selected.id, "approved")}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleAction(selected.id, "rejected")}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                  </div>
                </>
              ) : (
                <div className="bg-accent/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={statusColors[selected.status] || ""}>{selected.status}</Badge>
                    {selected.reviewDate && <span className="text-xs text-muted-foreground">on {selected.reviewDate}</span>}
                  </div>
                  {selected.reviewNote && <p className="text-sm text-foreground">{selected.reviewNote}</p>}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
