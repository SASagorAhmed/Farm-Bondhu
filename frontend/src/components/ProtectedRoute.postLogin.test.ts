import { describe, expect, it } from "vitest";
import { getPostLoginPath } from "./ProtectedRoute";

describe("getPostLoginPath", () => {
  it("sends buyers to marketplace regardless of MediBondhu preference", () => {
    expect(getPostLoginPath({ primaryRole: "buyer", farmerOpenMedibondhu: true })).toBe("/marketplace");
    expect(getPostLoginPath({ primaryRole: "buyer", farmerOpenMedibondhu: false })).toBe("/marketplace");
  });

  it("routes care-only vet signup users to VetBondhu", () => {
    expect(
      getPostLoginPath({
        primaryRole: "farmer",
        farmerOpenMedibondhu: false,
        capabilities: ["can_book_vet"],
      })
    ).toBe("/vetbondhu");
  });

  it("routes vet practitioners to the vet dashboard even with VetBondhu patient access", () => {
    expect(
      getPostLoginPath({
        primaryRole: "vet",
        farmerOpenMedibondhu: false,
        capabilities: ["can_book_vet", "can_consult_as_vet"],
      })
    ).toBe("/vet/dashboard");
  });

  it("routes human doctors to the doctor dashboard before patient care capabilities", () => {
    expect(
      getPostLoginPath({
        primaryRole: "doctor",
        farmerOpenMedibondhu: true,
        capabilities: ["can_book_human", "can_practice_human"],
      })
    ).toBe("/medibondhu/doctor/dashboard");
  });

  it("routes care-only medi signup users to MediBondhu", () => {
    expect(
      getPostLoginPath({
        primaryRole: "farmer",
        farmerOpenMedibondhu: true,
        capabilities: ["can_book_human"],
      })
    ).toBe("/medibondhu");
  });

  it("respects farmer MediBondhu landing toggle", () => {
    expect(getPostLoginPath({ primaryRole: "farmer", farmerOpenMedibondhu: true })).toBe("/medibondhu");
    expect(getPostLoginPath({ primaryRole: "farmer", farmerOpenMedibondhu: false })).toBe("/dashboard");
  });

  it("sends vendors to seller dashboard", () => {
    expect(getPostLoginPath({ primaryRole: "vendor", farmerOpenMedibondhu: true })).toBe("/seller/dashboard");
  });
});
