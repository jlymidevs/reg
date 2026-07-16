import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from "vitest";
import { dashboardRoutes, legacyDashboardRedirects, isBareRoute } from "./routes";

const appDirectory = fileURLToPath(new URL('../', import.meta.url));

function pageForRoute(route: string) {
  return `${appDirectory}${route === '/' ? 'page.tsx' : `${route.slice(1)}/page.tsx`}`;
}

describe("dashboard routes", () => {
  it("keeps navigation on canonical dashboard URLs", () => {
    expect(dashboardRoutes.pipeline.href).toBe("/dashboard/pipeline");
    expect(dashboardRoutes.meetings.href).toBe("/dashboard/meetings");
    expect(legacyDashboardRedirects["/pipeline"]).toBe("/dashboard/pipeline");
  });

  it('keeps core pages canonical and legacy URLs as server redirects', () => {
    const canonicalRoutes = [
      '/dashboard',
      '/dashboard/pulse',
      '/dashboard/pipeline',
      '/dashboard/journey',
      '/dashboard/tasks',
      '/dashboard/members',
      '/dashboard/attendance',
    ];
    const legacyRoutes = {
      '/': '/dashboard',
      '/watchlist': '/dashboard/pulse',
      '/pipeline': '/dashboard/pipeline',
      '/dashboard/djourney': '/dashboard/journey',
      '/followups': '/dashboard/tasks',
      '/members': '/dashboard/members',
      '/reports/weekly': '/dashboard/meetings',
    };

    for (const route of canonicalRoutes) {
      expect(existsSync(pageForRoute(route))).toBe(true);
    }

    expect(legacyDashboardRedirects).toEqual(expect.objectContaining(legacyRoutes));
    for (const [route, target] of Object.entries(legacyRoutes)) {
      expect(readFileSync(pageForRoute(route), 'utf8')).toContain(`redirect('${target}')`);
    }

    expect(readFileSync(pageForRoute('/dashboard/meetings'), 'utf8')).not.toContain('href="/reports/weekly"');
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
