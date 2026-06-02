import { API_BASE, readSession } from "@/api/client";
import type { DesignDraft, PhotoEditorCanvasJson } from "../types";

async function authJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  const token = readSession()?.access_token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok) return { ok: false, error: body.error || res.statusText };
  return { ok: true, data: body.data };
}

export async function fetchPhotoEditorDrafts(): Promise<DesignDraft[]> {
  const { ok, data, error } = await authJson<DesignDraft[]>(
    "/v1/marketplace/seller/photo-editor/drafts",
  );
  if (!ok) throw new Error(error || "Failed to load drafts");
  return data || [];
}

export async function fetchPhotoEditorDraft(id: string): Promise<DesignDraft> {
  const { ok, data, error } = await authJson<DesignDraft>(
    `/v1/marketplace/seller/photo-editor/drafts/${encodeURIComponent(id)}`,
  );
  if (!ok) throw new Error(error || "Draft not found");
  if (!data) throw new Error("Draft not found");
  return data;
}

export async function createPhotoEditorDraft(payload: {
  title?: string;
  preset_key?: string | null;
  width: number;
  height: number;
  canvas_json: PhotoEditorCanvasJson;
  thumbnail_data?: string | null;
}): Promise<DesignDraft> {
  const { ok, data, error } = await authJson<DesignDraft>(
    "/v1/marketplace/seller/photo-editor/drafts",
    { method: "POST", body: JSON.stringify(payload) },
  );
  if (!ok || !data) throw new Error(error || "Failed to save draft");
  return data;
}

export async function updatePhotoEditorDraft(
  id: string,
  payload: Partial<{
    title: string;
    preset_key: string | null;
    width: number;
    height: number;
    canvas_json: PhotoEditorCanvasJson;
    thumbnail_data: string | null;
  }>,
): Promise<DesignDraft> {
  const { ok, data, error } = await authJson<DesignDraft>(
    `/v1/marketplace/seller/photo-editor/drafts/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  if (!ok || !data) throw new Error(error || "Failed to update draft");
  return data;
}

export async function deletePhotoEditorDraft(id: string): Promise<void> {
  const { ok, error } = await authJson<unknown>(
    `/v1/marketplace/seller/photo-editor/drafts/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (!ok) throw new Error(error || "Failed to delete draft");
}

type DraftWritePayload = {
  title?: string;
  preset_key?: string | null;
  width: number;
  height: number;
  canvas_json: PhotoEditorCanvasJson;
  thumbnail_data?: string | null;
};

function draftAuthHeaders(): Record<string, string> {
  const token = readSession()?.access_token;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Best-effort save during page unload (refresh/close). */
export function updatePhotoEditorDraftKeepalive(
  id: string,
  payload: Partial<DraftWritePayload>,
): boolean {
  const res = fetch(`${API_BASE}/v1/marketplace/seller/photo-editor/drafts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: draftAuthHeaders(),
    body: JSON.stringify(payload),
    keepalive: true,
  });
  void res;
  return true;
}

/** Best-effort create during page unload when no draft id exists yet. */
export function createPhotoEditorDraftKeepalive(payload: DraftWritePayload): boolean {
  const res = fetch(`${API_BASE}/v1/marketplace/seller/photo-editor/drafts`, {
    method: "POST",
    headers: draftAuthHeaders(),
    body: JSON.stringify(payload),
    keepalive: true,
  });
  void res;
  return true;
}
