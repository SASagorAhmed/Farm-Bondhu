import { useEffect, useState } from "react";
import { formatRestrictionClock, isChatSendRestricted } from "@/lib/marketplaceChatContactGuard";

export function useLiveChatRestriction(restrictedUntil?: string | null) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!restrictedUntil) return;
    if (!isChatSendRestricted(restrictedUntil)) return;

    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [restrictedUntil]);

  const isRestricted = isChatSendRestricted(restrictedUntil, nowMs);
  const clock =
    restrictedUntil && isRestricted ? formatRestrictionClock(restrictedUntil, nowMs) : null;

  return { isRestricted, clock, nowMs };
}
