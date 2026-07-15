import { describe, expect, it } from "vitest";
import { dashboardRoutes, legacyDashboardRedirects } from "./routes";

describe("dashboard routes", () => {
  it("keeps navigation on canonical dashboard URLs", () => {
    expect(dashboardRoutes.pipeline.href).toBe("/dashboard/pipeline");
    expect(dashboardRoutes.meetings.href).toBe("/dashboard/meetings");
    expect(legacyDashboardRedirects["/pipeline"]).toBe("/dashboard/pipeline");
  });
});
