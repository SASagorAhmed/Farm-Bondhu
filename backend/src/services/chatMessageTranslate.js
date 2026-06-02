import { defaultChatModelId } from "./openrouterChatModels.js";

const SYSTEM_PROMPT = `You translate marketplace chat messages for FarmBondhu (Bangladesh farmers and buyers).
Rules:
- Output ONLY the translated message text. No quotes, labels, or explanations.
- Translate into the requested target language (English or Bengali/Bangla script).
- Fix informal spelling, Romanized Bangla (Banglish), typos, and shorthand while keeping the meaning.
- Source text may be in any language (e.g. Bangla, English, French, Hindi). Always output in the target language only.
- Preserve numbers, prices, product names, and URLs when appropriate.`;

/**
 * @param {string} text
 * @param {"en" | "bn"} targetLang
 */
export async function translateChatMessageText(text, targetLang) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error("OPENROUTER_API_KEY not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const targetLabel = targetLang === "bn" ? "Bengali (Bangla script)" : "English";
  const model = defaultChatModelId();

  const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.API_PUBLIC_URL || "http://localhost:3001",
      "X-Title": "FarmBondhu Chat Translate",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Target language: ${targetLabel}\n\nMessage:\n${text}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 512,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    const err = new Error(`AI upstream error (${upstream.status})`);
    err.detail = detail.slice(0, 500);
    throw err;
  }

  const body = await upstream.json();
  const translated = String(body?.choices?.[0]?.message?.content || "").trim();
  if (!translated) {
    throw new Error("Empty translation from AI");
  }
  return translated;
}

/**
 * @param {import("postgres").Sql} sql
 * @param {string} messageId
 * @param {"en" | "bn"} targetLang
 * @param {string} original
 */
export async function getOrCreateChatTranslation(sql, messageId, targetLang, original) {
  const [cached] = await sql`
    select translated_text, source_lang
    from chat_message_translations
    where message_id = ${messageId} and target_lang = ${targetLang}
    limit 1
  `;
  if (cached?.translated_text) {
    return {
      original,
      translated: cached.translated_text,
      target_lang: targetLang,
      cached: true,
    };
  }

  const translated = await translateChatMessageText(original, targetLang);
  await sql`
    insert into chat_message_translations ${sql({
      message_id: messageId,
      target_lang: targetLang,
      translated_text: translated,
      source_lang: null,
    })}
    on conflict (message_id, target_lang) do update set
      translated_text = excluded.translated_text,
      created_at = now()
  `;

  return {
    original,
    translated,
    target_lang: targetLang,
    cached: false,
  };
}
