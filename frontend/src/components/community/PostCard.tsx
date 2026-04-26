import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { ThumbsUp, MessageCircle, CheckCircle2, Clock, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import PostTypeBadge from "./PostTypeBadge";
import PriorityBadge from "./PriorityBadge";
import RoleBadge from "./RoleBadge";
import LinkPreview from "./LinkPreview";
import SharedPostEmbed, { type SharedPostData } from "./SharedPostEmbed";

interface PostCardProps {
  post: {
    id: string;
    title: string;
    body: string;
    post_type: string;
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
    link_preview?: any;
  };
  onReactionChange?: (postId: string, newCount: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  animal_health: "Animal Health",
  feed_nutrition: "Feed & Nutrition",
  medicine_vaccination: "Medicine & Vaccination",
  farm_management: "Farm Management",
  marketplace_buying: "Marketplace Buying",
  marketplace_selling: "Marketplace Selling",
  breeding_growth: "Breeding & Growth",
  egg_production: "Egg Production",
  milk_production: "Milk Production",
  meat_production: "Meat Production",
  equipment_setup: "Equipment & Setup",
  vet_advice: "Vet Advice",
  disease_symptoms: "Disease & Symptoms",
  emergency_help: "Emergency Help",
  business_profit: "Business & Profit",
  general_discussion: "General Discussion",
};

const ANIMAL_LABELS: Record<string, string> = {
  chicken: "Chicken", duck: "Duck", goat: "Goat", cow: "Cow",
  sheep: "Sheep", pigeon: "Pigeon", mixed: "Mixed", other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  animal_health: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  feed_nutrition: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  disease_symptoms: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  emergency_help: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  vet_advice: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  breeding_growth: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  farm_management: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function getRelativeTime(dateStr: string) {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

export default function PostCard({ post, onReactionChange }: PostCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hasReacted, setHasReacted] = useState(false);
  const [localCount, setLocalCount] = useState(post.reaction_count);
  const [toggling, setToggling] = useState(false);
  const [sharedPost, setSharedPost] = useState<SharedPostData | null>(null);

  useEffect(() => { setLocalCount(post.reaction_count); }, [post.reaction_count]);

  useEffect(() => {
    if (!user) return;
    api
      .from("community_reactions")
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHasReacted(!!data));
  }, [user, post.id]);

  // Fetch shared post if exists
  useEffect(() => {
    if (!post.shared_post_id) return;
    const fetchShared = async () => {
      const { data } = await api.from("community_posts").select("id, title, body, post_type, category, animal_type, created_at, user_id").eq("id", post.shared_post_id!).single();
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
  }, [post.shared_post_id]);

  const toggleReaction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || toggling) return;
    setToggling(true);
    const newReacted = !hasReacted;
    const newCount = newReacted ? localCount + 1 : Math.max(0, localCount - 1);
    setHasReacted(newReacted);
    setLocalCount(newCount);
    onReactionChange?.(post.id, newCount);
    try {
      if (newReacted) {
        await api.from("community_reactions").insert({ post_id: post.id, user_id: user.id });
      } else {
        await api.from("community_reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      }
      await api.from("community_posts").update({ reaction_count: newCount }).eq("id", post.id);
    } catch {
      setHasReacted(!newReacted);
      setLocalCount(localCount);
      onReactionChange?.(post.id, localCount);
    }
    setToggling(false);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/community/create?share=${post.id}`);
  };

  const categoryColorClass = CATEGORY_COLORS[post.category] || "bg-muted text-muted-foreground";

  return (
    <Card
      className="group shadow-sm hover:shadow-md cursor-pointer transition-all duration-300 hover:-translate-y-0.5 border border-border/60 rounded-xl overflow-hidden"
      onClick={() => navigate(`/community/post/${post.id}`)}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Author row */}
        <div className="flex items-center gap-3 mb-3">
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
          </div>
        </div>

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

        {/* Link Preview */}
        {post.link_preview && (
          <LinkPreview data={post.link_preview} compact />
        )}

        {/* Shared Post Embed */}
        {sharedPost && (
          <SharedPostEmbed post={sharedPost} compact />
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1 mt-3.5 pt-3 border-t border-border/50">
          <button
            onClick={toggleReaction}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              hasReacted
                ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${hasReacted ? "fill-current" : ""}`} />
            {localCount > 0 && localCount}
          </button>
          <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
            <MessageCircle className="h-3.5 w-3.5" /> {post.comment_count}
          </span>
          {(post.post_type === "question" || post.post_type === "help_request") && (
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> {post.answer_count} answers
            </span>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors ml-auto"
          >
            <Share2 className="h-3.5 w-3.5" />
            {(post.share_count ?? 0) > 0 && (post.share_count ?? 0)}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export { CATEGORY_LABELS, ANIMAL_LABELS };
