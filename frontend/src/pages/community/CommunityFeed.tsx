import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PenSquare, Search } from "lucide-react";
import { motion } from "framer-motion";
import PostCard from "@/components/community/PostCard";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";
import { fetchCommunityFeed, type CommunityFeedPost, type CommunityFeedResponse } from "@/lib/communityFeedApi";
import { COMMUNITY_FEED_FILTERS, type CommunityFeedFilter } from "@/lib/communityCategories";

export default function CommunityFeed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CommunityFeedFilter>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const activeFilter = COMMUNITY_FEED_FILTERS.find((item) => item.value === filter) || COMMUNITY_FEED_FILTERS[0];
  const feedQueryKey = ["community-feed", "infinite", filter, debouncedSearch] as const;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: feedQueryKey,
    queryFn: ({ pageParam }) =>
      fetchCommunityFeed({
        tab: activeFilter.tab,
        intent: activeFilter.intent,
        postType: activeFilter.postType,
        q: debouncedSearch,
        limit: 30,
        cursor: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: CommunityFeedResponse) => lastPage.nextCursor,
    staleTime: moduleCachePolicy.dashboard.staleTime,
    gcTime: moduleCachePolicy.dashboard.gcTime,
  });

  const posts = data?.pages?.flatMap((page) => page.posts) || [];

  useEffect(() => {
    const refreshCommunity = () => {
      void queryClient.invalidateQueries({ queryKey: ["community-feed"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    };
    const channel = api
      .channel("community-feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, refreshCommunity)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comments" }, refreshCommunity)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reactions" }, refreshCommunity)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_comment_reactions" }, refreshCommunity)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, refreshCommunity)
      .subscribe();
    return () => { api.removeChannel(channel); };
  }, [queryClient]);

  const updatePostInFeed = (postId: string, updater: (post: CommunityFeedPost) => CommunityFeedPost) => {
    queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>({ queryKey: ["community-feed"] }, (prev) => {
      if (!prev || !Array.isArray(prev.pages)) return prev;
      return {
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          posts: page.posts.map((post) => (post.id === postId ? updater(post) : post)),
        })),
      };
    });
  };

  const handleReactionChange = (postId: string, newCount: number, hasReacted: boolean) => {
    updatePostInFeed(postId, (post) => ({ ...post, reaction_count: newCount, has_reacted: hasReacted }));
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    }, { rootMargin: "360px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="space-y-5">
      {/* Quick-post banner */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/60 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate("/community/create")}
        >
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 p-0.5 shrink-0">
            <div className="h-full w-full rounded-full bg-card flex items-center justify-center text-sm font-bold text-teal-600">
              {user?.name?.charAt(0) || "?"}
            </div>
          </div>
          <div className="flex-1 px-4 py-2.5 rounded-full bg-muted/60 text-sm text-muted-foreground">
            What's on your mind? Share with the community...
          </div>
          <Button size="sm" className="bg-teal-500 hover:bg-teal-600 text-white rounded-full px-4 shrink-0">
            <PenSquare className="h-4 w-4 mr-1.5" /> Post
          </Button>
        </div>
      </motion.div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search posts, hiring, work, farm help..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full bg-card border-border/60" />
      </div>

      {/* Compact feed filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {COMMUNITY_FEED_FILTERS.map((item) => {
          const isActive = filter === item.value;
          return (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-teal-500 text-white shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {isFetching && posts.length > 0 && (
        <p className="text-xs text-muted-foreground">Refreshing posts...</p>
      )}
      {debouncedSearch && posts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing best matches for "{debouncedSearch}"
        </p>
      )}

      {/* Posts */}
      {isLoading && !posts.length ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            {debouncedSearch
              ? "No posts match this search or filter"
              : "No posts found"}
          </p>
          <Button variant="outline" className="mt-3 rounded-full" onClick={() => navigate("/community/create")}>Be the first to post</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <PostCard
                post={post}
                onReactionChange={handleReactionChange}
                onDeleted={(postId) => {
                  queryClient.setQueriesData<InfiniteData<CommunityFeedResponse>>({ queryKey: ["community-feed"] }, (prev) => {
                    if (!prev) return prev;
                    return {
                      ...prev,
                      pages: prev.pages.map((page) => ({
                        ...page,
                        posts: page.posts.filter((p) => p.id !== postId),
                      })),
                    };
                  });
                }}
              />
            </motion.div>
          ))}
          <div ref={loadMoreRef} className="flex justify-center py-4">
            {isFetchingNextPage ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : hasNextPage ? (
              <Button variant="outline" className="rounded-full" onClick={() => void fetchNextPage()}>
                Load more posts
              </Button>
            ) : posts.length > 0 ? (
              <p className="text-xs text-muted-foreground">You reached the older posts.</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
