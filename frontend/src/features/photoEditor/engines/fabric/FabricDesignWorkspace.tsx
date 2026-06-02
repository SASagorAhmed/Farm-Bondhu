import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Canvas,
  Circle,
  Ellipse,
  FabricImage,
  FabricText,
  Line,
  Rect,
  Triangle,
  type FabricObject,
  type TPointerEventInfo,
} from "fabric";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { FlipHorizontal, RotateCw, SlidersHorizontal, Upload } from "lucide-react";
import PhotoEditorTopBar from "../../components/PhotoEditorTopBar";
import PhotoEditorProjectNameDialog from "../../components/PhotoEditorProjectNameDialog";
import PhotoEditorToolSidebar from "../../components/PhotoEditorToolSidebar";
import PhotoEditorActionBar from "../../components/PhotoEditorActionBar";
import FabricToolPanel from "../../components/FabricToolPanel";
import FabricObjectPropertiesPanel from "../../components/FabricObjectPropertiesPanel";
import FabricLayersPanel, { type LayerMeta } from "../../components/FabricLayersPanel";
import {
  applyLabelKeyForTarget,
  getPreset,
  resolveExportTarget,
  resolvePresetFromParams,
} from "../../lib/presets";
import { applyPhotoEditorExport } from "../../lib/photoEditorApply";
import { photoEditorTheme } from "../../lib/photoEditorTheme";
import type { ExportTarget, FabricCanvasJson, PhotoEditorTool } from "../../types";
import { fetchPhotoEditorDrafts } from "../../api/photoEditorApi";
import {
  collectExistingTitles,
  isDraftTitleTaken,
  normalizeDraftTitle,
  proposeNextUntitledTitle,
  resolveTitleForSave,
} from "../../lib/draftTitleUtils";
import { listLocalPhotoEditorDrafts } from "../../lib/localDraftKeys";
import {
  buildHubBackUrl,
  loadDesignDraft,
  saveDraftLocally,
} from "../../lib/workspaceDraft";
import { usePhotoEditorAutoSave } from "../../hooks/usePhotoEditorAutoSave";
import { isFabricCanvas } from "../../lib/engineRouting";
import { exportFabricPng, exportFabricThumbnail } from "./fabricExport";
import {
  applyObjectChrome,
  findObjectByDataId,
  isFabricImage,
  isFabricTextbox,
  layerKindFromObject,
  layerMove,
  layerReorder,
  layerToBack,
  layerToFront,
  waitForFabricCanvas,
  type DocumentSize,
} from "./fabricCanvasHelpers";
import { importToastDraftImage, isToastDraftImportable } from "./importLegacyDraft";
import { useFabricHistory } from "./useFabricHistory";
import { registerFabricCustomProperties } from "./fabricSerialization";
import { fitCanvasToContainer } from "./fabricViewport";
import { applyImageFilters } from "./fabricImageAdjust";
import type { PhotoEditorShapeKind } from "../../lib/photoEditorShapes";
import { DEFAULT_PHOTO_EDITOR_FONT } from "../../lib/photoEditorFonts";
import { DEFAULT_SOLID_COLOR } from "../../lib/photoEditorColorPalette";
import type { FillSelection } from "./fabricFillColor";
import { applyTextControls, bindTextAutoFit, createTextAtPoint, fitTextToContent } from "./fabricTextHelpers";
import { coverImageToDocument } from "./fabricImageFit";
import {
  applyCropInsets,
  clearCrop,
  ensureNaturalSize,
  EMPTY_CROP_INSET,
  normalizeLoadedImage,
  readCropInsets,
  type CropInset,
} from "./fabricImageCrop";
import "./fabricEditor.css";

