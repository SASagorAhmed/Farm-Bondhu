import { apiJson } from "@/api/client";

export type ChatSoundCatalogItem = {
  id: string;
  labelEn: string;
  labelBn: string;
};

export type ChatSoundConfig = {
  default_id: string;
  enabled_ids: string[];
  catalog: ChatSoundCatalogItem[];
};

export type ChatSoundPreference = {
  sound_id: string;
  default_id?: string;
  enabled_ids?: string[];
};

export async function fetchChatSoundConfig(): Promise<ChatSoundConfig> {
  const { res, body } = await apiJson("/v1/marketplace/chat/sound-config");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load sound config"));
  return (body as { data: ChatSoundConfig }).data;
}

export async function fetchChatSoundPreference(): Promise<ChatSoundPreference> {
  const { res, body } = await apiJson("/v1/marketplace/chat/sound-preference");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load sound preference"));
  return (body as { data: ChatSoundPreference }).data;
}

export async function updateChatSoundPreference(soundId: string): Promise<ChatSoundPreference> {
  const { res, body } = await apiJson("/v1/marketplace/chat/sound-preference", {
    method: "PATCH",
    body: JSON.stringify({ sound_id: soundId }),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to save sound preference"));
  return (body as { data: ChatSoundPreference }).data;
}

export async function fetchAdminChatSoundSettings(): Promise<ChatSoundConfig> {
  const { res, body } = await apiJson("/v1/marketplace/admin/chat-sound");
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to load chat sound settings"));
  return (body as { data: ChatSoundConfig }).data;
}

export async function updateAdminChatSoundSettings(payload: {
  default_id?: string;
  enabled_ids?: string[];
}): Promise<{ default_id: string; enabled_ids: string[] }> {
  const { res, body } = await apiJson("/v1/marketplace/admin/chat-sound", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(String((body as { error?: string }).error || "Failed to save chat sound settings"));
  return (body as { data: { default_id: string; enabled_ids: string[] } }).data;
}
