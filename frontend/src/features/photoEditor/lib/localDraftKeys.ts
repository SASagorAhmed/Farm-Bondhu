import type { PhotoEditorCanvasJson } from "../types";
import { PHOTO_EDITOR_LOCAL_DRAFT_PREFIX } from "../types";

export type LocalPhotoEditorDraft = {
  storageKey: string;
  draftId: string;
  title: string;
};

function parseLocalDraftEntry(storageKey: string): LocalPhotoEditorDraft | null {
  if (typeof localStorage === "undefined") return null;
  if (!storageKey.startsWith(PHOTO_EDITOR_LOCAL_DRAFT_PREFIX)) return null;

  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  const draftId = storageKey.slice(PHOTO_EDITOR_LOCAL_DRAFT_PREFIX.length);
  try {
    const parsed = JSON.parse(raw) as { title?: string; canvas_json?: PhotoEditorCanvasJson };
    return {
      storageKey,
      draftId,
      title: parsed.title?.trim() || "",
    };
  } catch {
    return { storageKey, draftId, title: "" };
  }
}

export function listLocalPhotoEditorDrafts(): LocalPhotoEditorDraft[] {
  if (typeof localStorage === "undefined") return [];

  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PHOTO_EDITOR_LOCAL_DRAFT_PREFIX)) keys.push(key);
  }

  return keys
    .map(parseLocalDraftEntry)
    .filter((d): d is LocalPhotoEditorDraft => d !== null)
    .sort((a, b) => a.draftId.localeCompare(b.draftId));
}

export function countLocalPhotoEditorDrafts(): number {
  return listLocalPhotoEditorDrafts().length;
}

export function removeLocalPhotoEditorDraft(draftId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(`${PHOTO_EDITOR_LOCAL_DRAFT_PREFIX}${draftId}`);
}

/** Remove local backup after a draft is successfully stored on the server. */
export function clearLocalDraftIfSynced(serverDraftId: string, previousDraftId?: string | null): void {
  removeLocalPhotoEditorDraft(serverDraftId);
  if (previousDraftId && previousDraftId !== serverDraftId) {
    removeLocalPhotoEditorDraft(previousDraftId);
  }
  if (previousDraftId?.startsWith("local-")) {
    removeLocalPhotoEditorDraft(previousDraftId);
  }
}
