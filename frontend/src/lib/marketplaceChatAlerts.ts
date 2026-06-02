import { toast } from "sonner";
import {
  DEFAULT_CHAT_SOUND_ID,
  getChatSoundUrl,
  resolveUserChatSoundId,
} from "@/lib/marketplaceChatSounds";
import {
  fetchChatSoundConfig,
  fetchChatSoundPreference,
} from "@/lib/marketplaceChatSoundApi";

const NOTIFICATION_GAIN = 0.7;
const HTML_NOTIFICATION_VOLUME = 0.85;
const STORAGE_ENABLED = "farmbondhu_chat_sound_enabled";
const STORAGE_DISMISSED_UNTIL = "farmbondhu_chat_sound_dismissed_until";
const DISMISS_DAYS = 7;
const SOUND_STATE_EVENT = "farmbondhu-chat-sound-state";

let audioContext: AudioContext | null = null;
let notificationBuffer: AudioBuffer | null = null;
let bufferLoadStarted = false;
let bufferLoadUrl = "";
let pendingSound = false;
let notificationPermissionRequested = false;
let blockedToastShown = false;
let htmlNotificationAudio: HTMLAudioElement | null = null;
let htmlNotificationAudioUrl = "";
let lastSoundPlayedAt = 0;
const recentSoundDedupeKeys = new Set<string>();
const SOUND_DEBOUNCE_MS = 1000;

const CONVO_DEDUPE_KEY_RE = /^(?:convo|poll)-([0-9a-f-]{36})(?:-|$)/i;

function conversationDedupeKey(debounceKey: string): string | null {
  const match = debounceKey.match(CONVO_DEDUPE_KEY_RE);
  return match ? `convo-${match[1]}` : null;
}

function shouldSkipDuplicateSound(debounceKey: string): boolean {
  const now = Date.now();
  if (now - lastSoundPlayedAt >= SOUND_DEBOUNCE_MS) {
    recentSoundDedupeKeys.clear();
  }

  const keys = [debounceKey];
  const convoKey = conversationDedupeKey(debounceKey);
  if (convoKey) keys.push(convoKey);

  for (const key of keys) {
    if (recentSoundDedupeKeys.has(key)) return true;
  }

  for (const key of keys) {
    recentSoundDedupeKeys.add(key);
  }
  lastSoundPlayedAt = now;
  return false;
}

let activeSoundId = DEFAULT_CHAT_SOUND_ID;
let enabledSoundIds: string[] | null = null;
let defaultSoundId = DEFAULT_CHAT_SOUND_ID;
let soundPreferenceLoaded = false;
let soundPreferenceLoadPromise: Promise<void> | null = null;

export type ChatSoundState = "needsEnable" | "ready";

export type ChatSoundLabels = {
  enableToast?: string;
  enableButton?: string;
  openSettingsButton?: string;
  testOk?: string;
};

function getChatSoundSettingsPath(): string {
  if (typeof window === "undefined") return "/marketplace/settings";
  return window.location.pathname.startsWith("/seller") ? "/seller/settings" : "/marketplace/settings";
}

function dispatchSoundStateChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SOUND_STATE_EVENT));
}

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  return new Ctx();
}

function getAudioContext(): AudioContext | null {
  return audioContext;
}

export function getActiveChatSoundId(): string {
  return activeSoundId;
}

export function getEnabledChatSoundIds(): string[] {
  return enabledSoundIds || [];
}

function getActiveChatSoundUrl(): string {
  return getChatSoundUrl(activeSoundId);
}

function resetSoundAssets(): void {
  notificationBuffer = null;
  bufferLoadStarted = false;
  bufferLoadUrl = "";
  htmlNotificationAudio = null;
  htmlNotificationAudioUrl = "";
}

export function setUserChatSoundId(id: string): void {
  const next = resolveUserChatSoundId(id);
  if (next === activeSoundId) return;
  activeSoundId = next;
  resetSoundAssets();
  dispatchSoundStateChange();
}

export async function loadChatSoundPreference(force = false): Promise<void> {
  if (soundPreferenceLoaded && !force) return;
  if (soundPreferenceLoadPromise && !force) {
    await soundPreferenceLoadPromise;
    return;
  }

  soundPreferenceLoadPromise = (async () => {
    try {
      const config = await fetchChatSoundConfig().catch(() => null);
      if (config) {
        enabledSoundIds = config.enabled_ids;
        defaultSoundId = config.default_id;
      }

      let preferred = defaultSoundId;
      try {
        const preference = await fetchChatSoundPreference();
        preferred = preference?.sound_id || defaultSoundId;
      } catch {
        // anonymous or transient auth errors — use platform default
      }

      const next = resolveUserChatSoundId(preferred);
      if (next !== activeSoundId) {
        activeSoundId = next;
        resetSoundAssets();
      }
      soundPreferenceLoaded = true;
      dispatchSoundStateChange();
    } catch {
      activeSoundId = resolveUserChatSoundId(activeSoundId);
    } finally {
      soundPreferenceLoadPromise = null;
    }
  })();

  await soundPreferenceLoadPromise;
}

