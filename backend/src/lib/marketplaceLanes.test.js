import test from "node:test";
import assert from "node:assert/strict";
import {
  laneForProductCategory,
  validateSellerOnboardingBody,
  isValidMarketplaceLane,
  LICENSE_REQUIRED_LANES,
} from "./marketplaceLanes.js";

test("isValidMarketplaceLane accepts all six lanes", () => {
  for (const lane of ["medibondhu", "vetbondhu", "farm", "pet", "livestock_dairy", "farm_machinery"]) {
    assert.equal(isValidMarketplaceLane(lane), true);
  }
  assert.equal(isValidMarketplaceLane("pharmacy"), false);
});

test("laneForProductCategory maps slugs to lanes", () => {
  assert.equal(laneForProductCategory("medicine"), "medibondhu");
  assert.equal(laneForProductCategory("animal_medicine"), "vetbondhu");
  assert.equal(laneForProductCategory("fertilizer"), "farm");
  assert.equal(laneForProductCategory("pet_food"), "pet");
  assert.equal(laneForProductCategory("eggs"), "livestock_dairy");
  assert.equal(laneForProductCategory("farm_machines"), "farm_machinery");
  assert.equal(laneForProductCategory("unknown"), null);
});

test("validateSellerOnboardingBody requires at least one lane", () => {
  const result = validateSellerOnboardingBody({
    business_name: "Test Shop",
    phone: "01700000000",
    location: "Dhaka",
    lanes: [],
  });
  assert.equal(result.error, "Select at least one marketplace category");
});

test("validateSellerOnboardingBody requires license for regulated lanes", () => {
  const result = validateSellerOnboardingBody({
    business_name: "Test Shop",
    phone: "01700000000",
    location: "Dhaka",
    lanes: [{ lane: "medibondhu", license_number: "", license_file_url: "" }],
  });
  assert.match(result.error || "", /License number required/);
});

test("validateSellerOnboardingBody accepts farm lane without license", () => {
  const result = validateSellerOnboardingBody({
    business_name: "Test Shop",
    phone: "01700000000",
    location: "Dhaka",
    lanes: [{ lane: "farm" }],
  });
  assert.ok(result.value);
  assert.equal(result.value.lanes.length, 1);
  assert.equal(result.value.lanes[0].lane, "farm");
});

test("LICENSE_REQUIRED_LANES includes medibondhu vetbondhu farm_machinery", () => {
  assert.ok(LICENSE_REQUIRED_LANES.has("medibondhu"));
  assert.ok(LICENSE_REQUIRED_LANES.has("vetbondhu"));
  assert.ok(LICENSE_REQUIRED_LANES.has("farm_machinery"));
  assert.equal(LICENSE_REQUIRED_LANES.has("farm"), false);
});
