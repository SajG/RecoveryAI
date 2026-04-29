export function apiPath(path: string): string {
  const normalized = path.replace(/^\/+/, "");
  if (normalized.startsWith("api/")) {
    return normalized;
  }
  return `api/${normalized}`;
}
