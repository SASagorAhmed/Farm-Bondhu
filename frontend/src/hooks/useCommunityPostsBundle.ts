import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { moduleCachePolicy } from "@/lib/queryClient";

type CommunityPost = Record<string, any>;
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
      let profiles: ProfileMap = {};
      if (userIds.length) {
        const { data: profs } = await api.from("profiles").select("id, name, primary_role").in("id", userIds);
        profiles = (profs || []).reduce((acc: ProfileMap, p: any) => {
          acc[p.id] = { name: p.name, primary_role: p.primary_role };
          return acc;
        }, {});
      }
      return { posts, profiles };
    },
  });
}
