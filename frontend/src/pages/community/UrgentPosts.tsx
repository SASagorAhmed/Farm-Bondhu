import { api } from "@/api/client";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "@/components/community/PostCard";
import { useCommunityPostsBundle } from "@/hooks/useCommunityPostsBundle";

export default function UrgentPosts() {
  const { data, isLoading } = useCommunityPostsBundle({
    queryKey: ["community-urgent"],
    loadPosts: async () => {
      const { data: posts } = await api
        .from("community_posts")
        .select("*")
        .eq("status", "active")
        .in("priority", ["urgent", "expert_needed"])
        .order("created_at", { ascending: false });
      return posts || [];
    },
  });
  const posts = data?.posts || [];
  const profiles = data?.profiles || {};

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Urgent Posts</h1>
        <p className="text-muted-foreground mt-1">Posts needing immediate attention</p>
      </motion.div>
      {isLoading && !posts.length ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        : posts.length === 0 ? <p className="text-center py-16 text-muted-foreground">No urgent posts right now.</p>
        : <div className="space-y-3">{posts.map(p => <PostCard key={p.id} post={{ ...p, author_name: profiles[p.user_id]?.name, author_role: profiles[p.user_id]?.primary_role }} />)}</div>}
    </div>
  );
}
