import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, readSession, API_BASE } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { CATEGORY_LABELS, ANIMAL_LABELS } from "@/components/community/PostCard";
import LinkPreview, { type LinkPreviewData } from "@/components/community/LinkPreview";
import SharedPostEmbed, { type SharedPostData } from "@/components/community/SharedPostEmbed";
import { extractFirstUrl } from "@/lib/urlUtils";

const POST_TYPES = [
  { value: "question", label: "Question", emoji: "❓", desc: "Ask for help" },
  { value: "discussion", label: "Discussion", emoji: "💬", desc: "General discussion" },
  { value: "experience", label: "Experience", emoji: "📖", desc: "Share your story" },
  { value: "help_request", label: "Help Request", emoji: "🆘", desc: "Urgent problem" },
  { value: "knowledge_share", label: "Knowledge", emoji: "🎓", desc: "Educational" },
];

const PRIORITIES = [
  { value: "normal", label: "Normal" },
  { value: "important", label: "Important" },
  { value: "urgent", label: "Urgent" },
  { value: "expert_needed", label: "Expert Needed" },
];

export default function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shareId = searchParams.get("share");

  const [postType, setPostType] = useState("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("");
  const [animalType, setAnimalType] = useState("");
  const [priority, setPriority] = useState("normal");
  const [submitting, setSubmitting] = useState(false);

  const [linkPreview, setLinkPreview] = useState<LinkPreviewData | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string | null>(null);

  const [sharedPost, setSharedPost] = useState<SharedPostData | null>(null);
  const [sharedPostLoading, setSharedPostLoading] = useState(false);

  // Fetch shared post if ?share= param exists
  useEffect(() => {
    if (!shareId) return;
    const fetchShared = async () => {
      setSharedPostLoading(true);
      const { data } = await api
        .from("community_posts")
        .select("id, title, body, post_type, category, animal_type, created_at, user_id")
        .eq("id", shareId)
        .single();
      if (data) {
        const { data: profile } = await api.from("profiles").select("name, primary_role").eq("id", data.user_id).single();
        setSharedPost({
          ...data,
          author_name: profile?.name,
          author_role: profile?.primary_role,
        });
        // Pre-fill category and animal type from shared post
        if (!category) setCategory(data.category);
        if (!animalType) setAnimalType(data.animal_type);
        setPostType("discussion");
      }
      setSharedPostLoading(false);
    };
    fetchShared();
  }, [shareId]);

  const fetchLinkPreview = useCallback(async (url: string) => {
    if (url === lastFetchedUrl) return;
    setLastFetchedUrl(url);
    setLinkLoading(true);
    try {
      const token = readSession()?.access_token;
      if (!token) {
        setLinkPreview({ url });
        setLinkLoading(false);
        return;
      }
      const r = await fetch(`${API_BASE}/v1/tools/link-preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data && !data.error) {
        setLinkPreview(data as LinkPreviewData);
      } else {
        setLinkPreview({ url });
      }
    } catch {
      setLinkPreview({ url });
    }
    setLinkLoading(false);
  }, [lastFetchedUrl]);

  // Immediate URL detection to avoid typing-delay before preview starts.
  useEffect(() => {
    const url = extractFirstUrl(body);
    if (url) {
      void fetchLinkPreview(url);
    } else {
      setLinkPreview(null);
      setLastFetchedUrl(null);
    }
  }, [body, fetchLinkPreview]);

  const handleSubmit = async () => {
    if (!user || !title.trim() || !category || !animalType) {
      toast({ title: "Missing fields", description: "Please fill title, category, and animal type", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const insertData: any = {
      user_id: user.id, post_type: postType, title: title.trim(), body: body.trim(),
      category, animal_type: animalType, priority,
    };
    if (linkPreview && linkPreview.title) {
      insertData.link_preview = linkPreview;
    }
    if (sharedPost) {
      insertData.shared_post_id = sharedPost.id;
    }
    const { error } = await api.from("community_posts").insert(insertData);
    if (error) {
      setSubmitting(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    // Increment share_count on original post
    if (sharedPost) {
      const { data: origPost } = await api.from("community_posts").select("share_count").eq("id", sharedPost.id).single();
      if (origPost) {
        await api.from("community_posts").update({ share_count: ((origPost as any).share_count || 0) + 1 } as any).eq("id", sharedPost.id);
      }
    }
    setSubmitting(false);
    toast({ title: "Post created!", description: "Your post is now live in the community." });
    navigate("/community");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {sharedPost ? "Share this post" : "What do you want to share?"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {sharedPost ? "Add your thoughts and share with the community" : "Choose a type and tell the community"}
              </p>
            </div>

            {/* Shared post embed */}
            {sharedPostLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {sharedPost && (
              <SharedPostEmbed post={sharedPost} />
            )}

            {/* Post type cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {POST_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setPostType(t.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                    postType === t.value
                      ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 shadow-sm"
                      : "border-border/60 hover:border-muted-foreground/30 bg-card"
                  }`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span className="text-xs font-semibold text-foreground">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Title *</label>
              <Input placeholder="e.g. My goat is not eating properly" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className="rounded-lg" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea placeholder="Describe your question or experience in detail... Paste a link to auto-preview!" value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={5000} className="rounded-lg" />
              {(linkLoading || linkPreview) && (
                <LinkPreview data={linkPreview} loading={linkLoading} />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Category *</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Animal Type *</label>
                <Select value={animalType} onValueChange={setAnimalType}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select animal" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ANIMAL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {title.trim() && (
              <div className="rounded-xl border border-dashed border-border p-4 bg-muted/20">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Preview</p>
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                {body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{body}</p>}
                {linkPreview && <LinkPreview data={linkPreview} compact />}
                {sharedPost && <SharedPostEmbed post={sharedPost} compact />}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate("/community")} className="rounded-full">Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="bg-teal-500 hover:bg-teal-600 text-white rounded-full px-6">
                {submitting ? "Posting..." : sharedPost ? "Share Post" : "Publish Post"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
