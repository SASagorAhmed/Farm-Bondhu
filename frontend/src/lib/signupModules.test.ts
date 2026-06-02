import { describe, expect, it } from "vitest";
import {
  inferModuleFromPath,
  postSignupRouteForModule,
  resolveSignupModuleFromQuery,
} from "@/lib/signupModules";

describe("signupModules", () => {
  it("infers module from app paths", () => {
    expect(inferModuleFromPath("/vetbondhu/doctors")).toBe("vetbondhu");
    expect(inferModuleFromPath("/medibondhu")).toBe("medibondhu");
    expect(inferModuleFromPath("/marketplace/123")).toBe("marketplace");
    expect(inferModuleFromPath("/dashboard/farms")).toBe("farm");
    expect(inferModuleFromPath("/seller/dashboard")).toBe("vendor");
    expect(inferModuleFromPath("/vet/profile")).toBe("vet");
  });

  it("resolves module from query and state", () => {
    expect(resolveSignupModuleFromQuery("?module=vetbondhu")).toBe("vetbondhu");
    expect(resolveSignupModuleFromQuery("", "medibondhu")).toBe("medibondhu");
    expect(resolveSignupModuleFromQuery("?module=invalid")).toBeNull();
  });

  it("maps modules to post-signup routes", () => {
    expect(postSignupRouteForModule("vetbondhu")).toBe("/vetbondhu");
    expect(postSignupRouteForModule("marketplace")).toBe("/marketplace");
    expect(postSignupRouteForModule("farm")).toBe("/dashboard");
    expect(postSignupRouteForModule("vendor")).toBe("/seller/onboarding");
  });
});
