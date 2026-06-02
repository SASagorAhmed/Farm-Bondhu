import { describe, expect, it } from "vitest";
import {
  filterNotificationsForUser,
  getNotificationPath,
  isNotificationForUser,
  type NotificationRow,
} from "@/lib/notificationHelpers";

function notification(id: string, userId: string): NotificationRow {
  return {
    id,
    user_id: userId,
    type: "order",
    context: "marketplace",
    priority: "normal",
    title: `Notification ${id}`,
    message: "Message",
    read: false,
    action_url: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("getNotificationPath", () => {
  it("routes VetBondhu before vet portal", () => {
    expect(getNotificationPath("/vetbondhu/consultations")).toBe("/vetbondhu/notifications");
    expect(getNotificationPath("/vetbondhu")).toBe("/vetbondhu/notifications");
  });

  it("routes vet portal paths separately", () => {
    expect(getNotificationPath("/vet/dashboard")).toBe("/vet/notifications");
    expect(getNotificationPath("/vet/consultations")).toBe("/vet/notifications");
  });

  it("routes MediBondhu workspace", () => {
    expect(getNotificationPath("/medibondhu/doctors")).toBe("/medibondhu/notifications");
  });

  it("routes marketplace and checkout flow paths", () => {
    expect(getNotificationPath("/marketplace")).toBe("/marketplace/notifications");
    expect(getNotificationPath("/marketplace/abc")).toBe("/marketplace/notifications");
    expect(getNotificationPath("/orders/abc")).toBe("/marketplace/notifications");
    expect(getNotificationPath("/cart")).toBe("/marketplace/notifications");
    expect(getNotificationPath("/checkout")).toBe("/marketplace/notifications");
  });

  it("routes seller workspace paths", () => {
    expect(getNotificationPath("/seller/orders")).toBe("/seller/notifications");
    expect(getNotificationPath("/my-shop")).toBe("/seller/notifications");
  });

  it("routes learning, community, and admin workspaces", () => {
    expect(getNotificationPath("/learning")).toBe("/learning/notifications");
    expect(getNotificationPath("/community/post/1")).toBe("/community/notifications");
    expect(getNotificationPath("/admin/platform")).toBe("/admin/notifications");
  });

  it("routes farm dashboard workspace", () => {
    expect(getNotificationPath("/dashboard/farms")).toBe("/dashboard/notifications");
  });

  it("falls back to farm dashboard for unknown paths", () => {
    expect(getNotificationPath("/unknown")).toBe("/dashboard/notifications");
  });
});

describe("notification privacy guards", () => {
  it("accepts only notifications owned by the active user", () => {
    const mine = notification("n-1", "user-a");
    const other = notification("n-2", "user-b");

    expect(isNotificationForUser(mine, "user-a")).toBe(true);
    expect(isNotificationForUser(other, "user-a")).toBe(false);
  });

  it("filters mixed notification rows to the active user", () => {
    const rows = [
      notification("n-1", "user-a"),
      notification("n-2", "user-b"),
      notification("n-3", "user-a"),
    ];

    expect(filterNotificationsForUser(rows, "user-a").map((row) => row.id)).toEqual(["n-1", "n-3"]);
  });

  it("returns no notifications without an active user id", () => {
    const rows = [notification("n-1", "user-a")];

    expect(filterNotificationsForUser(rows)).toEqual([]);
    expect(isNotificationForUser(rows[0])).toBe(false);
  });
});
