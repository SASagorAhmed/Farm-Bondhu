import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "@/components/community/PostCard";
import { useCommunityPostsBundle } from "@/hooks/useCommunityPostsBundle";

export default function SavedPosts() {
  const { user } = useAuth();
  const { data, isLoading } = useCommunityPostsBundle({
    queryKey: ["community-saved", user?.id || "anon"],
    enabled: Boolean(user?.id),
    loadPosts: async () => {
      if (!user?.id) return [];
      const { data: saves } = await api.from("community_saves").select("post_id").eq("user_id", user.id);
      if (!saves?.length) return [];
      const postIds = saves.map((s) => s.post_id);
      const { data: postsData } = await api
        .from("community_posts")
        .select("*")
        .in("id", postIds)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return postsData || [];
    },
  });
  const posts = data?.posts || [];
  const profiles = data?.profiles || {};

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Saved Posts</h1>
        <p className="text-muted-foreground mt-1">Posts you've bookmarked</p>
      </motion.div>
      {isLoading && !posts.length ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        : posts.length === 0 ? <p className="text-center py-16 text-muted-foreground">No saved posts yet.</p>
        : <div className="space-y-3">{posts.map(p => <PostCard key={p.id} post={{ ...p, author_name: profiles[p.user_id]?.name, author_role: profiles[p.user_id]?.primary_role }} />)}</div>}
    </div>
  );
}
