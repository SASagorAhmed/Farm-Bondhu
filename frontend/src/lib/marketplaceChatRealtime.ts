import { useEffect, useRef } from "react";
import { API_BASE, readSession } from "@/api/client";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export function isMarketplaceChatRealtimeAvailable(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function useChatThreadPoll(
  conversationId: string | null | undefined,
  enabled: boolean,
  onMessages: (messages: unknown[]) => void,
  intervalMs = 2000
) {
  const onMessagesRef = useRef(onMessages);
  onMessagesRef.current = onMessages;

  useEffect(() => {
    if (!enabled || !conversationId || isMarketplaceChatRealtimeAvailable()) return;

    let cancelled = false;

    const poll = async () => {
      const token = readSession()?.access_token;
      const res = await fetch(
        `${API_BASE}/v1/marketplace/chat/conversations/${conversationId}/bootstrap`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok || cancelled) return;
      const body = (await res.json().catch(() => ({}))) as {
        data?: { messages?: unknown[] };
      };
      if (!cancelled && Array.isArray(body.data?.messages)) {
        onMessagesRef.current(body.data.messages);
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [conversationId, enabled, intervalMs]);
}

export function useChatInboxPoll(loadFn: () => void | Promise<void>, enabled: boolean, intervalMs = 3500) {
  const loadFnRef = useRef(loadFn);
  loadFnRef.current = loadFn;

  useEffect(() => {
    if (!enabled || isMarketplaceChatRealtimeAvailable()) return;

    const timer = window.setInterval(() => {
      void loadFnRef.current();
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}
