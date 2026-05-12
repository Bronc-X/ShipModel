export type RouteName =
  | "configure"
  | "concept"
  | "generating"
  | "download"
  | "failed"
  | "missing"
  | "files"
  | "settings"
  | "help"
  | "profile"
  | "history"
  | "storage"
  | "invite";

export interface RouteState {
  name: RouteName;
  runId?: string;
}

export const routePaths: Record<RouteName, string> = {
  configure: "/configure",
  concept: "/concept",
  generating: "/generate",
  download: "/download",
  failed: "/failed",
  missing: "/download",
  files: "/files",
  settings: "/settings",
  help: "/help",
  profile: "/profile",
  history: "/history",
  storage: "/storage",
  invite: "/invite"
};

export function parseRoute(pathname: string): RouteState {
  if (pathname === "/" || pathname === routePaths.configure) return { name: "configure" };
  if (pathname === routePaths.concept) return { name: "concept" };
  if (pathname === routePaths.generating) return { name: "generating" };

  const downloadMatch = /^\/download\/([^/]+)$/.exec(pathname);
  if (downloadMatch) return { name: "download", runId: decodeURIComponent(downloadMatch[1]) };
  if (pathname === routePaths.download) return { name: "download" };

  const failedMatch = /^\/failed\/([^/]+)$/.exec(pathname);
  if (failedMatch) return { name: "failed", runId: decodeURIComponent(failedMatch[1]) };
  if (pathname === routePaths.failed) return { name: "failed" };

  const utilityRoute = Object.entries(routePaths).find(
    ([name, path]) => path === pathname && !["download", "failed", "missing"].includes(name)
  );
  if (utilityRoute) return { name: utilityRoute[0] as RouteName };

  return { name: "configure" };
}
