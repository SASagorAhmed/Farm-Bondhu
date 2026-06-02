import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router-dom";
import type { PhotoEditorCanvasJson } from "../types";
import { PHOTO_EDITOR_LOCAL_DRAFT_PREFIX } from "../types";
import {
  createPhotoEditorDraft,
  fetchPhotoEditorDraft,
  updatePhotoEditorDraft,
} from "../api/photoEditorApi";
import { isLegacyKonvaCanvas } from "./engineRouting";
import { clearLocalDraftIfSynced } from "./localDraftKeys";
import { DEFAULT_PHOTO_EDITOR_BASE, photoEditorPaths, resolvePhotoEditorBase } from "./photoEditorPaths";

export function buildHubBackUrl(searchParams: URLSearchParams, editorBase?: string) {
  const qs = searchParams.toString();
  const base = editorBase ?? DEFAULT_PHOTO_EDITOR_BASE;
  return photoEditorPaths(base).hubBack(qs || undefined);
}

export function showDraftSavedToast(
  navigate: NavigateFunction,
  t: (key: string) => string,
  editorBase?: string,
) {
  const base = editorBase ?? DEFAULT_PHOTO_EDITOR_BASE;
  toast.success(t("seller.photoEditor.draftSaved"), {
    description: t("seller.photoEditor.draftSavedViewHub"),
    action: {
      label: t("seller.photoEditor.viewDrafts"),
      onClick: () => navigate(photoEditorPaths(base).drafts),
    },
  });
}

export async function loadDesignDraft(draftId: string): Promise<{
  title: string;
  canvas_json: PhotoEditorCanvasJson;
  legacyKonva: boolean;
} | null> {
  try {
    const draft = await fetchPhotoEditorDraft(draftId);
    const legacyKonva = isLegacyKonvaCanvas(draft.canvas_json);
    return {
      title: draft.title,
      canvas_json: draft.canvas_json,
      legacyKonva,
    };
  } catch {
    const local = localStorage.getItem(`${PHOTO_EDITOR_LOCAL_DRAFT_PREFIX}${draftId}`);
    if (!local) return null;
    try {
      const parsed = JSON.parse(local) as { title?: string; canvas_json: PhotoEditorCanvasJson };
      return {
        title: parsed.title || "Recovered draft",
        canvas_json: parsed.canvas_json,
        legacyKonva: isLegacyKonvaCanvas(parsed.canvas_json),
      };
    } catch {
      return null;
    }
  }
}

export type PersistDesignDraftResult = {
  id: string;
  updatedAt: string;
};

export async function persistDesignDraft(options: {
  currentDraftId: string | null;
  title: string;
  width: number;
  height: number;
  preset_key: string;
  canvas_json: PhotoEditorCanvasJson;
  thumbnail_data: string | null;
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  t: (key: string) => string;
  silent?: boolean;
  replaceUrlOnCreate?: boolean;
  queryClient?: QueryClient;
  previousDraftId?: string | null;
  editorBase?: string;
}): Promise<PersistDesignDraftResult | null> {
  const editorBase = options.editorBase ?? DEFAULT_PHOTO_EDITOR_BASE;
  const paths = photoEditorPaths(editorBase);
  const payload = {
    title: options.title,
    preset_key: options.preset_key,
    width: options.width,
    height: options.height,
    canvas_json: options.canvas_json,
    thumbnail_data: options.thumbnail_data,
  };

  if (options.currentDraftId) {
    const updated = await updatePhotoEditorDraft(options.currentDraftId, payload);
    clearLocalDraftIfSynced(updated.id, options.previousDraftId ?? options.currentDraftId);
    if (!options.silent) showDraftSavedToast(options.navigate, options.t, editorBase);
    void options.queryClient?.invalidateQueries({ queryKey: ["photo-editor-drafts"] });
    return { id: updated.id, updatedAt: updated.updated_at };
  }

  const created = await createPhotoEditorDraft(payload);
  clearLocalDraftIfSynced(created.id, options.previousDraftId);
  if (options.replaceUrlOnCreate !== false) {
    options.navigate(`${paths.editId(created.id, options.searchParams.toString())}`, {
      replace: true,
    });
  }
  if (!options.silent) showDraftSavedToast(options.navigate, options.t, editorBase);
  void options.queryClient?.invalidateQueries({ queryKey: ["photo-editor-drafts"] });
  return { id: created.id, updatedAt: created.updated_at };
}

export function saveDraftLocally(
  key: string,
  title: string,
  canvas_json: PhotoEditorCanvasJson,
  t: (k: string) => string,
  err?: unknown,
  options?: { silent?: boolean },
) {
  localStorage.setItem(
    `${PHOTO_EDITOR_LOCAL_DRAFT_PREFIX}${key}`,
    JSON.stringify({ title, canvas_json }),
  );
  if (!options?.silent) {
    toast.error(t("seller.photoEditor.draftSaveFailedLocal"), {
      description: err instanceof Error ? err.message : undefined,
    });
  }
}
