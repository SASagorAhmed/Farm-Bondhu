import { useLanguage } from "@/contexts/LanguageContext";
import { ShieldAlert } from "lucide-react";
import {
  marketplaceInlineNoticeAccentStyle,
  marketplaceInlineNoticeBox,
  marketplaceInlineNoticeCountdown,
  marketplaceInlineNoticeText,
} from "@/components/marketplace/marketplaceCalloutStyles";
import { MARKETPLACE_THEME } from "@/lib/marketplaceTheme";
import { cn } from "@/lib/utils";

interface ChatContactBlockedBannerProps {
  variant: "blocked" | "restricted";
  restrictedUntil?: string | null;
  countdownClock?: string | null;
  className?: string;
}

export default function ChatContactBlockedBanner({
  variant,
  restrictedUntil,
  countdownClock,
  className,
}: ChatContactBlockedBannerProps) {
  const { t } = useLanguage();

  const mainMessage =
    variant === "blocked"
      ? t("chat.contactBlocked")
      : restrictedUntil
        ? t("chat.contactRestricted")
        : t("chat.contactRestrictedGeneric");

  const countdownMessage =
    variant === "restricted" && countdownClock
      ? t("chat.contactRestrictedCountdown").replace("{time}", countdownClock)
      : null;

  return (
    <div
      role="alert"
      className={cn(marketplaceInlineNoticeBox, className)}
      style={marketplaceInlineNoticeAccentStyle}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: MARKETPLACE_THEME.primary }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={marketplaceInlineNoticeText}>{mainMessage}</p>
          {countdownMessage ? (
            <p className={marketplaceInlineNoticeCountdown} aria-live="polite">
              {countdownMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
