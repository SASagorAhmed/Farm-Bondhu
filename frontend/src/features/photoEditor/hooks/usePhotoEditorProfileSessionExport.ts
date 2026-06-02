import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { PHOTO_EDITOR_PROFILE_URL_KEY } from "@/features/photoEditor/types";

/** Applies profile photo URL exported from Photo Editor when returning to profile. */
export function usePhotoEditorProfileSessionExport(userId: string | undefined, refreshProfile: () => Promise<void>) {
  const applied = useRef(false);

  useEffect(() => {
    if (!userId || applied.current) return;
    const url = sessionStorage.getItem(PHOTO_EDITOR_PROFILE_URL_KEY);
    if (!url) return;

    applied.current = true;
    sessionStorage.removeItem(PHOTO_EDITOR_PROFILE_URL_KEY);

    void (async () => {
      try {
        const { error } = await api.from("profiles").update({ avatar_url: url }).eq("id", userId);
        if (error) throw new Error(error.message);
        await refreshProfile();
        toast.success("Profile photo updated from Photo Editor");
      } catch (err) {
        applied.current = false;
        sessionStorage.setItem(PHOTO_EDITOR_PROFILE_URL_KEY, url);
        toast.error(err instanceof Error ? err.message : "Could not apply profile photo");
      }
    })();
  }, [userId, refreshProfile]);
}
