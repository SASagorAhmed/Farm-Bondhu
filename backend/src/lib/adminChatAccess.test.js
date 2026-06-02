import test from "node:test";
import assert from "node:assert/strict";
import { adminMayReadConversation } from "./adminChatAccess.js";

test("participant may always read", () => {
  assert.equal(
    adminMayReadConversation({
      isParticipant: true,
      isAdmin: false,
      isPlatformSupport: false,
      hasModerationReport: false,
    }),
    true
  );
});

test("admin without report cannot read private marketplace thread", () => {
  assert.equal(
    adminMayReadConversation({
      isParticipant: false,
      isAdmin: true,
      isPlatformSupport: false,
      hasModerationReport: false,
    }),
    false
  );
});

test("admin with report may read marketplace thread", () => {
  assert.equal(
    adminMayReadConversation({
      isParticipant: false,
      isAdmin: true,
      isPlatformSupport: false,
      hasModerationReport: true,
    }),
    true
  );
});

test("admin may read platform support without report", () => {
  assert.equal(
    adminMayReadConversation({
      isParticipant: false,
      isAdmin: true,
      isPlatformSupport: true,
      hasModerationReport: false,
    }),
    true
  );
});

test("non-admin non-participant denied", () => {
  assert.equal(
    adminMayReadConversation({
      isParticipant: false,
      isAdmin: false,
      isPlatformSupport: false,
      hasModerationReport: true,
    }),
    false
  );
});
