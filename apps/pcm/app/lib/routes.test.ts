import { describe, expect, it } from "vitest";
import { dashboardRoutes, legacyDashboardRedirects, isBareRoute } from "./routes";

describe("dashboard routes", () => {
  it("keeps navigation on canonical dashboard URLs", () => {
    expect(dashboardRoutes.pipeline.href).toBe("/dashboard/pipeline");
    expect(dashboardRoutes.meetings.href).toBe("/dashboard/meetings");
    expect(legacyDashboardRedirects["/pipeline"]).toBe("/dashboard/pipeline");
  });
});

describe('isBareRoute', () => {
  it('marks auth surfaces as bare', () => {
    expect(isBareRoute('/login')).toBe(true);
    expect(isBareRoute('/auth/callback')).toBe(true);
  });

  it('keeps app routes inside shell', () => {
    expect(isBareRoute('/')).toBe(false);
    expect(isBareRoute('/members')).toBe(false);
  });
});
