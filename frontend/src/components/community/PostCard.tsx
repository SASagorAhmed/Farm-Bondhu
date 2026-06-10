import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { ThumbsUp, MessageCircle, CheckCircle2, Clock, Share2, Trash2, Briefcase, Lock, LockOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PostTypeBadge from "./PostTypeBadge";
import PriorityBadge from "./PriorityBadge";
import RoleBadge from "./RoleBadge";
import LinkPreview, { type LinkPreviewData } from "./LinkPreview";
import SharedPostEmbed, { type SharedPostData } from "./SharedPostEmbed";
import CommunityImageGrid from "./CommunityImageGrid";
import { useAdminPreviewMode } from "@/hooks/useAdminPreviewMode";
import { toast } from "@/hooks/use-toast";
import { CATEGORY_COLORS, CATEGORY_LABELS, ANIMAL_LABELS, type CommunityHiringIntent } from "@/lib/communityCategories";
import type { CommunityImageAttachment } from "@/lib/communityPostMediaApi";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitHiringInterest } from "@/lib/communityHiringApi";
import {
  blockCommunityUser,
  COMMUNITY_MODERATION_QUERY_KEYS,
  fetchCommunityBlockedUsers,
  unblockCommunityUser,
} from "@/lib/communityModerationApi";

interface PostCardProps {
  post: {
    id: string;
    user_id: string;
    title: string;
    body: string;
    post_type: string;
    post_intent?: string;
    category: string;
    animal_type: string;
    priority: string;
    reaction_count: number;
    comment_count: number;
    answer_count: number;
    share_count?: number;
    shared_post_id?: string | null;
    created_at: string;
    author_name?: string;
    author_role?: string;
    link_preview?: LinkPreviewData | null;
    attachments?: CommunityImageAttachment[] | null;
    has_reacted?: boolean;
    has_saved?: boolean;
    has_interested?: boolean;
    recent_comments?: Array<{
      id: string;
      user_id: string;
      body: string;
      parent_id?: string | null;
      reaction_count?: number;
      reply_count?: number;
      has_reacted?: boolean;
      created_at: string;
      author_name?: string;
      author_role?: string;
    }>;
    hiring_interest_count?: number;
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
    shared_post?: SharedPostData | null;
  };
  onReactionChange?: (postId: string, newCount: number, hasReacted: boolean) => void;
  onDeleted?: (postId: string) => void;
  hideModerationDelete?: boolean;
}

type CommunityCommentPreview = {
  id: string;
  post_id?: string;
  user_id: string;
  parent_id?: string | null;
  body: string;
  reaction_count?: number;
  reply_count?: number;
  has_reacted?: boolean;
  created_at: string;
  author_name?: string;
  author_role?: string;
};

