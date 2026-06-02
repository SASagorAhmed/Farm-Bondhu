import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ImageEditor from "@toast-ui/react-image-editor";
import "tui-image-editor/dist/tui-image-editor.css";
import "tui-color-picker/dist/tui-color-picker.css";
import "./toastEditor.css";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import PhotoEditorTopBar from "../../components/PhotoEditorTopBar";
import PhotoEditorActionBar from "../../components/PhotoEditorActionBar";
import { photoEditorTheme } from "../../lib/photoEditorTheme";
import {
  applyLabelKeyForTarget,
  getPreset,
  migratePresetKey,
  resolveExportTarget,
} from "../../lib/presets";
import { applyPhotoEditorExport } from "../../lib/photoEditorApply";
import type { ExportTarget, ToastCanvasJson } from "../../types";
import {
  buildHubBackUrl,
  loadDesignDraft,
  persistDesignDraft,
  saveDraftLocally,
} from "../../lib/workspaceDraft";
import { isToastCanvas } from "../../lib/engineRouting";
import { toastEditorTheme, TOAST_MENU } from "./toastTheme";
import { createBlankCanvasDataUrl } from "./createBlankCanvas";
import { exportToastPng, isLikelyEmptyExport, type ToastEditorInstance } from "./toastExport";

import { defaultReturnForTarget as resolveReturnForTarget, resolvePhotoEditorBase } from "../../lib/photoEditorPaths";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type EditorRef = { getInstance: () => ToastEditorInstance };

