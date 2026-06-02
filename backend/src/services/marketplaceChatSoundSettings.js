import sql from "../db.js";
import {
  DEFAULT_CHAT_SOUND_ID,
  getAllChatSoundIds,
  getPublicChatSoundCatalog,
  isValidChatSoundId,
  normalizeEnabledSoundIds,
  resolveChatSoundId,
  validateChatSoundSettings,
} from "./marketplaceChatSound.js";

const CHAT_SOUND_SETTINGS_KEY = "chat_sound";

let marketplaceSettingsTableReady = false;

export async function ensureMarketplaceSettingsTable() {
  if (marketplaceSettingsTableReady || !sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS public.marketplace_settings (
      key text PRIMARY KEY,
      value jsonb NOT NULL DEFAULT '{}'::jsonb,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid
    )
  `;
  marketplaceSettingsTableReady = true;
}

async function readChatSoundSettingsRow() {
  await ensureMarketplaceSettingsTable();
  const [row] = await sql`
    select value
    from marketplace_settings
    where key = ${CHAT_SOUND_SETTINGS_KEY}
    limit 1
  `;
  const value = row?.value && typeof row.value === "object" ? row.value : {};
  const enabledIds = normalizeEnabledSoundIds(value.enabled_ids);
  const defaultId = resolveChatSoundId(value.default_id, enabledIds);
  return { default_id: defaultId, enabled_ids: enabledIds };
}

export async function getChatSoundConfig() {
  const settings = await readChatSoundSettingsRow();
  return {
    default_id: settings.default_id,
    enabled_ids: settings.enabled_ids,
    catalog: getPublicChatSoundCatalog(),
  };
}

export async function updateChatSoundSettings({ defaultId, enabledIds, updatedBy }) {
  const validated = validateChatSoundSettings({ defaultId, enabledIds });
  if (validated.error) return validated;

  await ensureMarketplaceSettingsTable();
  await sql`
    insert into marketplace_settings (key, value, updated_at, updated_by)
    values (
      ${CHAT_SOUND_SETTINGS_KEY},
      ${sql.json({
        default_id: validated.value.default_id,
        enabled_ids: validated.value.enabled_ids,
      })},
      now(),
      ${updatedBy || null}
    )
    on conflict (key) do update set
      value = excluded.value,
      updated_at = now(),
      updated_by = excluded.updated_by
  `;

  return { value: validated.value };
}

export async function getUserChatSoundPreference(userId) {
  const config = await getChatSoundConfig();
  if (!userId) {
    return { sound_id: config.default_id, default_id: config.default_id, enabled_ids: config.enabled_ids };
  }

  const [profile] = await sql`
    select chat_notification_sound_id
    from profiles
    where id = ${userId}
    limit 1
  `;

  const soundId = resolveChatSoundId(profile?.chat_notification_sound_id, getAllChatSoundIds());
  return {
    sound_id: soundId,
    default_id: config.default_id,
    enabled_ids: config.enabled_ids,
  };
}

export async function updateUserChatSoundPreference(userId, soundId) {
  if (!isValidChatSoundId(soundId)) {
    return { error: "Invalid sound id" };
  }

  await sql`
    update profiles
    set chat_notification_sound_id = ${soundId}, updated_at = now()
    where id = ${userId}
  `;

  return { value: { sound_id: soundId } };
}

export { DEFAULT_CHAT_SOUND_ID, getAllChatSoundIds, isValidChatSoundId };