import { defaultReturnForTarget as resolveReturnForTarget, resolvePhotoEditorBase } from "../../lib/photoEditorPaths";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FabricDesignWorkspace() {
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const editorBase = useMemo(() => resolvePhotoEditorBase(location.pathname), [location.pathname]);
  const queryClient = useQueryClient();
  const { user, refreshProfile } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const presetParam = resolvePresetFromParams(
    searchParams.get("preset"),
    searchParams.get("target"),
  );
  const returnTo = searchParams.get("returnTo");
  const targetParam = searchParams.get("target");
  const preset = getPreset(presetParam);
  const presetLocked = presetParam !== "custom";
  const isNewProject = !draftId || draftId === "new";

  const { data: cloudDrafts = [] } = useQuery({
    queryKey: ["photo-editor-drafts"],
    queryFn: fetchPhotoEditorDrafts,
  });

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const artboardAreaRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const unbindHistoryRef = useRef<(() => void) | null>(null);
  const unbindTextAutoFitRef = useRef<(() => void) | null>(null);
  const bgImageRef = useRef<FabricImage | null>(null);

  const [docSize, setDocSize] = useState({ width: preset.width, height: preset.height });
  const [bgColor, setBgColor] = useState(preset.backgroundColor ?? "#ffffff");
  const [title, setTitle] = useState(() => (isNewProject ? "" : "Untitled design"));
  const [projectNameConfirmed, setProjectNameConfirmed] = useState(!isNewProject);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleRef = useRef(title);
  const titleBeforeEditRef = useRef(title);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(
    draftId && draftId !== "new" ? draftId : null,
  );
  const [loading, setLoading] = useState(Boolean(draftId && draftId !== "new"));
  const [activeTool, setActiveTool] = useState<PhotoEditorTool>("upload");
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [layers, setLayers] = useState<LayerMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customW, setCustomW] = useState(String(preset.width));
  const [customH, setCustomH] = useState(String(preset.height));
  const [cropInset, setCropInset] = useState<CropInset>(EMPTY_CROP_INSET);
  const [hasBgImage, setHasBgImage] = useState(false);
  const [viewportDisplay, setViewportDisplay] = useState({ width: 0, height: 0 });
  const [defaultTextFont, setDefaultTextFont] = useState(DEFAULT_PHOTO_EDITOR_FONT);
  const [defaultTextFill, setDefaultTextFill] = useState<FillSelection>({
    type: "solid",
    color: DEFAULT_SOLID_COLOR,
  });

  const exportTarget = useMemo(
    () => resolveExportTarget(presetParam, targetParam),
    [presetParam, targetParam],
  );

  const existingTitles = useMemo(
    () =>
      collectExistingTitles({
        cloudDrafts,
        localDrafts: listLocalPhotoEditorDrafts(),
        excludeDraftId: currentDraftId,
      }),
    [cloudDrafts, currentDraftId],
  );

  const existingTitlesRef = useRef(existingTitles);
  existingTitlesRef.current = existingTitles;

  const projectNameDialogOpen = isNewProject && !projectNameConfirmed;

  const suggestedProjectName = useMemo(
    () => proposeNextUntitledTitle(existingTitles, t),
    [existingTitles, t],
  );

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    if (!isMobile) setMobilePanelOpen(false);
  }, [isMobile]);

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    setTitleError(null);
  }, []);

  const handleTitleFocus = useCallback(() => {
    titleBeforeEditRef.current = titleRef.current;
  }, []);

  const handleTitleBlur = useCallback(() => {
    const current = normalizeDraftTitle(titleRef.current);
    if (!current) return;
    const previous = normalizeDraftTitle(titleBeforeEditRef.current);
    if (isDraftTitleTaken(current, existingTitlesRef.current, previous)) {
      const msg = t("seller.photoEditor.projectNameTaken");
      setTitleError(msg);
      toast.error(msg);
      setTitle(titleBeforeEditRef.current);
      return;
    }
    titleBeforeEditRef.current = current;
    if (current !== titleRef.current) setTitle(current);
  }, [t]);

  const handleProjectNameConfirm = useCallback((name: string) => {
    setTitle(name);
    titleRef.current = name;
    titleBeforeEditRef.current = name;
    setProjectNameConfirmed(true);
    setTitleError(null);
  }, []);

  const handleProjectNameCancel = useCallback(() => {
    navigate(buildHubBackUrl(searchParams, editorBase));
  }, [navigate, searchParams, editorBase]);

  const syncLayers = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects().filter((o) => o !== bgImageRef.current);
    setLayers(
      objs.map((o, i) => {
        const kind = layerKindFromObject(o);
        const thumbSrc =
          kind === "image" ? String(o.get("fbSrc") ?? (o as FabricImage).getSrc?.() ?? "") : undefined;
        return {
          id: String(o.get("dataId") ?? `obj-${i}`),
          name: String(o.get("name") ?? `Layer ${i + 1}`),
          visible: o.visible !== false,
          locked: !o.selectable,
          kind,
          thumbSrc: thumbSrc || undefined,
        };
      }),
    );
  }, []);

  const markDirtyRef = useRef<() => void>(() => {});
  const syncCropInsetRef = useRef<() => void>(() => {});

  const onHistoryChange = useCallback(() => {
    syncLayers();
    syncCropInsetRef.current();
    markDirtyRef.current();
  }, [syncLayers]);

  const history = useFabricHistory(onHistoryChange);

  const refitViewport = useCallback(() => {
    const canvas = fabricRef.current;
    const el = artboardAreaRef.current;
    if (!canvas || !el) return;
    const fit = fitCanvasToContainer(canvas, docSize.width, docSize.height, el);
    setViewportDisplay({ width: fit.displayWidth, height: fit.displayHeight });
  }, [docSize.height, docSize.width]);

  const getSelectedImage = useCallback((): FabricImage | null => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedId) return null;
    const obj = findObjectByDataId(canvas, selectedId);
    return obj && isFabricImage(obj) && obj instanceof FabricImage ? obj : null;
  }, [selectedId]);

  const cropInsetRef = useRef(cropInset);
  cropInsetRef.current = cropInset;
  const cropHistoryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCropHistory = useCallback(() => {
    if (cropHistoryDebounceRef.current) clearTimeout(cropHistoryDebounceRef.current);
    cropHistoryDebounceRef.current = setTimeout(() => {
      cropHistoryDebounceRef.current = null;
      history.pushSnapshot();
    }, 350);
  }, [history]);

  useEffect(() => {
    const img = getSelectedImage();
    setCropInset(img ? readCropInsets(img) : EMPTY_CROP_INSET);
  }, [getSelectedImage, selectedId]);

  syncCropInsetRef.current = () => {
    const img = getSelectedImage();
    setCropInset(img ? readCropInsets(img) : EMPTY_CROP_INSET);
  };

  const onCropInsetChange = useCallback(
    (edge: "left" | "top" | "right" | "bottom", value: number) => {
      const img = getSelectedImage();
      if (!img) return;
      const next = { ...cropInsetRef.current, [edge]: value };
      setCropInset(next);
      applyCropInsets(img, next);
      fabricRef.current?.requestRenderAll();
      markDirtyRef.current();
      scheduleCropHistory();
    },
    [getSelectedImage, scheduleCropHistory],
  );

  const resetCropOnSelected = useCallback(() => {
    const img = getSelectedImage();
    if (!img) return;
    clearCrop(img);
    setCropInset(EMPTY_CROP_INSET);
    fabricRef.current?.requestRenderAll();
    markDirtyRef.current();
    history.pushSnapshot();
  }, [getSelectedImage, history]);

  const fitSelectedImageToCanvas = useCallback(() => {
    const img = getSelectedImage();
    if (!img) return;
    const iw = img.width || 1;
    const ih = img.height || 1;
    const scale = Math.min(docSize.width / iw, docSize.height / ih);
    img.set({
      left: (docSize.width - iw * scale) / 2,
      top: (docSize.height - ih * scale) / 2,
      scaleX: scale,
      scaleY: scale,
    });
    img.setCoords();
    fabricRef.current?.requestRenderAll();
    history.pushSnapshot();
  }, [docSize.height, docSize.width, getSelectedImage, history]);

  const fillSelectedImageToCanvas = useCallback(() => {
    const img = getSelectedImage();
    if (!img) return;
    coverImageToDocument(img, docSize);
    fabricRef.current?.requestRenderAll();
    history.pushSnapshot();
  }, [docSize.height, docSize.width, getSelectedImage, history]);

  const selectedImg = getSelectedImage();
  const adjustValues = {
    brightness: Number(selectedImg?.get("fbBrightness") ?? 0),
    contrast: Number(selectedImg?.get("fbContrast") ?? 0),
    saturation: Number(selectedImg?.get("fbSaturation") ?? 0),
    blur: Number(selectedImg?.get("fbBlur") ?? 0),
  };

  const adjustDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAdjustChange = useCallback(
    (key: "brightness" | "contrast" | "saturation" | "blur", value: number) => {
      const img = getSelectedImage();
      if (!img) return;
      const next = {
        brightness: Number(img.get("fbBrightness") ?? 0),
        contrast: Number(img.get("fbContrast") ?? 0),
        saturation: Number(img.get("fbSaturation") ?? 0),
        blur: Number(img.get("fbBlur") ?? 0),
        [key]: value,
      };
      applyImageFilters(img, next.brightness, next.contrast, next.saturation, next.blur);
      fabricRef.current?.requestRenderAll();
      if (adjustDebounceRef.current) clearTimeout(adjustDebounceRef.current);
      adjustDebounceRef.current = setTimeout(() => {
        adjustDebounceRef.current = null;
        history.pushSnapshot();
      }, 350);
    },
    [getSelectedImage, history],
  );

  useEffect(() => {
    registerFabricCustomProperties();
    if (!canvasElRef.current || fabricRef.current) return;
    const canvas = new Canvas(canvasElRef.current, {
      width: docSize.width,
      height: docSize.height,
      backgroundColor: bgColor,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    const onSelect = (e: { selected?: { get: (k: string) => unknown }[] }) => {
      const obj = e.selected?.[0];
      setSelectedId(obj ? String(obj.get("dataId") ?? "") : null);
    };
    canvas.on("selection:created", onSelect);
    canvas.on("selection:updated", onSelect);
    canvas.on("selection:cleared", () => setSelectedId(null));

    unbindHistoryRef.current = history.bindCanvas(canvas);
    unbindTextAutoFitRef.current = bindTextAutoFit(canvas);
    requestAnimationFrame(refitViewport);

    return () => {
      unbindHistoryRef.current?.();
      unbindHistoryRef.current = null;
      unbindTextAutoFitRef.current?.();
      unbindTextAutoFitRef.current = null;
      canvas.dispose();
      fabricRef.current = null;
      bgImageRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = bgColor;
    if (bgImageRef.current) {
      coverImageToDocument(bgImageRef.current, docSize);
    }
    refitViewport();
  }, [bgColor, docSize.height, docSize.width, refitViewport]);

  useEffect(() => {
    const el = artboardAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => refitViewport());
    ro.observe(el);
    return () => ro.disconnect();
  }, [refitViewport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        void history.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        void history.redo();
        return;
      }
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const canvas = fabricRef.current;
      const active = canvas?.getActiveObject();
      if (!canvas || !active || active === bgImageRef.current) return;
      e.preventDefault();
      canvas.remove(active);
      setSelectedId(null);
      history.pushSnapshot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || activeTool !== "text") return;

    const onMouseDown = (opt: TPointerEventInfo) => {
      const target = opt.target as FabricObject | undefined;
      if (target && isFabricTextbox(target)) return;

      const point = opt.scenePoint ?? canvas.getScenePoint(opt.e);
      const initialFill = defaultTextFill.type === "solid" ? defaultTextFill.color : DEFAULT_SOLID_COLOR;
      const text = createTextAtPoint(canvas, point, {
        text: t("seller.photoEditor.defaultText"),
        fontFamily: defaultTextFont,
        fill: initialFill,
        fillSelection: defaultTextFill,
      });
      setSelectedId(String(text.get("dataId") ?? ""));
      history.pushSnapshot();

      requestAnimationFrame(() => {
        canvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        fitTextToContent(text, { force: true });
        canvas.requestRenderAll();
      });
    };

    canvas.on("mouse:down", onMouseDown);
    return () => {
      canvas.off("mouse:down", onMouseDown);
    };
  }, [activeTool, defaultTextFill, defaultTextFont, history, t]);

  const loadFabricJson = useCallback(
    async (json: Record<string, unknown>, sizeOverride?: DocumentSize) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const doc = sizeOverride ?? docSize;
      await history.runWithoutHistory(async () => {
        await canvas.loadFromJSON(json);
        canvas.getObjects().forEach((o) => {
          applyObjectChrome(o);
          applyTextControls(o);
          normalizeLoadedImage(o);
        });
        const bg = canvas.getObjects().find((o) => o.get("dataId") === "bg-image");
        if (bg && bg instanceof FabricImage) {
          bgImageRef.current = bg;
          bg.set({ selectable: false, evented: false });
          coverImageToDocument(bg, doc);
          setHasBgImage(true);
        }
        canvas.requestRenderAll();
      });
      history.resetFromCanvas();
      refitViewport();
      syncLayers();
    },
    [docSize, history, refitViewport, syncLayers],
  );

  const loadFabricJsonRef = useRef(loadFabricJson);
  loadFabricJsonRef.current = loadFabricJson;
  const historyRef = useRef(history);
  historyRef.current = history;
  const presetRef = useRef({ preset, presetLocked });
  presetRef.current = { preset, presetLocked };
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!draftId || draftId === "new") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const result = await loadDesignDraft(draftId);
        if (cancelled) return;

        if (!result) {
          toast.error(tRef.current("seller.photoEditor.draftLoadFailed"));
          return;
        }

        const canvas = await waitForFabricCanvas(fabricRef);
        if (cancelled || !canvas) return;

        setTitle(result.title);
        const json = result.canvas_json;
        const { preset: p, presetLocked: locked } = presetRef.current;

        if (result.legacyKonva) {
          toast.message(tRef.current("seller.photoEditor.legacyDraftToast"));
        } else if (isToastDraftImportable(json)) {
          setBgColor(json.backgroundColor ?? p.backgroundColor ?? "#ffffff");
          toast.message(tRef.current("seller.photoEditor.toastDraftConverted"));
          await historyRef.current.runWithoutHistory(async () => {
            await importToastDraftImage(canvas, json, p.width, p.height);
          });
          historyRef.current.resetFromCanvas();
          syncLayers();
        } else if (isFabricCanvas(json) && json.fabricJson) {
          if (!locked) setDocSize({ width: json.width, height: json.height });
          setBgColor(json.backgroundColor);
          if (json.presetKey === "custom") {
            setCustomW(String(json.width));
            setCustomH(String(json.height));
          }
          await loadFabricJsonRef.current(json.fabricJson, { width: json.width, height: json.height });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftId, syncLayers]);

  const addImageFromFile = useCallback(
    async (file: File, opts?: { replaceId?: string; stackIndex?: number; silent?: boolean }) => {
      const canvas = fabricRef.current;
      if (!canvas) return false;
      try {
        const src = await readFileAsDataUrl(file);
        const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
        ensureNaturalSize(img);
        const maxW = docSize.width * 0.92;
        const maxH = docSize.height * 0.92;
        const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        const stack = opts?.stackIndex ?? 0;
        const offset = stack * 28;
        const id = `img-${Date.now()}-${stack}`;
        const baseName = file.name.replace(/\.[^.]+$/, "") || "Image";
        img.set({
          left: (docSize.width - (img.width || 0) * scale) / 2 + offset,
          top: (docSize.height - (img.height || 0) * scale) / 2 + offset,
          scaleX: scale,
          scaleY: scale,
          dataId: id,
          name: baseName.slice(0, 32),
          objectType: "image",
          fbSrc: src,
          fbBrightness: 0,
          fbContrast: 0,
          fbSaturation: 0,
          fbBlur: 0,
        });
        applyObjectChrome(img);
        if (opts?.replaceId) {
          const existing = findObjectByDataId(canvas, opts.replaceId);
          if (existing) canvas.remove(existing);
        }
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.calcOffset();
        canvas.requestRenderAll();
        syncLayers();
        if (!opts?.silent) toast.success(t("seller.photoEditor.imageAdded"));
        return true;
      } catch {
        if (!opts?.silent) toast.error(t("seller.photoEditor.editorInitFailed"));
        return false;
      }
    },
    [docSize.height, docSize.width, syncLayers, t],
  );

  const addImagesFromFiles = useCallback(
    async (files: File[]) => {
      const list = files.filter((f) => f.type.startsWith("image/"));
      if (!list.length) return;
      let added = 0;
      await history.runWithoutHistory(async () => {
        for (let i = 0; i < list.length; i++) {
          const ok = await addImageFromFile(list[i], { stackIndex: i, silent: true });
          if (ok) added++;
        }
      });
      if (added > 0) {
        history.pushSnapshot();
        toast.success(added === 1 ? t("seller.photoEditor.imageAdded") : t("seller.photoEditor.imagesAdded"));
      } else {
        toast.error(t("seller.photoEditor.editorInitFailed"));
      }
    },
    [addImageFromFile, history, t],
  );

  const setBackgroundImageFromFile = useCallback(
    async (file: File) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const src = await readFileAsDataUrl(file);
      const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
      if (bgImageRef.current) canvas.remove(bgImageRef.current);
      coverImageToDocument(img, docSize);
      img.set({
        dataId: "bg-image",
        name: "Background",
        selectable: false,
        evented: false,
        fbSrc: src,
      });
      canvas.add(img);
      canvas.sendObjectToBack(img);
      bgImageRef.current = img;
      setHasBgImage(true);
      canvas.requestRenderAll();
      history.pushSnapshot();
    },
    [docSize.height, docSize.width, history],
  );

  const removeBackgroundImage = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !bgImageRef.current) return;
    canvas.remove(bgImageRef.current);
    bgImageRef.current = null;
    setHasBgImage(false);
    history.pushSnapshot();
  }, [history]);

  const addShape = useCallback(
    (kind: PhotoEditorShapeKind) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const cx = docSize.width / 2;
      const cy = docSize.height / 2;
      const ts = Date.now();
      let obj;
      switch (kind) {
        case "rect":
          obj = new Rect({
            left: cx - 80,
            top: cy - 50,
            width: 160,
            height: 100,
            fill: "#3b82f6",
            dataId: `rect-${ts}`,
            name: "Rectangle",
          });
          break;
        case "circle":
          obj = new Circle({
            left: cx - 50,
            top: cy - 50,
            radius: 50,
            fill: "#22c55e",
            dataId: `circle-${ts}`,
            name: "Circle",
          });
          break;
        case "line":
          obj = new Line([cx - 80, cy, cx + 80, cy], {
            stroke: "#111827",
            strokeWidth: 4,
            fill: "",
            dataId: `line-${ts}`,
            name: "Line",
          });
          break;
        case "triangle":
          obj = new Triangle({
            left: cx - 60,
            top: cy - 52,
            width: 120,
            height: 104,
            fill: "#f59e0b",
            dataId: `triangle-${ts}`,
            name: "Triangle",
          });
          break;
        case "ellipse":
          obj = new Ellipse({
            left: cx - 70,
            top: cy - 45,
            rx: 70,
            ry: 45,
            fill: "#8b5cf6",
            dataId: `ellipse-${ts}`,
            name: "Ellipse",
          });
          break;
      }
      obj.set({ objectType: "shape" });
      applyObjectChrome(obj);
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.calcOffset();
      canvas.requestRenderAll();
    },
    [docSize.height, docSize.width],
  );

  const addSticker = useCallback(
    (emoji: string) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const sticker = new FabricText(emoji, {
        left: docSize.width / 2 - 24,
        top: docSize.height / 2 - 24,
        fontSize: 48,
        dataId: `sticker-${Date.now()}`,
        name: "Sticker",
        objectType: "sticker",
      });
      applyObjectChrome(sticker);
      canvas.add(sticker);
      history.pushSnapshot();
    },
    [docSize.height, docSize.width, history],
  );

  const rotateSelected90 = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active) return;
    active.rotate(((active.angle ?? 0) + 90) % 360);
    active.setCoords();
    canvas?.requestRenderAll();
    history.pushSnapshot();
  }, [history]);

  const hasDesignContent = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return false;
    return canvas.getObjects().some((o) => o !== bgImageRef.current);
  }, []);

  const buildCanvasJson = useCallback((): FabricCanvasJson => {
    const canvas = fabricRef.current;
    return {
      engine: "fabric",
      presetKey: presetParam,
      width: docSize.width,
      height: docSize.height,
      backgroundColor: bgColor,
      fabricJson: canvas ? (canvas.toJSON() as Record<string, unknown>) : undefined,
    };
  }, [bgColor, docSize.height, docSize.width, presetParam]);

  const buildDraftPayload = useCallback(() => {
    if (!hasDesignContent()) return null;
    if (isNewProject && !projectNameConfirmed) return null;
    const canvas = fabricRef.current;
    const resolvedTitle = resolveTitleForSave(titleRef.current, existingTitlesRef.current, t);
    if (resolvedTitle !== titleRef.current) {
      titleRef.current = resolvedTitle;
      setTitle(resolvedTitle);
      titleBeforeEditRef.current = resolvedTitle;
    }
    return {
      title: resolvedTitle,
      width: docSize.width,
      height: docSize.height,
      preset_key: presetParam,
      canvas_json: buildCanvasJson(),
      thumbnail_data: canvas ? exportFabricThumbnail(canvas) : null,
    };
  }, [
    buildCanvasJson,
    docSize.height,
    docSize.width,
    hasDesignContent,
    isNewProject,
    presetParam,
    projectNameConfirmed,
    t,
  ]);

  const autoSave = usePhotoEditorAutoSave({
    currentDraftId,
    setCurrentDraftId,
    hasDesignContent,
    buildPayload: buildDraftPayload,
    navigate,
    searchParams,
    t,
    queryClient,
    editorBase,
  });

  markDirtyRef.current = autoSave.markDirty;

  useEffect(() => {
    if (draftId && draftId !== "new") {
      setCurrentDraftId(draftId);
    }
  }, [draftId]);

  const skipMetaDirtyRef = useRef(true);
  useEffect(() => {
    if (skipMetaDirtyRef.current) {
      skipMetaDirtyRef.current = false;
      return;
    }
    if (loading) return;
    autoSave.markDirty();
  }, [autoSave, bgColor, docSize.height, docSize.width, loading, title]);

  const saveDraft = useCallback(async () => {
    if (!hasDesignContent()) {
      toast.error(t("seller.photoEditor.designEmpty"));
      return;
    }
    try {
      await autoSave.flushSave({ silent: false, force: true });
    } catch (err) {
      const fallbackTitle = resolveTitleForSave(
        titleRef.current,
        existingTitlesRef.current,
        t,
      );
      saveDraftLocally(
        currentDraftId || `local-${Date.now()}`,
        fallbackTitle,
        buildCanvasJson(),
        t,
        err,
      );
    }
  }, [autoSave, buildCanvasJson, currentDraftId, hasDesignContent, t, title]);

  const handleBack = useCallback(async () => {
    await autoSave.flushSave({ silent: true, force: true });
    navigate(buildHubBackUrl(searchParams, editorBase));
  }, [autoSave, navigate, searchParams, editorBase]);

  const handleDownload = () => {
    if (!hasDesignContent()) {
      toast.error(t("seller.photoEditor.designEmpty"));
      return;
    }
    const canvas = fabricRef.current;
    const dataUrl = canvas ? exportFabricPng(canvas) : null;
    if (!dataUrl) {
      toast.error(t("seller.photoEditor.exportFailed"));
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title.replace(/\s+/g, "-")}.png`;
    a.click();
  };

  const handleApply = async () => {
    if (!exportTarget) return;
    if (!hasDesignContent()) {
      toast.error(t("seller.photoEditor.designEmpty"));
      return;
    }
    const canvas = fabricRef.current;
    const dataUrl = canvas ? exportFabricPng(canvas) : null;
    if (!dataUrl) {
      toast.error(t("seller.photoEditor.exportFailed"));
      return;
    }
    try {
      await autoSave.flushSave({ silent: true, force: true });
      const result = await applyPhotoEditorExport(exportTarget, dataUrl, {
        userId: user?.id,
        filename: `${title.replace(/\s+/g, "-")}.png`,
      });
      if (exportTarget === "profile") await refreshProfile();
      if (result.navigateHint === "openProductForm") sessionStorage.setItem("photoEditorOpenForm", "1");
      toast.success(t("seller.photoEditor.exportReady"));
      navigate(returnTo || resolveReturnForTarget(exportTarget, location.pathname));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("seller.photoEditor.exportFailed"));
    }
  };

  const applyLabelKey = exportTarget ? applyLabelKeyForTarget(exportTarget) : undefined;

  const selectLayer = useCallback((id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = findObjectByDataId(canvas, id);
    if (obj) {
      canvas.setActiveObject(obj);
      setSelectedId(id);
      canvas.requestRenderAll();
    }
  }, []);

  const toolPanelProps = {
    activeTool,
    preset,
    presetParam,
    presetLocked,
    docSize,
    bgColor,
    onBgColorChange: setBgColor,
    onBgImageUpload: (f: File) => void setBackgroundImageFromFile(f),
    onRemoveBgImage: removeBackgroundImage,
    hasBgImage,
    customW,
    customH,
    onCustomW: setCustomW,
    onCustomH: setCustomH,
    onApplyCustomSize: () => {
      const w = Number(customW) || docSize.width;
      const h = Number(customH) || docSize.height;
      setDocSize({ width: w, height: h });
    },
    imageLayers: layers
      .filter((l) => l.kind === "image")
      .map((l) => ({ id: l.id, name: l.name, thumbSrc: l.thumbSrc })),
    onUploadFiles: (files: File[]) => void addImagesFromFiles(files),
    onImageLayerSelect: selectLayer,
    selectedId,
    defaultTextFont,
    onDefaultTextFontChange: setDefaultTextFont,
    defaultTextFill,
    onDefaultTextFillChange: setDefaultTextFill,
    onAddShape: addShape,
    onAddSticker: addSticker,
    cropInset,
    onCropInsetChange,
    onResetCrop: resetCropOnSelected,
    onFitImageToCanvas: fitSelectedImageToCanvas,
    onFillImageToCanvas: fillSelectedImageToCanvas,
    hasSelectedImage: Boolean(getSelectedImage()),
    adjustValues,
    onAdjustChange,
  };

  const layersPanelProps = {
    layers,
    selectedId,
    onSelect: selectLayer,
    onUpdate: (id: string, patch: { visible?: boolean; locked?: boolean }) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const obj = findObjectByDataId(canvas, id);
      if (!obj) return;
      if (patch.visible !== undefined) obj.visible = patch.visible;
      if (patch.locked !== undefined) {
        obj.selectable = !patch.locked;
        obj.evented = !patch.locked;
      }
      canvas.requestRenderAll();
      syncLayers();
      history.pushSnapshot();
    },
    onRemove: (id: string) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const obj = findObjectByDataId(canvas, id);
      if (obj) {
        canvas.remove(obj);
        if (selectedId === id) setSelectedId(null);
        history.pushSnapshot();
      }
    },
    onMove: (id: string, direction: "up" | "down") => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      layerMove(canvas, id, direction);
      syncLayers();
      history.pushSnapshot();
    },
    onReorder: (id: string, targetVisualIndex: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      layerReorder(canvas, id, targetVisualIndex);
      syncLayers();
      history.pushSnapshot();
    },
    onToFront: (id: string) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      layerToFront(canvas, id);
      syncLayers();
      history.pushSnapshot();
    },
    onToBack: (id: string) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      layerToBack(canvas, id);
      syncLayers();
      history.pushSnapshot();
    },
  };

  const rightRail = (
    <aside className="fabric-editor-rail hidden md:flex flex-col min-h-0">
      <FabricLayersPanel className="shrink-0 border-b" {...layersPanelProps} />
      <div className="fabric-editor-rail-scroll flex-1 min-h-0 w-full">
        <FabricToolPanel {...toolPanelProps} />
        {selectedId && (
          <FabricObjectPropertiesPanel
            canvas={fabricRef.current}
            selectedId={selectedId}
            onHistory={history.pushSnapshot}
            onClearSelection={() => setSelectedId(null)}
            onReplaceImage={(f) => void addImageFromFile(f, { replaceId: selectedId })}
          />
        )}
      </div>
    </aside>
  );

  return (
    <div
      className={`fabric-editor-root bg-muted/30${projectNameDialogOpen ? " pointer-events-none" : ""}`}
    >
      {loading && (
        <div className="fabric-editor-loading-overlay" aria-busy="true">
          {t("seller.photoEditor.loading")}
        </div>
      )}
      <PhotoEditorProjectNameDialog
        open={projectNameDialogOpen}
        initialName={suggestedProjectName}
        existingTitles={existingTitles}
        onConfirm={handleProjectNameConfirm}
        onCancel={handleProjectNameCancel}
      />
      <PhotoEditorTopBar
        title={title}
        onTitleChange={handleTitleChange}
        onTitleBlur={handleTitleBlur}
        onTitleFocus={handleTitleFocus}
        titleError={titleError}
        onBack={() => void handleBack()}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => void history.undo()}
        onRedo={() => void history.redo()}
        onSaveDraft={() => void saveDraft()}
        onDownload={handleDownload}
        onApply={() => void handleApply()}
        applyLabelKey={applyLabelKey}
        showApply={Boolean(exportTarget)}
        saving={autoSave.isSaving}
        saveStatus={autoSave.saveStatus}
        lastSavedAt={autoSave.lastSavedAt}
        hideActionsOnMobile
      />

      <div className="fabric-editor-preset-strip shrink-0 border-b bg-card px-3 py-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-normal">
          {t(preset.labelKey)} · {preset.aspectLabel} · {docSize.width}×{docSize.height}px
        </Badge>
        {presetLocked && (
          <span className="text-xs text-muted-foreground">{t("seller.photoEditor.canvasSizeLocked")}</span>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 ml-auto"
          onClick={() => document.getElementById("fabric-photo-upload")?.click()}
        >
          <Upload className="h-4 w-4" />
          {t("seller.photoEditor.toastUploadPhoto")}
        </Button>
        <input
          id="fabric-photo-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (files.length) void addImagesFromFiles(files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="fabric-editor-workspace">
        <PhotoEditorToolSidebar
          active={activeTool}
          onChange={(tool) => {
            setActiveTool(tool);
            if (isMobile) setMobilePanelOpen(true);
          }}
        />
        <div className="fabric-editor-artboard flex flex-col flex-1 min-w-0">
          <div ref={artboardAreaRef} className="fabric-editor-artboard-inner">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-3 right-3 z-10 gap-1 shadow-md md:hidden"
              onClick={() => setMobilePanelOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("seller.photoEditor.toolOptions")}
            </Button>
            <div
              className={`fabric-editor-artboard-frame${activeTool === "text" ? " fabric-editor-artboard-frame--text-tool" : ""}`}
              style={{
                width: viewportDisplay.width || docSize.width,
                height: viewportDisplay.height || docSize.height,
                boxShadow: `0 4px 24px ${photoEditorTheme.primary}22`,
              }}
            >
              {layers.length === 0 && !hasBgImage && (
                <p className="fabric-editor-artboard-empty-hint">{t("seller.photoEditor.canvasEmptyHint")}</p>
              )}
              <canvas ref={canvasElRef} />
            </div>
          </div>
          <div className="fabric-editor-quick-bar px-4">
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={rotateSelected90}>
              <RotateCw className="h-4 w-4" />
              {t("seller.photoEditor.rotate")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                const canvas = fabricRef.current;
                const active = canvas?.getActiveObject();
                if (active) {
                  active.set("flipX", !active.flipX);
                  canvas?.requestRenderAll();
                  history.pushSnapshot();
                }
              }}
            >
              <FlipHorizontal className="h-4 w-4" />
              {t("seller.photoEditor.flip")}
            </Button>
          </div>
          <PhotoEditorActionBar
            className="md:hidden shrink-0 w-full"
            onSaveDraft={() => void saveDraft()}
            onDownload={handleDownload}
            onApply={() => void handleApply()}
            applyLabelKey={applyLabelKey}
            showApply={Boolean(exportTarget)}
            saving={autoSave.isSaving}
          />
        </div>
        {rightRail}
      </div>

      {isMobile && (
        <Sheet open={mobilePanelOpen} onOpenChange={setMobilePanelOpen}>
          <SheetContent side="bottom" className="h-[75vh] p-0 flex flex-col min-h-0">
            <FabricLayersPanel className="shrink-0 border-b" {...layersPanelProps} />
            <div className="fabric-editor-rail-scroll flex-1 min-h-0">
              <FabricToolPanel {...toolPanelProps} />
              {selectedId && (
                <FabricObjectPropertiesPanel
                  canvas={fabricRef.current}
                  selectedId={selectedId}
                  onHistory={history.pushSnapshot}
                  onClearSelection={() => setSelectedId(null)}
                  onReplaceImage={(f) => void addImageFromFile(f, { replaceId: selectedId })}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