export default function ToastImageWorkspace() {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const editorBase = resolvePhotoEditorBase(location.pathname);
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const menuBarPosition = isMobile ? "bottom" : "left";

  const presetParam = migratePresetKey(searchParams.get("preset") || "product_photo");
  const returnTo = searchParams.get("returnTo");
  const targetParam = searchParams.get("target");
  const preset = getPreset(presetParam);

  const blankCanvasUrl = useMemo(
    () => createBlankCanvasDataUrl(preset.width, preset.height, preset.backgroundColor ?? "#ffffff"),
    [preset.width, preset.height, preset.backgroundColor],
  );

  const exportTarget = useMemo(
    () => resolveExportTarget(presetParam, targetParam),
    [presetParam, targetParam],
  );

  const editorRef = useRef<EditorRef | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const initGenerationRef = useRef(0);

  const [title, setTitle] = useState("Untitled design");
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(
    draftId && draftId !== "new" ? draftId : null,
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(draftId && draftId !== "new"));
  const [editorReady, setEditorReady] = useState(false);
  const [restoredImageUrl, setRestoredImageUrl] = useState<string | null>(null);
  const [hasUserImage, setHasUserImage] = useState(false);
  const [initDone, setInitDone] = useState(false);
  const [cssMaxSize, setCssMaxSize] = useState({ width: preset.width, height: preset.height });

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const update = (width: number, height: number) => {
      setCssMaxSize({
        width: Math.max(1, Math.min(preset.width, Math.floor(width))),
        height: Math.max(1, Math.min(preset.height, Math.floor(height))),
      });
    };
    update(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) update(rect.width, rect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [preset.width, preset.height]);

  const includeUI = useMemo(
    () => ({
      loadImage: {
        path: blankCanvasUrl,
        name: "blank",
      },
      theme: toastEditorTheme,
      menu: [...TOAST_MENU],
      menuBarPosition: menuBarPosition as "bottom" | "left",
      uiSize: { width: "100%", height: "100%" },
    }),
    [blankCanvasUrl, menuBarPosition],
  );

  const getInstance = useCallback((): ToastEditorInstance | null => {
    try {
      return editorRef.current?.getInstance?.() ?? null;
    } catch {
      return null;
    }
  }, []);

  const loadImageIntoEditor = useCallback(
    async (src: string, name: string, fromUser: boolean) => {
      const inst = getInstance();
      if (!inst) return false;
      try {
        if (inst.resizeCanvasDimension) {
          try {
            inst.resizeCanvasDimension({ width: preset.width, height: preset.height });
          } catch {
            /* continue — canvas may already be correct size */
          }
        }
        await inst.loadImageFromURL(src, name);
        if (fromUser) setHasUserImage(true);
        return true;
      } catch {
        return false;
      }
    },
    [getInstance, preset.height, preset.width],
  );

  const runInit = useCallback(async () => {
    const inst = getInstance();
    if (!inst) return;
    const gen = ++initGenerationRef.current;

    let ok = true;
    if (restoredImageUrl) {
      ok = await loadImageIntoEditor(restoredImageUrl, "draft", true);
    } else if (inst.resizeCanvasDimension) {
      try {
        inst.resizeCanvasDimension({ width: preset.width, height: preset.height });
      } catch {
        /* includeUI.loadImage already sized blank — non-fatal */
      }
    }

    if (gen !== initGenerationRef.current) return;

    if (ok) {
      setInitDone(true);
      if (restoredImageUrl) setHasUserImage(true);
    } else {
      toast.error(t("seller.photoEditor.editorInitFailed"), {
        description: t("seller.photoEditor.editorInitFailedHint"),
      });
    }
  }, [loadImageIntoEditor, preset.height, preset.width, restoredImageUrl, t]);

  useEffect(() => {
    setEditorReady(false);
    setInitDone(false);
  }, [menuBarPosition]);

  useEffect(() => {
    if (!editorReady || loading) return;
    void runInit();
  }, [editorReady, loading, runInit]);

  useEffect(() => {
    if (!editorReady || !restoredImageUrl || loading) return;
    setInitDone(false);
    void runInit();
  }, [restoredImageUrl, editorReady, loading, runInit]);

  useEffect(() => {
    if (!draftId || draftId === "new") return;
    setLoading(true);
    void loadDesignDraft(draftId).then((result) => {
      if (!result) {
        toast.error(t("seller.photoEditor.draftLoadFailed"));
        setLoading(false);
        return;
      }
      setTitle(result.title);
      if (result.legacyKonva) {
        toast.message(t("seller.photoEditor.legacyDraftToast"));
      } else if (isToastCanvas(result.canvas_json) && result.canvas_json.imageDataUrl) {
        setRestoredImageUrl(result.canvas_json.imageDataUrl);
        setHasUserImage(true);
      }
      setLoading(false);
    });
  }, [draftId, t]);

  const handleUpload = useCallback(
    async (file: File) => {
      const inst = getInstance();
      if (!inst) {
        toast.error(t("seller.photoEditor.editorInitFailed"));
        return;
      }
      try {
        if (inst.loadImageFromFile) {
          await inst.loadImageFromFile(file, "upload");
        } else {
          const url = await readFileAsDataUrl(file);
          await inst.loadImageFromURL(url, "upload");
        }
        if (inst.resizeCanvasDimension) {
          try {
            inst.resizeCanvasDimension({ width: preset.width, height: preset.height });
          } catch {
            /* non-fatal */
          }
        }
        setHasUserImage(true);
        setInitDone(true);
        toast.success(t("seller.photoEditor.toastImageLoaded"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("seller.photoEditor.exportFailed"));
      }
    },
    [getInstance, preset.height, preset.width, t],
  );

  const requireUserImage = useCallback((): boolean => {
    if (hasUserImage) return true;
    const inst = getInstance();
    if (!inst) {
      toast.error(t("seller.photoEditor.toastUploadFirst"));
      return false;
    }
    const dataUrl = exportToastPng(inst);
    if (!isLikelyEmptyExport(dataUrl)) {
      setHasUserImage(true);
      return true;
    }
    toast.error(t("seller.photoEditor.toastUploadFirst"));
    return false;
  }, [getInstance, hasUserImage, t]);

  const buildCanvasJson = useCallback((): ToastCanvasJson => {
    const inst = getInstance();
    const imageDataUrl = inst ? exportToastPng(inst) : null;
    return {
      engine: "toast",
      presetKey: presetParam,
      width: preset.width,
      height: preset.height,
      backgroundColor: preset.backgroundColor ?? "#ffffff",
      imageDataUrl: imageDataUrl ?? undefined,
    };
  }, [getInstance, preset.backgroundColor, preset.height, preset.width, presetParam]);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const inst = getInstance();
      const thumb = inst ? exportToastPng(inst) : null;
      const canvas_json = buildCanvasJson();
      const result = await persistDesignDraft({
        currentDraftId,
        title,
        width: preset.width,
        height: preset.height,
        preset_key: presetParam,
        canvas_json,
        thumbnail_data: thumb,
        navigate,
        searchParams,
        t,
        editorBase,
      });
      if (result) setCurrentDraftId(result.id);
    } catch (err) {
      saveDraftLocally(currentDraftId || `local-${Date.now()}`, title, buildCanvasJson(), t, err);
    } finally {
      setSaving(false);
    }
  }, [
    buildCanvasJson,
    currentDraftId,
    getInstance,
    navigate,
    preset.height,
    preset.width,
    presetParam,
    searchParams,
    t,
    title,
    editorBase,
  ]);

  const handleDownload = useCallback(() => {
    if (!requireUserImage()) return;
    const inst = getInstance();
    const dataUrl = inst ? exportToastPng(inst) : null;
    if (!dataUrl) {
      toast.error(t("seller.photoEditor.exportFailed"));
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title.replace(/\s+/g, "-")}.png`;
    a.click();
  }, [getInstance, requireUserImage, t, title]);

  const handleApply = useCallback(async () => {
    if (!exportTarget) return;
    if (!requireUserImage()) return;
    const inst = getInstance();
    const dataUrl = inst ? exportToastPng(inst) : null;
    if (!dataUrl || isLikelyEmptyExport(dataUrl)) {
      toast.error(t("seller.photoEditor.toastUploadFirst"));
      return;
    }
    try {
      const result = await applyPhotoEditorExport(exportTarget, dataUrl, {
        userId: user?.id,
        filename: `${title.replace(/\s+/g, "-")}.png`,
      });
      if (exportTarget === "profile") await refreshProfile();
      if (result.navigateHint === "openProductForm") {
        sessionStorage.setItem("photoEditorOpenForm", "1");
      }
      toast.success(t("seller.photoEditor.exportReady"));
      navigate(returnTo || defaultReturnForTarget(exportTarget));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("seller.photoEditor.exportFailed"));
    }
  }, [exportTarget, getInstance, navigate, refreshProfile, requireUserImage, returnTo, t, title, user?.id]);

  const applyLabelKey = exportTarget ? applyLabelKeyForTarget(exportTarget) : undefined;
  const stepApplyLabel = exportTarget ? t(applyLabelKey) : t("seller.photoEditor.download");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t("seller.photoEditor.loading")}
      </div>
    );
  }

  return (
    <div className="toast-editor-root flex flex-col h-full min-h-0 bg-muted/30">
      <PhotoEditorTopBar
        title={title}
        onTitleChange={setTitle}
        onBack={() => navigate(buildHubBackUrl(searchParams, editorBase))}
        canUndo={false}
        canRedo={false}
        onUndo={() => getInstance()?.undo?.()}
        onRedo={() => getInstance()?.redo?.()}
        onSaveDraft={() => void saveDraft()}
        onDownload={handleDownload}
        onApply={() => void handleApply()}
        applyLabelKey={applyLabelKey}
        showApply={Boolean(exportTarget)}
        saving={saving}
        hideActionsOnMobile
      />

      <div
        className={`shrink-0 border-b bg-card px-3 ${hasUserImage ? "py-2" : "py-3 space-y-2"}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {t(preset.labelKey)} · {preset.aspectLabel} · {preset.width}×{preset.height}px
          </Badge>
          {!hasUserImage && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {t("seller.photoEditor.toastUploadFirst")}
            </span>
          )}
          {hasUserImage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => document.getElementById("toast-photo-upload")?.click()}
            >
              <Upload className="h-4 w-4" />
              {t("seller.photoEditor.toastChangePhoto")}
            </Button>
          ) : null}
        </div>
        {!hasUserImage && (
          <>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
              <li>{t("seller.photoEditor.toastStepUpload")}</li>
              <li>{t("seller.photoEditor.toastStepEdit")}</li>
              <li>
                {t("seller.photoEditor.toastStepApply")} — {stepApplyLabel}
              </li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-1.5 text-white"
                style={photoEditorTheme.buttonStyle}
                onClick={() => document.getElementById("toast-photo-upload")?.click()}
              >
                <Upload className="h-4 w-4" />
                {t("seller.photoEditor.toastUploadPhoto")}
              </Button>
              {!initDone && (
                <span className="text-xs text-muted-foreground">{t("seller.photoEditor.loading")}</span>
              )}
            </div>
          </>
        )}
        <input
          id="toast-photo-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
            e.target.value = "";
          }}
        />
      </div>

      <div ref={canvasWrapRef} className="toast-editor-canvas-wrap flex-1 min-h-0">
        <ImageEditor
          key={`toast-editor-${menuBarPosition}`}
          ref={(el) => {
            editorRef.current = el as unknown as EditorRef;
            if (el && !editorReady) {
              requestAnimationFrame(() => setEditorReady(true));
            }
          }}
          includeUI={includeUI}
          cssMaxWidth={cssMaxSize.width}
          cssMaxHeight={cssMaxSize.height}
          usageStatistics={false}
        />
      </div>

      <PhotoEditorActionBar
        className="md:hidden shrink-0"
        onSaveDraft={() => void saveDraft()}
        onDownload={handleDownload}
        onApply={() => void handleApply()}
        applyLabelKey={applyLabelKey}
        showApply={Boolean(exportTarget)}
        saving={saving}
      />
    </div>
  );
}
