import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PawPrint, Egg, Milk, Wallet, BarChart3, TrendingUp, HeartPulse, Skull, ShoppingBag, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import { api } from "@/api/client";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ActivityIconKey = "health" | "sales" | "mortality";

const activityIconMap: Record<ActivityIconKey, React.ReactNode> = {
  health: <HeartPulse className="h-4 w-4" />,
  sales: <ShoppingBag className="h-4 w-4" />,
  mortality: <Skull className="h-4 w-4" />,
};

export default function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: overviewData, isFetching } = useQuery({
    queryKey: ["dashboard-overview", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const uid = user!.id;
      const [animalsRes, productionRes, financialRes, healthRes, salesRes, mortRes] = await Promise.all([
        api.from("animals").select("id", { count: "exact", head: true }).eq("user_id", uid),
        api.from("production_records").select("*").eq("user_id", uid).order("date", { ascending: true }).limit(10),
        api.from("financial_records").select("type, amount").eq("user_id", uid),
        api.from("health_records").select("*").eq("user_id", uid).order("date", { ascending: false }).limit(2),
        api.from("sale_records").select("*").eq("user_id", uid).order("date", { ascending: false }).limit(2),
        api.from("mortality_records").select("*").eq("user_id", uid).order("date", { ascending: false }).limit(2),
      ]);

      const productionData = (productionRes.data || []).map((r) => ({ date: r.date, eggs: r.eggs, milk: Number(r.milk) }));
      const records = financialRes.data || [];
      const totalRevenue = records.filter((r) => r.type === "income").reduce((s, r) => s + Number(r.amount), 0);
      const totalExpenses = records.filter((r) => r.type === "expense").reduce((s, r) => s + Number(r.amount), 0);

      const recentActivity: { id: string; iconKey: ActivityIconKey; color: string; text: string; date: string; link: string }[] = [];
      (healthRes.data || []).forEach((r) => {
        recentActivity.push({ id: `h-${r.id}`, iconKey: "health", color: ICON_COLORS.health, text: `${r.description} — ${r.animal_label || "Animal"}`, date: r.date, link: "/dashboard/health" });
      });
      (salesRes.data || []).forEach((r) => {
        recentActivity.push({ id: `s-${r.id}`, iconKey: "sales", color: ICON_COLORS.finance, text: `${r.product} sold to ${r.buyer} — ৳${Number(r.total).toLocaleString()}`, date: r.date, link: "/dashboard/sales" });
      });
      (mortRes.data || []).forEach((r) => {
        recentActivity.push({ id: `m-${r.id}`, iconKey: "mortality", color: ICON_COLORS.mortality, text: `${r.count} ${r.animal_type} deaths — ${r.cause}`, date: r.date, link: "/dashboard/mortality" });
      });

      return {
        totalAnimals: animalsRes.count || 0,
        productionData,
        financials: { totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses },
        recentActivity: recentActivity.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
      };
    },
  });

  const totalAnimals = overviewData?.totalAnimals || 0;
  const productionData = overviewData?.productionData || [];
  const financials = overviewData?.financials || { totalRevenue: 0, totalExpenses: 0, profit: 0 };
  const recentActivity = overviewData?.recentActivity || [];

  useEffect(() => {
    if (!user?.id) return;
    const tables = ["animals", "production_records", "financial_records", "health_records", "sale_records", "mortality_records"];
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const channels = tables.map((table) =>
      api
        .channel(`overview-live-${table}-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["dashboard-overview", user.id] });
          }, 250);
        })
        .subscribe()
    );
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      channels.forEach((channel) => {
        api.removeChannel(channel);
      });
    };
  }, [queryClient, user?.id]);

  const latestEggs = productionData[productionData.length - 1]?.eggs || 0;
  const latestMilk = productionData[productionData.length - 1]?.milk || 0;

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Welcome, {user?.name} 👋</h1>
        <p className="text-muted-foreground mt-1">Your farm overview at a glance</p>
        {isFetching && <p className="text-xs text-muted-foreground mt-1">Refreshing dashboard...</p>}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Animals" value={totalAnimals.toLocaleString()} icon={<PawPrint className="h-5 w-5" />} iconColor={ICON_COLORS.animals} index={0} href="/dashboard/animals" />
        <StatCard title="Daily Eggs" value={latestEggs.toLocaleString()} icon={<Egg className="h-5 w-5" />} iconColor={ICON_COLORS.egg} index={1} href="/dashboard/production" />
        <StatCard title="Daily Milk (L)" value={latestMilk.toLocaleString()} icon={<Milk className="h-5 w-5" />} iconColor={ICON_COLORS.milk} index={2} href="/dashboard/production" />
        <StatCard title="Net Profit" value={`৳${financials.profit > 0 ? (financials.profit / 1000).toFixed(0) + "K" : "0"}`} icon={<Wallet className="h-5 w-5" />} iconColor={ICON_COLORS.wallet} index={3} href="/dashboard/finances" />
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="shadow-card overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.farm}, ${ICON_COLORS.dashboard})` }} />
          <CardHeader className="pb-2"><CardTitle className="text-lg font-display">Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Add Animal", icon: <PawPrint className="h-4 w-4" />, url: "/dashboard/animals", color: ICON_COLORS.animals },
                { label: "Log Production", icon: <Egg className="h-4 w-4" />, url: "/dashboard/production", color: ICON_COLORS.egg },
                { label: "Record Sale", icon: <ShoppingBag className="h-4 w-4" />, url: "/dashboard/sales", color: ICON_COLORS.finance },
                { label: "Health Record", icon: <HeartPulse className="h-4 w-4" />, url: "/dashboard/health", color: ICON_COLORS.health },
              ].map((action) => (
                <Button key={action.label} variant="outline" className="justify-start gap-2 h-auto py-3 transition-all duration-200" style={{ borderColor: `${action.color}4D`, color: action.color }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = action.color; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = action.color; }}
                  onClick={() => navigate(action.url)}>
                  {action.icon}
                  <span className="text-sm font-medium">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts */}
      {productionData.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="shadow-card overflow-hidden cursor-pointer" onClick={() => navigate("/dashboard/production")}>
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.egg}, ${ICON_COLORS.finance})` }} />
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" style={{ color: ICON_COLORS.egg }} />Egg Production
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={productionData}>
                    <defs><linearGradient id="eggGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ICON_COLORS.egg} /><stop offset="100%" stopColor={ICON_COLORS.egg} stopOpacity={0.3} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" /><YAxis className="text-xs" /><Tooltip />
                    <Bar dataKey="eggs" fill="url(#eggGrad)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="shadow-card overflow-hidden cursor-pointer" onClick={() => navigate("/dashboard/production")}>
              <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.milk}, ${ICON_COLORS.vet})` }} />
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" style={{ color: ICON_COLORS.milk }} />Milk Production
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={productionData}>
                    <defs><linearGradient id="milkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ICON_COLORS.milk} stopOpacity={0.4} /><stop offset="100%" stopColor={ICON_COLORS.milk} stopOpacity={0.05} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" className="text-xs" /><YAxis className="text-xs" /><Tooltip />
                    <Area type="monotone" dataKey="milk" stroke={ICON_COLORS.milk} strokeWidth={2} fill="url(#milkGrad)" dot={{ r: 4, fill: ICON_COLORS.milk }} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Financial Summary & Recent Activity */}
      <div className="grid md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card className="shadow-card overflow-hidden cursor-pointer" onClick={() => navigate("/dashboard/finances")}>
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${ICON_COLORS.farm})` }} />
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-display flex items-center gap-2">Financial Summary<ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" /></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
                  <span className="text-sm text-foreground">Total Revenue</span>
                  <span className="font-bold" style={{ color: ICON_COLORS.farm }}>৳{financials.totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-accent/50">
                  <span className="text-sm text-foreground">Total Expenses</span>
                  <span className="font-bold" style={{ color: ICON_COLORS.health }}>৳{financials.totalExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-accent/30">
                  <span className="text-sm font-medium text-foreground">Net Profit</span>
                  <span className="font-bold text-lg" style={{ color: ICON_COLORS.dashboard }}>৳{financials.profit.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.dashboard}, ${ICON_COLORS.farm})` }} />
            <CardHeader className="pb-2"><CardTitle className="text-lg font-display">Recent Activity</CardTitle></CardHeader>
            <CardContent>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 cursor-pointer hover:bg-accent/70 transition-colors" onClick={() => navigate(item.link)}>
                      <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${item.color}1A`, color: item.color }}>
                        {activityIconMap[item.iconKey]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{item.text}</p>
                        <p className="text-xs text-muted-foreground">{item.date}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm text-center py-8">No recent activity — start adding farm data!</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
