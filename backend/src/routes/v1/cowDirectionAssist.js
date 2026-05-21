import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireUser } from "../../middleware/requireUser.js";

const router = Router();

const MAX_IMAGE_CHARS = 2_800_000;
const SYSTEM_PROMPT = `You analyze side-view photos of cows for livestock weight estimation.
Reply with ONLY valid JSON, no markdown:
{
  "headSide": "left" | "right" | "unknown",
  "confidence": 0.0-1.0,
  "headBbox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
  "frontLeg": { "x": 0-1, "y": 0-1 },
  "hindLeg": { "x": 0-1, "y": 0-1 },
  "topChest": { "x": 0-1, "y": 0-1 },
  "lowerChest": { "x": 0-1, "y": 0-1 },
  "standoffDistanceM": number or null,
  "distanceConfidence": 0.0-1.0,
  "reason": "one short sentence"
}
Definitions (photo coordinates, x increases right, y increases down):
- headSide: which side of the image has the cow's HEAD (smaller end, neck/nose), not the tail/rump.
- frontLeg: foreleg hoof on the HEAD side — frontLeg.x must be on the SAME side as headSide (left if headSide is left, right if headSide is right).
- hindLeg: rear/hind hoof on the TAIL side — opposite side from frontLeg. If the rear hoof is hidden in grass, place hindLeg at the best tail-side ground contact (still return both points).
- headBbox: tight box around neck and head only (not shoulder or mid-body); width typically under 22% of cow span.
- topChest: withers / upper chest — smaller y value (higher on the photo) than lowerChest.
- lowerChest: brisket — larger y value (lower on the photo) than topChest.
- standoffDistanceM: approximate camera-to-cow distance in meters for a side-view barn photo, or null if unsure.
If unclear, use "unknown" for headSide and confidence below 0.5.`;

function parseAssistJson(text) {
  const trimmed = String(text || "").trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function normalizeHeadSide(v) {
  const s = String(v || "").toLowerCase();
  if (s === "left" || s === "head_left") return "left";
  if (s === "right" || s === "head_right") return "right";
  return "unknown";
}

function normalizeBbox(raw) {
  if (!raw || typeof raw !== "object") return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (![x, y, width, height].every((n) => Number.isFinite(n))) return null;
  if (width <= 0 || height <= 0) return null;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0.02, Math.min(1, width)),
    height: Math.max(0.02, Math.min(1, height)),
  };
}

function normalizePoint(raw) {
  if (!raw || typeof raw !== "object") return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

router.post(
  "/assist-direction",
  requireUser,
  asyncHandler(async (req, res) => {
    if (process.env.COW_DIRECTION_ASSIST_ENABLED === "false") {
      res.status(503).json({ error: "Cow direction assist is disabled" });
      return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ error: "OPENROUTER_API_KEY not configured" });
      return;
    }

    const { image_data: imageData, local_hints: localHints } = req.body || {};
    if (!imageData || typeof imageData !== "string") {
      res.status(400).json({ error: "image_data required (base64 data URL or raw base64)" });
      return;
    }
    if (imageData.length > MAX_IMAGE_CHARS) {
      res.status(400).json({ error: "image_data too large" });
      return;
    }

    const imageUrl = imageData.startsWith("data:")
      ? imageData
      : `data:image/jpeg;base64,${imageData}`;

    const model =
      process.env.OPENROUTER_VISION_MODEL?.trim() ||
      process.env.OPENROUTER_MODEL?.trim() ||
      "google/gemini-2.0-flash-001";

    const hintText =
      localHints && typeof localHints === "object"
        ? `Local algorithm hints: ${JSON.stringify(localHints)}`
        : "";

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.API_PUBLIC_URL || "http://localhost:3001",
        "X-Title": "FarmBondhu Cow Vision Assist",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this side-view cow photo. Return head side, front/hind leg positions, top/lower chest, and approximate camera distance in meters. ${hintText}`.trim(),
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      res.status(upstream.status).json({ error: "AI upstream error", detail: t.slice(0, 500) });
      return;
    }

    const payload = await upstream.json();
    const content = payload?.choices?.[0]?.message?.content;
    const text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((p) => p?.text || "").join("")
          : "";

    const parsed = parseAssistJson(text);
    if (!parsed) {
      res.status(502).json({ error: "Could not parse AI response", detail: text.slice(0, 300) });
      return;
    }

    const headSide = normalizeHeadSide(parsed.headSide);
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const distanceConfidence = Math.max(
      0,
      Math.min(1, Number(parsed.distanceConfidence) || 0)
    );
    const standoffRaw = Number(parsed.standoffDistanceM);
    const standoffDistanceM =
      Number.isFinite(standoffRaw) && standoffRaw > 0 ? standoffRaw : null;

    res.json({
      data: {
        headSide,
        confidence,
        headBbox: normalizeBbox(parsed.headBbox),
        frontLeg: normalizePoint(parsed.frontLeg),
        hindLeg: normalizePoint(parsed.hindLeg),
        topChest: normalizePoint(parsed.topChest),
        lowerChest: normalizePoint(parsed.lowerChest),
        standoffDistanceM,
        distanceConfidence,
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : null,
        model,
      },
    });
  })
);

export default router;
