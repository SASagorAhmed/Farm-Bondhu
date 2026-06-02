import { API_BASE, readSession } from "@/api/client";

export type TranslateTargetLang = "en" | "bn";

const STORAGE_KEY = "chatTranslateTarget";
const sessionCache = new Map<string, string>();

export function getDefaultTranslateTarget(): TranslateTargetLang {
  if (typeof window === "undefined") return "en";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "bn" ? "bn" : "en";
}

export function setDefaultTranslateTarget(target: TranslateTargetLang): void {
  localStorage.setItem(STORAGE_KEY, target);
}

export interface TranslateChatMessageResult {
  original: string;
  translated: string;
  target_lang: TranslateTargetLang;
  cached?: boolean;
}

export async function translateChatMessage(
  messageId: string,
  targetLang: TranslateTargetLang
): Promise<TranslateChatMessageResult> {
  const cacheKey = `${messageId}:${targetLang}`;
  const cached = sessionCache.get(cacheKey);
  if (cached) {
    return {
      original: "",
      translated: cached,
      target_lang: targetLang,
      cached: true,
    };
  }

  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}/v1/marketplace/chat/messages/${messageId}/translate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ target_lang: targetLang }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: TranslateChatMessageResult;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(body.error || `Translation failed (${res.status})`);
  }

  if (!body.data?.translated) {
    throw new Error("Translation unavailable");
  }

  sessionCache.set(cacheKey, body.data.translated);
  setDefaultTranslateTarget(targetLang);
  return body.data;
}

export function primeTranslationCache(
  messageId: string,
  targetLang: TranslateTargetLang,
  translated: string,
  original: string
): void {
  sessionCache.set(`${messageId}:${targetLang}`, translated);
  if (original) sessionCache.set(`${messageId}:original`, original);
}

export function getCachedTranslation(messageId: string, targetLang: TranslateTargetLang): string | null {
  return sessionCache.get(`${messageId}:${targetLang}`) || null;
}
