import { useLanguage } from "@/contexts/LanguageContext";
import { formatChatThreadDateLabel } from "@/lib/marketplaceChatDates";

export default function ChatThreadDateDivider({ dateKey }: { dateKey: string }) {
  const { t } = useLanguage();
  const label = formatChatThreadDateLabel(dateKey, {
    today: t("chat.dateToday"),
    yesterday: t("chat.dateYesterday"),
  });

  return (
    <div className="flex items-center gap-3 py-2" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-border" />
      <span className="shrink-0 rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
