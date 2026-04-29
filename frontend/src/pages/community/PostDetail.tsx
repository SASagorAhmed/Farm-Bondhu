import { useState, useEffect } from "react";
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
import { Loader2, ThumbsUp, Bookmark, Flag, ArrowLeft, Pencil, Trash2, MoreVertical, Clock, Send, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import PostTypeBadge from "@/components/community/PostTypeBadge";
import PriorityBadge from "@/components/community/PriorityBadge";
import RoleBadge from "@/components/community/RoleBadge";
import AnswerCard from "@/components/community/AnswerCard";
import ReportDialog from "@/components/community/ReportDialog";
import LinkPreview from "@/components/community/LinkPreview";
import SharedPostEmbed, { type SharedPostData } from "@/components/community/SharedPostEmbed";
import { CATEGORY_LABELS, ANIMAL_LABELS } from "@/components/community/PostCard";
import { withApiTiming } from "@/lib/perfMetrics";

type PostRow = {
  id: string; user_id: string; post_type: string; title: string; body: string;
  category: string; animal_type: string; priority: string; status: string;
  comment_count: number; answer_count: number; reaction_count: number;
  share_count?: number; shared_post_id?: string | null;
  created_at: string; link_preview?: any;
};

type CommentRow = { id: string; user_id: string; body: string; created_at: string };
type AnswerRow = { id: string; user_id: string; body: string; is_best_answer: boolean; upvote_count: number; created_at: string };

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string; primary_role: string }>>({});
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [hasReacted, setHasReacted] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sharedPost, setSharedPost] = useState<SharedPostData | null>(null);

  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");

  const isQuestionType = post?.post_type === "question" || post?.post_type === "help_request";
  const isPostOwner = user?.id === post?.user_id;

  const fetchAll = async () => {
    if (!id) return;
    const token = readSession()?.access_token;
    const res = await withApiTiming("/v1/community/posts/:id/detail", () =>
      fetch(`${API_BASE}/v1/community/posts/${id}/detail`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    );
    const body = await res.json().catch(() => ({}));
    const data = (body as { data?: any }).data;
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
    setSharedPost((data.sharedPost || null) as SharedPostData | null);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const toggleReaction = async () => {
    if (!user || !post) return;
    const newReacted = !hasReacted;
    const newCount = newReacted ? post.reaction_count + 1 : Math.max(0, post.reaction_count - 1);
    setHasReacted(newReacted);
    setPost(p => p ? { ...p, reaction_count: newCount } : p);
    if (newReacted) {
      await api.from("community_reactions").insert({ post_id: post.id, user_id: user.id });
    } else {
      await api.from("community_reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
    }
    await api.from("community_posts").update({ reaction_count: newCount }).eq("id", post.id);
  };

  const toggleSave = async () => {
    if (!user || !post) return;
    if (hasSaved) {
      await api.from("community_saves").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await api.from("community_saves").insert({ post_id: post.id, user_id: user.id });
    }
    setHasSaved(!hasSaved);
  };

  const submitComment = async () => {
    if (!user || !post || !newComment.trim()) return;
    const { error } = await api.from("community_comments").insert({ post_id: post.id, user_id: user.id, body: newComment.trim() });
    if (!error) {
      await api.from("community_posts").update({ comment_count: post.comment_count + 1 }).eq("id", post.id);
      setNewComment("");
      fetchAll();
    }
  };

  const submitAnswer = async () => {
    if (!user || !post || !newAnswer.trim()) return;
    const { error } = await api.from("community_answers").insert({ post_id: post.id, user_id: user.id, body: newAnswer.trim() });
    if (!error) {
      await api.from("community_posts").update({ answer_count: post.answer_count + 1 }).eq("id", post.id);
      setNewAnswer("");
      fetchAll();
    }
  };

  const markBestAnswer = async (answerId: string) => {
    if (!post) return;
    await api.from("community_answers").update({ is_best_answer: false }).eq("post_id", post.id);
    await api.from("community_answers").update({ is_best_answer: true }).eq("id", answerId);
    fetchAll();
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
    if (!error) { setComments(prev => prev.filter(c => c.id !== commentId)); const newCount = Math.max(0, post.comment_count - 1); await api.from("community_posts").update({ comment_count: newCount }).eq("id", post.id); setPost(p => p ? { ...p, comment_count: newCount } : p); toast({ title: "Comment deleted" }); }
  };

  const deleteAnswer = async (answerId: string) => {
    if (!post) return;
    const { error } = await api.from("community_answers").delete().eq("id", answerId);
    if (!error) { setAnswers(prev => prev.filter(a => a.id !== answerId)); const newCount = Math.max(0, post.answer_count - 1); await api.from("community_posts").update({ answer_count: newCount }).eq("id", post.id); setPost(p => p ? { ...p, answer_count: newCount } : p); toast({ title: "Answer deleted" }); }
  };
  const saveEditAnswer = async (answerId: string, newBody: string) => {
    const { error } = await api.from("community_answers").update({ body: newBody.trim() }).eq("id", answerId);
    if (!error) { setAnswers(prev => prev.map(a => a.id === answerId ? { ...a, body: newBody.trim() } : a)); toast({ title: "Answer updated!" }); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!post) return <div className="text-center py-20"><p>Post not found</p></div>;

  const author = profiles[post.user_id];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
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
                {isPostOwner && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEditPost}><Pencil className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete your post and all its comments and answers.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={deletePost} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
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
                {post.link_preview && (
                  <LinkPreview data={post.link_preview} />
                )}
                {sharedPost && (
                  <SharedPostEmbed
                    post={sharedPost}
                    onClick={() => navigate(`/community/post/${sharedPost.id}`)}
                  />
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
              <button
                onClick={() => navigate(`/community/create?share=${post.id}`)}
                className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-colors ml-auto"
              >
                <Share2 className="h-4 w-4" /> Share {(post as any).share_count > 0 && (post as any).share_count}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

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
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{comments.length} Comment{comments.length !== 1 ? "s" : ""}</h2>
        {comments.map(c => (
          <div key={c.id} className="flex gap-3 p-3 rounded-xl bg-muted/30">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5 shrink-0">
              <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-xs font-bold text-teal-600">
                {(profiles[c.user_id]?.name || "U").charAt(0)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{profiles[c.user_id]?.name || "User"}</span>
                {profiles[c.user_id]?.primary_role && <RoleBadge role={profiles[c.user_id].primary_role} />}
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                {user?.id === c.user_id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto"><MoreVertical className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEditComment(c)}><Pencil className="h-3.5 w-3.5 mr-2" /> Edit</DropdownMenuItem>
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
            </div>
          </div>
        ))}

        {/* Social-style comment input */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border/60">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5 shrink-0 mt-0.5">
            <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-xs font-bold text-teal-600">
              {user?.name?.charAt(0) || "?"}
            </div>
          </div>
          <div className="flex-1 flex items-end gap-2">
            <Textarea placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} rows={1} maxLength={1000} className="flex-1 min-h-[38px] resize-none rounded-full px-4 py-2" />
            <Button onClick={submitComment} disabled={!newComment.trim()} size="icon" className="h-9 w-9 rounded-full bg-teal-500 hover:bg-teal-600 text-white shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} postId={post.id} />
    </div>
  );
}
