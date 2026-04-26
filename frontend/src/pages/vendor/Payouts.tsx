import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DollarSign, Wallet, TrendingUp, Clock, Download, BanknoteIcon } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const earningsData = [
  { month: "Oct", amount: 12000 },
  { month: "Nov", amount: 18500 },
  { month: "Dec", amount: 22000 },
  { month: "Jan", amount: 15000 },
  { month: "Feb", amount: 28000 },
  { month: "Mar", amount: 32500 },
];

const payoutHistory = [
  { id: "PO-001", date: "2026-03-10", amount: 15000, method: "bKash", status: "completed", ref: "TXN8832991" },
  { id: "PO-002", date: "2026-03-05", amount: 12500, method: "Bank Transfer", status: "completed", ref: "TXN7742881" },
  { id: "PO-003", date: "2026-02-28", amount: 8200, method: "bKash", status: "completed", ref: "TXN6652771" },
  { id: "PO-004", date: "2026-02-20", amount: 18000, method: "Nagad", status: "completed", ref: "TXN5562661" },
  { id: "PO-005", date: "2026-02-15", amount: 9500, method: "Bank Transfer", status: "completed", ref: "TXN4472551" },
  { id: "PO-006", date: "2026-03-12", amount: 5000, method: "bKash", status: "pending", ref: "—" },
];

const statusColors: Record<string, string> = {
  completed: ICON_COLORS.farm,
  pending: ICON_COLORS.finance,
  failed: ICON_COLORS.health,
};

export default function Payouts() {
  const totalEarnings = 128000;
  const availableBalance = 5000;
  const totalPaid = 123000;
  const pendingPayout = 5000;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Payouts</h1>
          <p className="text-muted-foreground mt-1">Track your earnings and withdrawal history</p>
        </div>
        <Button className="text-white" style={{ backgroundColor: ICON_COLORS.marketplace }}>
          <BanknoteIcon className="h-4 w-4 mr-1" /> Request Payout
        </Button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Earnings" value={`৳${totalEarnings.toLocaleString()}`} icon={<TrendingUp className="h-5 w-5" />} iconColor={ICON_COLORS.marketplace} index={0} />
        <StatCard title="Available Balance" value={`৳${availableBalance.toLocaleString()}`} icon={<Wallet className="h-5 w-5" />} iconColor={ICON_COLORS.farm} index={1} />
        <StatCard title="Total Withdrawn" value={`৳${totalPaid.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} iconColor={ICON_COLORS.finance} index={2} />
        <StatCard title="Pending Payout" value={`৳${pendingPayout.toLocaleString()}`} icon={<Clock className="h-5 w-5" />} iconColor={ICON_COLORS.health} index={3} />
      </div>

      {/* Earnings Chart */}
      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardHeader>
          <CardTitle className="text-lg font-display">Earnings Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={earningsData}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ICON_COLORS.marketplace} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ICON_COLORS.marketplace} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" />
                <YAxis axisLine={false} tickLine={false} className="text-xs" tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`৳${v.toLocaleString()}`, "Earnings"]} />
                <Area type="monotone" dataKey="amount" stroke={ICON_COLORS.marketplace} fill="url(#earnGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.marketplace}, ${ICON_COLORS.vet})` }} />
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg font-display">Payout History</CardTitle>
          <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payout ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payoutHistory.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-foreground">{p.id}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="text-foreground">{p.method}</TableCell>
                  <TableCell className="text-right font-bold text-foreground">৳{p.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{p.ref}</TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: `${statusColors[p.status]}1A`, color: statusColors[p.status] }} className="capitalize">
                      {p.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