export function isSoundEnabledInStorage(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_ENABLED) === "1";
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const until = Number(localStorage.getItem(STORAGE_DISMISSED_UNTIL) || "0");
  return until > Date.now();
}

export function dismissChatSoundPrompt(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_DISMISSED_UNTIL,
    String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
  );
  dispatchSoundStateChange();
}

export function subscribeChatSoundState(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(SOUND_STATE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(SOUND_STATE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getChatSoundState(): ChatSoundState {
  if (typeof window === "undefined") return "needsEnable";
  if (!isSoundEnabledInStorage()) return "needsEnable";
  return "ready";
}

async function ensureAudioContextRunning(): Promise<boolean> {
  if (!isSoundEnabledInStorage()) return false;

  if (!audioContext) {
    audioContext = createAudioContext();
  }
  const ctx = audioContext;
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }

  if (ctx.state === "running") {
    void preloadNotificationBuffer(getActiveChatSoundUrl());
  }

  return ctx.state === "running";
}

function playBufferSound(ctx: AudioContext, buffer: AudioBuffer, gainValue: number): void {
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = gainValue;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

function getHtmlNotificationAudio(url: string): HTMLAudioElement {
  if (!htmlNotificationAudio || htmlNotificationAudioUrl !== url) {
    htmlNotificationAudio = new Audio(url);
    htmlNotificationAudioUrl = url;
    htmlNotificationAudio.preload = "auto";
    htmlNotificationAudio.volume = HTML_NOTIFICATION_VOLUME;
  }
  return htmlNotificationAudio;
}

async function primeHtmlNotificationAudio(url: string): Promise<boolean> {
  const audio = getHtmlNotificationAudio(url);
  try {
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    return true;
  } catch {
    return false;
  }
}

async function playHtmlNotificationSound(url: string): Promise<boolean> {
  try {
    const audio = getHtmlNotificationAudio(url);
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    try {
      const fallback = new Audio(url);
      fallback.volume = HTML_NOTIFICATION_VOLUME;
      await fallback.play();
      return true;
    } catch {
      return false;
    }
  }
}

function playWebNotificationTone(url: string): boolean {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return false;
  if (!notificationBuffer || bufferLoadUrl !== url) return false;

  try {
    playBufferSound(ctx, notificationBuffer, NOTIFICATION_GAIN);
    return true;
  } catch {
    return false;
  }
}

async function playSoundById(soundId: string, debounceKey?: string, bypassEnabledCheck = false): Promise<void> {
  if (!bypassEnabledCheck && !isSoundEnabledInStorage()) {
    pendingSound = true;
    dispatchSoundStateChange();
    return;
  }

  const url = getChatSoundUrl(soundId);
  const key = debounceKey || soundId;
  if (!bypassEnabledCheck && shouldSkipDuplicateSound(key)) return;

  pendingSound = false;

  if (bypassEnabledCheck) {
    await playHtmlNotificationSound(url);
    return;
  }

  const running = await ensureAudioContextRunning();
  if (running) {
    await preloadNotificationBuffer(url);
    if (playWebNotificationTone(url)) return;
  }

  await playHtmlNotificationSound(url);
}

async function playIncomingSound(debounceKey?: string): Promise<void> {
  await playSoundById(activeSoundId, debounceKey, false);
}

export async function previewChatSound(soundId: string): Promise<void> {
  recentSoundDedupeKeys.clear();
  lastSoundPlayedAt = 0;
  await playSoundById(soundId, `preview-${soundId}`, true);
}

export async function testChatSound(): Promise<boolean> {
  if (!isSoundEnabledInStorage()) {
    const ok = await enableChatSound({ playTest: false, requestNotifications: false });
    if (!ok) return false;
  }

  recentSoundDedupeKeys.clear();
  lastSoundPlayedAt = 0;
  await playIncomingSound("test");
  return true;
}

async function preloadNotificationBuffer(url: string): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx || ctx.state !== "running") return;
  if (notificationBuffer && bufferLoadUrl === url) return;
  if (bufferLoadStarted && bufferLoadUrl === url) return;

  if (bufferLoadUrl !== url) {
    notificationBuffer = null;
    bufferLoadStarted = false;
  }

  bufferLoadStarted = true;
  bufferLoadUrl = url;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      notificationBuffer = null;
      bufferLoadStarted = false;
      return;
    }
    const data = await res.arrayBuffer();
    notificationBuffer = await ctx.decodeAudioData(data.slice(0));
  } catch {
    notificationBuffer = null;
    bufferLoadStarted = false;
  }
}

export function consumePendingSound(): void {
  if (!pendingSound || !isSoundEnabledInStorage()) return;
  void playIncomingSound();
}

async function requestBrowserNotificationPermission(force = false): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "default") return;
  if (notificationPermissionRequested && !force) return;
  notificationPermissionRequested = true;
  try {
    await Notification.requestPermission();
  } catch {
    // ignore
  }
}

