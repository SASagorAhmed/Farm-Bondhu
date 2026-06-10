import { apiJson } from "@/api/client";

export const COMMUNITY_POST_IMAGE_LIMIT = 4;
export const COMMUNITY_POST_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

export type CommunityImageAttachment = {
  type: "image";
  url: string;
  filename: string;
  mime_type: string;
};

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadCommunityPostImage(file: File): Promise<CommunityImageAttachment> {
  if (!COMMUNITY_POST_IMAGE_MIME_TYPES.includes(file.type)) {
    throw new Error("Upload a PNG, JPG, JPEG, or WEBP image");
  }
  const fileData = await readFileAsDataUrl(file);
  const { res, body } = await apiJson("/v1/community/uploads/images", {
    method: "POST",
    body: JSON.stringify({ file_data: fileData, filename: file.name }),
  });
  if (!res.ok) {
    throw new Error(String(body.error || "Image upload failed"));
  }
  return body.data as CommunityImageAttachment;
}
