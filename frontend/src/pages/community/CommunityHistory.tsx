import { useState } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Heart, Bookmark, HelpCircle, PenSquare, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";

interface ActivityItem {
  id: string;
  action_type: string;
  post_id: string;
  target_id: string | null;
  created_at: string;
  post_title?: string;
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string }> = {
  comment: { icon: MessageSquare, label: "Commented", color: "text-blue-600", bgColor: "bg-blue-100" },
  reaction: { icon: Heart, label: "Reacted", color: "text-rose-600", bgColor: "bg-rose-100" },
  save: { icon: Bookmark, label: "Saved", color: "text-amber-600", bgColor: "bg-amber-100" },
  answer: { icon: HelpCircle, label: "Answered", color: "text-emerald-600", bgColor: "bg-emerald-100" },
  post: { icon: PenSquare, label: "Posted", color: "text-teal-600", bgColor: "bg-teal-100" },
};

const TABS = ["all", "post", "comment", "answer", "reaction", "save"] as const;

export default function CommunityHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["community-history", user?.id || "anon", filter],
    enabled: Boolean(user?.id),
    staleTime: moduleCachePolicy.dashboard.staleTime,
    gcTime: moduleCachePolicy.dashboard.gcTime,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = api
        .from("community_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") query = query.eq("action_type", filter);
      const { data: logs } = await query;
      if (!logs?.length) return [];
      const postIds = [...new Set(logs.map((l) => l.post_id))];
      const { data: posts } = await api.from("community_posts").select("id, title").in("id", postIds);
      const titleMap = new Map(posts?.map((p) => [p.id, p.title]) ?? []);
      return logs.map((l) => ({ ...l, post_title: titleMap.get(l.post_id) ?? "Deleted post" })) as ActivityItem[];
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-5 w-5 text-teal-500" />
        <h1 className="text-xl font-bold text-foreground">Activity History</h1>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize text-xs">
              {t === "all" ? "All" : ACTION_CONFIG[t]?.label ?? t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && !activities.length ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No activity yet. Start engaging with the community!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const cfg = ACTION_CONFIG[a.action_type] ?? ACTION_CONFIG.comment;
            const Icon = cfg.icon;
            return (
              <Card
                key={a.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/community/post/${a.post_id}`)}
              >
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className={`rounded-full p-2 ${cfg.bgColor}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      <Badge variant="outline" className="mr-2 text-xs">
                        {cfg.label}
                      </Badge>
                      {a.post_title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
