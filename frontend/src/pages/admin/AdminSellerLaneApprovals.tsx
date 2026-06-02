import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Store, CheckCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";
import SellerLaneReviewPanel from "@/components/admin/SellerLaneReviewPanel";
import { adminListSellerLanes, type AdminSellerLaneRow } from "@/lib/sellerOnboardingApi";

type StatusTab = "pending" | "approved" | "rejected";

function groupByUser(rows: AdminSellerLaneRow[]) {
  const map = new Map<string, AdminSellerLaneRow[]>();
  for (const row of rows) {
    const list = map.get(row.user_id) || [];
    list.push(row);
    map.set(row.user_id, list);
  }
  return [...map.entries()].map(([userId, lanes]) => ({
    userId,
    lanes,
    userName: lanes[0]?.user_name || "Seller",
    userEmail: lanes[0]?.user_email || "",
    requestDetails: lanes[0]?.request_details,
  }));
}

export default function AdminSellerLaneApprovals() {
  const [statusTab, setStatusTab] = useState<StatusTab>("pending");

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-seller-lanes", statusTab],
    queryFn: async () => {
      const { ok, data, error } = await adminListSellerLanes(statusTab);
      if (!ok) {
        toast.error(error || "Failed to load seller lane queue");
        return [];
      }
      return data || [];
    },
  });

  const { data: pendingRows = [] } = useQuery({
    queryKey: ["admin-seller-lanes", "pending-count"],
    queryFn: async () => {
      const { ok, data } = await adminListSellerLanes("pending");
      return ok && data ? data : [];
    },
  });

  const { data: approvedRows = [] } = useQuery({
    queryKey: ["admin-seller-lanes", "approved-count"],
    queryFn: async () => {
      const { ok, data } = await adminListSellerLanes("approved");
      return ok && data ? data : [];
    },
  });

  const { data: rejectedRows = [] } = useQuery({
    queryKey: ["admin-seller-lanes", "rejected-count"],
    queryFn: async () => {
      const { ok, data } = await adminListSellerLanes("rejected");
      return ok && data ? data : [];
    },
  });

  const grouped = useMemo(() => groupByUser(rows), [rows]);

  return (
    <div className="space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Store className="h-7 w-7" style={{ color: ICON_COLORS.store }} />
          Seller lane approvals
        </h1>
        <p className="text-muted-foreground mt-1">
          Review marketplace category requests per applicant. Approving the first lane grants seller access.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Pending lanes" value={pendingRows.length} icon={<Clock className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={0} />
        <StatCard title="Approved lanes" value={approvedRows.length} icon={<CheckCircle className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={1} />
        <StatCard title="Rejected lanes" value={rejectedRows.length} icon={<XCircle className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={2} />
      </div>

      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingRows.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approvedRows.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejectedRows.length})</TabsTrigger>
        </TabsList>

        {(["pending", "approved", "rejected"] as StatusTab[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4 mt-4">
            {isLoading && tab === statusTab && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!isLoading && tab === statusTab && grouped.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">No {tab} lane requests</p>
            )}
            {tab === statusTab &&
              grouped.map(({ userId, userName, userEmail, requestDetails }) => (
                <Card key={userId} className="shadow-card">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-display">{userName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{userEmail}</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{tab}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <SellerLaneReviewPanel
                      userId={userId}
                      requestDetails={requestDetails}
                      onLaneReviewed={() => void refetch()}
                    />
                  </CardContent>
                </Card>
              ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
