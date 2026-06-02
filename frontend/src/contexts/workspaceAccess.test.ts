import { describe, expect, it } from "vitest";
import { canAccessWorkspace, type UserRole } from "./auth-context";

function ctx(roles: UserRole[], capabilities: string[]) {
  return {
    hasRole: (role: UserRole) => roles.includes(role),
    hasCapability: (cap: string) => capabilities.includes(cap),
  };
}

describe("canAccessWorkspace", () => {
  it("hides farm/marketplace/medibondhu for VetBondhu patient caps", () => {
    const vetPatient = ctx(["farmer"], ["can_book_vet", "can_access_learning"]);
    expect(canAccessWorkspace("farm", vetPatient)).toBe(false);
    expect(canAccessWorkspace("marketplace", vetPatient)).toBe(false);
    expect(canAccessWorkspace("medibondhu", vetPatient)).toBe(false);
    expect(canAccessWorkspace("learning", vetPatient)).toBe(true);
    expect(canAccessWorkspace("community", vetPatient)).toBe(false);
    expect(canAccessWorkspace("vetbondhu", vetPatient)).toBe(true);
  });

  it("shows community when can_access_community is granted", () => {
    const user = ctx(["farmer"], ["can_access_community", "can_book_vet"]);
    expect(canAccessWorkspace("community", user)).toBe(true);
  });

  it("hides farm when can_manage_farm is paused despite farmer role", () => {
    const farmer = ctx(["farmer"], ["can_buy", "can_access_learning"]);
    expect(canAccessWorkspace("farm", farmer)).toBe(false);
  });

  it("shows farm when can_manage_farm is granted", () => {
    const farmer = ctx(["farmer"], ["can_manage_farm", "can_access_learning"]);
    expect(canAccessWorkspace("farm", farmer)).toBe(true);
  });

  it("shows marketplace for buyer with can_buy only", () => {
    const buyer = ctx(["buyer"], ["can_buy"]);
    expect(canAccessWorkspace("marketplace", buyer)).toBe(true);
  });

  it("shows marketplace for wholesale buyer with can_bulk_buy only", () => {
    const buyer = ctx(["buyer"], ["can_bulk_buy"]);
    expect(canAccessWorkspace("marketplace", buyer)).toBe(true);
  });

  it("hides learning when can_access_learning is not granted", () => {
    const farmer = ctx(["farmer"], ["can_manage_farm", "can_book_vet"]);
    expect(canAccessWorkspace("learning", farmer)).toBe(false);
  });

  it("shows vet panel for vet practitioners without granting patient VetBondhu automatically", () => {
    const vet = ctx(["vet"], ["can_consult_as_vet"]);
    expect(canAccessWorkspace("vet", vet)).toBe(true);
    expect(canAccessWorkspace("vetbondhu", vet)).toBe(false);
  });

  it("shows patient VetBondhu when can_book_vet is granted", () => {
    const vet = ctx(["vet"], ["can_consult_as_vet", "can_book_vet"]);
    expect(canAccessWorkspace("vet", vet)).toBe(true);
    expect(canAccessWorkspace("vetbondhu", vet)).toBe(true);
  });

  it("reflects vet-panel workspace toggles for sidebar candidates", () => {
    const vet = ctx(["vet"], [
      "can_consult_as_vet",
      "can_manage_farm",
      "can_buy",
      "can_book_vet",
      "can_book_human",
      "can_access_learning",
      "can_access_community",
    ]);

    expect(canAccessWorkspace("farm", vet)).toBe(true);
    expect(canAccessWorkspace("marketplace", vet)).toBe(true);
    expect(canAccessWorkspace("vetbondhu", vet)).toBe(true);
    expect(canAccessWorkspace("medibondhu", vet)).toBe(true);
    expect(canAccessWorkspace("learning", vet)).toBe(true);
    expect(canAccessWorkspace("community", vet)).toBe(true);
  });
});
