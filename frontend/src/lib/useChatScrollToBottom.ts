import { useCallback, useEffect, useState, type RefObject } from "react";

const DEFAULT_THRESHOLD_PX = 48;

export function isScrollNearBottom(
  viewport: { scrollTop: number; scrollHeight: number; clientHeight: number },
  threshold = DEFAULT_THRESHOLD_PX
): boolean {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < threshold;
}

function getScrollViewport(scrollAreaRef: RefObject<HTMLElement | null>): HTMLElement | null {
  return scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") ?? null;
}

export function useChatScrollToBottom(options: {
  scrollAreaRef: RefObject<HTMLElement | null>;
  bottomRef: RefObject<HTMLElement | null>;
  messageCount?: number;
  enabled?: boolean;
}) {
  const { scrollAreaRef, bottomRef, messageCount = 0, enabled = true } = options;
  const [showScrollDown, setShowScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const viewport = getScrollViewport(scrollAreaRef);
    if (!viewport) {
      setShowScrollDown(false);
      return;
    }
    const canScroll = viewport.scrollHeight > viewport.clientHeight + 1;
    setShowScrollDown(canScroll && !isScrollNearBottom(viewport));
  }, [scrollAreaRef]);

  useEffect(() => {
    if (!enabled) {
      setShowScrollDown(false);
      return;
    }

    const viewport = getScrollViewport(scrollAreaRef);
    if (!viewport) return;

    updateScrollState();
    viewport.addEventListener("scroll", updateScrollState, { passive: true });

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [enabled, scrollAreaRef, updateScrollState, messageCount]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    window.setTimeout(updateScrollState, 300);
  }, [bottomRef, updateScrollState]);

  return { showScrollDown, scrollToBottom };
}