export type EnableChatSoundOptions = {
  requestNotifications?: boolean;
  playTest?: boolean;
  labels?: ChatSoundLabels;
};

export async function enableChatSound(options: EnableChatSoundOptions = {}): Promise<boolean> {
  const { requestNotifications = true, playTest = true, labels } = options;

  if (!audioContext) {
    audioContext = createAudioContext();
  }
  const ctx = audioContext;
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }

  if (ctx.state !== "running") return false;

  localStorage.setItem(STORAGE_ENABLED, "1");
  localStorage.removeItem(STORAGE_DISMISSED_UNTIL);
  blockedToastShown = false;

  const url = getActiveChatSoundUrl();
  await primeHtmlNotificationAudio(url);
  await preloadNotificationBuffer(url);

  if (playTest) {
    lastSoundPlayedAt = 0;
    await playIncomingSound();
  } else {
    consumePendingSound();
  }
  dispatchSoundStateChange();

  if (requestNotifications) {
    await requestBrowserNotificationPermission(true);
  }

  if (playTest && labels?.testOk) {
    toast.success(labels.testOk);
  }

  return true;
}

export function disableChatSound(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_ENABLED);
  pendingSound = false;
  blockedToastShown = false;
  resetSoundAssets();
  if (audioContext) {
    void audioContext.close().catch(() => {});
    audioContext = null;
  }
  dispatchSoundStateChange();
}

export function playChatMessageSound(debounceKey?: string): void {
  void playIncomingSound(debounceKey);
}

export function showSoundEnableActionToast(labels?: ChatSoundLabels): void {
  if (isSoundEnabledInStorage()) return;
  if (blockedToastShown) return;
  blockedToastShown = true;

  toast(labels?.enableToast || "New message — enable sounds in Settings to hear a ping", {
    duration: 8000,
    action: {
      label: labels?.openSettingsButton || labels?.enableButton || "Open settings",
      onClick: () => {
        window.location.assign(getChatSoundSettingsPath());
      },
    },
  });
}

export function showChatToast(
  title: string,
  body: string,
  onClick?: () => void,
  actionLabel = "Open"
): void {
  toast(title, {
    description: body,
    duration: 5000,
    onClick: () => {
      onClick?.();
    },
    action: onClick
      ? {
          label: actionLabel,
          onClick: () => onClick(),
        }
      : undefined,
  });
}

async function ensureNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (notificationPermissionRequested) return Notification.permission;
  notificationPermissionRequested = true;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function showChatBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void
): Promise<void> {
  if (typeof document !== "undefined" && !document.hidden) return;
  const permission = await ensureNotificationPermission();
  if (permission !== "granted") return;

  try {
    const notification = new Notification(title, {
      body,
      icon: "/favicon.ico",
      silent: false,
      tag: `farmbondhu-chat-${Date.now()}`,
    });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  } catch {
    // ignore notification failures
  }
}

export type IncomingChatAlertOptions = {
  title: string;
  body: string;
  onNavigate?: () => void;
  soundLabels?: ChatSoundLabels;
  openMessageLabel?: string;
  suppressToast?: boolean;
  soundDebounceKey?: string;
};

export function notifyIncomingChatMessage(opts: IncomingChatAlertOptions): void {
  if (!opts.suppressToast) {
    if (isSoundEnabledInStorage()) {
      void playIncomingSound(opts.soundDebounceKey);
    } else {
      pendingSound = true;
    }
  }

  if (opts.suppressToast) return;

  if (typeof document !== "undefined" && document.hidden) {
    void showChatBrowserNotification(opts.title, opts.body, opts.onNavigate);
  } else {
    if (!isSoundEnabledInStorage()) {
      showSoundEnableActionToast(opts.soundLabels);
    }
    showChatToast(opts.title, opts.body, opts.onNavigate, opts.openMessageLabel || "Open");
  }
}

export function shouldShowChatSoundPrompt(): boolean {
  if (isSoundEnabledInStorage()) return false;
  if (pendingSound) return true;
  return !isDismissed();
}

export function setupChatAudioUnlock(): () => void {
  const unlock = () => {
    if (!isSoundEnabledInStorage()) return;
    void ensureAudioContextRunning().then((running) => {
      if (running && pendingSound) consumePendingSound();
    });
  };

  document.addEventListener("click", unlock, { passive: true });
  document.addEventListener("keydown", unlock, { passive: true });
  document.addEventListener("touchstart", unlock, { passive: true });

  const onVisible = () => {
    if (document.visibilityState === "visible" && isSoundEnabledInStorage()) {
      void ensureAudioContextRunning().then((running) => {
        if (running && pendingSound) consumePendingSound();
      });
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    document.removeEventListener("click", unlock);
    document.removeEventListener("keydown", unlock);
    document.removeEventListener("touchstart", unlock);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function unlockChatAudio(): void {
  void enableChatSound({ playTest: false, requestNotifications: false });
}

export async function ensureAudioReady(): Promise<boolean> {
  if (!isSoundEnabledInStorage()) return false;
  return ensureAudioContextRunning();
}
