import { describe, expect, it } from "vitest";
import {
  isMediDoctorPortalPath,
  isMediPatientCarePathForAdminPreview,
  mediDoctorPortalDashboardPath,
} from "./medibondhuRoutes";

describe("medibondhuRoutes", () => {
  it("recognizes doctor portal paths", () => {
    expect(isMediDoctorPortalPath("/medibondhu/doctor/dashboard")).toBe(true);
    expect(isMediDoctorPortalPath("/medibondhu/doctor/rx/new")).toBe(true);
    expect(isMediDoctorPortalPath("/medibondhu/doctor/abc-uuid")).toBe(false);
  });

  it("flags patient-care paths for admin preview redirect", () => {
    expect(isMediPatientCarePathForAdminPreview("/medibondhu")).toBe(true);
    expect(isMediPatientCarePathForAdminPreview("/medibondhu/doctors")).toBe(true);
    expect(isMediPatientCarePathForAdminPreview("/medibondhu/doctor/dashboard")).toBe(false);
    expect(isMediPatientCarePathForAdminPreview("/medibondhu/profile")).toBe(false);
    expect(isMediPatientCarePathForAdminPreview("/medibondhu/support/chat/1")).toBe(false);
  });

  it("exposes doctor dashboard path", () => {
    expect(mediDoctorPortalDashboardPath()).toBe("/medibondhu/doctor/dashboard");
  });
});
