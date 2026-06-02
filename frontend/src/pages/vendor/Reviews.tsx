import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Star, MessageSquare, TrendingUp, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { ICON_COLORS } from "@/lib/iconColors";
import StatCard from "@/components/dashboard/StatCard";
import SellerReviewInbox, { useSellerReviewStats } from "@/components/marketplace/seller/SellerReviewInbox";
import SellerCommentInbox, { useSellerCommentStats } from "@/components/marketplace/seller/SellerCommentInbox";

type Filter = "all" | "needs_reply" | "replied";

const filterTabs: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_reply", label: "Needs reply" },
  { value: "replied", label: "Replied" },
];

export default function Reviews() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const [reviewFilter, setReviewFilter] = useState<Filter>("all");
  const [commentFilter, setCommentFilter] = useState<Filter>("all");
  const [mainTab, setMainTab] = useState("reviews");

  const { data: reviewStats } = useSellerReviewStats(userId);
  const { data: commentStats } = useSellerCommentStats(userId);

  const needsReplyTotal = (reviewStats?.needsReplyCount ?? 0) + (commentStats?.needsReplyCount ?? 0);
  const reviewResponseRate = reviewStats?.responseRate ?? 0;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Reviews & Feedback</h1>
        <p className="text-muted-foreground mt-1">Read verified reviews and answer customer questions professionally</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Verified reviews"
          value={reviewStats?.total ?? 0}
          icon={<Star className="h-5 w-5" />}
          iconColor={ICON_COLORS.finance}
          index={0}
        />
        <StatCard
          title="Needs reply"
          value={needsReplyTotal}
          icon={<Clock className="h-5 w-5" />}
          iconColor={ICON_COLORS.marketplace}
          index={1}
        />
        <StatCard
          title="Review response rate"
          value={`${reviewResponseRate}%`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor={ICON_COLORS.farm}
          index={2}
        />
        <StatCard
          title="Questions"
          value={commentStats?.total ?? 0}
          icon={<MessageSquare className="h-5 w-5" />}
          iconColor={ICON_COLORS.vet}
          index={3}
        />
      </div>

      <Card className="shadow-card overflow-hidden">
        <div className="h-1" style={{ background: `linear-gradient(to right, ${ICON_COLORS.finance}, ${ICON_COLORS.marketplace})` }} />
        <CardContent className="p-4 md:p-6">
          <Tabs value={mainTab} onValueChange={setMainTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="reviews">
                Verified reviews
                {(reviewStats?.needsReplyCount ?? 0) > 0 && (
                  <span className="ml-1 text-[10px]">({reviewStats?.needsReplyCount})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments">
                Questions
                {(commentStats?.needsReplyCount ?? 0) > 0 && (
                  <span className="ml-1 text-[10px]">({commentStats?.needsReplyCount})</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="space-y-4 mt-0">
              <Tabs value={reviewFilter} onValueChange={(v) => setReviewFilter(v as Filter)}>
                <TabsList className="flex-wrap h-auto">
                  {filterTabs.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <SellerReviewInbox userId={userId} filter={reviewFilter} />
            </TabsContent>

            <TabsContent value="comments" className="space-y-4 mt-0">
              <Tabs value={commentFilter} onValueChange={(v) => setCommentFilter(v as Filter)}>
                <TabsList className="flex-wrap h-auto">
                  {filterTabs.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <SellerCommentInbox userId={userId} filter={commentFilter} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
