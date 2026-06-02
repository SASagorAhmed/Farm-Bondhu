import PhotoEditorHome from "@/features/photoEditor/pages/PhotoEditorHome";
import { ADMIN_PHOTO_EDITOR_BASE } from "@/features/photoEditor/lib/photoEditorPaths";

export default function OfficialShopPhotoEditor() {
  return <PhotoEditorHome editorBasePath={ADMIN_PHOTO_EDITOR_BASE} />;
}
