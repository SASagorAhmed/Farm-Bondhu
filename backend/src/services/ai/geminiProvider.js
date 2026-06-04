import { safeAiDetail, shouldTryFallback } from "./aiProviderRouter.js";

function geminiUrl(model) {
  const id = String(model || "gemini-flash-latest").trim();
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`;
}

function splitSystemMessage(messages) {
  const [first, ...rest] = Array.isArray(messages) ? messages : [];
  if (first?.role === "system") {
    return {
      systemText: String(first.content || ""),
      chatMessages: rest,
    };
  }
  return { systemText: "", chatMessages: Array.isArray(messages) ? messages : [] };
}

function geminiContentsFromMessages(messages) {
  return messages
    .filter((message) => message?.content)
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: String(message.content || "") }],
    }));
}

function textFromGeminiPayload(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part?.text || "").join("");
}

function imageDataFromDataUrl(imageData) {
  const raw = String(imageData || "");
  const match = raw.match(/^data:([^;,]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1] || "image/jpeg",
      data: match[2],
    };
  }
  return {
    mimeType: "image/jpeg",
    data: raw.replace(/^data:image\/\w+;base64,/, ""),
  };
}

export async function geminiChatText({ apiKey, model, messages }) {
  if (!apiKey) {
    return {
      ok: false,
      provider: "gemini",
      model,
      status: 503,
      detail: "GEMINI_API_KEY not configured",
      retryable: false,
    };
  }

  const { systemText, chatMessages } = splitSystemMessage(messages);
  const upstream = await fetch(geminiUrl(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      ...(systemText && { system_instruction: { parts: [{ text: systemText }] } }),
      contents: geminiContentsFromMessages(chatMessages),
    }),
  });

  if (!upstream.ok) {
    const detail = safeAiDetail(await upstream.text());
    return {
      ok: false,
      provider: "gemini",
      model,
      status: upstream.status,
      detail,
      retryable: shouldTryFallback(upstream.status),
    };
  }

  const payload = await upstream.json();
  return {
    ok: true,
    provider: "gemini",
    model,
    text: textFromGeminiPayload(payload),
  };
}

export async function geminiVisionText({
  apiKey,
  model,
  systemPrompt,
  prompt,
  imageData,
  responseMimeType,
  responseSchema,
}) {
  if (!apiKey) {
    return {
      ok: false,
      provider: "gemini",
      model,
      status: 503,
      detail: "GEMINI_API_KEY not configured",
      retryable: false,
    };
  }

  const image = imageDataFromDataUrl(imageData);
  const upstream = await fetch(geminiUrl(model), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: image.mimeType,
                data: image.data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: responseMimeType ? 256 : 768,
        ...(responseMimeType && { responseMimeType }),
        ...(responseSchema && { responseSchema }),
      },
    }),
  });

  if (!upstream.ok) {
    const detail = safeAiDetail(await upstream.text());
    return {
      ok: false,
      provider: "gemini",
      model,
      status: upstream.status,
      detail,
      retryable: shouldTryFallback(upstream.status),
    };
  }

  const payload = await upstream.json();
  return {
    ok: true,
    provider: "gemini",
    model,
    text: textFromGeminiPayload(payload),
  };
}
