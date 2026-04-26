import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Shield, MessageSquareText, AlertTriangle, Eye, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminCommunity() {
  const [tab, setTab] = useState("reports");
  const [reports, setReports] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: reps }, { data: allPosts }] = await Promise.all([
      api.from("community_reports").select("*").order("created_at", { ascending: false }),
      api.from("community_posts").select("*").order("created_at", { ascending: false }),
    ]);
    setReports(reps || []);
    setPosts(allPosts || []);

    const userIds = new Set([...(allPosts || []).map((p: any) => p.user_id), ...(reps || []).map((r: any) => r.reported_by)]);
    const { data: profs } = await api.from("profiles").select("id, name").in("id", [...userIds]);
    if (profs) {
      const map: Record<string, string> = {};
      profs.forEach((p: any) => { map[p.id] = p.name; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updatePostStatus = async (postId: string, status: string) => {
    await api.from("community_posts").update({ status }).eq("id", postId);
    toast({ title: `Post ${status}` });
    fetchData();
  };

  const resolveReport = async (reportId: string) => {
    await api.from("community_reports").update({ status: "resolved" }).eq("id", reportId);
    toast({ title: "Report resolved" });
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const pendingReports = reports.filter(r => r.status === "pending");
  const flaggedPosts = posts.filter(p => p.status !== "active");

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366F1, #8B5CF6)" }}>
          <MessageSquareText className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Community Moderation
            <Badge variant="secondary" className="text-xs" style={{ backgroundColor: "#6366F11A", color: "#6366F1" }}>
              <Shield className="h-3 w-3 mr-1" /> Admin View
            </Badge>
          </h1>
          <p className="text-muted-foreground">{posts.length} total posts · {pendingReports.length} pending reports</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{posts.length}</p><p className="text-xs text-muted-foreground">Total Posts</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold" style={{ color: "#F43F5E" }}>{pendingReports.length}</p><p className="text-xs text-muted-foreground">Pending Reports</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{flaggedPosts.length}</p><p className="text-xs text-muted-foreground">Hidden/Under Review</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="reports">Reports</TabsTrigger><TabsTrigger value="all">All Posts</TabsTrigger></TabsList>
      </Tabs>

      {tab === "reports" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Reported Content</CardTitle></CardHeader>
          <CardContent>
            {pendingReports.length === 0 ? <p className="text-muted-foreground text-sm text-center py-6">No pending reports</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Reporter</TableHead><TableHead>Reason</TableHead><TableHead>Post ID</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pendingReports.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{profiles[r.reported_by] || "Unknown"}</TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell className="text-xs font-mono">{r.post_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="space-x-2">
                        {r.post_id && <Button size="sm" variant="outline" onClick={() => updatePostStatus(r.post_id, "hidden")}><Eye className="h-3 w-3 mr-1" /> Hide Post</Button>}
                        {r.post_id && <Button size="sm" variant="destructive" onClick={() => updatePostStatus(r.post_id, "removed")}><Trash2 className="h-3 w-3 mr-1" /> Remove</Button>}
                        <Button size="sm" variant="outline" onClick={() => resolveReport(r.id)}>Resolve</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">All Posts</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Author</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {posts.slice(0, 50).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{profiles[p.user_id] || "Unknown"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{p.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.post_type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={p.status === "active" ? "default" : "destructive"} className="text-[10px]">{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-1">
                      {p.status === "active" && <Button size="sm" variant="outline" onClick={() => updatePostStatus(p.id, "hidden")}>Hide</Button>}
                      {p.status === "hidden" && <Button size="sm" variant="outline" onClick={() => updatePostStatus(p.id, "active")}>Restore</Button>}
                      {p.status !== "removed" && <Button size="sm" variant="destructive" onClick={() => updatePostStatus(p.id, "removed")}>Remove</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
