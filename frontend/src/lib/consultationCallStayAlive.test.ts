import { describe, expect, it } from "vitest";
import {
  createIntentionalLeaveGate,
  createSoftRejoinFlight,
  decideCallStayAlive,
  SOFT_REJOIN_DEBOUNCE_MS,
  wasPageHiddenRecently,
} from "./consultationCallStayAlive";

describe("createIntentionalLeaveGate", () => {
  it("tracks end and navigate_away separately", () => {
    const gate = createIntentionalLeaveGate();
    expect(gate.isIntentional()).toBe(false);
    gate.markEnd();
    expect(gate.kind()).toBe("end");
    gate.reset();
    gate.markNavigateAway();
    expect(gate.kind()).toBe("navigate_away");
  });
});

describe("decideCallStayAlive", () => {
  const base = {
    intentional: null as const,
    hasFinalized: false,
    instanceAlive: false,
    hasJoined: false,
    reconnectInFlight: false,
    documentHidden: false,
    msSinceHidden: null,
    lastSoftRejoinAt: null,
  };

  it("never soft-rejoins when instance is still alive", () => {
    expect(
      decideCallStayAlive({ ...base, instanceAlive: true, hasJoined: true })
    ).toEqual({ action: "ignore" });
    expect(decideCallStayAlive({ ...base, instanceAlive: true, hasJoined: false })).toEqual({
      action: "ignore",
    });
  });

  it("soft-rejoins only when instance already dead (ambient)", () => {
    expect(decideCallStayAlive({ ...base })).toEqual({ action: "soft_rejoin" });
  });

  it("ignores ambient leave while document is hidden (minimize/tab)", () => {
    expect(decideCallStayAlive({ ...base, documentHidden: true })).toEqual({ action: "ignore" });
  });

  it("ignores when reconnect already in flight or debounced", () => {
    expect(decideCallStayAlive({ ...base, reconnectInFlight: true })).toEqual({ action: "ignore" });
    expect(
      decideCallStayAlive({
        ...base,
        lastSoftRejoinAt: Date.now(),
        now: Date.now() + SOFT_REJOIN_DEBOUNCE_MS - 100,
      })
    ).toEqual({ action: "ignore" });
  });

  it("routes intentional end and navigate away", () => {
    expect(decideCallStayAlive({ ...base, intentional: "end" })).toEqual({ action: "complete_end" });
    expect(decideCallStayAlive({ ...base, intentional: "navigate_away" })).toEqual({
      action: "pause_navigate",
    });
  });

  it("ignores when finalized", () => {
    expect(decideCallStayAlive({ ...base, hasFinalized: true })).toEqual({ action: "ignore" });
  });
});

describe("createSoftRejoinFlight", () => {
  it("allows only one in-flight begin and respects debounce", () => {
    const flight = createSoftRejoinFlight();
    expect(flight.tryBegin(1000)).toBe(true);
    expect(flight.tryBegin(1100)).toBe(false);
    flight.end();
    expect(flight.tryBegin(1000 + SOFT_REJOIN_DEBOUNCE_MS - 1)).toBe(false);
    expect(flight.tryBegin(1000 + SOFT_REJOIN_DEBOUNCE_MS)).toBe(true);
  });
});

describe("wasPageHiddenRecently", () => {
  it("detects recent hide window", () => {
    expect(wasPageHiddenRecently(500)).toBe(true);
    expect(wasPageHiddenRecently(null)).toBe(false);
    expect(wasPageHiddenRecently(60_000)).toBe(false);
  });
});
