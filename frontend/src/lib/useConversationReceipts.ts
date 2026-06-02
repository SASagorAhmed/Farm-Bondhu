import { useEffect, useRef } from "react";
import {
  applyLocalReceiptUpdates,
  markConversationReceipts,
  type ReceiptLevel,
} from "@/lib/marketplaceChatReceipts";
import type { MarketplaceChatRole } from "@/lib/marketplaceChatRoles";

export function useConversationReceipts<T extends { id: string; sender_role?: string | null }>(options: {
  conversationId: string | null | undefined;
  viewerRole: MarketplaceChatRole;
  enabled: boolean;
  messageCount: number;
  onLocalUpdate: (updater: (prev: T[]) => T[]) => void;
}) {
  const { conversationId, viewerRole, enabled, messageCount, onLocalUpdate } = options;
  const onLocalUpdateRef = useRef(onLocalUpdate);
  onLocalUpdateRef.current = onLocalUpdate;

  useEffect(() => {
    if (!enabled || !conversationId || messageCount === 0) return;

    let cancelled = false;

    const mark = async (level: ReceiptLevel) => {
      onLocalUpdateRef.current((prev) => applyLocalReceiptUpdates(prev, viewerRole, level));
      await markConversationReceipts(conversationId, viewerRole, level);
    };

    void (async () => {
      await mark("delivered");
      if (cancelled) return;
      await mark("read");
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, enabled, messageCount, viewerRole]);
}
