import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PenSquare, Search, Sparkles, Flame, HelpCircle, Clock } from "lucide-react";
import { motion } from "framer-motion";
import PostCard, { CATEGORY_LABELS, ANIMAL_LABELS } from "@/components/community/PostCard";

type PostRow = {
  id: string; user_id: string; post_type: string; title: string; body: string;
  category: string; animal_type: string; priority: string; status: string;
  comment_count: number; answer_count: number; reaction_count: number;
  created_at: string; updated_at: string;
};

const TABS = [
  { value: "latest", label: "Latest", icon: Clock },
  { value: "questions", label: "Questions", icon: HelpCircle },
  { value: "urgent", label: "Urgent", icon: Flame },
  { value: "unanswered", label: "Unanswered", icon: Sparkles },
];

export default function CommunityFeed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; primary_role: string }>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("latest");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [animalFilter, setAnimalFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllAnimals, setShowAllAnimals] = useState(false);

  const fetchPosts = async () => {
    const { data, error } = await api.from("community_posts").select("*").eq("status", "active").order("created_at", { ascending: false });
    if (!error && data) {
      setPosts(data as PostRow[]);
      const userIds = [...new Set(data.map((p: any) => p.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await api.from("profiles").select("id, name, primary_role").in("id", userIds);
        if (profs) {
          const map: Record<string, { name: string; primary_role: string }> = {};
          profs.forEach((p: any) => { map[p.id] = { name: p.name, primary_role: p.primary_role }; });
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  useEffect(() => {
    const channel = api
      .channel("community-posts-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_posts" }, (payload) => {
        const updated = payload.new as PostRow;
        setPosts(prev => prev.map(p => p.id === updated.id ? { ...p, reaction_count: updated.reaction_count, comment_count: updated.comment_count, answer_count: updated.answer_count } : p));
      })
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, []);

  const handleReactionChange = (postId: string, newCount: number) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, reaction_count: newCount } : p));
  };

  let filtered = posts;
  if (tab === "questions") filtered = filtered.filter(p => p.post_type === "question" || p.post_type === "help_request");
  if (tab === "urgent") filtered = filtered.filter(p => p.priority === "urgent" || p.priority === "expert_needed");
  if (tab === "unanswered") filtered = filtered.filter(p => (p.post_type === "question" || p.post_type === "help_request") && p.answer_count === 0);
  if (categoryFilter !== "all") filtered = filtered.filter(p => p.category === categoryFilter);
  if (animalFilter !== "all") filtered = filtered.filter(p => p.animal_type === animalFilter);
  if (search.trim()) {
    const s = search.toLowerCase();
    filtered = filtered.filter(p => p.title.toLowerCase().includes(s) || p.body.toLowerCase().includes(s));
  }

  const categoryEntries = Object.entries(CATEGORY_LABELS);
  const animalEntries = Object.entries(ANIMAL_LABELS);
  const visibleCategories = showAllCategories ? categoryEntries : categoryEntries.slice(0, 5);
  const visibleAnimals = showAllAnimals ? animalEntries : animalEntries.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Quick-post banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/60 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/community/create")}
        >
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5 shrink-0">
            <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-sm font-bold text-teal-600">
              {user?.name?.charAt(0) || "?"}
            </div>
          </div>
          <div className="flex-1 px-4 py-2.5 rounded-full bg-muted/60 text-sm text-muted-foreground">
            What's on your mind? Share with the community...
          </div>
          <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white rounded-full px-4 shrink-0">
            <PenSquare className="h-4 w-4 mr-1.5" /> Post
          </Button>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search posts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full bg-card border-border/60" />
      </div>

      {/* Pill tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          const isActive = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-teal-500 text-white shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filter chips */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-1">Category:</span>
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              categoryFilter === "all" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >All</button>
          {visibleCategories.map(([k, v]) => (
            <button
              key={k}
              onClick={() => setCategoryFilter(k === categoryFilter ? "all" : k)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                categoryFilter === k ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >{v}</button>
          ))}
          {categoryEntries.length > 5 && (
            <button onClick={() => setShowAllCategories(!showAllCategories)} className="text-[11px] text-teal-600 hover:underline">
              {showAllCategories ? "Less" : `+${categoryEntries.length - 5} more`}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-1">Animal:</span>
          <button
            onClick={() => setAnimalFilter("all")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              animalFilter === "all" ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >All</button>
          {visibleAnimals.map(([k, v]) => (
            <button
              key={k}
              onClick={() => setAnimalFilter(k === animalFilter ? "all" : k)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                animalFilter === k ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >{v}</button>
          ))}
          {animalEntries.length > 5 && (
            <button onClick={() => setShowAllAnimals(!showAllAnimals)} className="text-[11px] text-teal-600 hover:underline">
              {showAllAnimals ? "Less" : `+${animalEntries.length - 5} more`}
            </button>
          )}
        </div>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No posts found</p>
          <Button variant="outline" className="mt-3 rounded-full" onClick={() => navigate("/community/create")}>Be the first to post</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <PostCard
                post={{
                  ...post,
                  author_name: profiles[post.user_id]?.name,
                  author_role: profiles[post.user_id]?.primary_role,
                }}
                onReactionChange={handleReactionChange}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
