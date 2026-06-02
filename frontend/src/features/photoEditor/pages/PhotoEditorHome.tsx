import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { PHOTO_EDITOR_PRESETS, getPreset, resolvePresetFromParams, type PresetDefinition } from "../lib/presets";
import { photoEditorTheme } from "../lib/photoEditorTheme";
import { fetchPhotoEditorDrafts } from "../api/photoEditorApi";
import { listLocalPhotoEditorDrafts, type LocalPhotoEditorDraft } from "../lib/localDraftKeys";
import { formatDraftRelativeTime, sortDraftsByUpdatedAt } from "../lib/draftRelativeTime";
import type { PresetKey } from "../types";
import {
  ADMIN_PHOTO_EDITOR_BASE,
  DEFAULT_PHOTO_EDITOR_BASE,
  defaultReturnForTarget,
  photoEditorPaths,
} from "../lib/photoEditorPaths";
import {
  FolderOpen,
  Image,
  LayoutTemplate,
  Megaphone,
  Package,
  Store,
  User,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PRESET_ICONS: Record<PresetKey, LucideIcon> = {
  product_photo: Package,
  shop_cover: Store,
  shop_logo: Store,
  profile_photo: User,
  promo_banner: Megaphone,
  custom: LayoutTemplate,
};

function buildEditUrl(
  preset: PresetDefinition,
  existingQs: URLSearchParams,
  editorBase: string = DEFAULT_PHOTO_EDITOR_BASE,
) {
  const p = new URLSearchParams(existingQs);
  p.set("preset", preset.key);
  if (preset.exportTarget !== "download_only") {
    p.set("target", preset.exportTarget);
  } else {
    p.delete("target");
  }
  if (editorBase.includes(ADMIN_PHOTO_EDITOR_BASE) && preset.exportTarget !== "download_only") {
    p.set("returnTo", defaultReturnForTarget(preset.exportTarget, editorBase));
  } else if (preset.suggestedReturnTo) {
    p.set("returnTo", preset.suggestedReturnTo);
  }
  return photoEditorPaths(editorBase).editNew(p.toString());
}

type PhotoEditorHomeProps = {
  editorBasePath?: string;
};

export default function PhotoEditorHome({ editorBasePath = DEFAULT_PHOTO_EDITOR_BASE }: PhotoEditorHomeProps) {
  const paths = photoEditorPaths(editorBasePath);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language } = useLanguage();
  const qs = searchParams.toString();

  const { data: drafts = [] } = useQuery({
    queryKey: ["photo-editor-drafts"],
    queryFn: fetchPhotoEditorDrafts,
  });

  const recentDrafts = useMemo(
    () => sortDraftsByUpdatedAt(drafts).slice(0, 9),
    [drafts],
  );

  const [offlineDrafts, setOfflineDrafts] = useState<LocalPhotoEditorDraft[]>([]);

  const refreshOfflineDrafts = useCallback(() => {
    setOfflineDrafts(listLocalPhotoEditorDrafts());
  }, []);

  useEffect(() => {
    refreshOfflineDrafts();
  }, [refreshOfflineDrafts]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshOfflineDrafts();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshOfflineDrafts]);

  const offlineEditPath = (draftId: string) => paths.editId(draftId, qs || undefined);

  useEffect(() => {
    const target = searchParams.get("target");
    const preset = searchParams.get("preset");
    if (target && !preset) {
      const key = resolvePresetFromParams(null, target);
      navigate(buildEditUrl(getPreset(key), searchParams, editorBasePath), { replace: true });
    }
  }, [editorBasePath, navigate, searchParams]);

  const startPreset = (preset: PresetDefinition) => {
    navigate(buildEditUrl(preset, searchParams, editorBasePath));
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
      <div
        className="rounded-2xl px-6 py-8 text-white shadow-sm"
        style={{ background: photoEditorTheme.gradient }}
      >
        <h1 className="text-2xl md:text-3xl font-display font-bold">{t("seller.photoEditor.title")}</h1>
        <p className="text-white/90 mt-2 max-w-2xl">{t("seller.photoEditor.subtitle")}</p>
      </div>

      {offlineDrafts.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 space-y-3">
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("seller.photoEditor.offlineDraftsTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("seller.photoEditor.offlineDraftsHint").replace("{count}", String(offlineDrafts.length))}
              </p>
            </div>
          </div>
          <ul className="space-y-2 pl-8">
            {offlineDrafts.map((d) => (
              <li
                key={d.storageKey}
                className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2"
              >
                <span className="text-sm truncate min-w-0">
                  {d.title || t("seller.photoEditor.offlineDraftUntitled")}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-8"
                  onClick={() => navigate(offlineEditPath(d.draftId))}
                >
                  {t("seller.photoEditor.offlineDraftOpen")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          {t("seller.photoEditor.choosePreset")}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PHOTO_EDITOR_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.key];
            return (
              <Card
                key={preset.key}
                className="flex flex-col hover:shadow-md transition-shadow"
                style={{ borderColor: "transparent" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = photoEditorTheme.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "hsl(var(--border))";
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${photoEditorTheme.primary}18`, color: photoEditorTheme.primary }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base leading-tight">{t(preset.labelKey)}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-mono text-xs">
                      {preset.aspectLabel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-3 pt-0">
                  <p className="text-sm text-muted-foreground">{t(preset.usedForKey)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("seller.photoEditor.ratioLabel")}: {preset.width}×{preset.height}px
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-auto w-full text-white"
                    style={photoEditorTheme.buttonStyle}
                    onClick={() => startPreset(preset)}
                  >
                    {t("seller.photoEditor.startDesign")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {recentDrafts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("seller.photoEditor.recentDrafts")}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/seller/photo-editor/drafts${qs ? `?${qs}` : ""}`}>
                <FolderOpen className="h-4 w-4 mr-1" />
                {t("seller.photoEditor.allDrafts")}
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t("seller.photoEditor.recentDraftsHint")}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {recentDrafts.map((d) => (
              <Card
                key={d.id}
                className="cursor-pointer hover:border-[#0EA5E9] transition-colors"
                onClick={() => navigate(paths.editId(d.id, qs || undefined))}
              >
                <CardContent className="p-3">
                  {d.thumbnail_data ? (
                    <img
                      src={d.thumbnail_data}
                      alt=""
                      className="w-full aspect-video object-contain bg-muted rounded mb-2"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-muted rounded mb-2 flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.width}×{d.height}
                    {" · "}
                    {t("seller.photoEditor.draftUpdated").replace(
                      "{time}",
                      formatDraftRelativeTime(d.updated_at, language),
                    )}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
