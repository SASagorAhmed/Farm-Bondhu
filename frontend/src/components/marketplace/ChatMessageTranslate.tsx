import { useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getCachedTranslation,
  getDefaultTranslateTarget,
  primeTranslationCache,
  translateChatMessage,
  type TranslateTargetLang,
} from "@/lib/marketplaceChatTranslate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessageTranslateProps {
  messageId: string;
  textBody: string | null | undefined;
  onPrimaryBubble?: boolean;
  className?: string;
}

export default function ChatMessageTranslate({
  messageId,
  textBody,
  onPrimaryBubble,
  className,
}: ChatMessageTranslateProps) {
  const { t } = useLanguage();
  const original = String(textBody || "").trim();
  const disabled = !original || String(messageId).startsWith("local-");

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<TranslateTargetLang | null>(null);

  const displayText = showTranslated && translatedText ? translatedText : original;

  const statusLabel =
    activeTarget === "bn" ? t("chat.translatedToBangla") : activeTarget === "en" ? t("chat.translatedToEnglish") : null;

  const handlePickTarget = async (target: TranslateTargetLang) => {
    setOpen(false);
    setLoading(true);
    try {
      const cached = getCachedTranslation(messageId, target);
      if (cached) {
        setTranslatedText(cached);
        setActiveTarget(target);
        setShowTranslated(true);
        return;
      }
      const result = await translateChatMessage(messageId, target);
      primeTranslationCache(messageId, target, result.translated, result.original || original);
      setTranslatedText(result.translated);
      setActiveTarget(target);
      setShowTranslated(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("chat.translateFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleIconClick = () => {
    if (disabled || loading) return;
    if (showTranslated) {
      setShowTranslated(false);
      setOpen(false);
      return;
    }
    setOpen(true);
  };

  const defaultTarget = getDefaultTranslateTarget();
  const labelClass = onPrimaryBubble ? "text-primary-foreground/60" : "text-muted-foreground";
  const iconClass = onPrimaryBubble ? "text-primary-foreground/70 hover:text-primary-foreground" : "text-muted-foreground hover:text-foreground";

  return (
    <div className={cn("min-w-0", className)}>
      {showTranslated && statusLabel && (
        <p className={cn("text-[10px] mb-0.5", labelClass)}>{statusLabel}</p>
      )}
      <div className="flex items-start gap-1">
        <p className="flex-1 min-w-0 whitespace-pre-wrap">{displayText}</p>
        {!disabled && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6 shrink-0", iconClass)}
                title={showTranslated ? t("chat.showOriginal") : t("chat.translate")}
                aria-label={showTranslated ? t("chat.showOriginal") : t("chat.translate")}
                onClick={(e) => {
                  e.preventDefault();
                  handleIconClick();
                }}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-1 pb-1">{t("chat.translateTo")}</p>
              <Button
                type="button"
                variant={defaultTarget === "en" ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => void handlePickTarget("en")}
              >
                {t("chat.translateEnglish")}
              </Button>
              <Button
                type="button"
                variant={defaultTarget === "bn" ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => void handlePickTarget("bn")}
              >
                {t("chat.translateBangla")}
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
