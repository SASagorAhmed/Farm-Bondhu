import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { MarketplaceChatRole } from "@/lib/marketplaceChatRoles";

type MarketplaceChatFocusContextValue = {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  activeViewerRole: MarketplaceChatRole | null;
  setActiveViewerRole: (role: MarketplaceChatRole | null) => void;
};

const MarketplaceChatFocusContext = createContext<MarketplaceChatFocusContextValue>({
  activeConversationId: null,
  setActiveConversationId: () => {},
  activeViewerRole: null,
  setActiveViewerRole: () => {},
});

export function MarketplaceChatFocusProvider({ children }: { children: ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeViewerRole, setActiveViewerRole] = useState<MarketplaceChatRole | null>(null);
  const value = useMemo(
    () => ({
      activeConversationId,
      setActiveConversationId,
      activeViewerRole,
      setActiveViewerRole,
    }),
    [activeConversationId, activeViewerRole]
  );
  return (
    <MarketplaceChatFocusContext.Provider value={value}>
      {children}
    </MarketplaceChatFocusContext.Provider>
  );
}

export function useMarketplaceChatFocus(): MarketplaceChatFocusContextValue {
  return useContext(MarketplaceChatFocusContext);
}
