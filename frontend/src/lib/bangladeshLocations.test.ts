import { describe, expect, it } from "vitest";
import {
  getDistricts,
  getDivisions,
  getUpazilas,
  resetAfterDivisionChange,
  validateAddressHierarchy,
  createEmptyAddressForm,
} from "./bangladeshLocations";
import { isValidBangladeshMobile } from "./bangladeshPhone";

describe("bangladeshLocations", () => {
  it("returns 8 divisions", () => {
    expect(getDivisions()).toHaveLength(8);
  });

  it("returns districts under Dhaka division", () => {
    const dhaka = getDivisions().find((d) => d.name === "Dhaka");
    expect(dhaka).toBeTruthy();
    const districts = getDistricts(dhaka!.id);
    expect(districts.some((d) => d.name === "Gazipur")).toBe(true);
    expect(districts).toHaveLength(13);
  });

  it("blocks invalid district under wrong division", () => {
    const dhaka = getDivisions().find((d) => d.name === "Dhaka")!;
    const sylhet = getDivisions().find((d) => d.name === "Sylhet")!;
    const sylhetDistricts = getDistricts(sylhet.id);
    const sylhetDist = sylhetDistricts.find((d) => d.name === "Sylhet");
    expect(sylhetDist).toBeTruthy();
    expect(
      validateAddressHierarchy({
        country: "Bangladesh",
        divisionId: dhaka.id,
        districtId: sylhetDist!.id,
        upazilaId: "",
      })
    ).toBe(false);
  });

  it("resets dependent fields when division changes", () => {
    const dhaka = getDivisions().find((d) => d.name === "Dhaka")!;
    const gazipur = getDistricts(dhaka.id).find((d) => d.name === "Gazipur")!;
    const upazilas = getUpazilas(dhaka.id, gazipur!.id);
    const form = createEmptyAddressForm({
      divisionId: dhaka.id,
      districtId: gazipur!.id,
      upazilaId: upazilas[0]?.id || "",
      area: "Jamalpur",
    });
    const next = resetAfterDivisionChange(form, getDivisions().find((d) => d.name === "Sylhet")!.id);
    expect(next.districtId).toBe("");
    expect(next.upazilaId).toBe("");
    expect(next.area).toBe("");
  });
});

describe("bangladeshPhone", () => {
  it("validates BD mobile numbers", () => {
    expect(isValidBangladeshMobile("01712345678")).toBe(true);
    expect(isValidBangladeshMobile("1712345678")).toBe(false);
    expect(isValidBangladeshMobile("02123456789")).toBe(false);
  });
});
