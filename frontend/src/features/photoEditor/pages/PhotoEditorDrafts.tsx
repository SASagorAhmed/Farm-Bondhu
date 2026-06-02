import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { deletePhotoEditorDraft, fetchPhotoEditorDrafts } from "../api/photoEditorApi";
import { formatDraftRelativeTime, sortDraftsByUpdatedAt } from "../lib/draftRelativeTime";
import { toast } from "sonner";
import { Trash2, ArrowLeft } from "lucide-react";
import { DEFAULT_PHOTO_EDITOR_BASE, photoEditorPaths } from "../lib/photoEditorPaths";

type PhotoEditorDraftsProps = {
  editorBasePath?: string;
};

export default function PhotoEditorDrafts({ editorBasePath = DEFAULT_PHOTO_EDITOR_BASE }: PhotoEditorDraftsProps) {
  const paths = photoEditorPaths(editorBasePath);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["photo-editor-drafts"],
    queryFn: fetchPhotoEditorDrafts,
    refetchOnMount: "always",
  });

  const sortedDrafts = useMemo(() => sortDraftsByUpdatedAt(drafts), [drafts]);

  const editPath = (id: string) => paths.editId(id, qs || undefined);

  const remove = async (id: string) => {
    try {
      await deletePhotoEditorDraft(id);
      void queryClient.invalidateQueries({ queryKey: ["photo-editor-drafts"] });
      toast.success(t("seller.photoEditor.draftDeleted"));
    } catch {
      toast.error(t("seller.photoEditor.draftDeleteFailed"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(paths.hubBack(qs || undefined))}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t("seller.photoEditor.backHome")}
      </Button>
      <h1 className="text-xl font-display font-bold">{t("seller.photoEditor.allDrafts")}</h1>
      {isLoading && <p className="text-muted-foreground">{t("seller.photoEditor.loading")}</p>}
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        {sortedDrafts.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-3 space-y-2">
              {d.thumbnail_data ? (
                <img
                  src={d.thumbnail_data}
                  alt=""
                  className="w-full aspect-video object-contain bg-muted rounded cursor-pointer"
                  onClick={() => navigate(editPath(d.id))}
                />
              ) : (
                <div
                  className="w-full aspect-video bg-muted rounded cursor-pointer"
                  onClick={() => navigate(editPath(d.id))}
                />
              )}
              <p className="text-sm font-medium truncate">{d.title}</p>
              <p className="text-xs text-muted-foreground">
                {t("seller.photoEditor.draftUpdated").replace(
                  "{time}",
                  formatDraftRelativeTime(d.updated_at, language),
                )}
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => navigate(editPath(d.id))}>
                  {t("seller.photoEditor.editDraft")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void remove(d.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {!isLoading && sortedDrafts.length === 0 && (
        <p className="text-muted-foreground text-center py-8">{t("seller.photoEditor.noDrafts")}</p>
      )}
    </div>
  );
}
