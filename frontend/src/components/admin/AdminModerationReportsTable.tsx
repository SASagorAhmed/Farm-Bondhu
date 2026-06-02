import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Flag, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchModerationReports,
  resolveMarketplaceModerationReport,
  type ModerationReportRow,
} from "@/lib/marketplaceChatReportApi";
import { ICON_COLORS } from "@/lib/iconColors";

interface AdminModerationReportsTableProps {
  defaultTypeFilter?: "all" | "community" | "marketplace";
  title?: string;
  showTypeTabs?: boolean;
}

export default function AdminModerationReportsTable({
  defaultTypeFilter = "all",
  title = "Moderation reports",
  showTypeTabs = true,
}: AdminModerationReportsTableProps) {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState(defaultTypeFilter);
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved" | "all">("pending");
  const [rows, setRows] = useState<ModerationReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchModerationReports({ type: typeFilter, status: statusFilter });
    setRows(data);
    setLoading(false);
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResolve = async (row: ModerationReportRow) => {
    if (row.type !== "marketplace") {
      navigate(row.action_url);
      return;
    }
    setResolvingId(row.id);
    const ok = await resolveMarketplaceModerationReport(row.id);
    setResolvingId(null);
    if (!ok) {
      toast.error("Could not resolve report");
      return;
    }
    toast.success("Report marked resolved");
    void load();
  };

  const openTarget = (row: ModerationReportRow) => {
    if (row.type === "marketplace" && row.target.conversation_id) {
      navigate(`/admin/marketplace/messages?conversation=${row.target.conversation_id}`);
      return;
    }
    navigate(row.action_url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Flag className="h-4 w-4 text-destructive" />
          {title}
        </h2>
        <div className="flex flex-wrap gap-2">
          {showTypeTabs && (
            <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="community">Community</TabsTrigger>
                <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <TabsList>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">No reports in this view.</p>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.type}-${row.id}`}>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{row.reporter.name}</div>
                    {row.reporter.role && (
                      <span className="text-[10px] text-muted-foreground capitalize">{row.reporter.role}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px]">
                    <p className="truncate">{row.reason}</p>
                    {row.details && <p className="text-[10px] text-muted-foreground truncate">{row.details}</p>}
                  </TableCell>
                  <TableCell className="text-sm max-w-[240px]">
                    <p className="truncate">{row.target.summary}</p>
                    {row.type === "marketplace" && row.target.shop_name && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {[row.target.shop_name, row.target.seller_name, row.target.seller_phone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => openTarget(row)}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                    {row.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolvingId === row.id}
                        onClick={() => void handleResolve(row)}
                        style={{ color: ICON_COLORS.admin }}
                      >
                        {resolvingId === row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {row.type === "marketplace" ? "Resolve" : "Review"}
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
