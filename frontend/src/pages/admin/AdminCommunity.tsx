import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Loader2, Shield, MessageSquareText, Eye, Trash2, Lock, LockOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { ICON_COLORS } from "@/lib/iconColors";
import {
  blockCommunityUser,
  COMMUNITY_MODERATION_QUERY_KEYS,
  fetchAdminCommunityPosts,
  fetchAdminCommunityReports,
  fetchCommunityBlockedUsers,
  fetchCommunityUsers,
  resolveAdminCommunityReport,
  unblockCommunityUser,
  updateAdminCommunityPostStatus,
  type AdminCommunityPost,
  type AdminCommunityReport,
  type CommunityBlockedUser,
  type CommunityModerationUser,
} from "@/lib/communityModerationApi";

type ProfileSummary = {
  id: string;
  name?: string;
  email?: string;
  primary_role?: string;
};

export default function AdminCommunity() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("reports");
  const [reports, setReports] = useState<AdminCommunityReport[]>([]);
  const [posts, setPosts] = useState<AdminCommunityPost[]>([]);
  const [communityUsers, setCommunityUsers] = useState<CommunityModerationUser[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<CommunityBlockedUser[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [profileDetails, setProfileDetails] = useState<Record<string, ProfileSummary>>({});
  const [loading, setLoading] = useState(true);
  const [moderatingUserId, setModeratingUserId] = useState<string | null>(null);

  const fetchData = async () => {
    const [reps, allPosts, blocks, users] = await Promise.all([
      fetchAdminCommunityReports().catch(() => []),
      fetchAdminCommunityPosts().catch(() => []),
      fetchCommunityBlockedUsers().catch(() => []),
      fetchCommunityUsers().catch(() => []),
    ]);
    setReports(reps);
    setPosts(allPosts);
    setBlockedUsers(blocks);
    setCommunityUsers(users);

    const map: Record<string, string> = {};
    const details: Record<string, ProfileSummary> = {};
    [...users, ...blocks].forEach((p) => {
      map[p.user_id] = p.name || p.email || "Unknown";
      details[p.user_id] = {
        id: p.user_id,
        name: p.name,
        email: p.email,
        primary_role: p.primary_role,
      };
    });
    setProfiles(map);
    setProfileDetails(details);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updatePostStatus = async (postId: string, status: string) => {
    await updateAdminCommunityPostStatus(postId, status);
    toast({ title: `Post ${status}` });
    fetchData();
  };

  const resolveReport = async (reportId: string) => {
    await resolveAdminCommunityReport(reportId);
    toast({ title: "Report resolved" });
    fetchData();
  };

  const postById = new Map(posts.map((post) => [post.id, post]));
  const blockedUserIds = new Set(blockedUsers.map((user) => user.user_id));

  const toggleCommunityBlock = async (userId: string, blocked: boolean) => {
    setModeratingUserId(userId);
    try {
      if (blocked) {
        await unblockCommunityUser(userId);
        toast({ title: "Community access restored" });
      } else {
        await blockCommunityUser(userId);
        toast({ title: "User blocked from Community" });
      }
      await fetchData();
      void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      void queryClient.invalidateQueries({ queryKey: COMMUNITY_MODERATION_QUERY_KEYS.users });
      void queryClient.invalidateQueries({ queryKey: COMMUNITY_MODERATION_QUERY_KEYS.blockedUsers });
    } catch (error) {
      toast({
        title: "Community moderation failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setModeratingUserId(null);
    }
  };

  const renderCommunityBlockButton = (userId?: string | null) => {
    if (!userId) return null;
    const blocked = blockedUserIds.has(userId);
    return (
      <Button
        size="sm"
        variant={blocked ? "outline" : "destructive"}
        disabled={moderatingUserId === userId}
        onClick={() => void toggleCommunityBlock(userId, blocked)}
      >
        {blocked ? <LockOpen className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
        {blocked ? "Unblock Community" : "Block Community"}
      </Button>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  const pendingReports = reports.filter(r => r.status === "pending");

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${ICON_COLORS.community}, ${ICON_COLORS.admin})` }}>
          <MessageSquareText className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Community Moderation
            <Badge variant="secondary" className="text-xs" style={{ backgroundColor: "#6366F11A", color: "#6366F1" }}>
              <Shield className="h-3 w-3 mr-1" /> Admin View
            </Badge>
          </h1>
          <p className="text-muted-foreground">{posts.length} total posts · {pendingReports.length} pending reports · {blockedUsers.length} blocked users</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{posts.length}</p><p className="text-xs text-muted-foreground">Total Posts</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold" style={{ color: "#F43F5E" }}>{pendingReports.length}</p><p className="text-xs text-muted-foreground">Pending Reports</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold" style={{ color: ICON_COLORS.community }}>{blockedUsers.length}</p><p className="text-xs text-muted-foreground">Community Blocked</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="all">All Posts</TabsTrigger>
          <TabsTrigger value="users">Community Users</TabsTrigger>
          <TabsTrigger value="blocked">Blocked Users</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "reports" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Reported Content</CardTitle></CardHeader>
          <CardContent>
            {pendingReports.length === 0 ? <p className="text-muted-foreground text-sm text-center py-6">No pending reports</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Reporter</TableHead><TableHead>Reason</TableHead><TableHead>Post ID</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pendingReports.map(r => {
                    const reportedPost = r.post_id ? postById.get(r.post_id) : null;
                    return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{r.reported_by ? profiles[r.reported_by] : "Unknown"}</TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell className="text-xs font-mono">{r.post_id?.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="space-x-2">
                        {r.post_id && <Button size="sm" variant="outline" onClick={() => updatePostStatus(r.post_id || "", "hidden")}><Eye className="h-3 w-3 mr-1" /> Hide Post</Button>}
                        {r.post_id && <Button size="sm" variant="destructive" onClick={() => updatePostStatus(r.post_id || "", "removed")}><Trash2 className="h-3 w-3 mr-1" /> Remove</Button>}
                        {renderCommunityBlockButton(reportedPost?.user_id)}
                        <Button size="sm" variant="outline" onClick={() => resolveReport(r.id)}>Resolve</Button>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : tab === "all" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">All Posts</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Author</TableHead><TableHead>Title</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {posts.slice(0, 50).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span>{profiles[p.user_id] || "Unknown"}</span>
                        {blockedUserIds.has(p.user_id) && <span className="text-[11px] text-destructive">Community blocked</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{p.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{p.post_type}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={p.status === "active" ? "default" : "destructive"} className="text-[10px]">{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="space-x-1">
                      {p.status === "active" && <Button size="sm" variant="outline" onClick={() => updatePostStatus(p.id, "hidden")}>Hide</Button>}
                      {p.status === "hidden" && <Button size="sm" variant="outline" onClick={() => updatePostStatus(p.id, "active")}>Restore</Button>}
                      {p.status !== "removed" && <Button size="sm" variant="destructive" onClick={() => updatePostStatus(p.id, "removed")}>Remove</Button>}
                      {renderCommunityBlockButton(p.user_id)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : tab === "users" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Community Users</CardTitle></CardHeader>
          <CardContent>
            {communityUsers.length === 0 ? <p className="text-muted-foreground text-sm text-center py-6">No Community users found yet.</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {communityUsers.map((communityUser) => {
                    const blocked = blockedUserIds.has(communityUser.user_id) || Boolean(communityUser.is_community_blocked);
                    return (
                      <TableRow key={communityUser.user_id}>
                        <TableCell className="text-sm font-medium">{communityUser.name || communityUser.email || "Unknown"}</TableCell>
                        <TableCell className="text-sm">{communityUser.email || "-"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{communityUser.primary_role || "member"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {communityUser.post_count || 0} posts · {communityUser.comment_count || 0} comments · {communityUser.answer_count || 0} answers
                          {communityUser.latest_activity_at && (
                            <span className="block">Last active {new Date(communityUser.latest_activity_at).toLocaleDateString()}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={blocked ? "destructive" : "secondary"} className="text-[10px]">
                            {blocked ? "Community blocked" : "Allowed"}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderCommunityBlockButton(communityUser.user_id)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === "blocked" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Community Blocked Users</CardTitle></CardHeader>
          <CardContent>
            {blockedUsers.length === 0 ? <p className="text-muted-foreground text-sm text-center py-6">No users are blocked from Community.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Blocked</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {blockedUsers.map((blocked) => {
                    const profile = profileDetails[blocked.user_id];
                    return (
                      <TableRow key={blocked.user_id}>
                        <TableCell className="text-sm">{blocked.name || profile?.name || "Unknown"}</TableCell>
                        <TableCell className="text-sm">{blocked.email || profile?.email || "-"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{blocked.primary_role || profile?.primary_role || "member"}</Badge></TableCell>
                        <TableCell className="text-xs">{blocked.blocked_at ? new Date(blocked.blocked_at).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" disabled={moderatingUserId === blocked.user_id} onClick={() => void toggleCommunityBlock(blocked.user_id, true)}>
                            <LockOpen className="h-3 w-3 mr-1" /> Unblock Community
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
