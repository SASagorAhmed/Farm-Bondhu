import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, API_BASE, readSession } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, ThumbsUp, Bookmark, Flag, ArrowLeft, Pencil, Trash2, MoreVertical, Clock, Send, Share2, Briefcase, ExternalLink, UserCircle, Lock, LockOpen } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import PostTypeBadge from "@/components/community/PostTypeBadge";
import PriorityBadge from "@/components/community/PriorityBadge";
import RoleBadge from "@/components/community/RoleBadge";
import AnswerCard from "@/components/community/AnswerCard";
import ReportDialog from "@/components/community/ReportDialog";
import LinkPreview from "@/components/community/LinkPreview";
import type { LinkPreviewData } from "@/components/community/LinkPreview";
import SharedPostEmbed, { type SharedPostData } from "@/components/community/SharedPostEmbed";
import CommunityImageGrid from "@/components/community/CommunityImageGrid";
import { CATEGORY_LABELS, ANIMAL_LABELS, type CommunityHiringIntent } from "@/lib/communityCategories";
import type { CommunityImageAttachment } from "@/lib/communityPostMediaApi";
import { withApiTiming } from "@/lib/perfMetrics";
import { useAdminPreviewMode } from "@/hooks/useAdminPreviewMode";
import { fetchHiringInterests, submitHiringInterest, type HiringInterest } from "@/lib/communityHiringApi";
import {
  blockCommunityUser,
  COMMUNITY_MODERATION_QUERY_KEYS,
  fetchCommunityBlockedUsers,
  unblockCommunityUser,
} from "@/lib/communityModerationApi";

type PostRow = {
  id: string; user_id: string; post_type: string; title: string; body: string;
  post_intent?: string;
  category: string; animal_type: string; priority: string; status: string;
  comment_count: number; answer_count: number; reaction_count: number;
  share_count?: number; shared_post_id?: string | null;
  created_at: string; link_preview?: LinkPreviewData | null;
  attachments?: CommunityImageAttachment[] | null;
  hiring_details?: {
    intent?: CommunityHiringIntent;
    position?: string;
    location?: string;
    pay?: string;
    skills?: string;
    contact?: string;
    deadline?: string;
    availability?: string;
  };
};

type CommentRow = {
  id: string;
  post_id?: string;
  user_id: string;
  parent_id?: string | null;
  body: string;
  reaction_count?: number;
  reply_count?: number;
  has_reacted?: boolean;
  created_at: string;
};
type AnswerRow = { id: string; user_id: string; body: string; is_best_answer: boolean; upvote_count: number; created_at: string };

