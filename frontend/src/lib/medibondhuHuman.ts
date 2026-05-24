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

export type MediAppointmentBrief = {
  id?: string;
  status?: string | null;
  consultation_type?: string | null;
};

function mediErrorMessage(body: unknown, res: Response, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback || String(res.status);
}

/** PATCH appointment status (doctor or patient cancel flows). */
export async function patchMediAppointmentStatus(
  appointmentId: string,
  status: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const { res, body } = await mediHumanJson<{ data?: Record<string, unknown>; error?: string }>(
    `/appointments/${appointmentId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) {
    return { ok: false, error: mediErrorMessage(body, res, "Failed to update appointment") };
  }
  return { ok: true, data: body.data };
}

/**
 * Doctor accepts an online teleconsult (pending/confirmed → in_progress).
 * No-op if already in_progress. Returns current status when skipped.
 */
export async function acceptMediOnlineVisit(
  appointmentId: string,
  opts?: { currentStatus?: string | null },
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const raw = String(opts?.currentStatus || "").toLowerCase();
  if (raw === "in_progress") {
    return { ok: true, status: "in_progress" };
  }
  if (raw && raw !== "pending" && raw !== "confirmed") {
    return { ok: false, error: `Cannot start visit from status "${raw}"` };
  }
  const result = await patchMediAppointmentStatus(appointmentId, "in_progress");
  if (!result.ok) return { ok: false, error: result.error };
  const next = String(result.data?.status || "in_progress").toLowerCase();
  return { ok: true, status: next };
}

/** Patient waiting for doctor vs ready to join video room. */
export function isMediPatientWaitingForDoctor(status?: string | null): boolean {
  const st = String(status || "").toLowerCase();
  return st === "pending" || st === "confirmed";
}

export function isMediOnlineVideoReady(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "in_progress";
}
