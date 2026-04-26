import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import PostTypeBadge from "./PostTypeBadge";
import { CATEGORY_LABELS, ANIMAL_LABELS } from "./PostCard";

export interface SharedPostData {
  id: string;
  title: string;
  body: string;
  post_type: string;
  category: string;
  animal_type: string;
  created_at: string;
  author_name?: string;
  author_role?: string;
}

interface SharedPostEmbedProps {
  post: SharedPostData;
  compact?: boolean;
  onClick?: () => void;
}

export default function SharedPostEmbed({ post, compact, onClick }: SharedPostEmbedProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-border/60 bg-muted/30 overflow-hidden transition-colors ${
        onClick ? "cursor-pointer hover:bg-muted/50" : ""
      } ${compact ? "mt-2" : "mt-3"}`}
    >
      <div className="border-l-[3px] border-teal-500 p-3 sm:p-4">
        {/* Author row */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5 shrink-0">
            <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-[10px] font-bold text-teal-600">
              {(post.author_name || "U").charAt(0)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-foreground">{post.author_name || "User"}</span>
              <PostTypeBadge type={post.post_type} />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
            {CATEGORY_LABELS[post.category] || post.category}
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
            {ANIMAL_LABELS[post.animal_type] || post.animal_type}
          </span>
        </div>

        {/* Title & body */}
        <h4 className={`font-semibold text-foreground leading-snug ${compact ? "text-[13px] line-clamp-1" : "text-sm line-clamp-2"}`}>
          {post.title}
        </h4>
        {post.body && (
          <p className={`text-muted-foreground mt-1 leading-relaxed ${compact ? "text-[11px] line-clamp-1" : "text-xs line-clamp-2"}`}>
            {post.body}
          </p>
        )}
      </div>
    </div>
  );
}