type PostDetailPayload = {
  post?: PostRow;
  comments?: CommentRow[];
  answers?: AnswerRow[];
  profiles?: Record<string, { name: string; primary_role: string }>;
  hasReacted?: boolean;
  hasSaved?: boolean;
  hasInterested?: boolean;
  hiringInterestCount?: number;
  sharedPost?: SharedPostData | null;
};

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { canModerate } = useAdminPreviewMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [post, setPost] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; primary_role: string }>>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyBodyByCommentId, setReplyBodyByCommentId] = useState<Record<string, string>>({});
  const [hasReacted, setHasReacted] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasInterested, setHasInterested] = useState(false);
  const [hiringInterestCount, setHiringInterestCount] = useState(0);
  const [interestMessage, setInterestMessage] = useState("");
  const [interestSubmitting, setInterestSubmitting] = useState(false);
  const [hiringInterests, setHiringInterests] = useState<HiringInterest[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sharedPost, setSharedPost] = useState<SharedPostData | null>(null);

  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [moderatingUserId, setModeratingUserId] = useState<string | null>(null);

  const isQuestionType = post?.post_type === "question" || post?.post_type === "help_request";
  const isHiringPost = post?.post_type === "hiring" || post?.post_intent === "hiring" || Boolean(post?.category?.includes("hiring"));
  const isPostOwner = user?.id === post?.user_id;
  const isJobWanted = post?.hiring_details?.intent === "job_wanted" || post?.category === "job_wanted";
  const canEditPost = isPostOwner;
  const canDeletePost = isPostOwner || canModerate;

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const token = readSession()?.access_token;
    const res = await withApiTiming("/v1/community/posts/:id/detail", () =>
      fetch(`${API_BASE}/v1/community/posts/${id}/detail`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    );
    const body = await res.json().catch(() => ({}));
    const data = (body as { data?: PostDetailPayload }).data;
    if (!res.ok || !data?.post) {
      setLoading(false);
      return;
    }
    setPost(data.post as PostRow);
    setComments((data.comments || []) as CommentRow[]);
    setAnswers((data.answers || []) as AnswerRow[]);
    setProfiles((data.profiles || {}) as Record<string, { name: string; primary_role: string }>);
    setHasReacted(Boolean(data.hasReacted));
    setHasSaved(Boolean(data.hasSaved));
    setHasInterested(Boolean(data.hasInterested));
    setHiringInterestCount(Number(data.hiringInterestCount || 0));
    setSharedPost((data.sharedPost || null) as SharedPostData | null);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadBlockedUsers = useCallback(async () => {
    if (!canModerate) return;
    try {
      const rows = await fetchCommunityBlockedUsers();
      setBlockedUserIds(new Set(rows.map((row) => row.user_id)));
    } catch {
      setBlockedUserIds(new Set());
    }
  }, [canModerate]);

  useEffect(() => {
    void loadBlockedUsers();
  }, [loadBlockedUsers]);

  useEffect(() => {
    if (!id) return undefined;
    const refreshDetail = () => {
      void fetchAll();
      void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    };
    const channel = api
      .channel(`community-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts", filter: `id=eq.${id}` }, refreshDetail)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments", filter: `post_id=eq.${id}` }, refreshDetail)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_answers", filter: `post_id=eq.${id}` }, refreshDetail)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reactions", filter: `post_id=eq.${id}` }, refreshDetail)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comment_reactions", filter: `post_id=eq.${id}` }, refreshDetail)
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [fetchAll, id, queryClient]);

  useEffect(() => {
    if (loading) return;
    if (window.location.hash !== "#comments") return;
    window.requestAnimationFrame(() => {
      document.getElementById("comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, comments.length]);

  const toggleReaction = async () => {
    if (!user || !post) return;
    const newReacted = !hasReacted;
    const newCount = newReacted ? post.reaction_count + 1 : Math.max(0, post.reaction_count - 1);
    setHasReacted(newReacted);
    setPost(p => p ? { ...p, reaction_count: newCount } : p);
    let result: { post_counts?: { reaction_count?: number } } | null = null;
    if (newReacted) {
      const { data } = await api.from("community_reactions").insert({ post_id: post.id, user_id: user.id });
      result = data as typeof result;
    } else {
      const { data } = await api.from("community_reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      result = data as typeof result;
    }
    if (result?.post_counts?.reaction_count !== undefined) {
      setPost(p => p ? { ...p, reaction_count: Number(result?.post_counts?.reaction_count || 0) } : p);
    }
    void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
  };

  const toggleSave = async () => {
    if (!user || !post) return;
    if (hasSaved) {
      await api.from("community_saves").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await api.from("community_saves").insert({ post_id: post.id, user_id: user.id });
    }
    setHasSaved(!hasSaved);
    void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
  };

  const sendHiringInterest = async () => {
    if (!post || !user || interestSubmitting) return;
    if (!user.cvUrl) {
      navigate("/community/profile");
      return;
    }
    setInterestSubmitting(true);
    const result = await submitHiringInterest(post.id, interestMessage);
    setInterestSubmitting(false);
    if (!result.ok) {
      toast({ title: "Could not send interest", description: result.error, variant: "destructive" });
      return;
    }
    setHasInterested(true);
    setHiringInterestCount((n) => n + (hasInterested ? 0 : 1));
    toast({ title: "Interest sent", description: "Your profile and CV were shared with the hiring post owner." });
  };

  const loadHiringInterests = useCallback(async () => {
    if (!post) return;
    setLoadingInterests(true);
    try {
      const rows = await fetchHiringInterests(post.id);
      setHiringInterests(rows);
    } catch (error) {
      toast({ title: "Could not load interested users", description: error instanceof Error ? error.message : "Try again", variant: "destructive" });
    } finally {
      setLoadingInterests(false);
    }
  }, [post]);

  useEffect(() => {
    if (post && isHiringPost && (isPostOwner || canModerate)) {
      void loadHiringInterests();
    }
  }, [post, isHiringPost, isPostOwner, canModerate, loadHiringInterests]);

  const submitComment = async () => {
    if (!user || !post || !newComment.trim()) return;
    const { data, error } = await api.from("community_comments").insert({ post_id: post.id, user_id: user.id, body: newComment.trim() });
    if (!error) {
      const created = data as CommentRow & { post_counts?: { comment_count?: number } };
      if (created?.post_counts?.comment_count !== undefined) {
        setPost((p) => p ? { ...p, comment_count: Number(created.post_counts?.comment_count || 0) } : p);
      }
      setNewComment("");
      await fetchAll();
      void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    }
  };

  const submitReply = async (parentId: string) => {
    if (!user || !post) return;
    const text = (replyBodyByCommentId[parentId] || "").trim();
    if (!text) return;
    const { data, error } = await api.from("community_comments").insert({ post_id: post.id, parent_id: parentId, user_id: user.id, body: text });
    if (!error) {
      const created = data as CommentRow & { post_counts?: { comment_count?: number } };
      if (created?.post_counts?.comment_count !== undefined) {
        setPost((p) => p ? { ...p, comment_count: Number(created.post_counts?.comment_count || 0) } : p);
      }
      setReplyBodyByCommentId((prev) => ({ ...prev, [parentId]: "" }));
      setReplyingToCommentId(null);
      await fetchAll();
      void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    }
  };

  const submitAnswer = async () => {
    if (!user || !post || !newAnswer.trim()) return;
    const { data, error } = await api.from("community_answers").insert({ post_id: post.id, user_id: user.id, body: newAnswer.trim() });
    if (!error) {
      const created = data as AnswerRow & { post_counts?: { answer_count?: number } };
      if (created?.post_counts?.answer_count !== undefined) {
        setPost((p) => p ? { ...p, answer_count: Number(created.post_counts?.answer_count || 0) } : p);
      }
      setNewAnswer("");
      await fetchAll();
      void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    }
  };

  const markBestAnswer = async (answerId: string) => {
    if (!post) return;
    await api.from("community_answers").update({ is_best_answer: false }).eq("post_id", post.id);
    await api.from("community_answers").update({ is_best_answer: true }).eq("id", answerId);
    void fetchAll();
    void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
    toast({ title: "Best answer marked!" });
  };

  const startEditPost = () => { if (!post) return; setEditTitle(post.title); setEditBody(post.body); setEditingPost(true); };
  const saveEditPost = async () => {
    if (!post || !editTitle.trim()) return;
    const { error } = await api.from("community_posts").update({ title: editTitle.trim(), body: editBody.trim() }).eq("id", post.id);
    if (!error) { setPost(p => p ? { ...p, title: editTitle.trim(), body: editBody.trim() } : p); setEditingPost(false); toast({ title: "Post updated!" }); }
  };
  const deletePost = async () => { if (!post) return; await api.from("community_posts").delete().eq("id", post.id); toast({ title: "Post deleted" }); navigate("/community"); };

  const startEditComment = (c: CommentRow) => { setEditingCommentId(c.id); setEditCommentBody(c.body); };
  const saveEditComment = async () => {
    if (!editingCommentId || !editCommentBody.trim()) return;
    const { error } = await api.from("community_comments").update({ body: editCommentBody.trim() }).eq("id", editingCommentId);
    if (!error) { setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, body: editCommentBody.trim() } : c)); setEditingCommentId(null); toast({ title: "Comment updated!" }); }
  };
  const deleteComment = async (commentId: string) => {
    if (!post) return;
    const { error } = await api.from("community_comments").delete().eq("id", commentId);
    if (!error) {
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
      await fetchAll();
      void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      toast({ title: "Comment deleted" });
    }
  };

  const deleteAnswer = async (answerId: string) => {
    if (!post) return;
    const { error } = await api.from("community_answers").delete().eq("id", answerId);
    if (!error) { setAnswers(prev => prev.filter(a => a.id !== answerId)); await fetchAll(); void queryClient.invalidateQueries({ queryKey: ["community-feed"] }); toast({ title: "Answer deleted" }); }
  };

  const toggleCommunityBlock = async (userId: string) => {
    if (!canModerate || user?.id === userId) return;
    const isBlocked = blockedUserIds.has(userId);
    setModeratingUserId(userId);
    try {
      if (isBlocked) {
        await unblockCommunityUser(userId);
        toast({ title: "Community access restored" });
      } else {
        await blockCommunityUser(userId);
        toast({ title: "User blocked from Community" });
      }
      await loadBlockedUsers();
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

  const renderCommunityBlockItem = (userId: string) => {
    if (!canModerate || user?.id === userId) return null;
    const isBlocked = blockedUserIds.has(userId);
    return (
      <DropdownMenuItem onClick={() => void toggleCommunityBlock(userId)}>
        {isBlocked ? <LockOpen className="h-3.5 w-3.5 mr-2" /> : <Lock className="h-3.5 w-3.5 mr-2" />}
        {isBlocked ? "Unblock from Community" : "Block user from Community"}
      </DropdownMenuItem>
    );
  };
  const saveEditAnswer = async (answerId: string, newBody: string) => {
    const { error } = await api.from("community_answers").update({ body: newBody.trim() }).eq("id", answerId);
    if (!error) { setAnswers(prev => prev.map(a => a.id === answerId ? { ...a, body: newBody.trim() } : a)); toast({ title: "Answer updated!" }); }
  };

  const toggleCommentReaction = async (comment: CommentRow) => {
    if (!user) return;
    const nextReacted = !comment.has_reacted;
    setComments((prev) => prev.map((row) => row.id === comment.id ? {
      ...row,
      has_reacted: nextReacted,
      reaction_count: nextReacted ? (row.reaction_count || 0) + 1 : Math.max(0, (row.reaction_count || 0) - 1),
    } : row));
    if (nextReacted) {
      await api.from("community_comment_reactions").insert({ comment_id: comment.id });
    } else {
      await api.from("community_comment_reactions").delete().eq("comment_id", comment.id);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!post) return <div className="text-center py-20"><p>Post not found</p></div>;

  const author = profiles[post.user_id];
  const topLevelComments = comments.filter((comment) => !comment.parent_id);
  const repliesByParent = comments.reduce((acc, comment) => {
    if (!comment.parent_id) return acc;
    acc[comment.parent_id] = [...(acc[comment.parent_id] || []), comment];
    return acc;
  }, {} as Record<string, CommentRow[]>);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate("/community")} className="rounded-full">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            {/* Author section */}
            <div className="flex items-start gap-3 mb-4">
              <div className="h-11 w-11 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5 shrink-0">
                <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-sm font-bold text-teal-600">
                  {(author?.name || "U").charAt(0)}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">{author?.name || "User"}</span>
                  {author?.primary_role && <RoleBadge role={author.primary_role} />}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3" />
                  <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <PostTypeBadge type={post.post_type} />
                <PriorityBadge priority={post.priority} />
                {canModerate && !isPostOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                    disabled={moderatingUserId === post.user_id}
                    onClick={() => void toggleCommunityBlock(post.user_id)}
                  >
                    {blockedUserIds.has(post.user_id) ? <LockOpen className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                    <span className="hidden sm:inline text-xs">
                      {blockedUserIds.has(post.user_id) ? "Unblock" : "Block user"}
                    </span>
                  </Button>
                )}
                {canEditPost && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditPost}><Pencil className="h-4 w-4" /></Button>
                )}
                {canDeletePost && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {canModerate && !isPostOwner ? "Delete this post as Super Admin?" : "Delete this post?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {canModerate && !isPostOwner
                            ? "This will permanently delete this post and all its comments and answers."
                            : "This will permanently delete your post and all its comments and answers."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deletePost} className="bg-destructive text-destructive-foreground">
                          {canModerate && !isPostOwner ? "Delete as Super Admin" : "Delete"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                {CATEGORY_LABELS[post.category] || post.category}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                {ANIMAL_LABELS[post.animal_type] || post.animal_type}
              </span>
            </div>

            {editingPost ? (
              <div className="space-y-3">
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-xl font-bold" maxLength={200} />
                <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={5} maxLength={5000} />
                <div className="flex gap-2">
                  <Button onClick={saveEditPost} disabled={!editTitle.trim()} className="bg-teal-500 hover:bg-teal-600 text-white">Save</Button>
                  <Button variant="outline" onClick={() => setEditingPost(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-3 leading-snug">{post.title}</h1>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{post.body}</p>
                <CommunityImageGrid attachments={post.attachments} />
                {post.link_preview && (
                  <LinkPreview data={post.link_preview} />
                )}
                {sharedPost && (
                  <SharedPostEmbed
                    post={sharedPost}
                    onClick={() => navigate(`/community/post/${sharedPost.id}`)}
                  />
                )}
                {isHiringPost && (
                  <div className="mt-4 rounded-xl border border-border bg-muted/25 p-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-foreground">
                      <Briefcase className="h-4 w-4 text-teal-600" />
                      {isJobWanted ? "Work preference details" : "Hiring details"}
                    </div>
                    {post.hiring_details?.location && <p><span className="text-muted-foreground">{isJobWanted ? "Preferred location" : "Location"}:</span> {post.hiring_details.location}</p>}
                    {post.hiring_details?.pay && <p><span className="text-muted-foreground">{isJobWanted ? "Expected pay" : "Pay range"}:</span> {post.hiring_details.pay}</p>}
                    {post.hiring_details?.skills && <p><span className="text-muted-foreground">{isJobWanted ? "Skills / experience" : "Skills needed"}:</span> {post.hiring_details.skills}</p>}
                    {post.hiring_details?.contact && <p><span className="text-muted-foreground">Contact:</span> {post.hiring_details.contact}</p>}
                    {isJobWanted && post.hiring_details?.availability && <p><span className="text-muted-foreground">Availability:</span> {post.hiring_details.availability}</p>}
                    {!isJobWanted && post.hiring_details?.deadline && <p><span className="text-muted-foreground">Deadline:</span> {post.hiring_details.deadline}</p>}
                  </div>
                )}
              </>
            )}

            {/* Floating action bar */}
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border/50">
              <button
                onClick={toggleReaction}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  hasReacted
                    ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                <ThumbsUp className={`h-4 w-4 ${hasReacted ? "fill-current" : ""}`} /> {post.reaction_count}
              </button>
              <button
                onClick={toggleSave}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  hasSaved
                    ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Bookmark className={`h-4 w-4 ${hasSaved ? "fill-current" : ""}`} /> {hasSaved ? "Saved" : "Save"}
              </button>
              <button
                onClick={() => setReportOpen(true)}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
              >
                <Flag className="h-4 w-4" /> Report
              </button>
              {isHiringPost && (
                isPostOwner || canModerate ? (
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => void loadHiringInterests()}>
                    <Briefcase className="h-4 w-4 mr-1" /> Interested people {hiringInterestCount > 0 && hiringInterestCount}
                  </Button>
                ) : hasInterested ? (
                  <span className="rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700">
                    Interest sent
                  </span>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-full text-teal-700 border-teal-200">
                        <Briefcase className="h-4 w-4 mr-1" /> Interested
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Share your profile and CV?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your profile information and CV will be shared with the hiring post owner. Please confirm your CV is safe and up to date before continuing.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <Textarea
                        value={interestMessage}
                        onChange={(e) => setInterestMessage(e.target.value)}
                        placeholder="Optional message to the hiring post owner"
                        rows={3}
                        maxLength={800}
                      />
                      {!user?.cvUrl && (
                        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          No CV saved yet. Upload your CV in Profile before sending interest.
                        </p>
                      )}
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        {!user?.cvUrl ? (
                          <AlertDialogAction onClick={() => navigate("/community/profile")}>Update CV first</AlertDialogAction>
                        ) : (
                          <AlertDialogAction onClick={() => void sendHiringInterest()} disabled={interestSubmitting}>
                            {interestSubmitting ? "Sharing..." : "Yes, share my profile and CV"}
                          </AlertDialogAction>
                        )}
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )
              )}
              <button
                onClick={() => navigate(`/community/create?share=${post.id}`)}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-colors ml-auto"
              >
                <Share2 className="h-4 w-4" /> Share {(post.share_count || 0) > 0 && post.share_count}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {isHiringPost && (isPostOwner || canModerate) && (
        <Card className="rounded-xl border-border/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Interested people</h2>
                <p className="text-sm text-muted-foreground">Only the hiring post owner and admins can see this list.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadHiringInterests()} disabled={loadingInterests}>
                {loadingInterests ? "Loading..." : "Refresh"}
              </Button>
            </div>
            {hiringInterests.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                No one has sent interest yet.
              </p>
            ) : (
              <div className="space-y-3">
                {hiringInterests.map((interest) => {
                  const profile = interest.shared_profile || {};
                  const name = String(profile.name || "Interested user");
                  const role = String(profile.primary_role || "member");
                  const phone = profile.phone ? String(profile.phone) : "";
                  const email = profile.email ? String(profile.email) : "";
                  return (
                    <div key={interest.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{name}</p>
                            <RoleBadge role={role} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Shared {formatDistanceToNow(new Date(interest.created_at), { addSuffix: true })}
                          </p>
                          {(phone || email) && (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {[phone, email].filter(Boolean).join(" • ")}
                            </p>
                          )}
                          {interest.message && <p className="mt-2 text-sm">{interest.message}</p>}
                        </div>
                        {interest.shared_cv_url && (
                          <Button variant="outline" size="sm" onClick={() => window.open(interest.shared_cv_url || "", "_blank", "noopener,noreferrer")}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1" /> CV
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Answers */}
      {isQuestionType && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{answers.length} Answer{answers.length !== 1 ? "s" : ""}</h2>
          {answers.map(a => (
            <AnswerCard
              key={a.id}
              answer={{ ...a, author_name: profiles[a.user_id]?.name, author_role: profiles[a.user_id]?.primary_role }}
              isPostOwner={isPostOwner}
              isAnswerOwner={user?.id === a.user_id}
              canModerate={canModerate}
              onMarkBest={markBestAnswer}
              onDelete={deleteAnswer}
              onSaveEdit={saveEditAnswer}
            />
          ))}
          <Card className="rounded-xl border-border/60">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-3">Your Answer</h3>
              <Textarea placeholder="Write your answer..." value={newAnswer} onChange={e => setNewAnswer(e.target.value)} rows={3} maxLength={3000} className="mb-3" />
              <Button onClick={submitAnswer} disabled={!newAnswer.trim()} className="bg-teal-500 hover:bg-teal-600 text-white rounded-full">Submit Answer</Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* Comments */}
      <Card id="comments" className="scroll-mt-24 rounded-xl border-border/60">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5">
            <div>
              <h2 className="text-base font-semibold">{post.comment_count} Comment{post.comment_count !== 1 ? "s" : ""}</h2>
              <p className="text-[11px] text-muted-foreground">Scroll inside this section to read more.</p>
            </div>
          </div>

          <div className="max-h-[520px] space-y-2 overflow-y-auto px-3 py-2.5">
            {topLevelComments.length === 0 ? (
              <p className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
            ) : topLevelComments.map(c => (
              <div key={c.id} className="space-y-1.5">
                <div className="flex gap-2.5 rounded-xl bg-muted/30 p-2.5">
                  <div className="h-7 w-7 rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 flex items-center justify-center shrink-0">
                    <UserCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium">{profiles[c.user_id]?.name || "User"}</span>
                      {profiles[c.user_id]?.primary_role && <RoleBadge role={profiles[c.user_id].primary_role} />}
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                      {(user?.id === c.user_id || canModerate) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto"><MoreVertical className="h-3.5 w-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {user?.id === c.user_id && <DropdownMenuItem onClick={() => startEditComment(c)}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>}
                            {renderCommunityBlockItem(c.user_id)}
                            <DropdownMenuItem onClick={() => deleteComment(c.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {editingCommentId === c.id ? (
                      <div className="mt-2 space-y-2">
                        <Textarea value={editCommentBody} onChange={e => setEditCommentBody(e.target.value)} rows={2} maxLength={1000} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEditComment} disabled={!editCommentBody.trim()} className="bg-teal-500 hover:bg-teal-600 text-white">Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingCommentId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm mt-1">{c.body}</p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-muted-foreground">
                      <button onClick={() => void toggleCommentReaction(c)} className={c.has_reacted ? "font-medium text-teal-700" : "hover:text-teal-700"}>
                        Like {c.reaction_count ? c.reaction_count : ""}
                      </button>
                      <button onClick={() => setReplyingToCommentId(replyingToCommentId === c.id ? null : c.id)} className="hover:text-teal-700">
                        Reply
                      </button>
                      {(c.reply_count || repliesByParent[c.id]?.length || 0) > 0 && <span>{c.reply_count || repliesByParent[c.id]?.length} replies</span>}
                    </div>
                  </div>
                </div>

                {(repliesByParent[c.id] || []).map((reply) => (
                  <div key={reply.id} className="ml-8 flex gap-2.5 rounded-xl border-l-2 border-teal-200 bg-muted/20 p-2.5">
                    <div className="h-6 w-6 rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 flex items-center justify-center shrink-0">
                      <UserCircle className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium">{profiles[reply.user_id]?.name || "User"}</span>
                        {profiles[reply.user_id]?.primary_role && <RoleBadge role={profiles[reply.user_id].primary_role} />}
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm mt-1">{reply.body}</p>
                      <button onClick={() => void toggleCommentReaction(reply)} className={`mt-1.5 text-[11px] ${reply.has_reacted ? "font-medium text-teal-700" : "text-muted-foreground hover:text-teal-700"}`}>
                        Like {reply.reaction_count ? reply.reaction_count : ""}
                      </button>
                      {canModerate && user?.id !== reply.user_id && (
                        <button
                          onClick={() => void toggleCommunityBlock(reply.user_id)}
                          disabled={moderatingUserId === reply.user_id}
                          className="ml-2 text-[11px] text-teal-700 hover:text-teal-800 disabled:opacity-60"
                        >
                          {blockedUserIds.has(reply.user_id) ? "Unblock Community" : "Block Community"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {replyingToCommentId === c.id && (
                  <div className="ml-8 flex gap-2">
                    <Textarea
                      value={replyBodyByCommentId[c.id] || ""}
                      onChange={(e) => setReplyBodyByCommentId((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="Write a reply..."
                      rows={1}
                      maxLength={1000}
                      className="min-h-9 resize-none rounded-full"
                    />
                    <Button size="sm" onClick={() => void submitReply(c.id)} disabled={!replyBodyByCommentId[c.id]?.trim()} className="bg-teal-500 hover:bg-teal-600 text-white rounded-full">
                      Reply
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Social-style comment input */}
          <div className="flex items-start gap-2.5 border-t border-border/60 bg-card p-2.5">
            <div className="h-7 w-7 rounded-full bg-teal-50 text-teal-700 ring-1 ring-teal-200 flex items-center justify-center shrink-0 mt-0.5">
              <UserCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 flex items-end gap-2">
              <Textarea placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} rows={1} maxLength={1000} className="flex-1 min-h-9 resize-none rounded-full px-4 py-2" />
              <Button onClick={submitComment} disabled={!newComment.trim()} size="icon" className="h-9 w-9 rounded-full bg-teal-500 hover:bg-teal-600 text-white shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} postId={post.id} />
    </div>
  );
}
