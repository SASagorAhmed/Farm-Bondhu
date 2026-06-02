import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSignupCarePath,
  normalizeSignupModule,
  resolveSignupModuleFromMeta,
  signupCarePathConfig,
  signupModuleConfig,
} from "./ensureAppUser.js";

test("normalizeSignupCarePath accepts vetbondhu and medibondhu", () => {
  assert.equal(normalizeSignupCarePath("vetbondhu"), "vetbondhu");
  assert.equal(normalizeSignupCarePath("MediBondhu"), "medibondhu");
  assert.equal(normalizeSignupCarePath("farmer"), null);
  assert.equal(normalizeSignupCarePath(""), null);
});

test("normalizeSignupModule accepts all module keys", () => {
  assert.equal(normalizeSignupModule("vetbondhu"), "vetbondhu");
  assert.equal(normalizeSignupModule("marketplace"), "marketplace");
  assert.equal(normalizeSignupModule("farm"), "farm");
  assert.equal(normalizeSignupModule("invalid"), null);
});

test("resolveSignupModuleFromMeta prefers signup_module then care path", () => {
  assert.equal(resolveSignupModuleFromMeta({ signup_module: "marketplace" }), "marketplace");
  assert.equal(resolveSignupModuleFromMeta({ signup_care_path: "vetbondhu" }), "vetbondhu");
  assert.equal(resolveSignupModuleFromMeta({ primary_role: "buyer" }), "marketplace");
});

test("signupModuleConfig scopes vetbondhu to module-only caps", () => {
  const vet = signupModuleConfig("vetbondhu");
  assert.equal(vet.primaryRole, "farmer");
  assert.equal(vet.farmerOpenMedibondhu, false);
  assert.deepEqual(vet.enable, ["can_book_vet", "can_access_learning"]);
  assert.ok(vet.disable.includes("can_buy"));
  assert.ok(vet.disable.includes("can_manage_farm"));
  assert.ok(vet.disable.includes("can_book_human"));
  assert.ok(!vet.disable.includes("can_access_learning"));
});

test("signupModuleConfig scopes medibondhu to module-only caps", () => {
  const medi = signupModuleConfig("medibondhu");
  assert.equal(medi.primaryRole, "farmer");
  assert.equal(medi.farmerOpenMedibondhu, true);
  assert.deepEqual(medi.enable, ["can_book_human"]);
  assert.ok(medi.disable.includes("can_buy"));
  assert.ok(medi.disable.includes("can_book_vet"));
  assert.ok(!medi.disable.includes("can_book_human"));
});

test("signupModuleConfig marketplace buyer enables can_buy only", () => {
  const mp = signupModuleConfig("marketplace");
  assert.equal(mp.primaryRole, "buyer");
  assert.deepEqual(mp.enable, ["can_buy"]);
  assert.deepEqual(mp.disable, ["can_book_human", "can_bulk_buy"]);
});

test("signupCarePathConfig remains compatible with care modules", () => {
  const vet = signupCarePathConfig("vetbondhu");
  assert.ok(vet.disable.includes("can_buy"));
  assert.ok(!vet.disable.includes("can_access_learning"));
  assert.deepEqual(vet.enable, ["can_book_vet", "can_access_learning"]);

  assert.equal(signupCarePathConfig("buyer"), null);
});
