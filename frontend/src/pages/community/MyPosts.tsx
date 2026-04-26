import { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import PostCard from "@/components/community/PostCard";

export default function MyPosts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.from("community_posts").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setPosts(data || []); setLoading(false); });
  }, [user]);

  const deletePost = async (postId: string) => {
    const { error } = await api.from("community_posts").delete().eq("id", postId);
    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: "Post deleted" });
    }
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">My Posts</h1>
        <p className="text-muted-foreground mt-1">Posts you've created</p>
      </motion.div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        : posts.length === 0 ? <p className="text-center py-16 text-muted-foreground">You haven't posted yet.</p>
        : <div className="space-y-3">{posts.map(p => (
          <div key={p.id} className="relative group">
            <PostCard post={{ ...p, author_name: user?.name, author_role: user?.primaryRole }} />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-3 right-3 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete your post.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deletePost(p.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}</div>}
    </div>
  );
}