function getRelativeTime(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export default function PostCard({ post, onReactionChange, onDeleted, hideModerationDelete = false }: PostCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canModerate } = useAdminPreviewMode();
  const [hasReacted, setHasReacted] = useState(Boolean(post.has_reacted));
  const [localCount, setLocalCount] = useState(post.reaction_count);
  const [toggling, setToggling] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState(post.comment_count || 0);
  const [sharedPost, setSharedPost] = useState<SharedPostData | null>(post.shared_post || null);
  const [hasInterested, setHasInterested] = useState(Boolean(post.has_interested));
  const [interestMessage, setInterestMessage] = useState("");
  const [interestSubmitting, setInterestSubmitting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<CommunityCommentPreview[]>(post.recent_comments || []);
  const [commentText, setCommentText] = useState("");
  const [replyTextById, setReplyTextById] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [blockingAuthor, setBlockingAuthor] = useState(false);
  const isHiringPost = post.post_type === "hiring" || post.post_intent === "hiring" || post.category.includes("hiring");
  const isOwner = user?.id === post.user_id;
  const { data: blockedUsers = [] } = useQuery({
    queryKey: COMMUNITY_MODERATION_QUERY_KEYS.blockedUsers,
    queryFn: fetchCommunityBlockedUsers,
    enabled: canModerate,
    staleTime: 10_000,
  });
  const blockedUserIds = new Set(blockedUsers.map((blockedUser) => blockedUser.user_id));

  useEffect(() => { setLocalCount(post.reaction_count); }, [post.reaction_count]);
  useEffect(() => { setLocalCommentCount(post.comment_count || 0); }, [post.comment_count]);
  useEffect(() => {
    if (!commentsOpen) setComments(post.recent_comments || []);
  }, [post.recent_comments, commentsOpen]);
  useEffect(() => {
    if (typeof post.has_reacted === "boolean") setHasReacted(post.has_reacted);
  }, [post.has_reacted]);
  useEffect(() => {
    if (post.shared_post !== undefined) setSharedPost(post.shared_post || null);
  }, [post.shared_post]);
  useEffect(() => {
    if (typeof post.has_interested === "boolean") setHasInterested(post.has_interested);
  }, [post.has_interested]);

  useEffect(() => {
    if (typeof post.has_reacted === "boolean") return;
    if (!user) return;
    api
      .from("community_reactions")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHasReacted(!!data));
  }, [user, post.id, post.has_reacted]);

  // Fetch shared post if exists
  useEffect(() => {
    if (post.shared_post !== undefined) return;
    if (!post.shared_post_id) return;
    const fetchShared = async () => {
      const { data } = await api.from("community_posts").select("id, title, body, post_type, category, animal_type, created_at, user_id, reaction_count, comment_count, answer_count, share_count, attachments").eq("id", post.shared_post_id!).single();
      if (data) {
        const { data: profile } = await api.from("profiles").select("name, primary_role").eq("id", data.user_id).single();
        setSharedPost({
          ...data,
          author_name: profile?.name,
          author_role: profile?.primary_role,
        });
      }
    };
    fetchShared();
  }, [post.shared_post_id, post.shared_post]);

  const toggleReaction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || toggling) return;
    setToggling(true);
    const newReacted = !hasReacted;
    const newCount = newReacted ? localCount + 1 : Math.max(0, localCount - 1);
    setHasReacted(newReacted);
    setLocalCount(newCount);
    onReactionChange?.(post.id, newCount, newReacted);
    try {
      let result: { post_counts?: { reaction_count?: number } } | null = null;
      if (newReacted) {
        const { data } = await api.from("community_reactions").insert({ post_id: post.id, user_id: user.id });
        result = data as typeof result;
      } else {
        const { data } = await api.from("community_reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
        result = data as typeof result;
      }
      if (result?.post_counts?.reaction_count !== undefined) {
        const syncedCount = Number(result.post_counts.reaction_count || 0);
        setLocalCount(syncedCount);
        onReactionChange?.(post.id, syncedCount, newReacted);
      }
    } catch {
      setHasReacted(!newReacted);
      setLocalCount(localCount);
      onReactionChange?.(post.id, localCount, !newReacted);
    }
    setToggling(false);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/community/create?share=${post.id}`);
  };

  const loadComments = async () => {
    setCommentsOpen(true);
    setCommentsLoading(true);
    const { data } = await api.from("community_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    const rows = ((data || []) as CommunityCommentPreview[]);
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
    let profiles: Record<string, { name?: string; primary_role?: string }> = {};
    if (userIds.length) {
      const { data: profs } = await api.from("profiles").select("id, name, primary_role").in("id", userIds);
      profiles = ((profs || []) as Array<{ id: string; name?: string; primary_role?: string }>).reduce((acc, profile) => {
        acc[profile.id] = { name: profile.name, primary_role: profile.primary_role };
        return acc;
      }, {} as Record<string, { name?: string; primary_role?: string }>);
    }
    setComments(rows.map((row) => ({
      ...row,
      author_name: row.author_name || profiles[row.user_id]?.name,
      author_role: row.author_role || profiles[row.user_id]?.primary_role,
    })));
    setCommentsLoading(false);
  };

  const submitInlineComment = async (parentId?: string) => {
    if (!user) return;
    const text = parentId ? (replyTextById[parentId] || "").trim() : commentText.trim();
    if (!text) return;
    const { data, error } = await api.from("community_comments").insert({
      post_id: post.id,
      parent_id: parentId,
      body: text,
    });
    if (error) {
      toast({ title: "Could not add comment", description: error.message, variant: "destructive" });
      return;
    }
    const created = data as CommunityCommentPreview & { post_counts?: { comment_count?: number } };
    setComments((prev) => [...prev, { ...created, author_name: user.name, author_role: user.primaryRole }]);
    setLocalCommentCount(Number(created.post_counts?.comment_count ?? localCommentCount + 1));
    if (parentId) {
      setReplyTextById((prev) => ({ ...prev, [parentId]: "" }));
      setReplyingTo(null);
    } else {
      setCommentText("");
    }
    setCommentsOpen(true);
  };

  const toggleCommentReaction = async (comment: CommunityCommentPreview) => {
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

  const deletePost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await api.from("community_posts").delete().eq("id", post.id);
    if (error) {
      toast({ title: "Failed to delete post", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post deleted" });
    onDeleted?.(post.id);
  };

  const toggleCommunityAuthorBlock = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!canModerate || user?.id === userId) return;
    const isBlocked = blockedUserIds.has(userId);
    setBlockingAuthor(true);
    try {
      if (isBlocked) {
        await unblockCommunityUser(userId);
        toast({ title: "Community access restored" });
      } else {
        await blockCommunityUser(userId);
        toast({ title: "User blocked from Community" });
      }
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
      setBlockingAuthor(false);
    }
  };

  const handleInterested = async () => {
    if (!user || interestSubmitting) return;
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
    toast({ title: "Interest sent", description: "Your profile and CV were shared with the hiring post owner." });
  };

  const categoryColorClass = CATEGORY_COLORS[post.category] || "bg-muted text-muted-foreground";
  const hiring = post.hiring_details || {};
  const isJobWanted = hiring.intent === "job_wanted" || post.category === "job_wanted";
  const topLevelComments = comments.filter((comment) => !comment.parent_id);
  const repliesByParent = comments.reduce((acc, comment) => {
    if (!comment.parent_id) return acc;
    acc[comment.parent_id] = [...(acc[comment.parent_id] || []), comment];
    return acc;
  }, {} as Record<string, CommunityCommentPreview[]>);

  return (
    <Card
      className="group shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 border border-border/60 rounded-xl overflow-hidden"
      onClick={() => navigate(`/community/post/${post.id}`)}
    >
      <CardContent className="p-0">
        {/* Author row */}
        <div className="flex items-center gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5">
              <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-sm font-bold text-teal-600">
                {(post.author_name || "U").charAt(0)}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{post.author_name || "User"}</span>
              {post.author_role && <RoleBadge role={post.author_role} />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Clock className="h-3 w-3" />
              <span>{getRelativeTime(post.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PostTypeBadge type={post.post_type} />
            <PriorityBadge priority={post.priority} />
            {canModerate && !isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-teal-700 hover:bg-teal-50 hover:text-teal-800"
                disabled={blockingAuthor}
                onClick={(e) => void toggleCommunityAuthorBlock(e, post.user_id)}
              >
                {blockedUserIds.has(post.user_id) ? <LockOpen className="h-3.5 w-3.5 mr-1" /> : <Lock className="h-3.5 w-3.5 mr-1" />}
                <span className="hidden sm:inline text-xs">{blockedUserIds.has(post.user_id) ? "Unblock" : "Block user"}</span>
              </Button>
            )}
            {canModerate && !hideModerationDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this post as Super Admin?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this post and all its comments and answers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={deletePost} className="bg-destructive text-destructive-foreground">
                      Delete as Super Admin
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="px-4 pb-3 pt-3 sm:px-5">
          {/* Category & Animal chips */}
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${categoryColorClass}`}>
              {CATEGORY_LABELS[post.category] || post.category}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
              {ANIMAL_LABELS[post.animal_type] || post.animal_type}
            </span>
          </div>

          {/* Title & Body */}
          <h3 className="text-[15px] font-semibold text-foreground mb-1.5 line-clamp-2 group-hover:text-teal-600 transition-colors">
            {post.title}
          </h3>
          {post.body && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{post.body}</p>
          )}

          <CommunityImageGrid attachments={post.attachments} compact />

          {isHiringPost && (
            <div className="mt-3 rounded-lg border border-border bg-muted/25 p-3 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Briefcase className="h-3.5 w-3.5 text-teal-600" />
                {isJobWanted ? "Looking for work" : "Hiring post"}
              </div>
              {hiring.location && <p>{isJobWanted ? "Preferred location" : "Location"}: {hiring.location}</p>}
              {hiring.pay && <p>{isJobWanted ? "Expected pay" : "Pay"}: {hiring.pay}</p>}
              {hiring.skills && <p>{isJobWanted ? "Skills / experience" : "Skills needed"}: {hiring.skills}</p>}
              {isJobWanted && hiring.availability && <p>Availability: {hiring.availability}</p>}
              {!isJobWanted && hiring.deadline && <p>Deadline: {hiring.deadline}</p>}
            </div>
          )}

          {/* Link Preview */}
          {post.link_preview && (
            <LinkPreview data={post.link_preview} compact />
          )}

          {/* Shared Post Embed */}
          {sharedPost && (
            <SharedPostEmbed post={sharedPost} compact />
          )}
        </div>

        <div className="mx-4 flex items-center justify-between gap-3 border-y border-border/60 py-2 text-xs text-muted-foreground sm:mx-5">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <ThumbsUp className="h-3 w-3 fill-current" />
            </span>
            {localCount} reaction{localCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/community/post/${post.id}#comments`);
            }}
            className="hover:text-teal-600"
          >
            {localCommentCount} comment{localCommentCount === 1 ? "" : "s"}
            {(post.answer_count || 0) > 0 && ` • ${post.answer_count} answer${post.answer_count === 1 ? "" : "s"}`}
          </button>
        </div>

        {!commentsOpen && (post.recent_comments || []).length > 0 && (
          <div className="mx-4 mb-3 space-y-2 rounded-xl border border-border/60 border-l-4 border-l-teal-400 bg-muted/25 p-3 sm:mx-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent comments</p>
              <span className="text-[11px] text-muted-foreground">{localCommentCount} total</span>
            </div>
            {(post.recent_comments || []).map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-[10px] font-bold text-teal-600">
                    {(comment.author_name || "U").charAt(0)}
                  </div>
                </div>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-background px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{comment.author_name || "User"}</p>
                    {canModerate && user?.id !== comment.user_id && (
                      <button type="button" onClick={(e) => void toggleCommunityAuthorBlock(e, comment.user_id)} className="text-[10px] font-medium text-teal-700 hover:text-teal-800">
                        {blockedUserIds.has(comment.user_id) ? "Unblock" : "Block"}
                      </button>
                    )}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{comment.body}</p>
                </div>
              </div>
            ))}
            {(post.comment_count || 0) > (post.recent_comments?.length || 0) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void loadComments();
                }}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                View all comments in this post
              </button>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="grid grid-cols-3 gap-1 px-2 py-1.5 sm:px-3">
          <button
            onClick={toggleReaction}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
              hasReacted
                ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${hasReacted ? "fill-current" : ""}`} />
            Like
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (commentsOpen) setCommentsOpen(false);
              else void loadComments();
            }}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              commentsOpen ? "bg-teal-50 text-teal-700" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" /> Comment
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share{(post.share_count ?? 0) > 0 ? ` ${post.share_count}` : ""}
          </button>
        </div>

        <div className="flex items-center gap-1 px-4 pb-3 sm:px-5">
          {(post.post_type === "question" || post.post_type === "help_request") && (
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> {post.answer_count} answers
            </span>
          )}
          {isHiringPost && (
            isOwner ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/community/post/${post.id}`);
                }}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
              >
                <Briefcase className="h-3.5 w-3.5" />
                View interested {(post.hiring_interest_count || 0) > 0 && post.hiring_interest_count}
              </button>
            ) : hasInterested ? (
              <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50">
                <CheckCircle2 className="h-3.5 w-3.5" /> Interest sent
              </span>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
                  >
                    <Briefcase className="h-3.5 w-3.5" /> Interested
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                    {!user?.cvUrl ? (
                      <AlertDialogAction onClick={(e) => { e.stopPropagation(); navigate("/community/profile"); }}>
                        Update CV first
                      </AlertDialogAction>
                    ) : (
                      <AlertDialogAction onClick={(e) => { e.stopPropagation(); void handleInterested(); }} disabled={interestSubmitting}>
                        {interestSubmitting ? "Sharing..." : "Yes, share my profile and CV"}
                      </AlertDialogAction>
                    )}
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          )}
        </div>

        {commentsOpen && (
          <div className="mx-4 mb-4 space-y-2 rounded-2xl border border-border bg-muted/30 p-2.5 sm:mx-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Comments</p>
                <p className="text-[11px] text-muted-foreground">Thread for this post</p>
              </div>
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {localCommentCount} total
              </span>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {commentsLoading ? (
                <p className="rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">Loading comments...</p>
              ) : topLevelComments.length === 0 ? (
                <p className="rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">No comments yet. Be the first to comment.</p>
              ) : (
                topLevelComments.map((comment) => (
                  <div key={comment.id} className="space-y-1.5">
                    <div className="flex gap-2">
                      <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5">
                        <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-[9px] font-bold text-teal-600">
                          {(comment.author_name || "U").charAt(0)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="rounded-2xl rounded-tl-md bg-background px-2.5 py-1.5 shadow-sm">
                          <p className="text-xs font-semibold">{comment.author_name || "User"}</p>
                          <p className="text-sm">{comment.body}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2.5 px-1 text-[11px] text-muted-foreground">
                          <button type="button" onClick={() => void toggleCommentReaction(comment)} className={comment.has_reacted ? "font-medium text-teal-700" : "hover:text-teal-700"}>
                            Like {comment.reaction_count ? comment.reaction_count : ""}
                          </button>
                          <button type="button" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="hover:text-teal-700">
                            Reply
                          </button>
                          {canModerate && user?.id !== comment.user_id && (
                            <button type="button" onClick={(e) => void toggleCommunityAuthorBlock(e, comment.user_id)} className="text-teal-700 hover:text-teal-800">
                              {blockedUserIds.has(comment.user_id) ? "Unblock Community" : "Block Community"}
                            </button>
                          )}
                          <span>{getRelativeTime(comment.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {(repliesByParent[comment.id] || []).map((reply) => (
                      <div key={reply.id} className="ml-8 flex gap-2 border-l-2 border-border/70 pl-2.5">
                        <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5">
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-card text-[8px] font-bold text-teal-600">
                            {(reply.author_name || "U").charAt(0)}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="rounded-2xl rounded-tl-md bg-background px-2.5 py-1.5 shadow-sm">
                            <p className="text-xs font-semibold">{reply.author_name || "User"}</p>
                            <p className="text-sm">{reply.body}</p>
                          </div>
                          <div className="mt-1 flex items-center gap-2.5 px-1 text-[11px] text-muted-foreground">
                            <button type="button" onClick={() => void toggleCommentReaction(reply)} className={reply.has_reacted ? "font-medium text-teal-700" : "hover:text-teal-700"}>
                              Like {reply.reaction_count ? reply.reaction_count : ""}
                            </button>
                            {canModerate && user?.id !== reply.user_id && (
                              <button type="button" onClick={(e) => void toggleCommunityAuthorBlock(e, reply.user_id)} className="text-teal-700 hover:text-teal-800">
                                {blockedUserIds.has(reply.user_id) ? "Unblock Community" : "Block Community"}
                              </button>
                            )}
                            <span>{getRelativeTime(reply.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {replyingTo === comment.id && (
                      <div className="ml-8 flex gap-2 border-l-2 border-teal-200 pl-2.5">
                        <Textarea
                          value={replyTextById[comment.id] || ""}
                          onChange={(e) => setReplyTextById((prev) => ({ ...prev, [comment.id]: e.target.value }))}
                          placeholder="Write a reply..."
                          rows={1}
                          className="min-h-8 resize-none rounded-full"
                        />
                        <Button size="sm" className="rounded-full bg-teal-500 text-white hover:bg-teal-600" onClick={() => void submitInlineComment(comment.id)}>
                          Reply
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 border-t border-border/60 pt-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment on this post..."
                rows={1}
                className="min-h-8 resize-none rounded-full bg-background"
              />
              <Button size="sm" className="rounded-full bg-teal-500 text-white hover:bg-teal-600" onClick={() => void submitInlineComment()}>
                Comment
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

