import crypto from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireUser } from "../../middleware/requireUser.js";

const router = Router();

/** Zego token04 (official format): AES-CBC binary payload, prefixed with "04". */
function generateZegoToken04(appID, serverSecret, roomID, userID, userName, expireSeconds = 7200) {
  const now = Math.floor(Date.now() / 1000);
  const nonce = Math.floor(Math.random() * 4294967296) - 2147483648;
  const payload = JSON.stringify({
    room_id: roomID,
    user_id: userID,
    user_name: userName,
    privilege: { 1: 1, 2: 1 },
    stream_id_list: null,
  });
  const tokenInfo = {
    app_id: appID,
    user_id: userID,
    nonce,
    ctime: now,
    expire: now + expireSeconds,
    payload,
  };
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(serverSecret, "utf8"), iv);
  cipher.setAutoPadding(true);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokenInfo), "utf8"), cipher.final()]);

  const expireBytes = Buffer.alloc(8);
  expireBytes.writeBigInt64BE(BigInt(tokenInfo.expire), 0);
  const ivLen = Buffer.alloc(2);
  ivLen.writeUInt16BE(iv.length, 0);
  const encryptedLen = Buffer.alloc(2);
  encryptedLen.writeUInt16BE(encrypted.length, 0);
  const content = Buffer.concat([expireBytes, ivLen, iv, encryptedLen, encrypted]);

  return {
    token: `04${content.toString("base64")}`,
    meta: {
      app_id: appID,
      room_id: roomID,
      user_id: userID,
      user_name: userName,
      ctime: tokenInfo.ctime,
      expire: tokenInfo.expire,
      nonce,
    },
  };
}

function extractMeta(html, property) {
  const ogRegex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  let match = html.match(ogRegex);
  if (match) return match[1];
  const ogRegex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  match = html.match(ogRegex2);
  if (match) return match[1];
  return null;
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

router.post(
  "/link-preview",
  requireUser,
  asyncHandler(async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "url is required" });
      return;
    }
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }
    const response = await fetch(formattedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FarmBondhuLinkPreview/1.0)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      res.status(422).json({ error: `Failed to fetch: ${response.status}` });
      return;
    }
    const reader = response.body?.getReader();
    let html = "";
    const decoder = new TextDecoder();
    let bytesRead = 0;
    const maxBytes = 50000;
    if (reader) {
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytesRead += value.length;
      }
      reader.cancel().catch(() => {});
    }
    const parsedUrl = new URL(formattedUrl);
    const domain = parsedUrl.hostname.replace(/^www\./, "");
    const title =
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title") ||
      extractTitle(html);
    const description =
      extractMeta(html, "og:description") ||
      extractMeta(html, "twitter:description") ||
      extractMeta(html, "description");
    let image = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");
    if (image && !image.startsWith("http")) {
      image = new URL(image, formattedUrl).href;
    }
    res.json({
      url: formattedUrl,
      title: title || null,
      description: description || null,
      image: image || null,
      domain,
    });
  })
);

router.post(
  "/zego-token",
  requireUser,
  asyncHandler(async (req, res) => {
    const { roomId, userName } = req.body || {};
    if (!roomId || typeof roomId !== "string" || !userName || typeof userName !== "string") {
      res.status(400).json({ error: "roomId and userName are required" });
      return;
    }
    const appIdRaw = process.env.ZEGOCLOUD_APP_ID?.trim();
    const serverSecret = process.env.ZEGOCLOUD_SERVER_SECRET?.trim();
    if (!appIdRaw || !serverSecret) {
      res.status(503).json({ error: "ZegoCloud is not configured on the server" });
      return;
    }
    const appID = parseInt(appIdRaw, 10);
    if (Number.isNaN(appID)) {
      res.status(503).json({ error: "Invalid ZEGOCLOUD_APP_ID" });
      return;
    }
    if (Buffer.byteLength(serverSecret, "utf8") !== 32) {
      res.status(503).json({ error: "ZEGOCLOUD_SERVER_SECRET must be exactly 32 characters" });
      return;
    }
    const { token, meta } = generateZegoToken04(appID, serverSecret, roomId, req.userId, userName);
    const now = Math.floor(Date.now() / 1000);
    console.info(
      "[zego-token]",
      JSON.stringify({
        appID,
        roomId,
        userId: req.userId,
        tokenLength: token.length,
        tokenMeta: meta,
        serverNow: now,
        secondsUntilExpiry:
          typeof meta?.expire === "number" ? meta.expire - now : null,
      })
    );
    res.json({ token, appID });
  })
);

export default router;
