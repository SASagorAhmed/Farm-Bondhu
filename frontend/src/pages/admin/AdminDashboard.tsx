import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ShieldCheck, Bell, BarChart3 } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import StatCard from "@/components/dashboard/StatCard";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { api } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy, queryKeys } from "@/lib/queryClient";

interface Stats {
  totalUsers: number;
  pendingApprovals: number;
  totalNotifications: number;
  roleDistribution: { name: string; value: number; color: string }[];
  recentActivity: { id: string; title: string; time: string; type: string }[];
}

const ROLE_COLORS: Record<string, string> = {
  buyer: ICON_COLORS.cart,
  farmer: ICON_COLORS.farm,
  vendor: ICON_COLORS.store,
  vet: ICON_COLORS.stethoscope,
  admin: ICON_COLORS.admin,
};

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: queryKeys().adminDashboardStats(),
    staleTime: moduleCachePolicy.admin.staleTime,
    gcTime: moduleCachePolicy.admin.gcTime,
    queryFn: async (): Promise<Stats> => {
      const [profilesRes, approvalsRes, rolesRes, recentApprovalsRes] = await Promise.all([
        api.from("profiles").select("id", { count: "exact", head: true }),
        api.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        api.from("user_roles").select("role"),
        api.from("approval_requests").select("*").order("created_at", { ascending: false }).limit(10),
      ]);

      // Role distribution
      const roleCounts: Record<string, number> = {};
      (rolesRes.data || []).forEach((r: any) => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
      });
      const roleDistribution = Object.entries(roleCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: ROLE_COLORS[name] || ICON_COLORS.dashboard,
      }));

      // Recent activity
      const recentActivity = (recentApprovalsRes.data || []).map((a: any) => ({
        id: a.id,
        title: `${a.request_type.replace(/_/g, " ")} — ${a.status}`,
        time: format(new Date(a.created_at), "MMM d, h:mm a"),
        type: a.status,
      }));

      return {
        totalUsers: profilesRes.count || 0,
        pendingApprovals: approvalsRes.count || 0,
        totalNotifications: 0,
        roleDistribution,
        recentActivity,
      };
    },
  });

  useEffect(() => {
    const channels = ["profiles", "approval_requests", "user_roles"].map((table) =>
      api
        .channel(`admin-dashboard-live-${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          queryClient.invalidateQueries({ queryKey: queryKeys().adminDashboardStats() });
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => api.removeChannel(channel));
    };
  }, [queryClient]);

  const safeStats: Stats = stats || {
    totalUsers: 0,
    pendingApprovals: 0,
    totalNotifications: 0,
    roleDistribution: [],
    recentActivity: [],
  };

  const statusColor = (type: string) =>
    type === "approved" ? "text-secondary" : type === "rejected" ? "text-destructive" : "text-warning";

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform-wide analytics and management</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={loading ? "…" : safeStats.totalUsers.toLocaleString()} icon={<Users className="h-5 w-5" />} iconColor={ICON_COLORS.users} index={0} />
        <StatCard title="Pending Approvals" value={loading ? "…" : safeStats.pendingApprovals.toString()} icon={<ShieldCheck className="h-5 w-5" />} iconColor={ICON_COLORS.shield} index={1} />
        <StatCard title="Total Roles Assigned" value={loading ? "…" : safeStats.roleDistribution.reduce((s, r) => s + r.value, 0).toString()} icon={<BarChart3 className="h-5 w-5" />} iconColor={ICON_COLORS.analytics} index={2} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.admin}, ${ICON_COLORS.dashboard})` }} />
            <CardHeader><CardTitle className="text-lg font-display">Role Distribution</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">Loading…</div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={safeStats.roleDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {safeStats.roleDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
            <CardHeader><CardTitle className="text-lg font-display">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">Loading…</div>
              ) : safeStats.recentActivity.length === 0 ? (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">No recent activity</div>
              ) : (
                <div className="space-y-3 max-h-[250px] overflow-y-auto">
                  {safeStats.recentActivity.map((a) => (
                    <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className={`text-sm font-medium capitalize ${statusColor(a.type)}`}>{a.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{a.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
