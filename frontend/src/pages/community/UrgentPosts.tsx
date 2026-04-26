import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "@/components/community/PostCard";

export default function UrgentPosts() {
  const [posts, setPosts] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; primary_role: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await api.from("community_posts").select("*").eq("status", "active").in("priority", ["urgent", "expert_needed"]).order("created_at", { ascending: false });
      setPosts(data || []);
      const userIds = [...new Set((data || []).map((p: any) => p.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await api.from("profiles").select("id, name, primary_role").in("id", userIds);
        if (profs) {
          const map: Record<string, { name: string; primary_role: string }> = {};
          profs.forEach((p: any) => { map[p.id] = { name: p.name, primary_role: p.primary_role }; });
          setProfiles(map);
        }
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Urgent Posts</h1>
        <p className="text-muted-foreground mt-1">Posts needing immediate attention</p>
      </motion.div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        : posts.length === 0 ? <p className="text-center py-16 text-muted-foreground">No urgent posts right now.</p>
        : <div className="space-y-3">{posts.map(p => <PostCard key={p.id} post={{ ...p, author_name: profiles[p.user_id]?.name, author_role: profiles[p.user_id]?.primary_role }} />)}</div>}
    </div>
  );
}
