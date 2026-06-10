import { apiJson } from "@/api/client";

export type CommunityBlockedUser = {
  user_id: string;
  name?: string;
  email?: string;
  primary_role?: string;
  signup_module?: string;
  avatar_url?: string | null;
  blocked_at?: string;
  blocked_by?: string | null;
};

export type CommunityModerationUser = CommunityBlockedUser & {
  post_count?: number;
  comment_count?: number;
  answer_count?: number;
  report_count?: number;
  latest_activity_at?: string | null;
  is_community_blocked?: boolean;
};

export type AdminCommunityPost = {
  id: string;
  user_id: string;
  title?: string;
  post_type?: string;
  status?: string;
  created_at?: string;
};

export type AdminCommunityReport = {
  id: string;
  post_id?: string | null;
  reported_by?: string;
  reason?: string;
  status?: string;
  created_at?: string;
};

export const COMMUNITY_MODERATION_QUERY_KEYS = {
  users: ["community-moderation", "users"] as const,
  blockedUsers: ["community-moderation", "blocked-users"] as const,
  posts: ["community-moderation", "posts"] as const,
  reports: ["community-moderation", "reports"] as const,
};

type ApiResult<T> = {
  data?: T;
  error?: string;
};

async function adminCommunityRequest<T>(payload: Record<string, unknown>): Promise<T> {
  const { res, body } = await apiJson("/v1/compat/from/admin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const result = body as ApiResult<T>;
  if (!res.ok) {
    throw new Error(String(result.error || "Community moderation action failed"));
  }
  return result.data as T;
}

export async function fetchCommunityBlockedUsers(): Promise<CommunityBlockedUser[]> {
  return adminCommunityRequest<CommunityBlockedUser[]>({
    action: "select",
    table: "community_blocks",
    mode: "blocked_users",
  });
}

export async function fetchCommunityUsers(): Promise<CommunityModerationUser[]> {
  return adminCommunityRequest<CommunityModerationUser[]>({
    action: "select",
    table: "community_users",
    mode: "admin_all",
  });
}

export async function fetchAdminCommunityPosts(): Promise<AdminCommunityPost[]> {
  return adminCommunityRequest<AdminCommunityPost[]>({
    action: "select",
    table: "community_posts",
    mode: "admin_all",
  });
}

export async function fetchAdminCommunityReports(): Promise<AdminCommunityReport[]> {
  return adminCommunityRequest<AdminCommunityReport[]>({
    action: "select",
    table: "community_reports",
    mode: "admin_all",
  });
}

export async function updateAdminCommunityPostStatus(postId: string, status: string): Promise<void> {
  await adminCommunityRequest({
    action: "update",
    table: "community_posts",
    mode: "admin_moderate",
    id: postId,
    patch: { status },
  });
}

export async function resolveAdminCommunityReport(reportId: string): Promise<void> {
  await adminCommunityRequest({
    action: "update",
    table: "community_reports",
    mode: "resolve",
    id: reportId,
  });
}

export async function blockCommunityUser(userId: string): Promise<void> {
  await adminCommunityRequest({
    action: "community_block_user",
    table: "community_blocks",
    user_id: userId,
  });
}

export async function unblockCommunityUser(userId: string): Promise<void> {
  await adminCommunityRequest({
    action: "community_unblock_user",
    table: "community_blocks",
    user_id: userId,
  });
}
