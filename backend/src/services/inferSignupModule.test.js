import test from "node:test";
import assert from "node:assert/strict";
import { inferSignupModuleFromAccess } from "./inferSignupModule.js";

test("inferSignupModuleFromAccess prefers stored module", () => {
  assert.equal(inferSignupModuleFromAccess("farm", ["farmer"], ["can_book_vet"]), "farm");
});

test("inferSignupModuleFromAccess detects vetbondhu care-only patient", () => {
  assert.equal(
    inferSignupModuleFromAccess(undefined, ["farmer"], ["can_book_vet"]),
    "vetbondhu",
  );
});

test("inferSignupModuleFromAccess detects medibondhu care-only patient", () => {
  assert.equal(
    inferSignupModuleFromAccess(undefined, ["farmer"], ["can_book_human"]),
    "medibondhu",
  );
});

test("inferSignupModuleFromAccess does not infer vetbondhu for full farmers", () => {
  assert.equal(
    inferSignupModuleFromAccess(undefined, ["farmer"], ["can_book_vet", "can_manage_farm"]),
    undefined,
  );
});

test("inferSignupModuleFromAccess reconciles stale medibondhu when user has farm access", () => {
  assert.equal(
    inferSignupModuleFromAccess("medibondhu", ["farmer"], ["can_book_human", "can_manage_farm"]),
    "farm",
  );
});

test("inferSignupModuleFromAccess reconciles stale vetbondhu when user has farm access", () => {
  assert.equal(
    inferSignupModuleFromAccess("vetbondhu", ["farmer"], ["can_book_vet", "can_manage_farm"]),
    "farm",
  );
});

test("inferSignupModuleFromAccess keeps true medibondhu patient without farm access", () => {
  assert.equal(
    inferSignupModuleFromAccess("medibondhu", ["farmer"], ["can_book_human"]),
    "medibondhu",
  );
});
