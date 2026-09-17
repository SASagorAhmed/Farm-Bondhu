/**
 * Meet-style screen-share audio: harden getDisplayMedia constraints while a
 * consultation room is active so Zego (and any other caller) requests tab/system
 * audio like Google Meet.
 */

const PATCH_FLAG = "__farmbondhuMeetScreenAudio";

type DisplayMediaAudioConstraints = MediaTrackConstraints & {
  suppressLocalAudioPlayback?: boolean;
};

/** Extended Chrome/Edge options beyond the base DisplayMediaStreamOptions type. */
export type MeetLikeDisplayMediaOptions = DisplayMediaStreamOptions & {
  systemAudio?: "include" | "exclude";
  windowAudio?: "system" | "window" | "exclude";
};

export function isFirefoxLikeUa(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return /firefox|fxios/i.test(ua);
}

/** Clear system/tab audio — disable mic-oriented processing (Meet-style). */
export const MEET_LIKE_SCREEN_AUDIO: DisplayMediaAudioConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  suppressLocalAudioPlayback: false,
};

/**
 * Merge caller constraints with Meet-like screen-audio defaults.
 * Firefox/FxIOS keep audio off (getDisplayMedia audio is unsupported / rejected).
 */
export function mergeMeetLikeDisplayMediaConstraints(
  constraints?: DisplayMediaStreamOptions | undefined,
  ua?: string
): MeetLikeDisplayMediaOptions {
  const base = { ...(constraints || {}) } as MeetLikeDisplayMediaOptions;
  const firefox = isFirefoxLikeUa(ua);

  if (firefox || base.audio === false) {
    return {
      ...base,
      audio: false,
      systemAudio: "include",
      windowAudio: "system",
    };
  }

  const audio: DisplayMediaAudioConstraints =
    typeof base.audio === "object" && base.audio !== null
      ? { ...MEET_LIKE_SCREEN_AUDIO, ...base.audio }
      : { ...MEET_LIKE_SCREEN_AUDIO };

  return {
    ...base,
    audio,
    systemAudio: "include",
    windowAudio: "system",
  };
}

type PatchedMediaDevices = MediaDevices & {
  [PATCH_FLAG]?: boolean;
  __farmbondhuMeetScreenAudioOrig?: MediaDevices["getDisplayMedia"];
};

/**
 * Install a scoped getDisplayMedia wrapper. Returns uninstall (idempotent).
 * Safe to call multiple times; only the first install patches until matching uninstalls.
 */
export function installMeetLikeScreenShareAudio(): () => void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return () => {};
  }

  const md = navigator.mediaDevices as PatchedMediaDevices;
  if (md[PATCH_FLAG]) {
    return () => {};
  }

  const original = md.getDisplayMedia.bind(md);
  md.__farmbondhuMeetScreenAudioOrig = original;
  md[PATCH_FLAG] = true;

  md.getDisplayMedia = ((constraints?: DisplayMediaStreamOptions) => {
    return original(mergeMeetLikeDisplayMediaConstraints(constraints));
  }) as MediaDevices["getDisplayMedia"];

  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    if (md.__farmbondhuMeetScreenAudioOrig) {
      md.getDisplayMedia = md.__farmbondhuMeetScreenAudioOrig;
      delete md.__farmbondhuMeetScreenAudioOrig;
    }
    delete md[PATCH_FLAG];
  };
}

/** Short in-room guidance for Meet-style share audio. */
export const SCREEN_SHARE_AUDIO_HELP =
  "For screen audio (Meet-style): use Chrome/Edge, share a tab or entire screen, and keep Share audio checked in the browser dialog.";

export const SCREEN_SHARE_AUDIO_ERROR =
  "Screen sharing with audio needs Chrome/Edge on desktop. Share a tab or entire screen and keep Share audio checked.";
