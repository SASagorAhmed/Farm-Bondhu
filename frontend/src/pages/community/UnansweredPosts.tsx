import { api } from "@/api/client";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "@/components/community/PostCard";
import { useCommunityPostsBundle } from "@/hooks/useCommunityPostsBundle";

export default function UnansweredPosts() {
  const { data, isLoading } = useCommunityPostsBundle({
    queryKey: ["community-unanswered"],
    loadPosts: async () => {
      const { data: posts } = await api
        .from("community_posts")
        .select("*")
        .eq("status", "active")
        .in("post_type", ["question", "help_request"])
        .eq("answer_count", 0)
        .order("created_at", { ascending: false });
      return posts || [];
    },
  });
  const posts = data?.posts || [];
  const profiles = data?.profiles || {};

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Unanswered Questions</h1>
        <p className="text-muted-foreground mt-1">These questions need your help</p>
      </motion.div>
      {isLoading && !posts.length ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        : posts.length === 0 ? <p className="text-center py-16 text-muted-foreground">All questions have been answered! 🎉</p>
        : <div className="space-y-3">{posts.map(p => <PostCard key={p.id} post={{ ...p, author_name: profiles[p.user_id]?.name, author_role: profiles[p.user_id]?.primary_role }} />)}</div>}
    </div>
  );
}
