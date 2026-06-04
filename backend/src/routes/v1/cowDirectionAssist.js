import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireUser } from "../../middleware/requireUser.js";
import {
  providerSetting,
  safeAiDetail,
  shouldTryFallback,
  uniqueAttempts,
} from "../../services/ai/aiProviderRouter.js";
import { openRouterVisionText } from "../../services/ai/openRouterProvider.js";
import { geminiVisionText } from "../../services/ai/geminiProvider.js";

const router = Router();

const MAX_IMAGE_CHARS = 2_800_000;
const IS_DEV = process.env.NODE_ENV !== "production";
const COW_ASSIST_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    headSide: { type: "STRING", enum: ["left", "right", "unknown"] },
    confidence: { type: "NUMBER" },
    headBbox: {
      type: "OBJECT",
      nullable: true,
      properties: {
        x: { type: "NUMBER" },
        y: { type: "NUMBER" },
        width: { type: "NUMBER" },
        height: { type: "NUMBER" },
      },
    },
    standoffDistanceM: { type: "NUMBER", nullable: true },
    distanceConfidence: { type: "NUMBER" },
    reason: { type: "STRING", nullable: true },
  },
  required: ["headSide", "confidence"],
};
const SYSTEM_PROMPT = `You analyze side-view photos of cows for livestock weight estimation.
Reply with ONLY valid compact JSON, no markdown. Required fields are headSide and confidence. Optional fields may be null:
{
  "headSide": "left" | "right" | "unknown",
  "confidence": 0.0-1.0,
  "headBbox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
  "standoffDistanceM": number or null,
  "distanceConfidence": 0.0-1.0,
  "reason": "one short sentence"
}
Definitions (photo coordinates, x increases right, y increases down):
- headSide: which side of the image has the cow's HEAD (smaller end, neck/nose), not the tail/rump.
- headBbox: tight box around neck and head only (not shoulder or mid-body); width typically under 22% of cow span.
- standoffDistanceM: approximate camera-to-cow distance in meters for a side-view barn photo, or null if unsure.
If unclear, use "unknown" for headSide and confidence below 0.5.`;

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stripJsonFence(text) {
  return String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function firstBalancedJsonObject(text) {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return "";
}

function numberFieldFromText(text, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i");
  const match = String(text || "").match(re);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function nullableNumberFieldFromText(text, field) {
  if (new RegExp(`"${field}"\\s*:\\s*null`, "i").test(String(text || ""))) return null;
  return numberFieldFromText(text, field);
}

function stringFieldFromText(text, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`, "i");
  const match = String(text || "").match(re);
  return match ? match[1] : null;
}

function salvageAssistJson(text) {
  const rawHeadSide = String(stringFieldFromText(text, "headSide") || "").toLowerCase();
  if (!["left", "right", "head_left", "head_right", "unknown"].includes(rawHeadSide)) return null;
  const headSide = normalizeHeadSide(rawHeadSide);
  const confidence = numberFieldFromText(text, "confidence");
  if (confidence == null) return null;

  return {
    headSide,
    confidence,
    headBbox: null,
    frontLeg: null,
    hindLeg: null,
    topChest: null,
    lowerChest: null,
    standoffDistanceM: nullableNumberFieldFromText(text, "standoffDistanceM"),
    distanceConfidence: numberFieldFromText(text, "distanceConfidence") ?? 0,
    reason: "Recovered from partial Gemini response",
  };
}

function parseAssistJson(text) {
  const trimmed = String(text || "").trim();
  return (
    tryParseJson(trimmed) ||
    tryParseJson(stripJsonFence(trimmed)) ||
    tryParseJson(firstBalancedJsonObject(trimmed)) ||
    salvageAssistJson(trimmed)
  );
}

function logAssistFailure(failures) {
  if (!IS_DEV || !failures.length) return;
  console.warn(
    "[cow-direction-assist] AI failures",
    failures.map((failure) => ({
      provider: failure.provider,
      model: failure.model,
      status: failure.status,
      detail: safeAiDetail(failure.detail, 240),
    }))
  );
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

function visionAttemptOrder() {
  const primary = providerSetting("AI_VISION_PROVIDER", "gemini");
  const fallback = providerSetting("AI_VISION_FALLBACK_PROVIDER", "off");
  return [primary, fallback].filter((provider, index, arr) => provider !== "off" && arr.indexOf(provider) === index);
}

function geminiVisionModels() {
  const primary = process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash";
  const fallbacks = String(process.env.GEMINI_VISION_FALLBACK_MODELS || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return [primary, ...fallbacks].filter((model, index, arr) => arr.indexOf(model) === index);
}

async function runOpenRouterVision({ prompt, imageUrl }) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model =
    process.env.OPENROUTER_VISION_MODEL?.trim() ||
    process.env.OPENROUTER_MODEL?.trim() ||
    "google/gemma-4-31b-it:free";
  if (!apiKey) {
    return {
      ok: false,
      provider: "openrouter",
      model,
      status: 503,
      detail: "OPENROUTER_API_KEY not configured",
      retryable: false,
    };
  }
  return openRouterVisionText({
    apiKey,
    model,
    systemPrompt: SYSTEM_PROMPT,
    prompt,
    imageUrl,
  });
}

async function runGeminiVision({ prompt, imageData, model }) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return geminiVisionText({
    apiKey,
    model,
    systemPrompt: SYSTEM_PROMPT,
    prompt,
    imageData,
    responseMimeType: "application/json",
    responseSchema: COW_ASSIST_RESPONSE_SCHEMA,
  });
}

router.post(
  "/assist-direction",
  requireUser,
  asyncHandler(async (req, res) => {
    if (process.env.COW_DIRECTION_ASSIST_ENABLED === "false") {
      res.status(503).json({ error: "Cow direction assist is disabled" });
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

    const hintText =
      localHints && typeof localHints === "object"
        ? `Local algorithm hints: ${JSON.stringify(localHints)}`
        : "";
    const prompt = `Analyze this side-view cow photo. Return head side, head box, and approximate camera distance in meters. ${hintText}`.trim();

    const failures = [];
    let parsed = null;
    let provider = null;
    let model = null;

    providerLoop:
    for (const nextProvider of visionAttemptOrder()) {
      if (nextProvider === "gemini") {
        for (const geminiModel of geminiVisionModels()) {
          const attempt = await runGeminiVision({ prompt, imageData, model: geminiModel });
          if (attempt.ok) {
            parsed = parseAssistJson(attempt.text);
            provider = attempt.provider;
            model = attempt.model;
            if (parsed) break providerLoop;
            failures.push({
              provider: attempt.provider,
              model: attempt.model,
              status: 502,
              detail: `Could not parse AI response: ${String(attempt.text || "").slice(0, 300)}`,
            });
            continue;
          }

          failures.push({
            provider: attempt.provider,
            model: attempt.model,
            status: attempt.status,
            detail: attempt.detail,
          });
          if (!attempt.retryable && !shouldTryFallback(attempt.status)) break providerLoop;
        }
        continue;
      } else {
        const attempt = await runOpenRouterVision({ prompt, imageUrl });
        if (attempt.ok) {
          parsed = parseAssistJson(attempt.text);
          provider = attempt.provider;
          model = attempt.model;
          if (parsed) break providerLoop;
          failures.push({
            provider: attempt.provider,
            model: attempt.model,
            status: 502,
            detail: `Could not parse AI response: ${String(attempt.text || "").slice(0, 300)}`,
          });
          continue;
        }

        failures.push({
          provider: attempt.provider,
          model: attempt.model,
          status: attempt.status,
          detail: attempt.detail,
        });
        if (!attempt.retryable && !shouldTryFallback(attempt.status)) break providerLoop;
      }
    }

    if (!parsed) {
      logAssistFailure(failures);
      const last = failures[failures.length - 1];
      res.status(last?.status || 503).json({
        error: "AI upstream error",
        detail: last?.detail || "All configured vision providers failed.",
        failed_provider: last?.provider || "unknown",
        failed_model: last?.model || null,
        attempts: uniqueAttempts(failures),
      });
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
        provider,
      },
    });
  })
);

export default router;
