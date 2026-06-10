import { apiJson } from "@/api/client";

export type HiringInterest = {
  id: string;
  post_id: string;
  owner_user_id: string;
  interested_user_id: string;
  status: string;
  shared_profile: Record<string, unknown>;
  shared_cv_url?: string | null;
  message?: string | null;
  created_at: string;
  updated_at: string;
};

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadProfileCv(file: File) {
  const fileData = await readFileAsDataUrl(file);
  const { res, body } = await apiJson("/v1/me/cv", {
    method: "POST",
    body: JSON.stringify({ file_data: fileData, filename: file.name }),
  });
  return {
    ok: res.ok,
    error: String(body.error || ""),
    user: body.user,
  };
}

export async function removeProfileCv() {
  const { res, body } = await apiJson("/v1/me/cv", { method: "DELETE" });
  return {
    ok: res.ok,
    error: String(body.error || ""),
    user: body.user,
  };
}

export async function submitHiringInterest(postId: string, message?: string) {
  const { res, body } = await apiJson(`/v1/community/posts/${postId}/interests`, {
    method: "POST",
    body: JSON.stringify({ message: message?.trim() || undefined }),
  });
  return {
    ok: res.ok,
    error: String(body.error || ""),
    data: body.data as HiringInterest | undefined,
  };
}

export async function fetchHiringInterests(postId: string): Promise<HiringInterest[]> {
  const { res, body } = await apiJson(`/v1/community/posts/${postId}/interests`);
  if (!res.ok) throw new Error(String(body.error || "Failed to load interested users"));
  return (body.data || []) as HiringInterest[];
}
