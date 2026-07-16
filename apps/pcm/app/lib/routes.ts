export function isBareRoute(pathname: string) {
  return pathname === '/login' || pathname.startsWith('/auth');
}

export const dashboardRoutes = {
  overview: { href: "/dashboard", label: "Dashboard" },
  pulse: { href: "/dashboard/pulse", label: "Daily Pulse" },
  pipeline: { href: "/dashboard/pipeline", label: "CRM Pipeline" },
  journey: { href: "/dashboard/journey", label: "D-Journey" },
  tasks: { href: "/dashboard/tasks", label: "Tasks & Follow-ups" },
  meetings: { href: "/dashboard/meetings", label: "Heartlink Reports" },
} as const;

export const legacyDashboardRedirects: Record<string, string> = {
  "/": "/dashboard",
  "/watchlist": "/dashboard/pulse",
  "/pipeline": "/dashboard/pipeline",
  "/dashboard/djourney": "/dashboard/journey",
  "/followups": "/dashboard/tasks",
  "/reports/weekly": "/dashboard/meetings",
  "/members": "/dashboard/members",
};
