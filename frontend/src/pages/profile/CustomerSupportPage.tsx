import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Headphones, Phone, MessageCircle, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { moduleCachePolicy } from "@/lib/queryClient";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  fetchSupportInbox,
  openSupportConversation,
  type SupportTopic,
} from "@/lib/platformSupportApi";
import {
  getWorkspaceAccent,
  getSupportChatPath,
  getWorkspaceSupportBase,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
} from "@/lib/workspaceAccent";

export default function CustomerSupportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const accent = getWorkspaceAccent(location.pathname);

  const [opening, setOpening] = useState<SupportTopic | null>(null);
  const [draftMessage, setDraftMessage] = useState("");

  const { data: inbox = [], isLoading } = useQuery({
    queryKey: ["support-inbox"],
    staleTime: moduleCachePolicy.marketplace.staleTime,
    gcTime: moduleCachePolicy.marketplace.gcTime,
    queryFn: fetchSupportInbox,
  });

  const handleOpen = async (topic: SupportTopic) => {
    setOpening(topic);
    try {
      const result = await openSupportConversation({
        topic,
        message: draftMessage.trim() || undefined,
      });
      setDraftMessage("");
      await queryClient.invalidateQueries({ queryKey: ["support-inbox"] });
      navigate(getSupportChatPath(location.pathname, result.conversation_id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("support.openFailed"));
    } finally {
      setOpening(null);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("support.now");
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <Headphones className="h-7 w-7" style={{ color: accent }} />
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{t("support.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("support.subtitle")}</p>
          </div>
        </div>
      </motion.div>

      <Card className="border-border/50 overflow-hidden">
        <div className="h-1" style={{ backgroundColor: accent }} />
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4" style={{ color: accent }} />
            {t("support.callTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("support.callDesc")}</p>
            <a
              href={`tel:${SUPPORT_PHONE_TEL}`}
              className="text-xl font-semibold mt-1 inline-block hover:underline"
              style={{ color: accent }}
            >
              {SUPPORT_PHONE_DISPLAY}
            </a>
          </div>
          <Button asChild variant="outline" className="shrink-0" style={{ borderColor: accent, color: accent }}>
            <a href={`tel:${SUPPORT_PHONE_TEL}`}>
              <Phone className="h-4 w-4 mr-2" />
              {t("support.callNow")}
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" style={{ color: accent }} />
            {t("support.chatTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="support-message" className="text-sm">
              {t("support.messageOptional")}
            </Label>
            <Textarea
              id="support-message"
              className="mt-2 min-h-[80px]"
              placeholder={t("support.messagePlaceholder")}
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Button
              className="text-white h-auto py-4 flex-col gap-1"
              style={{ backgroundColor: accent }}
              disabled={opening !== null}
              onClick={() => handleOpen("help")}
            >
              {opening === "help" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Headphones className="h-5 w-5" />
              )}
              <span className="font-semibold">{t("support.needHelp")}</span>
              <span className="text-xs opacity-90 font-normal">{t("support.needHelpDesc")}</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-1"
              style={{ borderColor: accent, color: accent }}
              disabled={opening !== null}
              onClick={() => handleOpen("complaint")}
            >
              {opening === "complaint" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="font-semibold">{t("support.complaint")}</span>
              <span className="text-xs opacity-80 font-normal">{t("support.complaintDesc")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("support.myChats")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : inbox.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">{t("support.noChats")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {inbox.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-center gap-3"
                    onClick={() => navigate(getSupportChatPath(location.pathname, row.id))}
                  >
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground truncate">
                          {row.support_topic === "complaint" ? t("support.complaint") : t("support.needHelp")}
                        </span>
                        {row.support_status === "resolved" && (
                          <Badge variant="outline" className="text-[10px]">
                            {t("support.resolved")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{row.last_message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(row.last_message_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
