import { apiJson } from "@/api/client";
import type { SharedPostData } from "@/components/community/SharedPostEmbed";
import type { CommunityHiringIntent } from "@/lib/communityCategories";
import type { CommunityImageAttachment } from "@/lib/communityPostMediaApi";

export type CommunityFeedTab = "latest" | "questions" | "urgent" | "unanswered" | "top";

export type CommunityRecentComment = {
  id: string;
  post_id: string;
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

export type CommunityFeedPost = {
  id: string;
  user_id: string;
  post_type: string;
  post_intent?: string;
  title: string;
  body: string;
  category: string;
  animal_type: string;
  priority: string;
  status: string;
  reaction_count: number;
  comment_count: number;
  answer_count: number;
  share_count?: number;
  shared_post_id?: string | null;
  link_preview?: unknown;
  attachments?: CommunityImageAttachment[];
  workspace_context?: string[];
  created_at: string;
  updated_at?: string;
  author_name?: string;
  author_role?: string;
  author_signup_module?: string | null;
  has_reacted?: boolean;
  has_saved?: boolean;
  has_interested?: boolean;
  recent_comments?: CommunityRecentComment[];
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
  feed_score?: number;
};

export type CommunityFeedParams = {
  tab?: CommunityFeedTab;
  q?: string;
  intent?: string;
  postType?: string;
  category?: string;
  animalType?: string;
  limit?: number;
  cursor?: string | null;
};

export type CommunityFeedResponse = {
  posts: CommunityFeedPost[];
  nextCursor: string | null;
  interests: string[];
};

export async function fetchCommunityFeed(params: CommunityFeedParams): Promise<CommunityFeedResponse> {
  const search = new URLSearchParams();
  if (params.tab) search.set("tab", params.tab);
  if (params.intent?.trim()) search.set("intent", params.intent.trim());
  if (params.postType?.trim()) search.set("post_type", params.postType.trim());
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.category && params.category !== "all") search.set("category", params.category);
  if (params.animalType && params.animalType !== "all") search.set("animal_type", params.animalType);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);

  const suffix = search.toString() ? `?${search.toString()}` : "";
  const { res, body } = await apiJson(`/v1/community/feed${suffix}`);
  if (!res.ok) throw new Error(String(body.error || "Failed to load community feed"));
  const data = body.data as Partial<CommunityFeedResponse> | undefined;
  return {
    posts: data?.posts || [],
    nextCursor: data?.nextCursor || null,
    interests: data?.interests || [],
  };
}
