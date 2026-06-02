import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router-dom";
import type { PhotoEditorCanvasJson } from "../types";
import {
  createPhotoEditorDraftKeepalive,
  updatePhotoEditorDraftKeepalive,
} from "../api/photoEditorApi";
import {
  persistDesignDraft,
  saveDraftLocally,
  type PersistDesignDraftResult,
} from "../lib/workspaceDraft";

const DEBOUNCE_MS = 3000;

export type AutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

type DraftPayload = {
  title: string;
  width: number;
  height: number;
  preset_key: string;
  canvas_json: PhotoEditorCanvasJson;
  thumbnail_data: string | null;
};

type BuildPayload = () => DraftPayload | null;

export function usePhotoEditorAutoSave(options: {
  currentDraftId: string | null;
  setCurrentDraftId: (id: string) => void;
  hasDesignContent: () => boolean;
  buildPayload: BuildPayload;
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  t: (key: string) => string;
  queryClient: QueryClient;
  editorBase?: string;
}) {
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const currentDraftIdRef = useRef(options.currentDraftId);
  currentDraftIdRef.current = options.currentDraftId;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const pendingAfterSaveRef = useRef(false);

  const runSave = useCallback(
    async (saveOptions: { silent: boolean; replaceUrlOnCreate?: boolean }): Promise<void> => {
      const o = optionsRef.current;
      if (!o.hasDesignContent()) return;

      const payload = o.buildPayload();
      if (!payload) return;

      setSaveStatus("saving");

      const previousDraftId = currentDraftIdRef.current;

      try {
        const result: PersistDesignDraftResult | null = await persistDesignDraft({
          currentDraftId: currentDraftIdRef.current,
          previousDraftId,
          title: payload.title,
          width: payload.width,
          height: payload.height,
          preset_key: payload.preset_key,
          canvas_json: payload.canvas_json,
          thumbnail_data: payload.thumbnail_data,
          navigate: o.navigate,
          searchParams: o.searchParams,
          t: o.t,
          silent: saveOptions.silent,
          replaceUrlOnCreate: saveOptions.replaceUrlOnCreate ?? true,
          queryClient: o.queryClient,
          editorBase: o.editorBase,
        });

        if (result) {
          currentDraftIdRef.current = result.id;
          o.setCurrentDraftId(result.id);
          setLastSavedAt(new Date(result.updatedAt));
          setSaveStatus("saved");
          dirtyRef.current = false;
        }
      } catch (err) {
        const draftKey = currentDraftIdRef.current || `local-${Date.now()}`;
        const payload = o.buildPayload();
        if (payload) {
          saveDraftLocally(draftKey, payload.title, payload.canvas_json, o.t, err, {
            silent: saveOptions.silent,
          });
        }
        setSaveStatus("error");
      }
    },
    [],
  );

  const enqueueSave = useCallback(
    (saveOptions: { silent: boolean; force?: boolean; replaceUrlOnCreate?: boolean }) => {
      if (!saveOptions.force && !dirtyRef.current) return Promise.resolve();

      saveChainRef.current = saveChainRef.current
        .then(async () => {
          await runSave({
            silent: saveOptions.silent,
            replaceUrlOnCreate: saveOptions.replaceUrlOnCreate,
          });
        })
        .catch(() => {
          /* runSave handles error state */
        })
        .finally(() => {
          if (pendingAfterSaveRef.current) {
            pendingAfterSaveRef.current = false;
            void enqueueSave({ silent: true, force: true });
          }
        });

      return saveChainRef.current;
    },
    [runSave],
  );

  const markDirty = useCallback(() => {
    const o = optionsRef.current;
    if (!o.hasDesignContent()) return;

    dirtyRef.current = true;
    setSaveStatus((status) => {
      if (status === "saving") {
        pendingAfterSaveRef.current = true;
        return "saving";
      }
      return "pending";
    });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void enqueueSave({ silent: true, force: true });
    }, DEBOUNCE_MS);
  }, [enqueueSave]);

  const flushSave = useCallback(
    async (flushOptions?: { silent?: boolean; force?: boolean }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      const silent = flushOptions?.silent ?? true;
      const force = flushOptions?.force ?? false;
      await enqueueSave({ silent, force });
    },
    [enqueueSave],
  );

  useEffect(() => {
    const onPageHide = () => {
      const o = optionsRef.current;
      if (!o.hasDesignContent() || !dirtyRef.current) return;

      const payload = o.buildPayload();
      if (!payload) return;

      const draftPayload = {
        title: payload.title,
        preset_key: payload.preset_key,
        width: payload.width,
        height: payload.height,
        canvas_json: payload.canvas_json,
        thumbnail_data: payload.thumbnail_data,
      };

      if (currentDraftIdRef.current) {
        updatePhotoEditorDraftKeepalive(currentDraftIdRef.current, draftPayload);
      } else {
        createPhotoEditorDraftKeepalive(draftPayload);
      }
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void flushSave({ silent: true, force: true });
    };
  }, [flushSave]);

  return {
    markDirty,
    flushSave,
    saveStatus,
    lastSavedAt,
    isSaving: saveStatus === "saving",
  };
}
