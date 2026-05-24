/**
 * Signed upload helper (data URL payloads, same strategy as VetBondhu profile uploads).
 */

export function parseDataUrl(input) {
  const raw = String(input || "");
  const m = /^data:([^;]+);base64,(.+)$/i.exec(raw);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

/**
 * @param {string} dataUrl
 * @param {string} folder
 * @param {string} [publicIdPrefix]
 */
export async function uploadToCloudinary(dataUrl, folder, publicIdPrefix = "file") {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error("Cloudinary is not configured on server");
    err.status = 503;
    throw err;
  }
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    const err = new Error("Invalid file payload");
    err.status = 400;
    throw err;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = Math.random().toString(36).slice(2, 10);
  const publicId = `${publicIdPrefix}_${timestamp}_${nonce}`;
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = (await import("node:crypto")).createHash("sha1").update(paramsToSign).digest("hex");
  const form = new FormData();
  form.append("file", dataUrl);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder);
  form.append("public_id", publicId);
  form.append("resource_type", "auto");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.secure_url) {
    const err = new Error(String(body?.error?.message || "Cloudinary upload failed"));
    err.status = 502;
    throw err;
  }
  return {
    url: String(body.secure_url),
    publicId: String(body.public_id || ""),
  };
}
