import { API_BASE, readSession } from "@/api/client";

/** Human doctor module — REST under `/api/v1/medibondhu`. Isolated from VetBondhu routes. */
export const MEDI_HUMAN_NS = "/v1/medibondhu";

export function mediHumanHeaders(method: string, hasBody: boolean): HeadersInit {
  const s = readSession();
  const h: Record<string, string> = {};
  if (s?.access_token) h.Authorization = `Bearer ${s.access_token}`;
  const upper = String(method || "GET").toUpperCase();
  if (hasBody && upper !== "GET" && upper !== "HEAD") h["Content-Type"] = "application/json";
  return h;
}

export async function mediHumanJson<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<{ res: Response; body: T }> {
  const method = String(init.method || "GET");
  const hasBody = init.body !== undefined && init.body !== null && init.body !== "";
  const url = `${API_BASE}${MEDI_HUMAN_NS}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...mediHumanHeaders(method, hasBody), ...(init.headers || {}) },
  });
  const text = await res.text();
  let body = {} as T;
  try {
    body = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    body = { error: text } as unknown as T;
  }
  return { res, body };
}

/** Realtime channel prefix for MediBondhu human appointments (separate from vetbondhu-consult-*). */
export const MEDI_HUMAN_REALTIME_TOPIC_PREFIX = "medibondhu-human-appointments";

export function mediHumanAppointmentChannel(userId: string) {
  return `${MEDI_HUMAN_REALTIME_TOPIC_PREFIX}:${userId}`;
}
