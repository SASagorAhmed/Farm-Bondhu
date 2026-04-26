import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireUser } from "../../middleware/requireUser.js";

const router = Router();

const SYSTEM_PROMPT = `You are FarmBondhu AI — a friendly, knowledgeable farm assistant for Bangladeshi farmers and livestock owners.
Be warm, practical, and concise. Respond in English. Keep under 300 words unless asked for detail.`;

router.post(
  "/farm-chat",
  requireUser,
  asyncHandler(async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ error: "OPENROUTER_API_KEY not configured" });
      return;
    }
    const { messages } = req.body || {};
    if (!messages || !Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: "messages array required" });
      return;
    }
    const model = process.env.OPENROUTER_MODEL?.trim() || "google/gemini-2.0-flash-001";
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.API_PUBLIC_URL || "http://localhost:3001",
        "X-Title": "FarmBondhu API",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });
    if (!upstream.ok) {
      const t = await upstream.text();
      res.status(upstream.status).json({ error: "AI upstream error", detail: t.slice(0, 500) });
      return;
    }
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (upstream.body) {
      const reader = upstream.body.getReader();
      const pump = async () => {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
        } finally {
          res.end();
        }
      };
      void pump();
      return;
    }
    res.end();
  })
);

export default router;
