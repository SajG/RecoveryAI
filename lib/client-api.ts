export function apiPath(path: string): string {
  const normalized = path.trim().replace(/^\/+/, "");
  if (normalized.length === 0) {
    return "/api";
  }
  if (normalized.startsWith("api/")) {
    return `/${normalized}`;
  }
  return `/api/${normalized}`;
}
