import { safeAiDetail, shouldTryFallback } from "./aiProviderRouter.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

function openRouterHeaders(apiKey, title = "FarmBondhu API") {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.API_PUBLIC_URL || "http://localhost:3001",
    "X-Title": title,
  };
}

export async function openRouterChatStream({ apiKey, model, messages }) {
  const upstream = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (upstream.ok) return { ok: true, provider: "openrouter", model, upstream };

  const detail = safeAiDetail(await upstream.text());
  return {
    ok: false,
    provider: "openrouter",
    model,
    status: upstream.status,
    detail,
    retryable: shouldTryFallback(upstream.status),
  };
}

export async function openRouterVisionText({ apiKey, model, systemPrompt, prompt, imageUrl }) {
  const upstream = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: openRouterHeaders(apiKey, "FarmBondhu Cow Vision Assist"),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!upstream.ok) {
    const detail = safeAiDetail(await upstream.text());
    return {
      ok: false,
      provider: "openrouter",
      model,
      status: upstream.status,
      detail,
      retryable: shouldTryFallback(upstream.status),
    };
  }

  const payload = await upstream.json();
  const content = payload?.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((p) => p?.text || "").join("")
        : "";

  return { ok: true, provider: "openrouter", model, text };
}
