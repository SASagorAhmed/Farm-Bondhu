import { describe, expect, it, beforeEach } from "vitest";
import {
  getChatAlertAck,
  isChatAlertAlreadyAcked,
  readChatAlertAckMap,
  seedChatAlertAcksForReadRows,
  setChatAlertAck,
  writeChatAlertAckMap,
} from "@/lib/marketplaceChatAlertAck";

const UID = "user-a";
const CONVO = "convo-1";

describe("marketplaceChatAlertAck", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("stores and reads ack per conversation", () => {
    setChatAlertAck(UID, CONVO, "2026-05-01T12:00:00Z");
    expect(getChatAlertAck(UID, CONVO)).toBe("2026-05-01T12:00:00Z");
    expect(isChatAlertAlreadyAcked(UID, CONVO, "2026-05-01T12:00:00Z")).toBe(true);
    expect(isChatAlertAlreadyAcked(UID, CONVO, "2026-05-01T13:00:00Z")).toBe(false);
  });

  it("seeds ack for read inbox rows", () => {
    seedChatAlertAcksForReadRows(UID, [
      { id: CONVO, last_message_at: "2026-05-01T12:00:00Z", has_unread: false },
      { id: "convo-2", last_message_at: "2026-05-01T11:00:00Z", has_unread: true },
    ]);
    expect(getChatAlertAck(UID, CONVO)).toBe("2026-05-01T12:00:00Z");
    expect(getChatAlertAck(UID, "convo-2")).toBeUndefined();
  });

  it("merges with existing map", () => {
    writeChatAlertAckMap(UID, { other: "2026-01-01T00:00:00Z" });
    setChatAlertAck(UID, CONVO, "2026-05-01T12:00:00Z");
    const map = readChatAlertAckMap(UID);
    expect(map.other).toBe("2026-01-01T00:00:00Z");
    expect(map[CONVO]).toBe("2026-05-01T12:00:00Z");
  });
});
