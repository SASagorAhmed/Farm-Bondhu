import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/api/client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ICON_COLORS } from "@/lib/iconColors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

export default function Reports() {
  const queryClient = useQueryClient();
  const { data: stats = { totalUsers: 0, totalFarms: 0, totalOrders: 0, totalRevenue: 0 } } = useQuery({
    queryKey: queryKeys().adminReportsSummary(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async () => {
      const [users, farms, orders] = await Promise.all([
        api.from("profiles").select("id", { count: "exact", head: true }),
        api.from("farms").select("id", { count: "exact", head: true }),
        api.from("orders").select("total"),
      ]);
      const totalRevenue = (orders.data || []).reduce((s: number, o: any) => s + Number(o.total), 0);
      return {
        totalUsers: users.count || 0,
        totalFarms: farms.count || 0,
        totalOrders: (orders.data || []).length,
        totalRevenue,
      };
    },
  });

  useEffect(() => {
    const channels = ["profiles", "farms", "orders"].map((table) =>
      api
        .channel(`admin-reports-live-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys().adminReportsSummary() });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Platform-wide analytics and reports</p>
        </div>
        <Button variant="outline" onClick={() => toast.info("Report export coming soon!")}><Download className="h-4 w-4 mr-2" />Export Report</Button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.dashboard}, ${ICON_COLORS.farm})` }} />
          <CardHeader><CardTitle className="text-lg font-display">Platform Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${ICON_COLORS.users}1A` }}><p className="text-sm text-muted-foreground">Total Users</p><p className="text-2xl font-bold text-foreground">{stats.totalUsers.toLocaleString()}</p></div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${ICON_COLORS.farm}1A` }}><p className="text-sm text-muted-foreground">Total Farms</p><p className="text-2xl font-bold text-foreground">{stats.totalFarms}</p></div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${ICON_COLORS.marketplace}1A` }}><p className="text-sm text-muted-foreground">Total Orders</p><p className="text-2xl font-bold text-foreground">{stats.totalOrders.toLocaleString()}</p></div>
              <div className="p-4 rounded-lg" style={{ backgroundColor: `${ICON_COLORS.finance}1A` }}><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold" style={{ color: ICON_COLORS.finance }}>৳{(stats.totalRevenue / 1000).toFixed(1)}K</p></div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
