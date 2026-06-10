import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { moduleCachePolicy } from "@/lib/queryClient";

type CommunityPost = Record<string, unknown> & {
  user_id?: string;
  author_name?: string;
  author_role?: string;
  author_signup_module?: string;
};
type ProfileRow = { id?: string; name?: string; primary_role?: string };
type ProfileMap = Record<string, { name: string; primary_role: string }>;

type Params = {
  queryKey: readonly unknown[];
  loadPosts: () => Promise<CommunityPost[]>;
  enabled?: boolean;
};

export function useCommunityPostsBundle({ queryKey, loadPosts, enabled = true }: Params) {
  return useQuery({
    queryKey,
    enabled,
    staleTime: moduleCachePolicy.dashboard.staleTime,
    gcTime: moduleCachePolicy.dashboard.gcTime,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const posts = (await loadPosts()) || [];
      const userIds = [...new Set(posts.map((p) => p.user_id).filter(Boolean))];
      let profiles: ProfileMap = posts.reduce((acc: ProfileMap, p) => {
        if (p.user_id && p.author_name) {
          acc[p.user_id] = { name: p.author_name, primary_role: p.author_role || p.author_signup_module || "" };
        }
        return acc;
      }, {});
      if (userIds.length) {
        const { data: profs } = await api.from("profiles").select("id, name, primary_role").in("id", userIds);
        profiles = ((profs || []) as ProfileRow[]).reduce((acc: ProfileMap, p) => {
          if (p.id) {
            acc[p.id] = { name: p.name || acc[p.id]?.name || "User", primary_role: p.primary_role || acc[p.id]?.primary_role || "" };
          }
          return acc;
        }, profiles);
      }
      return { posts, profiles };
    },
  });
}
