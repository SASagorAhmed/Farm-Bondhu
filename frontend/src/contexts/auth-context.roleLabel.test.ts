import { describe, expect, it } from "vitest";
import {
  formatUserRoleLabel,
  getUserRoleBadgeClass,
  resolveEffectiveSignupModule,
} from "@/contexts/auth-context";

describe("formatUserRoleLabel", () => {
  it("shows Vet Patient for vetbondhu signup module", () => {
    expect(
      formatUserRoleLabel({ primaryRole: "farmer", signupModule: "vetbondhu" }),
    ).toBe("Vet Patient");
  });

  it("shows Medi Patient for medibondhu signup module", () => {
    expect(
      formatUserRoleLabel({ primaryRole: "farmer", signupModule: "medibondhu" }),
    ).toBe("Medi Patient");
  });

  it("shows Farmer for farm signup module", () => {
    expect(formatUserRoleLabel({ primaryRole: "farmer", signupModule: "farm" })).toBe("Farmer");
  });

  it("infers Vet Patient from care-only capabilities when signupModule is missing", () => {
    expect(
      formatUserRoleLabel({
        primaryRole: "farmer",
        roles: ["farmer"],
        capabilities: ["can_book_vet"],
      }),
    ).toBe("Vet Patient");
  });

  it("infers Medi Patient from care-only capabilities when signupModule is missing", () => {
    expect(
      formatUserRoleLabel({
        primaryRole: "farmer",
        roles: ["farmer"],
        capabilities: ["can_book_human"],
      }),
    ).toBe("Medi Patient");
  });

  it("still shows Farmer when user has full farm access", () => {
    expect(
      formatUserRoleLabel({
        primaryRole: "farmer",
        roles: ["farmer"],
        capabilities: ["can_book_vet", "can_manage_farm"],
      }),
    ).toBe("Farmer");
  });

  it("shows Farmer when stale medibondhu module but user has farm access", () => {
    expect(
      formatUserRoleLabel({
        primaryRole: "farmer",
        signupModule: "medibondhu",
        roles: ["farmer"],
        capabilities: ["can_book_human", "can_manage_farm"],
      }),
    ).toBe("Farmer");
  });

  it("still shows Medi Patient for true care-only medibondhu signup", () => {
    expect(
      formatUserRoleLabel({
        primaryRole: "farmer",
        signupModule: "medibondhu",
        roles: ["farmer"],
        capabilities: ["can_book_human"],
      }),
    ).toBe("Medi Patient");
  });
});

describe("resolveEffectiveSignupModule", () => {
  it("prefers stored signupModule over inference", () => {
    expect(
      resolveEffectiveSignupModule({
        primaryRole: "farmer",
        signupModule: "farm",
        roles: ["farmer"],
        capabilities: ["can_book_vet"],
      }),
    ).toBe("farm");
  });

  it("reconciles stale medibondhu to farm when can_manage_farm is present", () => {
    expect(
      resolveEffectiveSignupModule({
        primaryRole: "farmer",
        signupModule: "medibondhu",
        roles: ["farmer"],
        capabilities: ["can_book_human", "can_manage_farm"],
      }),
    ).toBe("farm");
  });
});

describe("getUserRoleBadgeClass", () => {
  it("uses emerald styling for vetbondhu patients", () => {
    expect(getUserRoleBadgeClass({ primaryRole: "farmer", signupModule: "vetbondhu" })).toContain("emerald");
  });

  it("uses emerald styling for inferred vetbondhu patients", () => {
    expect(
      getUserRoleBadgeClass({
        primaryRole: "farmer",
        roles: ["farmer"],
        capabilities: ["can_book_vet"],
      }),
    ).toContain("emerald");
  });
});
