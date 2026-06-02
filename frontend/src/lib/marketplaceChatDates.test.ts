import { describe, expect, it } from "vitest";
import {
  formatChatThreadDateLabel,
  groupMessagesByDate,
  toLocalDateKey,
} from "@/lib/marketplaceChatDates";

const labels = { today: "Today", yesterday: "Yesterday" };

describe("marketplaceChatDates", () => {
  it("toLocalDateKey uses local calendar day", () => {
    const now = new Date("2026-05-24T22:00:00");
    expect(toLocalDateKey("2026-05-24T10:00:00Z", now)).toMatch(/^2026-05-2[34]$/);
  });

  it("groupMessagesByDate groups consecutive same-day messages", () => {
    const groups = groupMessagesByDate([
      { id: "a", created_at: "2026-05-23T10:00:00Z" },
      { id: "b", created_at: "2026-05-23T11:00:00Z" },
      { id: "c", created_at: "2026-05-24T09:00:00Z" },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].messages.map((m) => m.id)).toEqual(["a", "b"]);
    expect(groups[1].messages.map((m) => m.id)).toEqual(["c"]);
  });

  it("formatChatThreadDateLabel returns Today and Yesterday", () => {
    const now = new Date("2026-05-24T12:00:00");
    expect(formatChatThreadDateLabel("2026-05-24", labels, now)).toBe("Today");
    expect(formatChatThreadDateLabel("2026-05-23", labels, now)).toBe("Yesterday");
    expect(formatChatThreadDateLabel("2026-05-20", labels, now)).toBe("20 May 2026");
  });
});
