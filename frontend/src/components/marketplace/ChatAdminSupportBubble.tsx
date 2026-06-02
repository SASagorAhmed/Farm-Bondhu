import { ShieldCheck } from "lucide-react";
import { ICON_COLORS } from "@/lib/iconColors";
import ChatMessageTranslate from "@/components/marketplace/ChatMessageTranslate";
import { ADMIN_SUPPORT_MESSAGE_LABEL } from "@/lib/marketplaceChatRoles";

interface ChatAdminSupportBubbleProps {
  messageId: string;
  textBody: string | null;
  createdAt: string;
}

export default function ChatAdminSupportBubble({ messageId, textBody, createdAt }: ChatAdminSupportBubbleProps) {
  return (
    <div className="flex justify-center">
      <div className="space-y-0.5 max-w-[85%] w-full">
        <p className="text-[10px] text-center flex items-center justify-center gap-1" style={{ color: ICON_COLORS.admin }}>
          <ShieldCheck className="h-3 w-3" />
          {ADMIN_SUPPORT_MESSAGE_LABEL}
        </p>
        <div
          className="rounded-2xl px-4 py-2.5 text-sm text-white mx-auto border"
          style={{ backgroundColor: ICON_COLORS.admin, borderColor: `${ICON_COLORS.admin}33` }}
        >
          <ChatMessageTranslate messageId={messageId} textBody={textBody} onPrimaryBubble />
          <p className="text-[10px] mt-1 text-right text-white/70">
            {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </div>
  );
}
