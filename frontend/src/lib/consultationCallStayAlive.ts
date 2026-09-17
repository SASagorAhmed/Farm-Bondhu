/**
 * Keep consultation calls alive across phone minimize / PC tab switch.
 * Never destroy a live Zego session just to "rejoin". Soft recover only when already dead.
 */

export const SOFT_REJOIN_DEBOUNCE_MS = 2000;
export const PAGE_HIDDEN_RECENT_MS = 15_000;

export type IntentionalLeaveKind = "end" | "navigate_away" | null;

export type SoftRejoinDecisionInput = {
  intentional: IntentionalLeaveKind;
  hasFinalized: boolean;
  /** True when zegoInstanceRef still holds a live instance. */
  instanceAlive: boolean;
  /** True when SDK has reported a successful join and not yet cleared. */
  hasJoined: boolean;
  reconnectInFlight: boolean;
  documentHidden: boolean;
  /** ms since last visibility hidden; null if never hidden this session. */
  msSinceHidden: number | null;
  now?: number;
  lastSoftRejoinAt?: number | null;
};

export type SoftRejoinDecision =
  | { action: "ignore" }
  | { action: "pause_navigate" }
  | { action: "complete_end" }
  | { action: "soft_rejoin" };

export function createIntentionalLeaveGate() {
  let kind: IntentionalLeaveKind = null;
  return {
    markEnd() {
      kind = "end";
    },
    markNavigateAway() {
      kind = "navigate_away";
    },
    isIntentional() {
      return kind !== null;
    },
    kind() {
      return kind;
    },
    reset() {
      kind = null;
    },
  };
}

export type IntentionalLeaveGate = ReturnType<typeof createIntentionalLeaveGate>;

/**
 * Decide what to do after Zego onLeaveRoom or a visibility recover check.
 * Prefer keep: never soft-rejoin when instance is still alive.
 */
export function decideCallStayAlive(input: SoftRejoinDecisionInput): SoftRejoinDecision {
  if (input.hasFinalized) return { action: "ignore" };

  if (input.intentional === "end") return { action: "complete_end" };
  if (input.intentional === "navigate_away") return { action: "pause_navigate" };

  // Ambient: never tear down a live call to rejoin.
  if (input.instanceAlive && input.hasJoined) return { action: "ignore" };
  if (input.instanceAlive) return { action: "ignore" };

  if (input.reconnectInFlight) return { action: "ignore" };
  if (input.documentHidden) return { action: "ignore" };

  const now = input.now ?? Date.now();
  if (
    typeof input.lastSoftRejoinAt === "number" &&
    now - input.lastSoftRejoinAt < SOFT_REJOIN_DEBOUNCE_MS
  ) {
    return { action: "ignore" };
  }

  // Soft recover only when instance already dead.
  return { action: "soft_rejoin" };
}

/** True when page was hidden recently (minimize / tab switch). */
export function wasPageHiddenRecently(msSinceHidden: number | null, windowMs = PAGE_HIDDEN_RECENT_MS): boolean {
  if (msSinceHidden == null) return false;
  return msSinceHidden >= 0 && msSinceHidden <= windowMs;
}

export type WakeLockHandle = { release: () => Promise<void> };

/** Best-effort screen wake lock while a call is active. */
export async function requestCallWakeLock(): Promise<WakeLockHandle | null> {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const wakeLock = (nav as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void>; addEventListener?: Function }> } })
      ?.wakeLock;
    if (!wakeLock?.request) return null;
    const sentinel = await wakeLock.request("screen");
    return {
      release: async () => {
        try {
          await sentinel.release();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return null;
  }
}

export function createSoftRejoinFlight() {
  let inFlight = false;
  let lastAt: number | null = null;
  return {
    get inFlight() {
      return inFlight;
    },
    get lastAt() {
      return lastAt;
    },
    tryBegin(now = Date.now()): boolean {
      if (inFlight) return false;
      if (lastAt != null && now - lastAt < SOFT_REJOIN_DEBOUNCE_MS) return false;
      inFlight = true;
      lastAt = now;
      return true;
    },
    end() {
      inFlight = false;
    },
  };
}

export type SoftRejoinFlight = ReturnType<typeof createSoftRejoinFlight>;
