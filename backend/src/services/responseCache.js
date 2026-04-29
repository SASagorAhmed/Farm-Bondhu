const cacheStore = new Map();

function nowMs() {
  return Date.now();
}

export function makeCacheKey(namespace, { userId = "anon", parts = [] } = {}) {
  const safeParts = Array.isArray(parts) ? parts.map((p) => String(p)) : [];
  return `${String(namespace)}|u:${String(userId)}|${safeParts.join("|")}`;
}

export function getCachedValue(key) {
  const hit = cacheStore.get(String(key));
  if (!hit) return null;
  if (hit.expiresAt <= nowMs()) {
    cacheStore.delete(String(key));
    return null;
  }
  return hit.value;
}

export function setCachedValue(key, value, ttlMs) {
  const ttl = Math.max(1, Number(ttlMs) || 1);
  cacheStore.set(String(key), { value, expiresAt: nowMs() + ttl });
}

export function invalidateByPrefix(prefix) {
  const p = String(prefix);
  for (const key of cacheStore.keys()) {
    if (key.startsWith(p)) cacheStore.delete(key);
  }
}

export async function getOrSetCachedValue(key, ttlMs, producer) {
  const cached = getCachedValue(key);
  if (cached != null) return { value: cached, cacheHit: true };
  const value = await producer();
  setCachedValue(key, value, ttlMs);
  return { value, cacheHit: false };
}
